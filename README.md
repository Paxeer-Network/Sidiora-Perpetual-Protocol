<p align="center">
  <img src="https://img.shields.io/badge/Solidity-%5E0.8.27-363636?style=for-the-badge&logo=solidity&logoColor=white" alt="Solidity" />
  <img src="https://img.shields.io/badge/EIP--2535-Diamond%20Pattern-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white" alt="Diamond" />
  <img src="https://img.shields.io/badge/Chain-Paxeer%20(125)-00B4D8?style=for-the-badge" alt="Paxeer" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Status-Deployed-brightgreen?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Dependencies-Zero-orange?style=for-the-badge" alt="Zero Deps" />
</p>

<h1 align="center">Sidiora Perpetual Protocol</h1>

<p align="center">
  <strong>Synthetic perpetual futures. Any asset. Up to 1000x leverage. One diamond address.</strong>
</p>

## 1. System Overview

A synthetic perpetual futures protocol supporting RWA assets, crypto, stocks, and indexes. Traders open leveraged long/short positions (up to 1000x) collateralized by stablecoins held in per-user on-chain vaults. A central liquidity vault acts as counterparty to all trades. Pricing combines a custom oracle (batch-posted external prices), a Virtual AMM (on-chain mark price), and TWAP smoothing.

**The entire protocol lives behind a single Diamond proxy address.** The only contracts deployed separately are per-user `UserVault` clones.

### Design Influences

| Protocol | What We Borrow | What We Change |
|----------|---------------|----------------|
| GMX v2 | Central vault as counterparty, oracle-based pricing | Add per-user vault isolation, vAMM impact pricing |
| Gains Network | Synthetic perps, multi-asset support | Replace single-vault model with user vault + central vault split |
| dYdX v3 | Off-chain order matching for limits/stops | Keep order storage on-chain, only execution triggered off-chain |
| Perpetual Protocol v2 | vAMM concept for mark price | Oracle-anchored vAMM that re-centers every minute (not free-floating) |
| Nick Mudge EIP-2535 | Diamond standard | Implemented from scratch — no diamond library dependencies |

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER / FRONTEND                                 │
└──────────────────────┬───────────────────────────────────┬───────────────────┘
                       │ (write txs)                       │ (read/simulate)
                       ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                         PERP DIAMOND (single address)                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        DIAMOND CORE FACETS                              │ │
│  │  DiamondCutFacet · DiamondLoupeFacet · OwnershipFacet                  │ │
│  │  AccessControlFacet · PausableFacet                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                       VAULT & COLLATERAL FACETS                         │ │
│  │  VaultFactoryFacet · CentralVaultFacet · CollateralFacet               │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        TRADING ENGINE FACETS                            │ │
│  │  PositionFacet · OrderBookFacet · LiquidationFacet · FundingRateFacet  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRICING LAYER FACETS                            │ │
│  │  OracleFacet · VirtualAMMFacet · PriceFeedFacet                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         SUPPORT FACETS                                  │ │
│  │  MarketRegistryFacet · EventEmitterFacet · QuoterFacet                 │ │
│  │  InsuranceFundFacet                                                     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      SHARED STORAGE (AppStorage)                        │ │
│  │  All facets read/write a single AppStorage struct at a fixed            │ │
│  │  diamond storage slot. No storage collisions possible.                  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
         │                            │                          │
         │ deploys clones             │ emits events             │ prices
         ▼                            ▼                          ▼
┌────────────────┐          ┌──────────────────┐     ┌──────────────────────┐
│  UserVault     │          │  Off-Chain        │     │  Off-Chain           │
│  (per user,    │          │  Event Indexer    │     │  Infrastructure      │
│   EIP-1167     │          │  (subscribes to   │     │  - Price Bot         │
│   clones)      │          │   diamond events) │     │  - Order Keeper      │
└────────────────┘          └──────────────────┘     │  - Liquidation Keeper│
                                                      └──────────────────────┘
```

---

## 3. Facet Inventory

### 3.1 Diamond Core (5 facets)

| Facet | Functions | Purpose |
|-------|-----------|---------|
| **DiamondCutFacet** | `diamondCut()` | Add, replace, or remove facets. Owner-only. |
| **DiamondLoupeFacet** | `facets()`, `facetFunctionSelectors()`, `facetAddresses()`, `facetAddress()`, `supportsInterface()` | EIP-2535 introspection + ERC-165. |
| **OwnershipFacet** | `transferOwnership()`, `owner()` | ERC-173 ownership. Controls diamondCut. |
| **AccessControlFacet** | `grantRole()`, `revokeRole()`, `hasRole()`, `renounceRole()` | Role-based access for all protocol operations. |
| **PausableFacet** | `pauseGlobal()`, `unpauseGlobal()`, `pauseMarket()`, `unpauseMarket()` | Emergency stop for entire protocol or individual markets. |

### 3.2 Vault & Collateral (3 facets)

| Facet | Functions | Purpose |
|-------|-----------|---------|
| **VaultFactoryFacet** | `createVault()`, `getVault()`, `getUserVaultImplementation()`, `setImplementation()` | Deploys per-user UserVault clones via EIP-1167 + CREATE2. Maintains user→vault registry. |
| **CentralVaultFacet** | `fundVault()`, `defundVault()`, `getVaultBalance()`, `getUtilization()` | Central liquidity pool. Protocol-funded only (no external LPs). Owner deposits/withdraws protocol capital. Counterparty to all trades. |
| **CollateralFacet** | `addCollateral()`, `removeCollateral()`, `getCollateralValue()`, `isAcceptedCollateral()` | Whitelist accepted stablecoins. USD-equivalent valuation with depeg protection. |

### 3.3 Trading Engine (4 facets)

| Facet | Functions | Purpose |
|-------|-----------|---------|
| **PositionFacet** | `openPosition()`, `addCollateral()`, `addSize()`, `partialClose()`, `closePosition()` | Full position lifecycle. **One direction per market per user** (net mode) — if long on a market, cannot short it; must close first. Can add to existing direction or trade other markets freely. Validates leverage, transfers collateral between UserVault↔CentralVault, updates open interest. |
| **OrderBookFacet** | `placeLimitOrder()`, `placeStopLimitOrder()`, `cancelOrder()`, `executeOrder()` | On-chain limit/stop-limit order storage. Orders stored with trigger conditions. Keepers call `executeOrder()`. |
| **LiquidationFacet** | `liquidate()`, `checkLiquidatable()`, `setLiquidationParams()`, `autoDeleverage()` | Anyone can call `liquidate()`. Validates margin < maintenance on-chain. Keeper incentive (liquidation fee). ADL when insurance fund depleted. |
| **FundingRateFacet** | `getCurrentFundingRate()`, `getFundingAccrued()`, `getPositionFunding()` | **Per-second continuous accrual** — funding accrues every second based on (markTWAP - indexTWAP) / indexTWAP. Settled automatically on every position interaction (open/close/modify/liquidate). No separate `settleFunding()` needed — settlement is embedded in position operations. |

### 3.4 Pricing Layer (3 facets)

| Facet | Functions | Purpose |
|-------|-----------|---------|
| **OracleFacet** | `batchUpdatePrices()`, `getPrice()`, `getPriceHistory()`, `addPricePoster()` | Authorized bot batch-posts prices for all enabled markets every ~1 min. Stores rolling price history for TWAP. Staleness check: price > 2 min old → trading halts for that market. |
| **VirtualAMMFacet** | `getMarkPrice()`, `simulateImpact()`, `syncToOracle()`, `initializePool()` | Per-market virtual reserves. Mark price = quoteReserve / baseReserve. Longs increase mark, shorts decrease it. Re-centers toward oracle price every sync (dampened convergence). |
| **PriceFeedFacet** | `getExecutionPrice()`, `getIndexPrice()`, `getMarkPrice()`, `getTWAP()` | Aggregates: index price (oracle) + impact (vAMM) + TWAP smoothing. Provides final execution prices for trades and liquidations. |

### 3.5 Support (4 facets)

| Facet | Functions | Purpose |
|-------|-----------|---------|
| **MarketRegistryFacet** | `createMarket()`, `updateMarket()`, `enableMarket()`, `disableMarket()`, `getMarket()` | CRUD for perp markets. Stores: name, symbol, maxLeverage, maintenanceMargin, fees, fundingInterval, status. |
| **EventEmitterFacet** | (internal-only: called by other facets' library code) | Emits standardized events from the diamond address. `PositionOpened`, `PositionClosed`, `OrderPlaced`, `OrderExecuted`, `Liquidation`, `FundingSettled`, `PriceUpdated`, etc. Indexer watches this one address. |
| **QuoterFacet** | `quoteOpenPosition()`, `quoteClosePosition()`, `quoteLiquidationPrice()`, `quoteOrderExecution()` | Read-only (view) trade simulation. Returns: expected fill price, fees, estimated PnL, liquidation price, price impact. Frontend and off-chain servers query this. |
| **InsuranceFundFacet** | `getInsuranceBalance()`, `withdrawInsurance()`, `getADLThreshold()` | Collects: portion of liquidation fees + trading fees. Backstop for socialized losses. When depleted, triggers auto-deleveraging of profitable positions. |

---

## 4. Standalone Contracts (Outside Diamond)

| Contract | Pattern | Purpose |
|----------|---------|---------|
| **UserVault** | EIP-1167 clone template | Per-user collateral vault. Holds stablecoins. Only the user (deposit/withdraw idle funds) and the Diamond (lock/release collateral) can interact. |
| **UserVaultProxy** | Helper | Minimal proxy bytecode helper for EIP-1167 clone deployment. |

### UserVault Interface

```
UserVault:
  deposit(token, amount)           // User deposits stablecoins
  withdraw(token, amount)          // User withdraws idle (unlocked) funds
  lockCollateral(token, amount)    // Called by Diamond on trade open → transfers to CentralVault
  receiveCollateral(token, amount) // Called by Diamond on trade close → receives from CentralVault
  emergencyWithdraw(token)         // User can ALWAYS withdraw idle funds, even if protocol paused
  getBalance(token) → uint256      // Available (unlocked) balance
  getLockedBalance() → uint256     // Total locked in active positions
```

---

## 5. Library Inventory (All Internal — Zero External Deps)

| Library | Purpose | Used By |
|---------|---------|---------|
| **LibDiamond** | Diamond storage slot, facet mapping, cut logic, ownership storage | Diamond.sol, DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet |
| **LibAppStorage** | AppStorage struct definition + `appStorage()` getter | ALL facets |
| **LibAccessControl** | `_checkRole()`, `_grantRole()`, `_revokeRole()` helpers | AccessControlFacet, all write facets |
| **LibReentrancyGuard** | `_nonReentrantBefore()`, `_nonReentrantAfter()` mutex | PositionFacet, OrderBookFacet, LiquidationFacet, CentralVaultFacet |
| **LibSafeERC20** | `safeTransfer()`, `safeTransferFrom()`, `safeApprove()` | CentralVaultFacet, VaultFactoryFacet, CollateralFacet, UserVault |
| **LibTWAP** | Time-weighted average price calculation over configurable windows | PriceFeedFacet, FundingRateFacet |
| **LibPosition** | PnL calculation, margin ratio, liquidation price, leverage validation | PositionFacet, LiquidationFacet, QuoterFacet |
| **LibFee** | Trading fee tiers, funding fee math, liquidation penalty | PositionFacet, LiquidationFacet, FundingRateFacet, QuoterFacet |
| **LibMath** | Fixed-point arithmetic (18 decimals), mulDiv, safe cast, min/max | All math-heavy libraries and facets |
| **LibEvents** | Event definitions + internal emit helpers | All facets (routes through EventEmitterFacet pattern) |

---

## 6. AppStorage — Shared State

All facets read and write a single `AppStorage` struct stored at a fixed diamond storage position. This eliminates storage collision risk.

```
AppStorage {
    // ── Access Control ──
    mapping(bytes32 => mapping(address => bool)) roles
    mapping(bytes32 => bytes32) roleAdmins

    // ── Pausable ──
    bool globalPaused
    mapping(uint256 => bool) marketPaused

    // ── Reentrancy ──
    uint256 reentrancyStatus

    // ── Vault Factory ──
    address userVaultImplementation
    mapping(address => address) userVaults          // user → vault
    address[] allVaults

    // ── Central Vault (Protocol-Funded Only) ──
    mapping(address => uint256) vaultBalances       // token → balance
    address protocolFunder                          // network owner address

    // ── Collateral ──
    mapping(address => bool) acceptedCollateral
    mapping(address => uint8) collateralDecimals
    address[] collateralTokens

    // ── Markets ──
    uint256 nextMarketId
    mapping(uint256 => Market) markets
    uint256[] activeMarketIds

    // ── Positions (Net Mode: one direction per market per user) ──
    uint256 nextPositionId
    mapping(uint256 => Position) positions
    mapping(address => uint256[]) userPositionIds
    mapping(address => mapping(uint256 => uint256)) userMarketPosition  // user → marketId → positionId (enforces one position per market)
    mapping(uint256 => MarketOI) openInterest       // per market

    // ── Orders ──
    uint256 nextOrderId
    mapping(uint256 => Order) orders
    mapping(address => uint256[]) userOrderIds

    // ── Oracle ──
    mapping(uint256 => PricePoint[]) priceHistory   // marketId → history
    mapping(uint256 => uint256) latestPrice
    mapping(uint256 => uint256) latestPriceTimestamp
    mapping(address => bool) authorizedPricePosters
    uint256 maxPriceStaleness                       // default: 120 seconds

    // ── Virtual AMM ──
    mapping(uint256 => VirtualPool) virtualPools    // per market

    // ── Funding ──
    mapping(uint256 => FundingState) fundingStates  // per market

    // ── Insurance Fund ──
    mapping(address => uint256) insuranceBalances   // token → balance
    uint256 adlThreshold

    // ── Fees ──
    uint256 makerFeeBps
    uint256 takerFeeBps
    uint256 liquidationFeeBps
    uint256 insuranceFeeBps
}
```

### Key Sub-Structs

```
Market {
    string name             // "Bitcoin", "Gold", "S&P 500"
    string symbol           // "BTC", "XAU", "SPX"
    uint256 maxLeverage     // 1000e18 for 1000x
    uint256 maintenanceMarginBps  // e.g., 50 = 0.5%
    uint256 maxOpenInterest // cap per market
    bool enabled
}

Position {
    address user
    uint256 marketId
    bool isLong
    uint256 sizeUsd         // notional size in USD (18 decimals)
    uint256 collateralUsd   // collateral value in USD
    address collateralToken // which stablecoin
    uint256 collateralAmount// raw token amount
    uint256 entryPrice      // price at open (18 decimals)
    int256 lastFundingIndex // for funding settlement
    uint256 timestamp
    bool active
}

Order {
    address user
    uint256 marketId
    bool isLong
    uint8 orderType         // 0 = LIMIT, 1 = STOP_LIMIT
    uint256 triggerPrice    // price that activates the order
    uint256 limitPrice      // max/min execution price (for stop-limits)
    uint256 sizeUsd
    uint256 leverage
    address collateralToken
    uint256 collateralAmount
    bool active
}

VirtualPool {
    uint256 baseReserve     // virtual base asset reserve
    uint256 quoteReserve    // virtual quote asset reserve
    uint256 lastSyncTimestamp
    uint256 dampingFactor   // convergence speed toward oracle (bps)
}

FundingState {
    int256 cumulativeFundingPerUnitLong   // accumulated funding per unit of long OI (18 dec)
    int256 cumulativeFundingPerUnitShort  // accumulated funding per unit of short OI (18 dec)
    uint256 lastUpdateTimestamp           // last time cumulative values were updated
    int256 currentFundingRatePerSecond    // current rate, updated on each oracle sync
}

PricePoint {
    uint256 price           // 18 decimals
    uint256 timestamp
}

MarketOI {
    uint256 longOI          // total long open interest (USD)
    uint256 shortOI         // total short open interest (USD)
}
```

---

## 7. Per-User Vault Model

```
┌───────────────────────────────────────────────────────────────────┐
│                    USER VAULT LIFECYCLE                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. User calls Diamond → VaultFactoryFacet.createVault()          │
│     → EIP-1167 minimal proxy clone of UserVault implementation    │
│     → CREATE2 for deterministic, predictable address              │
│     → One vault per user, reusable across ALL trades              │
│                                                                   │
│  2. User deposits stablecoins into their UserVault                │
│     → user.approve(vault, amount) + vault.deposit(token, amt)     │
│     → Funds sit in user's personal contract (isolated, SAFE)      │
│                                                                   │
│  3. User opens a trade via Diamond → PositionFacet                │
│     → Diamond calls UserVault.lockCollateral(token, amount)       │
│     → Funds transfer: UserVault → CentralVault (inside Diamond)   │
│     → Position created in AppStorage                              │
│                                                                   │
│  4. User closes a trade via Diamond → PositionFacet               │
│     → PnL calculated via LibPosition                              │
│     → Collateral ± PnL transferred: CentralVault → UserVault     │
│     → User can withdraw idle funds from vault anytime             │
│                                                                   │
│  5. EMERGENCY: User can ALWAYS withdraw idle (unlocked) funds     │
│     → Works even if protocol is globally paused for trading       │
│     → Only locked (in-position) collateral is inaccessible        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Why Per-User Vaults

- **Security isolation** — Idle funds NOT in central vault. If CentralVault exploited, idle balances safe.
- **UX** — Deposit once, trade many times. No per-trade token approvals after initial setup.
- **Accounting** — Clean per-user balance tracking, easy audit trail.
- **Gas** — After vault creation + initial approval, subsequent trades are cheap (no approve tx).

---

## 8. Pricing Model: Oracle + vAMM + TWAP

### 8.1 Oracle (OracleFacet)

- Authorized bot calls `batchUpdatePrices(marketIds[], prices[], timestamp)` every ~60 seconds
- Stores price history per market (rolling window, configurable depth)
- **Staleness rule:** if latest price > `maxPriceStaleness` (default 120s), trading halts for that market
- Prices are 18-decimal fixed-point USD values

### 8.2 Virtual AMM (VirtualAMMFacet)

Per-market virtual reserves simulate an AMM without actual liquidity:

```
Mark Price = quoteReserve / baseReserve

When a LONG opens:  virtual "buy" → mark price increases above index
When a SHORT opens: virtual "sell" → mark price decreases below index

Every oracle sync (1 min):
  newBase  = baseReserve  + (oracleImpliedBase  - baseReserve)  * dampingFactor / 10000
  newQuote = quoteReserve + (oracleImpliedQuote - quoteReserve) * dampingFactor / 10000

This pulls the vAMM mark price toward oracle price over time.
```

- **Purpose:** Creates price impact proportional to order size. Large orders get worse execution.
- **Damping factor:** Controls how fast mark converges to index (e.g., 5000 = 50% per cycle)

### 8.3 TWAP (LibTWAP)

- **Oracle TWAP:** Time-weighted average of oracle prices over N minutes (configurable, e.g., 15 min)
- **Mark TWAP:** Time-weighted average of vAMM mark prices over same window
- Used exclusively for **funding rate** calculation — NOT for trade execution

### 8.4 Execution Price (PriceFeedFacet)

```
For MARKET orders:
  executionPrice = oracleIndexPrice + priceImpact(orderSize, virtualLiquidity)

For LIMIT orders:
  triggerCondition = oracleIndexPrice crosses triggerPrice
  executionPrice   = limitPrice (or better)

For LIQUIDATIONS:
  executionPrice = oracleIndexPrice (no impact — fair liquidation)
```

### 8.5 Funding Rate (FundingRateFacet) — Per-Second Continuous Accrual

```
fundingRatePerSecond = (markTWAP - indexTWAP) / indexTWAP / 86400

If positive: longs pay shorts (mark > index = longs are dominant)
If negative: shorts pay longs (mark < index = shorts are dominant)

Accrual model:
  On each oracle sync (~60s):
    1. Calculate elapsed seconds since last update
    2. Accumulate: cumulativeFundingPerUnitLong  += fundingRatePerSecond * elapsed
    3. Accumulate: cumulativeFundingPerUnitShort += fundingRatePerSecond * elapsed
    4. Update currentFundingRatePerSecond for next period

  On each position interaction (open/close/modify/liquidate):
    1. Accrue any pending funding since lastUpdateTimestamp
    2. Calculate user's funding debt/credit:
       fundingOwed = positionSize * (currentCumulativeFunding - position.lastFundingIndex)
    3. Apply to position collateral (deduct or credit)
    4. Update position.lastFundingIndex = currentCumulativeFunding

This gives per-second precision without requiring a separate keeper to settle.
Funding is always up-to-date at the moment of any position interaction.
```

---

## 9. Access Control Matrix

This is a **network-level protocol** on Paxeer. The network itself is the owner — no external multi-sig or timelock used.

| Role | Assigned To | Permissions |
|------|-------------|-------------|
| `DIAMOND_OWNER` | Network owner (Paxeer) | `diamondCut()`, upgrade facets, all admin functions |
| `MARKET_ADMIN` | Network owner | Create/update/pause markets, set parameters |
| `ORACLE_POSTER` | Price bot address(es) | `batchUpdatePrices()` |
| `KEEPER` | Keeper bot address(es) | `executeOrder()`, `liquidate()`, `syncToOracle()` |
| `INSURANCE_ADMIN` | Network owner | `withdrawInsurance()` |
| `PAUSER` | Network owner | `pauseGlobal()`, `pauseMarket()` |
| `PROTOCOL_FUNDER` | Network owner | `fundVault()`, `defundVault()` on CentralVault |
| (any user) | Public | `createVault()`, `openPosition()`, `closePosition()`, `placeLimitOrder()`, `cancelOrder()`, all view functions |

---

## 10. Event Catalog (EventEmitterFacet)

All events emit from the Diamond address. The off-chain indexer watches ONE contract.

| Event | Emitted When | Key Fields |
|-------|-------------|------------|
| `VaultCreated` | User creates vault | user, vaultAddress |
| `CollateralDeposited` | User deposits to vault | user, token, amount |
| `CollateralWithdrawn` | User withdraws from vault | user, token, amount |
| `PositionOpened` | New position created | positionId, user, marketId, isLong, size, leverage, entryPrice, collateral |
| `PositionModified` | Size/collateral added | positionId, newSize, newCollateral |
| `PositionClosed` | Partial or full close | positionId, closedSize, exitPrice, realizedPnl |
| `OrderPlaced` | Limit/stop-limit placed | orderId, user, marketId, orderType, triggerPrice |
| `OrderExecuted` | Keeper executes order | orderId, positionId, executionPrice |
| `OrderCancelled` | User cancels order | orderId |
| `Liquidation` | Position liquidated | positionId, user, marketId, liquidationPrice, penalty |
| `FundingSettled` | Funding applied | marketId, fundingRate, longPayment, shortPayment |
| `PriceUpdated` | Oracle batch post | marketId, price, timestamp |
| `MarketCreated` | New market added | marketId, name, symbol |
| `MarketPaused` | Market trading halted | marketId |
| `ADLExecuted` | Auto-deleverage triggered | positionId, deleveragedSize |

---

## 11. Directory Structure

```
contracts/
├── diamond/
│   ├── Diamond.sol                         # Main diamond proxy — fallback delegates to facets
│   │
│   ├── facets/
│   │   ├── core/
│   │   │   ├── DiamondCutFacet.sol         # EIP-2535 facet management
│   │   │   ├── DiamondLoupeFacet.sol       # EIP-2535 introspection + ERC-165
│   │   │   ├── OwnershipFacet.sol          # ERC-173 ownership
│   │   │   ├── AccessControlFacet.sol      # Role-based access
│   │   │   └── PausableFacet.sol           # Global + per-market pause
│   │   │
│   │   ├── vault/
│   │   │   ├── VaultFactoryFacet.sol       # Deploy UserVault clones
│   │   │   ├── CentralVaultFacet.sol       # Central liquidity pool
│   │   │   └── CollateralFacet.sol         # Stablecoin whitelist
│   │   │
│   │   ├── trading/
│   │   │   ├── PositionFacet.sol           # Position lifecycle
│   │   │   ├── OrderBookFacet.sol          # Limit & stop-limit orders
│   │   │   ├── LiquidationFacet.sol        # Liquidation + ADL
│   │   │   └── FundingRateFacet.sol        # Funding rate settlement
│   │   │
│   │   ├── pricing/
│   │   │   ├── OracleFacet.sol             # Batch price posting
│   │   │   ├── VirtualAMMFacet.sol         # Per-market vAMM
│   │   │   └── PriceFeedFacet.sol          # Price aggregation + TWAP
│   │   │
│   │   └── support/
│   │       ├── MarketRegistryFacet.sol     # Market CRUD
│   │       ├── EventEmitterFacet.sol       # Centralized event emission
│   │       ├── QuoterFacet.sol             # Read-only trade simulation
│   │       └── InsuranceFundFacet.sol      # Insurance fund + ADL backstop
│   │
│   ├── interfaces/
│   │   ├── IDiamondCut.sol                 # EIP-2535 cut interface
│   │   ├── IDiamondLoupe.sol               # EIP-2535 loupe interface
│   │   ├── IERC165.sol                     # Interface detection
│   │   ├── IERC173.sol                     # Ownership standard
│   │   ├── IERC20.sol                      # Minimal ERC20 interface
│   │   └── IUserVault.sol                  # UserVault interface
│   │
│   ├── libraries/
│   │   ├── LibDiamond.sol                  # Diamond storage, cut logic, ownership
│   │   ├── LibAppStorage.sol               # AppStorage struct + storage getter
│   │   ├── LibAccessControl.sol            # Role check/grant/revoke helpers
│   │   ├── LibReentrancyGuard.sol          # Reentrancy mutex
│   │   ├── LibSafeERC20.sol                # Safe ERC20 transfer wrappers
│   │   ├── LibTWAP.sol                     # TWAP calculation math
│   │   ├── LibPosition.sol                 # PnL, margin ratio, liquidation price
│   │   ├── LibFee.sol                      # Fee calculations
│   │   ├── LibMath.sol                     # Fixed-point math (18 dec), mulDiv, safeCast
│   │   └── LibEvents.sol                   # Event definitions + emit helpers
│   │
│   └── storage/
│       └── AppStorage.sol                  # All shared structs & AppStorage definition
│
├── vaults/
│   ├── UserVault.sol                       # Clone template: per-user collateral vault
│   └── UserVaultProxy.sol                  # EIP-1167 minimal proxy bytecode helper
│
└── mocks/
    ├── MockERC20.sol                       # Test stablecoin
    └── MockPriceBot.sol                    # Test oracle posting

scripts/
├── deploy/
│   ├── 01-deploy-diamond.js               # Deploy Diamond + core facets
│   ├── 02-deploy-trading-facets.js         # Deploy & cut trading facets
│   ├── 03-deploy-pricing-facets.js         # Deploy & cut pricing facets
│   ├── 04-deploy-support-facets.js         # Deploy & cut support facets
│   ├── 05-deploy-uservault-impl.js         # Deploy UserVault implementation
│   └── 06-initialize-protocol.js           # Set roles, add markets, whitelist collateral
│
├── upgrade/
│   └── upgrade-facet.js                    # Template for upgrading a single facet
│
└── helpers/
    └── diamond-helpers.js                  # diamondCut encoding utilities

tests/
├── diamond/
│   ├── DiamondCut.test.js
│   └── DiamondLoupe.test.js
├── vault/
│   ├── VaultFactory.test.js
│   ├── CentralVault.test.js
│   └── UserVault.test.js
├── trading/
│   ├── Position.test.js
│   ├── OrderBook.test.js
│   ├── Liquidation.test.js
│   └── FundingRate.test.js
├── pricing/
│   ├── Oracle.test.js
│   ├── VirtualAMM.test.js
│   └── PriceFeed.test.js
├── support/
│   ├── MarketRegistry.test.js
│   ├── Quoter.test.js
│   └── InsuranceFund.test.js
└── integration/
    ├── FullTradeLifecycle.test.js
    ├── LimitOrderExecution.test.js
    ├── LiquidationCascade.test.js
    └── MultiCollateral.test.js
```

---

## 12. Cross-Facet Communication Pattern

**Facets NEVER call each other directly.** Shared logic lives in libraries that read/write AppStorage.

```
Example: PositionFacet.openPosition() needs a price

  PositionFacet
       │
       ├──→ LibAppStorage.appStorage()         // get storage reference
       ├──→ LibPosition.validateLeverage()      // check leverage limits
       ├──→ LibPriceFeed.getExecutionPrice()    // reads oracle + vAMM from AppStorage
       ├──→ LibFee.calculateTradingFee()        // compute fee
       ├──→ LibSafeERC20.safeTransferFrom()     // move collateral
       ├──→ LibEvents.emitPositionOpened()       // emit event from diamond
       └──→ write to AppStorage.positions[]     // store position

No cross-facet DELEGATECALL. No external calls between facets.
All coordination happens through shared storage + shared libraries.
```

---

## 13. Trade Lifecycle Flows

### 13.1 Open Long Position

```
User → Diamond.openPosition(marketId, collateralToken, collateralAmt, leverage, isLong=true)
  │
  ├─ PositionFacet (routed by Diamond fallback via selector mapping)
  │   ├─ Check: !globalPaused && !marketPaused[marketId]
  │   ├─ Check: market.enabled && leverage <= market.maxLeverage
  │   ├─ Check: collateralToken is accepted
  │   ├─ LibReentrancyGuard._nonReentrantBefore()
  │   │
  │   ├─ Get user vault: AppStorage.userVaults[msg.sender]
  │   ├─ Call: UserVault.lockCollateral(token, amount)
  │   │    └─ UserVault transfers tokens to Diamond (CentralVault)
  │   │
  │   ├─ LibPosition.getExecutionPrice(marketId, size, isLong)
  │   │    ├─ Read oracle price from AppStorage
  │   │    ├─ Simulate vAMM impact from AppStorage.virtualPools[marketId]
  │   │    └─ Return: executionPrice
  │   │
  │   ├─ LibFee.calculateFee(size, takerFeeBps)
  │   ├─ LibPosition.calculateLiquidationPrice(entryPrice, leverage, isLong, maintenanceMargin)
  │   │
  │   ├─ Write position to AppStorage.positions[nextPositionId]
  │   ├─ Update AppStorage.openInterest[marketId].longOI += size
  │   ├─ Update VirtualAMM reserves (virtual buy)
  │   │
  │   ├─ LibEvents.emitPositionOpened(...)
  │   └─ LibReentrancyGuard._nonReentrantAfter()
  │
  └─ Return positionId
```

### 13.2 Limit Order Execution (Off-Chain Keeper)

```
1. User → Diamond.placeLimitOrder(marketId, triggerPrice, size, leverage, isLong, collateralToken, collateralAmt)
   └─ OrderBookFacet stores order in AppStorage.orders[]
   └─ Collateral stays in UserVault (NOT locked until execution)

2. Off-chain Keeper monitors OracleFacet.getPrice(marketId)
   └─ When oraclePrice crosses triggerPrice...

3. Keeper → Diamond.executeOrder(orderId)
   └─ OrderBookFacet:
       ├─ Validate: order.active && price condition met ON-CHAIN
       ├─ Lock collateral: UserVault.lockCollateral(...)
       ├─ Open position (same flow as 13.1)
       ├─ Mark order inactive
       └─ Emit OrderExecuted + PositionOpened
```

### 13.3 Liquidation

```
1. Keeper or anyone → Diamond.liquidate(positionId)
   └─ LiquidationFacet:
       ├─ Read position from AppStorage
       ├─ Get current price from LibPriceFeed
       ├─ LibPosition.calculateMarginRatio(position, currentPrice)
       ├─ Check: marginRatio < maintenanceMarginBps → LIQUIDATABLE
       │
       ├─ Close position at current oracle price
       ├─ Calculate remaining collateral after loss
       ├─ Distribute:
       │   ├─ Keeper reward: remainingCollateral * liquidationFeeBps
       │   ├─ Insurance fund: remainingCollateral * insuranceFeeBps
       │   └─ Remainder (if any): back to UserVault
       │
       ├─ Update open interest
       ├─ Update vAMM reserves
       └─ Emit Liquidation event
```

---

## 14. Risk Considerations for 1000x Leverage

| Risk | Mitigation |
|------|-----------|
| **0.1% move = full wipeout** at 1000x | Keeper infrastructure must liquidate within SECONDS of oracle update. Cannot rely on 1-min oracle alone for liquidation triggers — keepers should use off-chain price feeds for early detection. |
| **Oracle manipulation** | Custom oracle with authorized posters only. TWAP smoothing prevents single-price manipulation. Staleness check halts trading if oracle stops. |
| **Insurance fund depletion** | Auto-deleveraging (ADL) of profitable positions as last resort. Fee structure must fund insurance adequately. |
| **Cascading liquidations** | Per-market open interest caps. Gradual liquidation (partial) before full liquidation. |
| **vAMM manipulation** | vAMM re-centers toward oracle every minute. Impact is bounded by virtual liquidity depth (configurable per market). |
| **Stablecoin depeg** | CollateralFacet values each stablecoin at oracle price, not hardcoded $1. Positions auto-adjust if collateral depegs. |
| **Smart contract risk (no deps)** | All code is custom — larger audit surface. Requires thorough testing (fuzzing, invariant tests) and professional audit before mainnet. |

---

## 15. Off-Chain Infrastructure

| Component | Purpose | Frequency |
|-----------|---------|----------|
| **Price Bot** | Posts batch prices to OracleFacet for 15–20 markets | Every ~60 seconds (single tx) |
| **Order Keeper** | Monitors prices, calls `executeOrder()` when triggers hit | Continuous (every block or oracle update) |
| **Liquidation Keeper** | Monitors positions, calls `liquidate()` when undercollateralized | Continuous (CRITICAL — must be sub-second responsive for 1000x leverage) |
| **vAMM Syncer** | Calls `syncToOracle()` after each oracle update | Every ~60 seconds (can piggyback on oracle post tx) |
| **Event Indexer** | Subscribes to Diamond events, builds queryable database | Real-time |

**Note:** No separate Funding Settler needed — funding accrues per-second and settles automatically on every position interaction.

---

# Deployed Contracts on Paxeer Network (Chain 125)

| Contract | Address | Verification |
|----------|---------|--------------|
| Diamond | `0xeA65FE02665852c615774A3041DFE6f00fb77537` | [View](https://paxscan.paxeer.app/address/0xeA65FE02665852c615774A3041DFE6f00fb77537#code) |
| DiamondCutFacet | `0x8af7E829E2061Cb2353CCce3cf99b00e6ca4DC3B` | [View](https://paxscan.paxeer.app/address/0x8af7E829E2061Cb2353CCce3cf99b00e6ca4DC3B#code) |
| DiamondLoupeFacet | `0x425Bcb17F3e3679fC5fE001d3707BDC3ED76c3a1` | [View](https://paxscan.paxeer.app/address/0x425Bcb17F3e3679fC5fE001d3707BDC3ED76c3a1#code) |
| OwnershipFacet | `0xDD0C64553e792120B04727b9Eb2e97c8cd67F387` | [View](https://paxscan.paxeer.app/address/0xDD0C64553e792120B04727b9Eb2e97c8cd67F387#code) |
| PositionFacet | `0xD0f2448eF25427cd1555811f73D1d8d2FAbCf74e` | [View](https://paxscan.paxeer.app/address/0xD0f2448eF25427cd1555811f73D1d8d2FAbCf74e#code) |
| OrderBookFacet | `0xd2ff3a1684B970750b7FB912b6293C0842554eb4` | [View](https://paxscan.paxeer.app/address/0xd2ff3a1684B970750b7FB912b6293C0842554eb4#code) |
| LiquidationFacet | `0xfB1Efb83568635d5fBC1C572F5Cb03FF8fF81982` | [View](https://paxscan.paxeer.app/address/0xfB1Efb83568635d5fBC1C572F5Cb03FF8fF81982#code) |
| FundingRateFacet | `0x3B13193149142ee25926DfAe5C169D36f8EfDf0c` | [View](https://paxscan.paxeer.app/address/0x3B13193149142ee25926DfAe5C169D36f8EfDf0c#code) |
| OracleFacet | `0x8699dE864496A7Af1F73540262FAA9eD561D7d0F` | [View](https://paxscan.paxeer.app/address/0x8699dE864496A7Af1F73540262FAA9eD561D7d0F#code) |
| VirtualAMMFacet | `0x460490264c76d8aE5739F0744e40160582dC7E17` | [View](https://paxscan.paxeer.app/address/0x460490264c76d8aE5739F0744e40160582dC7E17#code) |
| PriceFeedFacet | `0x08E967408a4Ee268FF11ab116BfE1D95F2484c61` | [View](https://paxscan.paxeer.app/address/0x08E967408a4Ee268FF11ab116BfE1D95F2484c61#code) |
| AccessControlFacet | `0x71E10DB0c468BF682EA744F11C4A29b10E18FDEd` | [View](https://paxscan.paxeer.app/address/0x71E10DB0c468BF682EA744F11C4A29b10E18FDEd#code) |
| PausableFacet | `0xDc72b3dC885C5b8816456FcF9EFda7aD5625ABf8` | [View](https://paxscan.paxeer.app/address/0xDc72b3dC885C5b8816456FcF9EFda7aD5625ABf8#code) |
| VaultFactoryFacet | `0x54F4D455a8f47dFD2C6f252d0EdEEdDFfEe252B4` | [View](https://paxscan.paxeer.app/address/0x54F4D455a8f47dFD2C6f252d0EdEEdDFfEe252B4#code) |
| CentralVaultFacet | `0xd09b87f5790C29fB3D25D642E7E681d722e2Be6A` | [View](https://paxscan.paxeer.app/address/0xd09b87f5790C29fB3D25D642E7E681d722e2Be6A#code) |
| CollateralFacet | `0x26D0BEE6F9249dD3d098288a74f7b026929dD6BD` | [View](https://paxscan.paxeer.app/address/0x26D0BEE6F9249dD3d098288a74f7b026929dD6BD#code) |
| MarketRegistryFacet | `0x2af1c76EC28F437B165594137f28d5A57Af1EEF3` | [View](https://paxscan.paxeer.app/address/0x2af1c76EC28F437B165594137f28d5A57Af1EEF3#code) |
| InsuranceFundFacet | `0x830746A6b7b8989846d4B8848a12326d426Ed562` | [View](https://paxscan.paxeer.app/address/0x830746A6b7b8989846d4B8848a12326d426Ed562#code) |
| QuoterFacet | `0x5b1f999CC865b96a2DA2EF30BFAfe9E60A13083e` | [View](https://paxscan.paxeer.app/address/0x5b1f999CC865b96a2DA2EF30BFAfe9E60A13083e#code) |
| UserVault | `0x4195155D92451a47bF76987315DaEE499f1D7352` | [View](https://paxscan.paxeer.app/address/0x4195155D92451a47bF76987315DaEE499f1D7352#code) |



## License

Licensed under the **GNU General Public License v3.0**—see [LICENSE](LICENSE) for terms.

```
Copyright (C) 2026 PaxLabs Inc.
SPDX-License-Identifier: GPL-3.0-only
```

## Contact & Resources

| Resource | Link |
|----------|------|
| **Protocol Documentation** | [docs.hyperpaxeer.com](https://docs.hyperpaxeer.com) |
| **Block Explorer** | [paxscan.paxeer.app](https://paxscan.paxeer.app) |
| **Sidiora Interface** | [sidiora.hyperpaxeer.com](https://sidiora.hyperpaxeer.com) |
| **Website** | [paxeer.app](https://paxeer.app) |
| **Twitter/X** | [@paxeer_app](https://x.com/paxeer_app) |
| **General Inquiries** | [infopaxeer@paxeer.app](mailto:infopaxeer@paxeer.app) |
| **Security Reports** | [security@paxeer.app](mailto:security@paxeer.app) |

---

<p align="center">
  <strong>Built for the permissionless economy.</strong><br>
  <sub>Sidiora Perpetual Protocol © 2026 PaxLabs Inc.</sub>
</p>
