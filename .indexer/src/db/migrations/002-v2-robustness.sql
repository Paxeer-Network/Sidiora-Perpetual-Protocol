-- ============================================================
--  V2 ROBUSTNESS UPGRADE — New tables for KeeperMulticallFacet,
--  TradingAccount, and enhanced order tracking.
--  Run after 001 (initial schema from migrate.js).
-- ============================================================

-- ============================================================
--  KEEPER CYCLES
-- ============================================================

CREATE TABLE IF NOT EXISTS keeper_cycles (
  id                    SERIAL PRIMARY KEY,
  onchain_timestamp     BIGINT NOT NULL,
  markets_updated       INTEGER NOT NULL DEFAULT 0,
  orders_executed       INTEGER NOT NULL DEFAULT 0,
  liquidations_executed INTEGER NOT NULL DEFAULT 0,
  orders_failed         INTEGER NOT NULL DEFAULT 0,
  liquidations_failed   INTEGER NOT NULL DEFAULT 0,
  block_number          BIGINT NOT NULL,
  tx_hash               TEXT NOT NULL,
  block_timestamp       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_keeper_cycles_time ON keeper_cycles(block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_keeper_cycles_block ON keeper_cycles(block_number);

-- ============================================================
--  ACCOUNT LEDGER (TradingAccount ledger entries)
-- ============================================================

CREATE TABLE IF NOT EXISTS account_ledger (
  id              SERIAL PRIMARY KEY,
  entry_id        NUMERIC NOT NULL,
  user_address    TEXT NOT NULL,
  entry_type      INTEGER NOT NULL,
  token_address   TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  position_id     NUMERIC NOT NULL DEFAULT 0,
  is_debit        BOOLEAN NOT NULL DEFAULT FALSE,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_ledger_user ON account_ledger(user_address);
CREATE INDEX IF NOT EXISTS idx_account_ledger_position ON account_ledger(position_id);
CREATE INDEX IF NOT EXISTS idx_account_ledger_time ON account_ledger(block_timestamp DESC);

-- ============================================================
--  DELEGATES (TradingAccount delegation)
-- ============================================================

CREATE TABLE IF NOT EXISTS delegates (
  id                SERIAL PRIMARY KEY,
  user_address      TEXT NOT NULL,
  delegate_address  TEXT NOT NULL,
  can_trade         BOOLEAN NOT NULL DEFAULT FALSE,
  can_withdraw      BOOLEAN NOT NULL DEFAULT FALSE,
  can_modify_margin BOOLEAN NOT NULL DEFAULT FALSE,
  expiry            NUMERIC NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  block_number      BIGINT NOT NULL,
  tx_hash           TEXT NOT NULL,
  block_timestamp   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delegates_user ON delegates(user_address);
CREATE INDEX IF NOT EXISTS idx_delegates_delegate ON delegates(delegate_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delegates_pair ON delegates(user_address, delegate_address);

-- ============================================================
--  TRADING ACCOUNT EVENTS
--  (MarginLocked, MarginReleased, MarginModeChanged, MarginTransferred)
-- ============================================================

CREATE TABLE IF NOT EXISTS trading_account_events (
  id              SERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL,
  user_address    TEXT NOT NULL,
  position_id     NUMERIC DEFAULT 0,
  token_address   TEXT,
  amount          NUMERIC DEFAULT 0,
  extra_data      JSONB DEFAULT '{}',
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ta_events_user ON trading_account_events(user_address);
CREATE INDEX IF NOT EXISTS idx_ta_events_type ON trading_account_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ta_events_time ON trading_account_events(block_timestamp DESC);

-- ============================================================
--  ADD failure_reason COLUMN TO orders TABLE
--  (for OrderExecutionFailed events)
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- ============================================================
--  ADD margin_mode COLUMN TO user_vaults TABLE
--  (for MarginModeChanged events: 0=ISOLATED, 1=CROSS)
-- ============================================================

ALTER TABLE user_vaults ADD COLUMN IF NOT EXISTS margin_mode INTEGER DEFAULT 0;
