# PPMM Oracle Node

Oracle service that fetches real-time prices from **Pyth Network** (Hermes) and submits them to the **OracleFacet** on the PPMM Diamond contract via `batchUpdatePrices()`.

## Markets

| ID | Symbol | Pyth Feed ID |
|----|--------|-------------|
| 0  | BTC    | `0xe62df6c8...` |
| 1  | ETH    | `0xff61491a...` |
| 2  | SOL    | `0xef0d8b6f...` |
| 3  | AVAX   | `0x93da3352...` |
| 4  | LINK   | `0x8ac0c70f...` |

## Setup

```bash
cd .oracle
npm install
cp .env .env.backup   # backup before editing
# Edit .env with your ORACLE_PRIVATE_KEY and DIAMOND_ADDRESS
```

## Run

```bash
# Normal mode
npm start

# Verbose / debug mode
npm run dev
```

## Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `ORACLE_PRIVATE_KEY` | — | Private key with ORACLE_POSTER_ROLE |
| `RPC_URL` | `https://public-rpc.paxeer.app/rpc` | Paxeer Network RPC |
| `DIAMOND_ADDRESS` | `0xeA65FE02...` | Diamond proxy address |
| `PYTH_HERMES_URL` | `https://hermes.pyth.network` | Pyth Hermes endpoint |
| `UPDATE_INTERVAL_MS` | `5000` | Price update interval (ms) |
| `DEVIATION_THRESHOLD_PCT` | `0.5` | Deviation % for immediate update |
| `MAX_CONSECUTIVE_FAILURES` | `10` | Failure count before alert |
| `GAS_LIMIT` | `500000` | Gas limit per tx |

## Architecture

```
index.js              ← Main loop: fetch → submit → wait → repeat
├── config.js         ← Markets, Pyth IDs, node config, ABI
└── src/
    ├── pyth-fetcher.js   ← Pyth Hermes client, price normalization
    ├── submitter.js      ← On-chain batchUpdatePrices, retries, stats
    └── logger.js         ← Winston logger (console + file)
```

## Logs

Logs are written to `.oracle/logs/`:
- `oracle-node.log` — All logs (rotated at 10MB, 5 files)
- `oracle-errors.log` — Errors only (rotated at 5MB, 3 files)

## Graceful Shutdown

Send `SIGINT` (Ctrl+C) or `SIGTERM` to stop. The node prints a summary of total submissions and failures.
