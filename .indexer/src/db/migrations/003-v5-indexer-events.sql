-- ============================================================
--  V5 INDEXER EVENTS — New tables for LibIndexerEvents coverage.
--  Adds: fees, trade_settlements, oi_snapshots, mark_price_history,
--  vault_balance_history, funding_payments, market_snapshots,
--  protocol_snapshots, entry_price_changes, spot tables, block_hashes.
--  Run after 002-v2-robustness.
-- ============================================================

-- ============================================================
--  FEES (FeeCollected events — per-trade fee breakdown)
-- ============================================================

CREATE TABLE IF NOT EXISTS fees (
  id              SERIAL PRIMARY KEY,
  position_id     NUMERIC NOT NULL,
  user_address    TEXT NOT NULL,
  market_id       INTEGER NOT NULL,
  fee_type        INTEGER NOT NULL, -- 0=TAKER, 1=MAKER, 2=LIQUIDATION, 3=BORROWING
  fee_usd         NUMERIC NOT NULL,
  fee_tokens      NUMERIC NOT NULL,
  token_address   TEXT NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fees_user ON fees(user_address);
CREATE INDEX IF NOT EXISTS idx_fees_market ON fees(market_id);
CREATE INDEX IF NOT EXISTS idx_fees_position ON fees(position_id);
CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(fee_type);
CREATE INDEX IF NOT EXISTS idx_fees_time ON fees(block_timestamp DESC);

-- ============================================================
--  INSURANCE CONTRIBUTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS insurance_contributions (
  id              SERIAL PRIMARY KEY,
  token_address   TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  source          INTEGER NOT NULL, -- 0=TRADING_FEE, 1=LIQUIDATION_PENALTY
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insurance_contrib_time ON insurance_contributions(block_timestamp DESC);

-- ============================================================
--  TRADE SETTLEMENTS (TradeSettled — full PnL decomposition)
-- ============================================================

CREATE TABLE IF NOT EXISTS trade_settlements (
  id              SERIAL PRIMARY KEY,
  position_id     NUMERIC NOT NULL,
  user_address    TEXT NOT NULL,
  market_id       INTEGER NOT NULL,
  trade_type      INTEGER NOT NULL, -- 0=OPEN, 1=CLOSE, 2=PARTIAL_CLOSE, 3=LIQUIDATION, 4=ADL
  size_usd        NUMERIC NOT NULL,
  execution_price NUMERIC NOT NULL,
  gross_pnl       NUMERIC NOT NULL,
  total_fees_usd  NUMERIC NOT NULL,
  borrowing_fee_usd NUMERIC NOT NULL DEFAULT 0,
  funding_paid_usd NUMERIC NOT NULL DEFAULT 0,
  net_payout_tokens NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_settlements_user ON trade_settlements(user_address);
CREATE INDEX IF NOT EXISTS idx_trade_settlements_market ON trade_settlements(market_id);
CREATE INDEX IF NOT EXISTS idx_trade_settlements_position ON trade_settlements(position_id);
CREATE INDEX IF NOT EXISTS idx_trade_settlements_type ON trade_settlements(trade_type);
CREATE INDEX IF NOT EXISTS idx_trade_settlements_time ON trade_settlements(block_timestamp DESC);

-- ============================================================
--  OI SNAPSHOTS (OpenInterestChanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS oi_snapshots (
  id              SERIAL PRIMARY KEY,
  market_id       INTEGER NOT NULL,
  long_oi         NUMERIC NOT NULL,
  short_oi        NUMERIC NOT NULL,
  delta_usd       NUMERIC NOT NULL,
  is_increase     BOOLEAN NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oi_market ON oi_snapshots(market_id);
CREATE INDEX IF NOT EXISTS idx_oi_market_time ON oi_snapshots(market_id, block_timestamp DESC);

-- ============================================================
--  MARK PRICE HISTORY (MarkPriceChanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS mark_price_history (
  id              SERIAL PRIMARY KEY,
  market_id       INTEGER NOT NULL,
  mark_price      NUMERIC NOT NULL,
  index_price     NUMERIC NOT NULL,
  base_reserve    NUMERIC NOT NULL,
  quote_reserve   NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mark_price_market ON mark_price_history(market_id);
CREATE INDEX IF NOT EXISTS idx_mark_price_market_time ON mark_price_history(market_id, block_timestamp DESC);

-- ============================================================
--  VAULT BALANCE HISTORY (VaultBalanceChanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS vault_balance_history (
  id              SERIAL PRIMARY KEY,
  token_address   TEXT NOT NULL,
  vault_type      INTEGER NOT NULL, -- 0=CENTRAL, 1=SPOT, 2=INSURANCE
  new_balance     NUMERIC NOT NULL,
  delta           NUMERIC NOT NULL,
  is_increase     BOOLEAN NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_balance_token ON vault_balance_history(token_address);
CREATE INDEX IF NOT EXISTS idx_vault_balance_type ON vault_balance_history(vault_type);
CREATE INDEX IF NOT EXISTS idx_vault_balance_time ON vault_balance_history(block_timestamp DESC);

-- ============================================================
--  FUNDING PAYMENTS (PositionFundingApplied — per-position)
-- ============================================================

CREATE TABLE IF NOT EXISTS funding_payments (
  id              SERIAL PRIMARY KEY,
  position_id     NUMERIC NOT NULL,
  user_address    TEXT NOT NULL,
  market_id       INTEGER NOT NULL,
  funding_payment_usd NUMERIC NOT NULL, -- positive = paid, negative = received
  new_collateral_usd  NUMERIC NOT NULL,
  new_collateral_amount NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_funding_payments_user ON funding_payments(user_address);
CREATE INDEX IF NOT EXISTS idx_funding_payments_position ON funding_payments(position_id);
CREATE INDEX IF NOT EXISTS idx_funding_payments_market ON funding_payments(market_id);
CREATE INDEX IF NOT EXISTS idx_funding_payments_time ON funding_payments(block_timestamp DESC);

-- ============================================================
--  MARKET SNAPSHOTS (MarketSnapshot — periodic keeper-triggered)
-- ============================================================

CREATE TABLE IF NOT EXISTS market_snapshots (
  id              SERIAL PRIMARY KEY,
  market_id       INTEGER NOT NULL,
  long_oi         NUMERIC NOT NULL,
  short_oi        NUMERIC NOT NULL,
  mark_price      NUMERIC NOT NULL,
  index_price     NUMERIC NOT NULL,
  funding_rate_per_second NUMERIC NOT NULL,
  funding_rate_24h NUMERIC NOT NULL,
  volume_24h_usd  NUMERIC NOT NULL DEFAULT 0,
  onchain_timestamp BIGINT NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_market ON market_snapshots(market_id);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_time ON market_snapshots(block_timestamp DESC);

-- ============================================================
--  PROTOCOL SNAPSHOTS (ProtocolSnapshot — aggregate)
-- ============================================================

CREATE TABLE IF NOT EXISTS protocol_snapshots (
  id              SERIAL PRIMARY KEY,
  total_positions  NUMERIC NOT NULL,
  total_open_positions NUMERIC NOT NULL,
  total_markets   NUMERIC NOT NULL,
  tvl_usd         NUMERIC NOT NULL,
  insurance_total_usd NUMERIC NOT NULL,
  onchain_timestamp BIGINT NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_protocol_snapshots_time ON protocol_snapshots(block_timestamp DESC);

-- ============================================================
--  ENTRY PRICE CHANGES (PositionEntryPriceChanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS entry_price_changes (
  id              SERIAL PRIMARY KEY,
  position_id     NUMERIC NOT NULL,
  old_entry_price NUMERIC NOT NULL,
  new_entry_price NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entry_price_position ON entry_price_changes(position_id);

-- ============================================================
--  SPOT VOLUMES (SpotVolumeRecorded)
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_volumes (
  id              SERIAL PRIMARY KEY,
  trader_address  TEXT NOT NULL,
  market_id       TEXT NOT NULL, -- bytes32 as hex
  volume_usd      NUMERIC NOT NULL,
  new_cumulative_30d NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_volumes_trader ON spot_volumes(trader_address);
CREATE INDEX IF NOT EXISTS idx_spot_volumes_time ON spot_volumes(block_timestamp DESC);

-- ============================================================
--  SPOT VIRTUAL BALANCES (SpotVirtualBalanceChanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_virtual_balances (
  id              SERIAL PRIMARY KEY,
  user_address    TEXT NOT NULL,
  token_address   TEXT NOT NULL,
  new_balance     NUMERIC NOT NULL,
  delta           NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_vb_user ON spot_virtual_balances(user_address);
CREATE INDEX IF NOT EXISTS idx_spot_vb_token ON spot_virtual_balances(token_address);

-- ============================================================
--  SPOT VAULT BALANCE HISTORY (SpotVaultBalanceChanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_vault_balance_history (
  id              SERIAL PRIMARY KEY,
  token_address   TEXT NOT NULL,
  new_balance     NUMERIC NOT NULL,
  delta           NUMERIC NOT NULL,
  is_increase     BOOLEAN NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_vault_token ON spot_vault_balance_history(token_address);
CREATE INDEX IF NOT EXISTS idx_spot_vault_time ON spot_vault_balance_history(block_timestamp DESC);

-- ============================================================
--  SPOT FEE TIER UPDATES (SpotFeeTierUpdated)
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_fee_tier_updates (
  id              SERIAL PRIMARY KEY,
  trader_address  TEXT NOT NULL,
  old_tier        INTEGER NOT NULL,
  new_tier        INTEGER NOT NULL,
  volume_30d      NUMERIC NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_fee_tier_trader ON spot_fee_tier_updates(trader_address);

-- ============================================================
--  COLLATERAL CONFIG CHANGES (CollateralConfigChanged)
-- ============================================================

CREATE TABLE IF NOT EXISTS collateral_config_changes (
  id              SERIAL PRIMARY KEY,
  token_address   TEXT NOT NULL,
  decimals        INTEGER NOT NULL,
  accepted        BOOLEAN NOT NULL,
  is_spot         BOOLEAN NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_collateral_config_token ON collateral_config_changes(token_address);

-- ============================================================
--  BLOCK HASHES (for reorg detection — defense in depth)
-- ============================================================

CREATE TABLE IF NOT EXISTS block_hashes (
  block_number    BIGINT PRIMARY KEY,
  block_hash      TEXT NOT NULL,
  parent_hash     TEXT,
  block_timestamp TIMESTAMPTZ NOT NULL
);

-- ============================================================
--  ADD expired STATUS TO orders (for OrderExpired events)
-- ============================================================

-- OrderExpired sets status to 'expired' instead of just 'failed'
-- No ALTER needed — the status column is TEXT, 'expired' is valid.
