# PPMM Indexer

Custom on-chain event indexer for the Perpetual Product Market Maker protocol. Scans all events from the Diamond proxy, stores them in PostgreSQL, and exposes a **GraphQL API** for the frontend.

## Architecture

```
index.js                    ← Main: migrate → start GraphQL → sync → poll
├── src/
│   ├── config.js           ← Environment config
│   ├── abi.js              ← Combined event ABI for all 18 facets
│   ├── logger.js           ← Winston logger (console + file)
│   ├── scanner.js          ← Block scanner: fetch logs → decode → route to DB
│   ├── db/
│   │   ├── pool.js         ← PostgreSQL connection pool
│   │   ├── migrate.js      ← Schema migrations (14 tables)
│   │   └── models.js       ← Insert/update functions per entity
│   └── graphql/
│       ├── schema.js       ← GraphQL type definitions
│       ├── resolvers.js    ← Query resolvers (positions, trades, prices, stats...)
│       └── server.js       ← Apollo Server + Express
```

## Events Indexed

| Category     | Events |
|-------------|--------|
| Positions   | PositionOpened, PositionModified, PositionClosed |
| Orders      | OrderPlaced, OrderExecuted, OrderCancelled |
| Liquidations| Liquidation, ADLExecuted |
| Prices      | PricesUpdated |
| Funding     | FundingRateUpdated, FundingSettled |
| Markets     | MarketCreated, MarketUpdated, MarketEnabled, MarketDisabled, FeesUpdated |
| Vaults      | VaultCreated, CollateralDeposited, CollateralWithdrawn, VaultFunded, VaultDefunded |
| Collateral  | CollateralAdded, CollateralRemoved |
| vAMM        | PoolInitialized, PoolSynced, PoolReservesUpdated |
| Pausable    | GlobalPaused/Unpaused, MarketPaused/Unpaused |
| Access      | RoleGranted, RoleRevoked |
| Diamond     | DiamondCut, OwnershipTransferred |
| Oracle Admin| PricePosterAdded/Removed, MaxPriceStalenessUpdated |
| Insurance   | InsuranceWithdrawn, ADLThresholdUpdated |

## Setup

```bash
cd .indexer

# Install dependencies
npm install

# Create the PostgreSQL database
createdb ppmm_indexer

# Run migrations
npm run migrate

# (Optional) Reset database
npm run reset-db
```

## Run

```bash
# Normal mode
npm start

# Verbose / debug
npm run dev
```

## Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/ppmm_indexer` | PostgreSQL connection |
| `RPC_URL` | `https://public-rpc.paxeer.app/rpc` | Paxeer Network RPC |
| `DIAMOND_ADDRESS` | `0xeA65FE02...` | Diamond proxy address |
| `START_BLOCK` | `1301600` | Block to start indexing from |
| `BATCH_SIZE` | `100` | Blocks per scan batch |
| `POLL_INTERVAL_MS` | `3000` | Live polling interval |
| `GRAPHQL_PORT` | `4000` | GraphQL API port |

## GraphQL API

Once running, the API is available at `http://localhost:4000/graphql`.

### Example Queries

```graphql
# Get all markets with latest prices
{
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
  }
}

# Get user positions
{
  positions(userAddress: "0x...", status: "open") {
    positionId
    marketId
    isLong
    sizeUsd
    leverage
    entryPrice
    collateralAmount
    market {
      symbol
    }
  }
}

# Get recent trades
{
  trades(marketId: 0, limit: 20) {
    positionId
    tradeType
    sizeUsd
    price
    realizedPnl
    blockTimestamp
  }
}

# User stats
{
  userStats(userAddress: "0x...") {
    totalPositions
    openPositions
    closedPositions
    liquidatedPositions
    totalRealizedPnl
  }
}

# Global protocol stats
{
  globalStats {
    totalMarkets
    totalPositions
    openPositions
    totalTrades
    totalVolume
    totalUsers
  }
}

# Indexer health
{
  indexerStatus {
    lastIndexedBlock
    chainHead
    eventsProcessed
    isSynced
  }
}
```

### Endpoints

- `POST /graphql` — GraphQL API
- `GET /health` — Health check (JSON)

## Database Tables

| Table | Description |
|-------|-------------|
| `indexer_state` | Last indexed block, metadata |
| `markets` | Market registry |
| `collateral_tokens` | Whitelisted collateral |
| `positions` | All positions (open/closed/liquidated) |
| `trades` | Trade history (opens, closes, modifications) |
| `orders` | Limit/stop orders |
| `liquidations` | Liquidation events |
| `price_updates` | Full price history |
| `latest_prices` | Latest price per market |
| `funding_rates` | Funding rate history |
| `user_vaults` | User vault addresses |
| `vault_events` | Deposits, withdrawals |
| `pool_state` | vAMM pool reserves |
| `fee_config` | Current fee configuration |
| `protocol_events` | Admin/governance events |

## Logs

Written to `.indexer/logs/`:
- `indexer.log` — All logs (10MB rotation, 5 files)
- `indexer-errors.log` — Errors only (5MB rotation, 3 files)
