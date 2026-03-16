# Infrastructure Redesign Handoff — Oracle, Keeper, Indexer

## Context for Fresh Chat

The V2 robustness upgrade is **deployed and live** on paxeer-network. The key change that drives this redesign: the new **KeeperMulticallFacet** (`executeCycle()`) replaces the old pattern of separate `batchUpdatePrices()` + `syncToOracle()` + `updateFundingRate()` + `executeOrder()` + `liquidate()` calls. Everything now happens in **one atomic transaction every ~10 seconds**.

### What Changed On-Chain

- **Diamond**: `0xeA65FE02665852c615774A3041DFE6f00fb77537` on Paxeer (chain 125)
- **KeeperMulticallFacet** at `0x4fEB3D865D743c88BE2C4f1b623e4946E9Cb19f5` — 2 functions:
  - `executeCycle(marketIds[], prices[], orderIds[], liquidationIds[])` — full pipeline
  - `executePriceCycle(marketIds[], prices[])` — lightweight price-only update
- **TradingAccount** at `0x2B96C3E5e184C919311dFcbE4753d0214e5255B3` — new events: `MarginLocked`, `MarginReleased`, `LedgerEntryRecorded`, `DelegateAdded`, `DelegateRemoved`, `MarginModeChanged`, `MarginTransferred`
- **New events from facets**: `KeeperCycleExecuted`, `OrderExecutionFailed`, `LiquidationFailed`, `RobustnessParamsUpdated`
- **TP/SL order types**: `ORDER_TYPE_TAKE_PROFIT=2`, `ORDER_TYPE_STOP_LOSS=3` (new in OrderBookFacet)
- **New PositionFacet functions**: `removeCollateral`, `partialClose` has min-remaining-size guard
- **New MarketRegistryFacet functions**: `setRobustnessParams`, `getRobustnessParams`

---

## Current Architecture (What Exists — Pre-Redesign)

### `.oracle/` — Oracle Node
- **Role**: Fetches prices from Pyth (crypto) + Orderly (stocks/indices/commodities), submits to `OracleFacet.batchUpdatePrices()`
- **Structure**: `index.js` (main loop) → `pyth-fetcher.js`, `orderly-fetcher.js` (price sources) → `submitter.js` (on-chain tx)
- **Interval**: 5 seconds
- **Problem**: Only pushes prices. Doesn't do any keeper work. Separate process from keeper.

### `.keeper/` — Keeper Bot
- **Role**: Listens for `PricesUpdated` events, then runs: vAMM sync → order execution → liquidation scan
- **Structure**: `index.js` (event-driven loop) → `vamm-syncer.js`, `order-scanner.js`, `liquidation-scanner.js` → `executor.js` (tx submission)
- **Problem**: Reactive (waits for oracle events). Each action is a separate transaction. Race conditions between oracle and keeper. Only knows LIMIT + STOP_LIMIT orders (not TP/SL).

### `.indexer/` — Event Indexer + GraphQL
- **Role**: Scans blocks for Diamond events, stores in PostgreSQL, serves GraphQL API
- **Structure**: `index.js` (block poller) → `scanner.js` (event decoder + DB writer) → `graphql/` (Apollo server)
- **Problem**: Doesn't know about new events (KeeperCycleExecuted, TradingAccount events, TP/SL orders). No WebSocket subscriptions. No real-time price streaming.

---

## Proposed Architecture (Redesign)

### Core Insight: Merge Oracle + Keeper into One Process

The `KeeperMulticallFacet.executeCycle()` does everything in one tx. There is no reason to have separate oracle and keeper processes anymore. One process fetches prices, scans for triggered orders and liquidatable positions, then submits everything in a single atomic call.

### New `.perps-engine/` — Unified Oracle+Keeper

Replaces both `.oracle/` and `.keeper/`.

```
.perps-engine/
├── index.js                    # Main loop (10-second cycle)
├── config.js                   # Markets, RPC, keys, thresholds
├── package.json
├── .env
├── src/
│   ├── price-sources/
│   │   ├── pyth-fetcher.js     # Reuse from .oracle (works fine)
│   │   └── orderly-fetcher.js  # Reuse from .oracle (works fine)
│   ├── scanners/
│   │   ├── order-scanner.js    # Updated: TP/SL support, reads from indexer GraphQL
│   │   └── liquidation-scanner.js  # Updated: funding-aware margin calc
│   ├── cycle-builder.js        # Assembles the executeCycle() calldata
│   ├── submitter.js            # Submits executeCycle() or executePriceCycle()
│   ├── state-cache.js          # In-memory cache of positions, orders, prices
│   ├── health-monitor.js       # Self-diagnostics, alerts, balance check
│   └── logger.js
└── logs/
```

**Main loop** (every 10 seconds):
1. Fetch prices from Pyth + Orderly in parallel
2. Query indexer GraphQL for active orders + open positions (cached, refreshed every 30s)
3. Off-chain trigger check: which orders are triggered at the new prices?
4. Off-chain liquidation check: which positions are underwater at the new prices?
5. Build `executeCycle(marketIds, prices, triggeredOrderIds, liquidatablePositionIds)`
6. Submit single tx
7. If no orders/liquidations, use lightweight `executePriceCycle(marketIds, prices)` instead

**Key changes from current oracle+keeper:**
- **One process, one tx, one wallet** — no coordination between oracle and keeper
- **Requires ORACLE_POSTER_ROLE only** (the multicall facet checks this role)
- **TP/SL order types** — scanner needs to handle orderType 2 and 3 (close orders)
- **Funding-aware liquidation** — margin calc must include pending funding (matches the on-chain `checkLiquidatable` fix)
- **Soft failures** — if one order or liquidation fails on-chain, the rest still execute (multicall handles this)
- **Cycle metrics** — `KeeperCycleExecuted` event gives back `ordersExecuted`, `liquidationsExecuted`, `ordersFailed`, `liquidationsFailed`

**What to reuse from existing code:**
- `pyth-fetcher.js` — works perfectly, copy as-is
- `orderly-fetcher.js` — works perfectly, copy as-is
- `config.js` market definitions — merge oracle + keeper configs
- `liquidation-scanner.js` margin math — update to include pending funding
- `order-scanner.js` trigger logic — add TP/SL cases
- `logger.js` — either one works

**What to delete:**
- `.oracle/src/submitter.js` — replaced by new submitter that calls `executeCycle`
- `.keeper/src/vamm-syncer.js` — vAMM sync is now inside the multicall
- `.keeper/src/executor.js` — no more individual `executeOrder()` / `liquidate()` / `syncToOracle()` calls
- `.keeper/src/event-listener.js` — no more event-driven architecture
- `.keeper/src/state-cache.js` — rewrite to use indexer GraphQL as primary data source

### New `.indexer/` — Updated Indexer

The indexer structure is solid. It needs incremental updates, not a rewrite.

**Changes needed:**

1. **New event handlers in `scanner.js`:**
   - `KeeperCycleExecuted` → insert into `keeper_cycles` table (timestamp, markets_updated, orders_executed, liquidations_executed, failed counts)
   - `OrderExecutionFailed` → update order status to "failed" with reason
   - `LiquidationFailed` → insert into protocol_events
   - `RobustnessParamsUpdated` → update config table
   - `MarginLocked` / `MarginReleased` → insert into `trading_account_events` table
   - `LedgerEntryRecorded` → insert into `account_ledger` table
   - `DelegateAdded` / `DelegateRemoved` → insert into `delegates` table
   - `MarginModeChanged` → update user_vaults table
   - `MarginTransferred` → insert into `trading_account_events`

2. **New DB tables (migration):**
   ```sql
   keeper_cycles (id, timestamp, markets_updated, orders_executed, liquidations_executed, orders_failed, liquidations_failed, block_number, tx_hash)
   account_ledger (id, entry_id, user_address, entry_type, token, amount, position_id, is_debit, block_number, tx_hash, timestamp)
   delegates (id, user_address, delegate_address, can_trade, can_withdraw, can_modify_margin, expiry, is_active, block_number, tx_hash, timestamp)
   trading_account_events (id, event_type, user_address, position_id, token, amount, block_number, tx_hash, timestamp)
   ```

3. **Updated GraphQL schema:**
   - `KeeperCycle` type + `keeperCycles` query
   - `AccountLedgerEntry` type + `accountLedger(userAddress, positionId, limit, offset)` query
   - `Delegate` type + `delegates(userAddress)` query
   - `TradingAccountEvent` type + query
   - Update `Order` type to include `orderType` names: "limit", "stop_limit", "take_profit", "stop_loss"
   - Add `orderType` filter to `orders()` query
   - Add WebSocket subscription for real-time price updates (optional but high-value)

4. **Update ABI in `abi.js`:**
   - Add all new events from KeeperMulticallFacet, TradingAccount, MarketRegistryFacet
   - Add TP/SL order type constants

5. **Performance:**
   - The indexer should handle the `KeeperCycleExecuted` event (emitted every 10 seconds) without falling behind
   - Consider adding a materialized view for `keeper_cycle_stats` (avg orders/cycle, avg liquidations/cycle)

---

## File Inventory

### Files to read in fresh chat:

**Contracts (for ABI + event signatures):**
- `contracts/diamond/facets/core/KeeperMulticallFacet.sol` — new multicall ABI
- `contracts/diamond/interfaces/ITradingAccount.sol` — new TradingAccount events
- `contracts/diamond/libraries/LibEvents.sol` — all event definitions
- `contracts/diamond/facets/trading/OrderBookFacet.sol` — TP/SL order types
- `contracts/diamond/facets/support/MarketRegistryFacet.sol` — RobustnessParamsUpdated event

**Current infra (to understand what exists):**
- `.oracle/config.js` — market definitions, Pyth/Orderly config
- `.oracle/src/pyth-fetcher.js` — reuse as-is
- `.oracle/src/orderly-fetcher.js` — reuse as-is
- `.keeper/src/order-scanner.js` — update for TP/SL
- `.keeper/src/liquidation-scanner.js` — update for funding-aware margin
- `.indexer/src/scanner.js` — add new event handlers
- `.indexer/src/db/models.js` — add new DB models
- `.indexer/src/db/migrate.js` — add new migration
- `.indexer/src/graphql/schema.js` — add new types + queries
- `.indexer/src/graphql/resolvers.js` — add new resolvers
- `.indexer/perpetual.graphql` — update

**Deployment info:**
- `deployments/paxeer-network.json` — Diamond address, all facet addresses

### Files to create:
- `.perps-engine/` — entire new directory (replaces `.oracle/` + `.keeper/`)
- `.indexer/src/db/migrations/002-v2-robustness.sql` — new tables
- Updated event handlers in `.indexer/src/scanner.js`
- Updated GraphQL schema + resolvers

### Files to eventually delete (after migration):
- `.oracle/` — entire directory (replaced by `.perps-engine/`)
- `.keeper/` — entire directory (replaced by `.perps-engine/`)

---

## Deployment Config

| Key | Value |
|---|---|
| Network | Paxeer (chain 125) |
| RPC | `https://public-rpc.paxeer.app/rpc` |
| Diamond | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| KeeperMulticallFacet | `0x4fEB3D865D743c88BE2C4f1b623e4946E9Cb19f5` |
| TradingAccount impl | `0x2B96C3E5e184C919311dFcbE4753d0214e5255B3` |
| Markets | BTC(0), ETH(1), SOL(2), AVAX(3), LINK(4), TSLA(5), NVDA(6), NAS100(7), XAU(8), SPX500(9), GOOGL(10) |
| Cycle interval | 10 seconds |
| Required role | ORACLE_POSTER_ROLE for executeCycle() |
| Gas | <1 cent, 95% subsidized by network |

---

## Priority Order

1. **`.perps-engine/`** — Build the unified oracle+keeper first. This is what runs every 10 seconds and keeps the protocol alive.
2. **`.indexer/` updates** — Add new event handlers + DB tables + GraphQL schema. The indexer is already running; these are incremental additions.
3. **Delete `.oracle/` and `.keeper/`** — Only after `.perps-engine/` is tested and running in production.

---

## Open Questions for Andrew

1. Should the `.perps-engine/` run as a single process or should we keep a hot standby (two instances, one active, one watching)?
2. Should the indexer add WebSocket subscriptions for real-time price streaming to the frontend?
3. Any alerting preferences? (Slack webhook, PagerDuty, Telegram bot for critical failures)
