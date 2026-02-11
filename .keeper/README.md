# PPMM Keeper Node

Off-chain keeper service for the Sidiora Perpetual Protocol. Monitors on-chain state and executes three duties:

1. **Order Execution** — Detects when limit and stop-limit order trigger conditions are met, calls `executeOrder()` on the OrderBookFacet.
2. **Liquidation** — Scans open positions for undercollateralized margin, calls `liquidate()` on the LiquidationFacet. Earns 60% of the liquidation penalty as a keeper reward.
3. **vAMM Sync** — After each oracle price update, calls `syncToOracle()` on the VirtualAMMFacet to converge mark price toward the index price.

## Architecture

```
  Oracle Node (posts prices)
         |
         | PricesUpdated event
         v
  +------------------+
  |  Event Listener  |     Polls for PricesUpdated events
  +------------------+
         |
         | triggers execution cycle
         v
  +------------------+     +------------------------+     +---------------+
  |  Order Scanner   | --> |  Liquidation Scanner   | --> |  vAMM Syncer  |
  +------------------+     +------------------------+     +---------------+
         |                          |                          |
         | executeOrder()           | liquidate()              | syncToOracle()
         v                          v                          v
  +-------------------------------------------------------------------+
  |                     Diamond Proxy (on-chain)                      |
  +-------------------------------------------------------------------+
```

## Prerequisites

- Node.js 18+
- The oracle node must be running (keeper reacts to its price updates)
- The keeper wallet must have `KEEPER_ROLE` granted via AccessControlFacet
- PAX balance for gas

## Setup

```bash
cd .keeper
cp .env.example .env
# Edit .env with your KEEPER_PRIVATE_KEY
npm install
```

## Usage

```bash
# Full keeper (orders + liquidations + vAMM sync)
npm start

# Debug mode
npm run dev

# Orders only
npm run orders-only

# Liquidations only
npm run liquidations-only
```

## Configuration

See `.env.example` for all available options. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `KEEPER_PRIVATE_KEY` | _(required)_ | Wallet with KEEPER_ROLE |
| `RPC_URL` | `https://public-rpc.paxeer.app/rpc` | Paxeer RPC |
| `DIAMOND_ADDRESS` | `0xeA65...537` | Diamond proxy |
| `INDEXER_GRAPHQL_URL` | `http://localhost:4000/graphql` | Indexer for state queries |
| `FALLBACK_POLL_INTERVAL_MS` | `15000` | Price polling interval |
| `GAS_LIMIT_EXECUTE_ORDER` | `800000` | Gas per order execution |
| `GAS_LIMIT_LIQUIDATE` | `1000000` | Gas per liquidation |
| `GAS_LIMIT_SYNC_VAMM` | `300000` | Gas per vAMM sync |

## Granting KEEPER_ROLE

The keeper wallet needs `KEEPER_ROLE` to call `executeOrder()` and `syncToOracle()`. Liquidation is permissionless.

```javascript
// From the Diamond owner account:
const diamond = new ethers.Contract(DIAMOND_ADDRESS, accessControlAbi, ownerWallet);
const KEEPER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("KEEPER"));
await diamond.grantRole(KEEPER_ROLE, KEEPER_WALLET_ADDRESS);
```
