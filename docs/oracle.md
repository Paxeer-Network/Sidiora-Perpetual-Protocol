<p align="center">
  <img src="https://img.shields.io/badge/Source-Pyth_Network-7B3FE4?style=for-the-badge" alt="Pyth" />
  <img src="https://img.shields.io/badge/Update_Cycle-~60_seconds-blue?style=for-the-badge" alt="Update" />
  <img src="https://img.shields.io/badge/Staleness-120s_max-E74C3C?style=for-the-badge" alt="Staleness" />
  <img src="https://img.shields.io/badge/Precision-18_decimals-teal?style=for-the-badge" alt="Precision" />
</p>

# Oracle & Pricing System

<a href="./README.md"><img src="https://img.shields.io/badge/Back_to-Index-grey?style=flat-square" alt="Back" /></a>

Sidiora does not use an on-chain oracle protocol directly. Instead, a custom oracle node fetches prices from Pyth Network's Hermes service and posts them on-chain through the `OracleFacet`. This gives the protocol full control over update frequency, data format, and gas costs.

---

## Table of contents

- [Architecture overview](#architecture-overview)
- [Oracle node](#oracle-node)
- [Price feed mappings](#price-feed-mappings)
- [On-chain oracle (OracleFacet)](#on-chain-oracle-oraclefacet)
- [Virtual AMM](#virtual-amm)
- [TWAP](#twap)
- [Execution price](#execution-price)
- [Staleness rules](#staleness-rules)
- [Running the oracle node](#running-the-oracle-node)

---

## Architecture overview

```
  Pyth Network (Hermes)
         |
         | REST API (prices)
         v
  +------------------+
  |  Oracle Node     |     Node.js process
  |  (.oracle/)      |     Runs off-chain
  |                  |
  |  pyth-fetcher.js |---> Fetches prices, normalizes to 18 decimals
  |  submitter.js    |---> Signs and submits batchUpdatePrices() tx
  |  index.js        |---> Orchestrates fetch/submit loop
  +------------------+
         |
         | batchUpdatePrices(marketIds[], prices[])
         v
  +------------------+
  |  OracleFacet     |     On-chain (Diamond proxy)
  |                  |
  |  latestPrice[]   |---> Stored per market
  |  priceHistory[]  |---> Rolling window for TWAP
  |  staleness check |---> Halts trading if price too old
  +------------------+
         |
         | reads
         v
  +------------------+      +------------------+
  |  VirtualAMMFacet |      |  PriceFeedFacet  |
  |  (mark price)    |----->|  (aggregation)   |
  +------------------+      +------------------+
                                    |
                                    v
                             Execution price
                             for trades and
                             liquidations
```

---

## Oracle node

The oracle node lives in the `.oracle/` directory of this repository. It is a standalone Node.js process with no shared runtime dependencies on the smart contracts.

### How it works

1. Every 5 seconds (configurable), the node fetches latest prices for all configured markets from Pyth Network's Hermes REST API.
2. Prices are normalized from Pyth's exponent format to 18-decimal fixed-point integers.
3. If any price has deviated more than 0.5% (configurable) from the last submitted price, or if the submission interval has elapsed, the node calls `batchUpdatePrices()` on the Diamond proxy.
4. The transaction is signed by a private key that holds the `ORACLE_POSTER_ROLE`.

### Components

| File | Purpose |
|------|---------|
| `index.js` | Main entry point. Orchestrates the fetch-submit loop and handles graceful shutdown. |
| `config.js` | Loads environment variables and defines market-to-Pyth-feed mappings. |
| `src/pyth-fetcher.js` | Fetches prices from Pyth Hermes, normalizes to 18 decimals, detects deviations. |
| `src/submitter.js` | Manages wallet, signs transactions, submits `batchUpdatePrices()` with retries. |
| `src/logger.js` | Winston-based logging with console and file transports. |

### Configuration

The node reads from `.oracle/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ORACLE_PRIVATE_KEY` | _(required)_ | Private key of the `ORACLE_POSTER` account |
| `RPC_URL` | `https://public-rpc.paxeer.app/rpc` | Paxeer Network RPC endpoint |
| `DIAMOND_ADDRESS` | `0xeA65FE02665852c615774A3041DFE6f00fb77537` | Diamond proxy address |
| `PYTH_HERMES_URL` | `https://hermes.pyth.network` | Pyth Hermes REST endpoint |
| `UPDATE_INTERVAL_MS` | `5000` | How often to fetch prices (milliseconds) |
| `DEVIATION_THRESHOLD_PCT` | `0.5` | Price deviation % that triggers an immediate update |
| `GAS_LIMIT` | `1500000` | Gas limit for `batchUpdatePrices()` transactions |
| `MAX_CONSECUTIVE_FAILURES` | `10` | Failure count before alerting |

---

## Price feed mappings

Each on-chain market ID maps to a Pyth Network price feed ID. These mappings are defined in `.oracle/config.js`:

| Market ID | Symbol | Pyth Feed ID |
|:---------:|:------:|:-------------|
| 0 | BTC | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| 1 | ETH | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| 2 | SOL | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| 3 | AVAX | `0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7` |
| 4 | LINK | `0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221` |

---

## On-chain oracle (OracleFacet)

The `OracleFacet` stores prices and exposes them to the rest of the protocol.

### Posting prices

```solidity
OracleFacet.batchUpdatePrices(
    [0, 1, 2, 3, 4],                    // market IDs
    [97250e18, 3420e18, 180e18, ...]     // prices in 18-decimal USD
)
```

This writes each price to `AppStorage.latestPrice[marketId]`, updates `latestPriceTimestamp[marketId]` to `block.timestamp`, and pushes a `PricePoint` to the rolling `priceHistory[marketId]` array.

### Reading prices

```solidity
OracleFacet.getPrice(marketId)              // (price, timestamp)
OracleFacet.isPriceStale(marketId)          // true if older than maxStaleness
OracleFacet.getPriceHistoryLength(marketId) // number of stored points
OracleFacet.getPricePoint(marketId, index)  // historical (price, timestamp)
```

### Authorization

Only addresses with the `ORACLE_POSTER_ROLE` can call `batchUpdatePrices()`. The role is granted through `AccessControlFacet.grantRole()` or the convenience function `OracleFacet.addPricePoster()`.

```solidity
OracleFacet.addPricePoster(posterAddress)     // grants ORACLE_POSTER_ROLE
OracleFacet.removePricePoster(posterAddress)   // revokes it
OracleFacet.isAuthorizedPoster(posterAddress)  // check
```

---

## Virtual AMM

Each market has a Virtual AMM that creates price impact without requiring real liquidity. It works with virtual reserves -- there are no actual tokens in the AMM.

### Mark price

```
markPrice = quoteReserve / baseReserve
```

When a long opens, the vAMM simulates a "buy" which increases the mark price. When a short opens, it simulates a "sell" which decreases it. This creates price impact proportional to order size.

### Sync to oracle

Every time the oracle posts new prices, the vAMM can be re-centered toward the oracle price:

```solidity
VirtualAMMFacet.syncToOracle(marketId)
```

The sync uses a damping factor to control convergence speed:

```
newBase  = baseReserve  + (oracleImpliedBase  - baseReserve)  * dampingFactor / 10000
newQuote = quoteReserve + (oracleImpliedQuote - quoteReserve) * dampingFactor / 10000
```

A damping factor of 5000 means the reserves move 50% toward the oracle-implied values each cycle. This prevents the vAMM from diverging too far from reality while still allowing meaningful price impact.

### Pool initialization

When a new market is created, its vAMM pool must be initialized:

```solidity
VirtualAMMFacet.initializePool(
    marketId,
    initialPrice,       // starting price (18 decimals)
    virtualLiquidity,   // depth of the virtual pool
    dampingFactor        // convergence rate (bps)
)
```

### Querying

```solidity
VirtualAMMFacet.getMarkPrice(marketId)                     // current mark price
VirtualAMMFacet.getPool(marketId)                           // (base, quote, lastSync, damping)
VirtualAMMFacet.simulateImpact(marketId, sizeUsd, isLong)  // (impactedPrice, priceImpact)
```

---

## TWAP

Time-weighted average prices are computed by `LibTWAP` using the rolling price history stored by the oracle.

### Oracle TWAP

Averages oracle prices over a configurable time window (typically 15 minutes). Used exclusively for **funding rate calculations** -- not for trade execution.

```solidity
PriceFeedFacet.getOracleTWAP(marketId)                       // default window
PriceFeedFacet.getOracleTWAPCustom(marketId, windowSeconds)   // custom window
```

### Mark TWAP

The vAMM mark price is also time-weighted over the same window. The difference between mark TWAP and oracle TWAP determines the funding rate:

```
fundingRatePerSecond = (markTWAP - oracleTWAP) / oracleTWAP / 86400
```

---

## Execution price

The `PriceFeedFacet` aggregates oracle prices, vAMM impact, and TWAP into final prices used across the protocol.

| Function | What it returns | Used for |
|----------|----------------|----------|
| `getIndexPrice(marketId)` | Raw oracle price | Reference, funding calculation |
| `getMarkPrice(marketId)` | vAMM mark price | Funding calculation, UI display |
| `getExecutionPrice(marketId, sizeUsd, isLong)` | Oracle + vAMM impact | Trade execution |
| `getLiquidationPrice(marketId)` | Reference liquidation threshold | Liquidation checks |
| `getOracleTWAP(marketId)` | Time-weighted oracle average | Funding calculation |

### How execution price is computed

For market orders:

```
executionPrice = oracleIndexPrice + priceImpact(orderSize, virtualLiquidity)
```

For limit orders:

```
trigger:    oracleIndexPrice crosses triggerPrice
execution:  limitPrice (or better)
```

For liquidations:

```
executionPrice = oracleIndexPrice (no impact -- fair liquidation)
```

---

## Staleness rules

If the oracle stops posting prices, the protocol protects traders by halting activity on affected markets.

| Setting | Default | Effect |
|---------|---------|--------|
| `maxPriceStaleness` | 120 seconds | If `block.timestamp - latestPriceTimestamp > maxPriceStaleness`, the price is considered stale |

When a price is stale:

- `OracleFacet.isPriceStale(marketId)` returns `true`
- Position opens, closes, and order executions on that market will revert
- Existing positions remain open but cannot be interacted with until fresh prices arrive
- Liquidations continue to function (they use the last known price to prevent trapped positions)

The staleness threshold can be adjusted:

```solidity
OracleFacet.setMaxPriceStaleness(newThresholdInSeconds)
```

---

## Running the oracle node

### Prerequisites

- Node.js 18 or later
- An Ethereum-compatible wallet with the `ORACLE_POSTER_ROLE` granted on-chain
- The wallet needs a small amount of native gas token on Paxeer Network

### Setup

```bash
cd .oracle
cp .env.example .env
# Edit .env with your private key and configuration
npm install
```

### Start

```bash
npm start
```

The node logs to both the console and `.oracle/logs/oracle.log`. It will:

1. Connect to the Paxeer RPC
2. Verify that the configured wallet has the `ORACLE_POSTER_ROLE`
3. Begin the fetch-submit loop
4. Log every price update and any errors

### Graceful shutdown

The node handles `SIGINT` and `SIGTERM` signals. It will finish any in-flight transaction before exiting.

---

<p align="center">
  <a href="./trading-guide.md"><img src="https://img.shields.io/badge/%E2%86%90_Trading_Guide-grey?style=for-the-badge" alt="Previous" /></a>
  &nbsp;
  <a href="./indexer-api.md"><img src="https://img.shields.io/badge/GraphQL_API_%E2%86%92-E10098?style=for-the-badge" alt="Next" /></a>
</p>
