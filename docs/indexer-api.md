<p align="center">
  <img src="https://img.shields.io/badge/Protocol-GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white" alt="GraphQL" />
  <img src="https://img.shields.io/badge/Storage-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Server-Apollo-311C87?style=for-the-badge&logo=apollographql&logoColor=white" alt="Apollo" />
  <img src="https://img.shields.io/badge/Port-4000-blue?style=for-the-badge" alt="Port" />
</p>

# GraphQL API Reference

<a href="./README.md"><img src="https://img.shields.io/badge/Back_to-Index-grey?style=flat-square" alt="Back" /></a>

The indexer is a custom event indexer that watches the Diamond proxy for on-chain events, decodes them, and stores the data in PostgreSQL. It exposes a GraphQL API on port 4000 for frontend and analytics consumption.

---

## Table of contents

- [Architecture](#architecture)
- [Schema types](#schema-types)
- [Queries](#queries)
- [Example queries](#example-queries)
- [Running the indexer](#running-the-indexer)

---

## Architecture

```
  Diamond Proxy (on-chain)
         |
         | emits events (logs)
         v
  +------------------+
  |  Block Scanner   |     Polls RPC for new blocks
  |  scanner.js      |     Decodes event logs using combined ABI
  +------------------+
         |
         | decoded events
         v
  +------------------+
  |  PostgreSQL      |     14 tables
  |  (models.js)     |     Upsert logic for each entity
  +------------------+
         |
         | reads
         v
  +------------------+
  |  Apollo Server   |     GraphQL schema + resolvers
  |  port 4000       |     Exposes queries for all indexed data
  +------------------+
```

The scanner processes blocks in configurable batches (default: 100 blocks per batch) and polls for new blocks at a configurable interval (default: 3 seconds).

---

## Schema types

### Core entities

#### Position

| Field | Type | Description |
|-------|------|-------------|
| `positionId` | `BigDecimal!` | Unique position identifier |
| `userAddress` | `String!` | Trader's wallet address |
| `marketId` | `Int!` | Market identifier |
| `isLong` | `Boolean!` | True if long, false if short |
| `sizeUsd` | `BigDecimal!` | Notional size in USD (18 decimals) |
| `leverage` | `BigDecimal!` | Leverage used |
| `entryPrice` | `BigDecimal!` | Price at open |
| `collateralToken` | `String` | Collateral token address |
| `collateralAmount` | `BigDecimal!` | Raw collateral amount |
| `collateralUsd` | `BigDecimal!` | Collateral value in USD |
| `status` | `String!` | `open`, `closed`, or `liquidated` |
| `realizedPnl` | `BigDecimal` | PnL at close (null if still open) |
| `exitPrice` | `BigDecimal` | Price at close (null if still open) |
| `openedAt` | `DateTime` | Block timestamp of open |
| `closedAt` | `DateTime` | Block timestamp of close |
| `openBlock` | `Int` | Block number of open |
| `closeBlock` | `Int` | Block number of close |
| `openTxHash` | `String` | Transaction hash of open |
| `closeTxHash` | `String` | Transaction hash of close |
| `market` | `Market` | Nested market data |

#### Trade

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int!` | Auto-incremented trade ID |
| `positionId` | `BigDecimal!` | Related position |
| `userAddress` | `String` | Trader address |
| `marketId` | `Int` | Market identifier |
| `tradeType` | `String!` | `open`, `close`, `partial_close`, `add_size`, `add_collateral` |
| `isLong` | `Boolean` | Direction |
| `sizeUsd` | `BigDecimal!` | Trade size |
| `price` | `BigDecimal!` | Execution price |
| `realizedPnl` | `BigDecimal` | PnL (for closes) |
| `feeUsd` | `BigDecimal` | Fee charged |
| `blockNumber` | `Int!` | Block number |
| `txHash` | `String!` | Transaction hash |
| `blockTimestamp` | `DateTime!` | Block timestamp |

#### Order

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | `BigDecimal!` | Unique order identifier |
| `userAddress` | `String!` | User address |
| `marketId` | `Int!` | Market identifier |
| `orderType` | `Int!` | `0` = limit, `1` = stop-limit |
| `isLong` | `Boolean!` | Direction |
| `triggerPrice` | `BigDecimal!` | Trigger price |
| `sizeUsd` | `BigDecimal!` | Order size |
| `status` | `String!` | `active`, `executed`, `cancelled` |
| `positionId` | `BigDecimal` | Resulting position (if executed) |
| `executionPrice` | `BigDecimal` | Execution price (if executed) |
| `placedAt` | `DateTime` | When the order was placed |
| `resolvedAt` | `DateTime` | When the order was executed or cancelled |

#### Liquidation

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int!` | Auto-incremented ID |
| `positionId` | `BigDecimal!` | Liquidated position |
| `userAddress` | `String!` | Trader address |
| `marketId` | `Int!` | Market identifier |
| `price` | `BigDecimal!` | Liquidation price |
| `penalty` | `BigDecimal!` | Liquidation penalty |
| `keeper` | `String!` | Liquidator address |
| `blockNumber` | `Int!` | Block number |
| `txHash` | `String!` | Transaction hash |
| `blockTimestamp` | `DateTime!` | Block timestamp |

### Market data

#### Market

| Field | Type | Description |
|-------|------|-------------|
| `marketId` | `Int!` | Unique market identifier |
| `name` | `String!` | Human-readable name (e.g., "Bitcoin") |
| `symbol` | `String!` | Ticker symbol (e.g., "BTC") |
| `maxLeverage` | `BigDecimal!` | Maximum allowed leverage |
| `enabled` | `Boolean!` | Whether the market is active |
| `latestPrice` | `LatestPrice` | Nested latest price |
| `poolState` | `PoolState` | Nested vAMM state |
| `fundingRate` | `FundingRate` | Nested latest funding rate |

#### PriceUpdate

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int!` | Auto-incremented ID |
| `marketId` | `Int!` | Market identifier |
| `price` | `BigDecimal!` | Posted price (18 decimals) |
| `onchainTimestamp` | `Int!` | On-chain timestamp |
| `blockNumber` | `Int!` | Block number |
| `txHash` | `String!` | Transaction hash |

#### LatestPrice

| Field | Type | Description |
|-------|------|-------------|
| `marketId` | `Int!` | Market identifier |
| `price` | `BigDecimal!` | Latest price |
| `onchainTimestamp` | `Int!` | When the price was posted on-chain |
| `blockNumber` | `Int!` | Block number |

#### FundingRate

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int!` | Auto-incremented ID |
| `marketId` | `Int!` | Market identifier |
| `ratePerSecond` | `BigDecimal!` | Current funding rate per second |
| `rate24h` | `BigDecimal!` | Annualized 24h rate |
| `blockNumber` | `Int!` | Block number |

#### PoolState (vAMM)

| Field | Type | Description |
|-------|------|-------------|
| `marketId` | `Int!` | Market identifier |
| `baseReserve` | `BigDecimal!` | Virtual base reserve |
| `quoteReserve` | `BigDecimal!` | Virtual quote reserve |
| `oraclePrice` | `BigDecimal` | Oracle price at sync |
| `blockNumber` | `Int` | Block number |

### Vault data

#### UserVault

| Field | Type | Description |
|-------|------|-------------|
| `userAddress` | `String!` | Vault owner |
| `vaultAddress` | `String!` | On-chain vault address |
| `createdAt` | `DateTime` | Creation timestamp |
| `blockNumber` | `Int` | Creation block |

#### VaultEvent

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int!` | Auto-incremented ID |
| `eventType` | `String!` | `deposit`, `withdraw`, `emergency_withdraw`, `lock`, `release` |
| `userAddress` | `String` | User address |
| `tokenAddress` | `String!` | Token address |
| `amount` | `BigDecimal!` | Amount |
| `blockNumber` | `Int!` | Block number |
| `txHash` | `String!` | Transaction hash |

### Aggregates

#### UserStats

| Field | Type | Description |
|-------|------|-------------|
| `userAddress` | `String!` | User address |
| `totalPositions` | `Int!` | Total positions ever opened |
| `openPositions` | `Int!` | Currently open positions |
| `closedPositions` | `Int!` | Closed positions |
| `liquidatedPositions` | `Int!` | Liquidated positions |
| `totalTrades` | `Int!` | Total trades |
| `totalRealizedPnl` | `BigDecimal!` | Sum of realized PnL |
| `totalOrders` | `Int!` | Total orders placed |
| `activeOrders` | `Int!` | Currently active orders |

#### MarketStats

| Field | Type | Description |
|-------|------|-------------|
| `marketId` | `Int!` | Market identifier |
| `symbol` | `String` | Ticker symbol |
| `totalPositions` | `Int!` | Total positions in this market |
| `openPositions` | `Int!` | Currently open |
| `totalTrades` | `Int!` | Total trades |
| `totalLiquidations` | `Int!` | Total liquidations |
| `totalVolume` | `BigDecimal!` | Cumulative volume in USD |
| `latestPrice` | `BigDecimal` | Latest oracle price |
| `latestFundingRate` | `BigDecimal` | Current funding rate |

#### GlobalStats

| Field | Type | Description |
|-------|------|-------------|
| `totalMarkets` | `Int!` | Number of markets |
| `totalPositions` | `Int!` | Total positions across all markets |
| `openPositions` | `Int!` | Currently open positions |
| `totalTrades` | `Int!` | Total trades |
| `totalLiquidations` | `Int!` | Total liquidations |
| `totalVolume` | `BigDecimal!` | Total protocol volume |
| `totalUsers` | `Int!` | Unique users |
| `indexerBlock` | `Int!` | Last indexed block |

---

## Queries

All queries support pagination through `limit` and `offset` parameters where available.

| Query | Arguments | Returns |
|-------|-----------|---------|
| `position(positionId)` | `positionId: String!` | `Position` |
| `positions(...)` | `userAddress, marketId, status, limit, offset` | `[Position!]!` |
| `trades(...)` | `userAddress, marketId, positionId, tradeType, limit, offset` | `[Trade!]!` |
| `order(orderId)` | `orderId: String!` | `Order` |
| `orders(...)` | `userAddress, marketId, status, limit, offset` | `[Order!]!` |
| `liquidations(...)` | `userAddress, marketId, limit, offset` | `[Liquidation!]!` |
| `market(marketId)` | `marketId: Int!` | `Market` |
| `markets` | -- | `[Market!]!` |
| `latestPrices` | -- | `[LatestPrice!]!` |
| `priceHistory(...)` | `marketId: Int!, limit, offset` | `[PriceUpdate!]!` |
| `fundingRates(...)` | `marketId: Int!, limit, offset` | `[FundingRate!]!` |
| `userVault(userAddress)` | `userAddress: String!` | `UserVault` |
| `vaultEvents(...)` | `userAddress, eventType, limit, offset` | `[VaultEvent!]!` |
| `collateralTokens` | -- | `[CollateralToken!]!` |
| `poolStates` | -- | `[PoolState!]!` |
| `poolState(marketId)` | `marketId: Int!` | `PoolState` |
| `feeConfig` | -- | `FeeConfig` |
| `protocolEvents(...)` | `eventName, limit, offset` | `[ProtocolEvent!]!` |
| `userStats(userAddress)` | `userAddress: String!` | `UserStats` |
| `marketStats(marketId)` | `marketId: Int!` | `MarketStats` |
| `globalStats` | -- | `GlobalStats` |
| `indexerStatus` | -- | `IndexerStatus` |

---

## Example queries

### Get all markets with latest prices

```graphql
query {
  markets {
    marketId
    name
    symbol
    maxLeverage
    enabled
    latestPrice {
      price
      onchainTimestamp
    }
    fundingRate {
      ratePerSecond
      rate24h
    }
  }
}
```

### Get a user's open positions

```graphql
query {
  positions(
    userAddress: "0xYourAddress"
    status: "open"
  ) {
    positionId
    marketId
    isLong
    sizeUsd
    leverage
    entryPrice
    collateralUsd
    openedAt
  }
}
```

### Get recent trades for a market

```graphql
query {
  trades(marketId: 0, limit: 20) {
    positionId
    tradeType
    isLong
    sizeUsd
    price
    realizedPnl
    blockTimestamp
    txHash
  }
}
```

### Get a specific position with full history

```graphql
query {
  position(positionId: "42") {
    positionId
    userAddress
    marketId
    isLong
    sizeUsd
    leverage
    entryPrice
    exitPrice
    realizedPnl
    status
    openedAt
    closedAt
    openTxHash
    closeTxHash
  }
}
```

### Get active orders for a user

```graphql
query {
  orders(
    userAddress: "0xYourAddress"
    status: "active"
  ) {
    orderId
    marketId
    orderType
    isLong
    triggerPrice
    sizeUsd
    placedAt
  }
}
```

### Get recent liquidations

```graphql
query {
  liquidations(limit: 10) {
    positionId
    userAddress
    marketId
    price
    penalty
    keeper
    blockTimestamp
    txHash
  }
}
```

### Get price history for BTC

```graphql
query {
  priceHistory(marketId: 0, limit: 100) {
    price
    onchainTimestamp
    blockNumber
  }
}
```

### Get user stats (portfolio summary)

```graphql
query {
  userStats(userAddress: "0xYourAddress") {
    totalPositions
    openPositions
    closedPositions
    liquidatedPositions
    totalTrades
    totalRealizedPnl
    totalOrders
    activeOrders
  }
}
```

### Get global protocol stats

```graphql
query {
  globalStats {
    totalMarkets
    totalPositions
    openPositions
    totalTrades
    totalLiquidations
    totalVolume
    totalUsers
    indexerBlock
  }
}
```

### Check indexer sync status

```graphql
query {
  indexerStatus {
    lastIndexedBlock
    chainHead
    blocksScanned
    eventsProcessed
    isSynced
  }
}
```

---

## Running the indexer

### Prerequisites

- Node.js 18 or later
- PostgreSQL 14 or later
- Access to a Paxeer Network RPC endpoint

### Setup

```bash
cd .indexer
cp .env.example .env
# Edit .env with your database URL and RPC endpoint
npm install
```

### Configuration

The indexer reads from `.indexer/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | _(required)_ | PostgreSQL connection string |
| `RPC_URL` | `https://public-rpc.paxeer.app/rpc` | Paxeer RPC endpoint |
| `DIAMOND_ADDRESS` | `0xeA65FE02665852c615774A3041DFE6f00fb77537` | Diamond proxy address |
| `START_BLOCK` | `1301600` | Block to start indexing from |
| `BATCH_SIZE` | `100` | Blocks per scan batch |
| `POLL_INTERVAL_MS` | `3000` | Polling interval in milliseconds |
| `GRAPHQL_PORT` | `4000` | GraphQL server port |
| `LOG_LEVEL` | `info` | Logging level |

### Start

```bash
npm start
```

The indexer will:

1. Run database migrations (creates all 14 tables if they do not exist)
2. Start the Apollo GraphQL server on port 4000
3. Sync historical blocks from `START_BLOCK` to the chain head
4. Switch to live polling mode, processing new blocks as they arrive

### GraphQL Playground

Once running, open `http://localhost:4000/graphql` in your browser to access the Apollo GraphQL playground.

### Database tables

The indexer creates 14 tables:

| Table | Stores |
|-------|--------|
| `positions` | All position data (open, closed, liquidated) |
| `trades` | Every trade event (opens, closes, modifications) |
| `orders` | Limit and stop-limit orders |
| `liquidations` | Liquidation events |
| `price_updates` | Historical price posts |
| `latest_prices` | Most recent price per market |
| `funding_rates` | Funding rate snapshots |
| `markets` | Market definitions |
| `user_vaults` | User-to-vault mappings |
| `vault_events` | Deposits, withdrawals, locks, releases |
| `collateral_tokens` | Whitelisted collateral |
| `pool_states` | vAMM reserve snapshots |
| `fee_configs` | Fee configuration history |
| `protocol_events` | Raw event log archive |
| `indexer_state` | Scanner checkpoint (last indexed block) |

---

<p align="center">
  <a href="./oracle.md"><img src="https://img.shields.io/badge/%E2%86%90_Oracle_System-grey?style=for-the-badge" alt="Previous" /></a>
  &nbsp;
  <a href="./sdk-reference.md"><img src="https://img.shields.io/badge/SDK_Reference_%E2%86%92-3178C6?style=for-the-badge" alt="Next" /></a>
</p>
