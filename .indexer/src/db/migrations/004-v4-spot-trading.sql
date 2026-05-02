-- ============================================================
--  V4 SPOT TRADING — Primary spot event coverage.
--
--  Adds the core tables every spot trading event is written to:
--    • spot_markets                      ← SpotMarketCreated, MarketModeChanged
--    • spot_orders                       ← SpotOrderPlaced, *Filled (size), *Cancelled
--    • spot_order_fills                  ← SpotOrderFilled
--    • spot_batch_clearings              ← BatchCleared
--    • spot_epoch_settlements            ← EpochSettled
--    • spot_fast_settlements             ← FastSettled
--    • spot_collateral_movements         ← SpotCollateralDeposited, *Withdrawn
--    • spot_market_mode_changes          ← MarketModeChanged (audit log)
--    • spot_pofq_updates                 ← PoFQUpdated
--    • spot_plvs                         ← PLVRegistered, PLVDeregistered
--    • spot_keeper_cycles                ← SpotKeeperCycleExecuted
--    • spot_batch_clear_failures         ← SpotBatchClearFailed
--
--  Spot market identifiers are stored as 66-char hex strings (0x-prefixed
--  keccak256 of base/quote addresses). Prices signed int256 fit in NUMERIC.
--
--  Run after 003-v5-indexer-events.
-- ============================================================

-- ============================================================
--  SPOT MARKETS — current state of every spot pair ever created
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_markets (
  market_id           TEXT PRIMARY KEY,            -- bytes32 hex (0x + 64 chars)
  base_token          TEXT NOT NULL,
  quote_token         TEXT NOT NULL,
  mode                INTEGER NOT NULL DEFAULT 0,  -- 0=CONTINUOUS, 1=BATCH
  status              TEXT NOT NULL DEFAULT 'active',  -- active | disabled
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_block       BIGINT,
  created_tx_hash     TEXT,
  last_mode_changed_at TIMESTAMPTZ,
  last_mode_change_block BIGINT,
  last_mode_change_tx TEXT
);

CREATE INDEX IF NOT EXISTS idx_spot_markets_status ON spot_markets(status);
CREATE INDEX IF NOT EXISTS idx_spot_markets_base  ON spot_markets(base_token);
CREATE INDEX IF NOT EXISTS idx_spot_markets_quote ON spot_markets(quote_token);

-- ============================================================
--  SPOT ORDERS — lifecycle row per order (placed → filled/cancelled)
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_orders (
  order_id            NUMERIC PRIMARY KEY,
  trader_address      TEXT NOT NULL,
  market_id           TEXT NOT NULL,                -- bytes32 hex
  side                INTEGER NOT NULL,             -- 0=BUY, 1=SELL
  order_type          INTEGER NOT NULL,             -- 0=MARKET, 1=LIMIT
  offset_bps          INTEGER NOT NULL,             -- int16 widened
  size                NUMERIC NOT NULL,             -- base-token units (raw)
  filled_size         NUMERIC NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active',  -- active | filled | cancelled
  placed_at           TIMESTAMPTZ NOT NULL,
  placed_block        BIGINT NOT NULL,
  placed_tx_hash      TEXT NOT NULL,
  resolved_at         TIMESTAMPTZ,
  resolved_block      BIGINT,
  resolved_tx_hash    TEXT
);

CREATE INDEX IF NOT EXISTS idx_spot_orders_trader ON spot_orders(trader_address);
CREATE INDEX IF NOT EXISTS idx_spot_orders_market ON spot_orders(market_id);
CREATE INDEX IF NOT EXISTS idx_spot_orders_status ON spot_orders(status);
CREATE INDEX IF NOT EXISTS idx_spot_orders_trader_status ON spot_orders(trader_address, status);

-- ============================================================
--  SPOT ORDER FILLS — one row per fill event
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_order_fills (
  id                  SERIAL PRIMARY KEY,
  order_id            NUMERIC NOT NULL,
  trader_address      TEXT NOT NULL,
  market_id           TEXT NOT NULL,
  fill_size           NUMERIC NOT NULL,
  fill_price          NUMERIC NOT NULL,             -- int256 signed price
  fill_score          NUMERIC NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_fills_order   ON spot_order_fills(order_id);
CREATE INDEX IF NOT EXISTS idx_spot_fills_trader  ON spot_order_fills(trader_address);
CREATE INDEX IF NOT EXISTS idx_spot_fills_market  ON spot_order_fills(market_id);
CREATE INDEX IF NOT EXISTS idx_spot_fills_time    ON spot_order_fills(block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_spot_fills_market_time ON spot_order_fills(market_id, block_timestamp DESC);

-- ============================================================
--  SPOT BATCH CLEARINGS — uniform-clearing-price auction results
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_batch_clearings (
  id                  SERIAL PRIMARY KEY,
  market_id           TEXT NOT NULL,
  clearing_offset_bps INTEGER NOT NULL,             -- int16 widened
  clearing_price      NUMERIC NOT NULL,             -- int256 signed
  matched_volume      NUMERIC NOT NULL,
  num_buys_filled     INTEGER NOT NULL,
  num_sells_filled    INTEGER NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_batch_market ON spot_batch_clearings(market_id);
CREATE INDEX IF NOT EXISTS idx_spot_batch_time   ON spot_batch_clearings(block_timestamp DESC);

-- ============================================================
--  SPOT EPOCH SETTLEMENTS — one row per cleared epoch
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_epoch_settlements (
  epoch_number        NUMERIC PRIMARY KEY,
  users_processed     INTEGER NOT NULL,
  onchain_block       BIGINT NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_epoch_time ON spot_epoch_settlements(block_timestamp DESC);

-- ============================================================
--  SPOT FAST SETTLEMENTS — instant user-requested settlement
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_fast_settlements (
  id                  SERIAL PRIMARY KEY,
  user_address        TEXT NOT NULL,
  token_address       TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  fee                 NUMERIC NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_fast_user  ON spot_fast_settlements(user_address);
CREATE INDEX IF NOT EXISTS idx_spot_fast_token ON spot_fast_settlements(token_address);
CREATE INDEX IF NOT EXISTS idx_spot_fast_time  ON spot_fast_settlements(block_timestamp DESC);

-- ============================================================
--  SPOT COLLATERAL MOVEMENTS — deposits / withdrawals
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_collateral_movements (
  id                  SERIAL PRIMARY KEY,
  event_type          TEXT NOT NULL,                -- deposit | withdrawal
  user_address        TEXT NOT NULL,
  token_address       TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_cm_user  ON spot_collateral_movements(user_address);
CREATE INDEX IF NOT EXISTS idx_spot_cm_token ON spot_collateral_movements(token_address);
CREATE INDEX IF NOT EXISTS idx_spot_cm_type  ON spot_collateral_movements(event_type);
CREATE INDEX IF NOT EXISTS idx_spot_cm_time  ON spot_collateral_movements(block_timestamp DESC);

-- ============================================================
--  SPOT MARKET MODE CHANGES — audit log of mode transitions
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_market_mode_changes (
  id                  SERIAL PRIMARY KEY,
  market_id           TEXT NOT NULL,
  old_mode            INTEGER NOT NULL,
  new_mode            INTEGER NOT NULL,
  batch_mode_until_block BIGINT NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_mode_market ON spot_market_mode_changes(market_id);
CREATE INDEX IF NOT EXISTS idx_spot_mode_time   ON spot_market_mode_changes(block_timestamp DESC);

-- ============================================================
--  SPOT POFQ UPDATES — rolling reputation per trader / vault
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_pofq_updates (
  id                  SERIAL PRIMARY KEY,
  entity_address      TEXT NOT NULL,
  new_score           NUMERIC NOT NULL,
  new_weight          NUMERIC NOT NULL,
  is_vault            BOOLEAN NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_pofq_entity ON spot_pofq_updates(entity_address);
CREATE INDEX IF NOT EXISTS idx_spot_pofq_vault  ON spot_pofq_updates(is_vault);
CREATE INDEX IF NOT EXISTS idx_spot_pofq_time   ON spot_pofq_updates(block_timestamp DESC);

-- ============================================================
--  SPOT PLVs — current PLV registry
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_plvs (
  vault_address         TEXT PRIMARY KEY,
  is_registered         BOOLEAN NOT NULL DEFAULT TRUE,
  registered_at         TIMESTAMPTZ,
  registered_block      BIGINT,
  registered_tx_hash    TEXT,
  deregistered_at       TIMESTAMPTZ,
  deregistered_block    BIGINT,
  deregistered_tx_hash  TEXT
);

CREATE INDEX IF NOT EXISTS idx_spot_plvs_registered ON spot_plvs(is_registered);

-- ============================================================
--  SPOT KEEPER CYCLES — one row per keeper-cycle execution
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_keeper_cycles (
  id                  SERIAL PRIMARY KEY,
  onchain_timestamp   BIGINT NOT NULL,
  markets_evaluated   INTEGER NOT NULL,
  batches_cleared     INTEGER NOT NULL,
  epoch_settled       BOOLEAN NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_keeper_time ON spot_keeper_cycles(block_timestamp DESC);

-- ============================================================
--  SPOT BATCH CLEAR FAILURES — keeper could not clear a batch
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_batch_clear_failures (
  id                  SERIAL PRIMARY KEY,
  market_id           TEXT NOT NULL,
  reason              TEXT NOT NULL,
  block_number        BIGINT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  block_timestamp     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_clear_fail_market ON spot_batch_clear_failures(market_id);
CREATE INDEX IF NOT EXISTS idx_spot_clear_fail_time   ON spot_batch_clear_failures(block_timestamp DESC);
