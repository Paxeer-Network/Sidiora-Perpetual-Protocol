#!/usr/bin/env node

const { pool } = require("./pool");

/**
 * Database migration — creates all tables for the PPMM indexer.
 *
 * Usage:
 *   node src/db/migrate.js          # Create tables
 *   node src/db/migrate.js --reset  # Drop & recreate all tables
 */

const SCHEMA = `
-- ============================================================
--  INDEXER STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS indexer_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  MARKETS
-- ============================================================

CREATE TABLE IF NOT EXISTS markets (
  market_id       INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  max_leverage    NUMERIC NOT NULL DEFAULT 0,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  block_number    BIGINT,
  tx_hash         TEXT
);

-- ============================================================
--  COLLATERAL TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS collateral_tokens (
  token_address   TEXT PRIMARY KEY,
  decimals        INTEGER NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  added_at        TIMESTAMPTZ DEFAULT NOW(),
  block_number    BIGINT,
  tx_hash         TEXT
);

-- ============================================================
--  POSITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS positions (
  position_id     NUMERIC PRIMARY KEY,
  user_address    TEXT NOT NULL,
  market_id       INTEGER NOT NULL,
  is_long         BOOLEAN NOT NULL,
  size_usd        NUMERIC NOT NULL,
  leverage        NUMERIC NOT NULL,
  entry_price     NUMERIC NOT NULL,
  collateral_token TEXT,
  collateral_amount NUMERIC NOT NULL DEFAULT 0,
  collateral_usd  NUMERIC NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'open', -- open, closed, liquidated
  realized_pnl    NUMERIC DEFAULT 0,
  exit_price      NUMERIC,
  opened_at       TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  open_block      BIGINT,
  close_block     BIGINT,
  open_tx_hash    TEXT,
  close_tx_hash   TEXT
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_address);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions(user_address, status);

-- ============================================================
--  TRADES (derived from position open/close events)
-- ============================================================

CREATE TABLE IF NOT EXISTS trades (
  id              SERIAL PRIMARY KEY,
  position_id     NUMERIC NOT NULL,
  user_address    TEXT NOT NULL,
  market_id       INTEGER NOT NULL,
  trade_type      TEXT NOT NULL, -- open, close, partial_close, modify, liquidation
  is_long         BOOLEAN,
  size_usd        NUMERIC NOT NULL,
  price           NUMERIC NOT NULL,
  realized_pnl    NUMERIC DEFAULT 0,
  fee_usd         NUMERIC DEFAULT 0,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_address);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_position ON trades(position_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(block_timestamp DESC);

-- ============================================================
--  ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  order_id        NUMERIC PRIMARY KEY,
  user_address    TEXT NOT NULL,
  market_id       INTEGER NOT NULL,
  order_type      INTEGER NOT NULL, -- 0=limit, 1=stop, 2=take_profit, etc.
  is_long         BOOLEAN NOT NULL,
  trigger_price   NUMERIC NOT NULL,
  size_usd        NUMERIC NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active', -- active, executed, cancelled
  position_id     NUMERIC,
  execution_price NUMERIC,
  placed_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  placed_block    BIGINT,
  resolved_block  BIGINT,
  placed_tx_hash  TEXT,
  resolved_tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_address);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================================
--  LIQUIDATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS liquidations (
  id              SERIAL PRIMARY KEY,
  position_id     NUMERIC NOT NULL,
  user_address    TEXT NOT NULL,
  market_id       INTEGER NOT NULL,
  price           NUMERIC NOT NULL,
  penalty         NUMERIC NOT NULL,
  keeper          TEXT NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_liquidations_user ON liquidations(user_address);
CREATE INDEX IF NOT EXISTS idx_liquidations_market ON liquidations(market_id);

-- ============================================================
--  PRICE UPDATES
-- ============================================================

CREATE TABLE IF NOT EXISTS price_updates (
  id              SERIAL PRIMARY KEY,
  market_id       INTEGER NOT NULL,
  price           NUMERIC NOT NULL,
  onchain_timestamp BIGINT NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prices_market ON price_updates(market_id);
CREATE INDEX IF NOT EXISTS idx_prices_market_time ON price_updates(market_id, block_timestamp DESC);

-- keep only latest per market for quick lookup
CREATE TABLE IF NOT EXISTS latest_prices (
  market_id       INTEGER PRIMARY KEY,
  price           NUMERIC NOT NULL,
  onchain_timestamp BIGINT NOT NULL,
  block_number    BIGINT NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  FUNDING RATES
-- ============================================================

CREATE TABLE IF NOT EXISTS funding_rates (
  id              SERIAL PRIMARY KEY,
  market_id       INTEGER NOT NULL,
  rate_per_second NUMERIC NOT NULL,
  rate_24h        NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_funding_market ON funding_rates(market_id);
CREATE INDEX IF NOT EXISTS idx_funding_market_time ON funding_rates(market_id, block_timestamp DESC);

-- ============================================================
--  USER VAULTS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_vaults (
  user_address    TEXT PRIMARY KEY,
  vault_address   TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  block_number    BIGINT,
  tx_hash         TEXT
);

-- ============================================================
--  VAULT EVENTS (deposits, withdrawals)
-- ============================================================

CREATE TABLE IF NOT EXISTS vault_events (
  id              SERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL, -- deposit, withdrawal, vault_funded, vault_defunded
  user_address    TEXT,
  token_address   TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_events_user ON vault_events(user_address);
CREATE INDEX IF NOT EXISTS idx_vault_events_type ON vault_events(event_type);

-- ============================================================
--  PROTOCOL EVENTS (admin actions, role changes, pauses, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS protocol_events (
  id              SERIAL PRIMARY KEY,
  event_name      TEXT NOT NULL,
  event_data      JSONB NOT NULL DEFAULT '{}',
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_protocol_events_name ON protocol_events(event_name);
CREATE INDEX IF NOT EXISTS idx_protocol_events_time ON protocol_events(block_timestamp DESC);

-- ============================================================
--  POOL STATE (vAMM)
-- ============================================================

CREATE TABLE IF NOT EXISTS pool_state (
  market_id       INTEGER PRIMARY KEY,
  base_reserve    NUMERIC NOT NULL DEFAULT 0,
  quote_reserve   NUMERIC NOT NULL DEFAULT 0,
  oracle_price    NUMERIC DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  block_number    BIGINT
);

-- ============================================================
--  FEES CONFIG
-- ============================================================

CREATE TABLE IF NOT EXISTS fee_config (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  taker_fee_bps       INTEGER NOT NULL DEFAULT 0,
  maker_fee_bps       INTEGER NOT NULL DEFAULT 0,
  liquidation_fee_bps INTEGER NOT NULL DEFAULT 0,
  insurance_fee_bps   INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  block_number        BIGINT
);
`;

const DROP_SCHEMA = `
DROP TABLE IF EXISTS fee_config CASCADE;
DROP TABLE IF EXISTS pool_state CASCADE;
DROP TABLE IF EXISTS protocol_events CASCADE;
DROP TABLE IF EXISTS vault_events CASCADE;
DROP TABLE IF EXISTS user_vaults CASCADE;
DROP TABLE IF EXISTS funding_rates CASCADE;
DROP TABLE IF EXISTS latest_prices CASCADE;
DROP TABLE IF EXISTS price_updates CASCADE;
DROP TABLE IF EXISTS liquidations CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS collateral_tokens CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS indexer_state CASCADE;
`;

async function migrate(reset = false) {
  const client = await pool.connect();
  try {
    if (reset) {
      console.log("Dropping all tables...");
      await client.query(DROP_SCHEMA);
      console.log("Tables dropped.");
    }

    console.log("Creating tables...");
    await client.query(SCHEMA);
    console.log("Migration complete.");

    // Set initial indexer state if not present
    await client.query(`
      INSERT INTO indexer_state (key, value)
      VALUES ('last_indexed_block', '0')
      ON CONFLICT (key) DO NOTHING
    `);
  } finally {
    client.release();
  }
}

// CLI execution
if (require.main === module) {
  const reset = process.argv.includes("--reset");
  migrate(reset)
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

module.exports = { migrate };
