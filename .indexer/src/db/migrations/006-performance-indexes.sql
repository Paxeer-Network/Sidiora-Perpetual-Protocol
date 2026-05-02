-- ============================================================
--  006-performance-indexes.sql — Track 3: query performance
--
--  Adds three categories of indexes that are missing from all
--  prior migrations:
--
--  3a. Functional indexes on LOWER(user_address) / LOWER(trader_address)
--      so case-insensitive WHERE clauses use an index instead of seqscan.
--
--  3b. Partial indexes on hot status filters (open positions, active
--      orders) — tiny, fast, covers the most-read dashboard queries.
--
--  3c. BRIN indexes on large append-only time-series tables — orders of
--      magnitude smaller than B-tree and just as fast for range scans.
--
--  All statements use IF NOT EXISTS so the migration is fully idempotent.
-- ============================================================

BEGIN;

-- ─── 3a. Functional LOWER(user_address) indexes ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_positions_lower_user
  ON positions(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_trades_lower_user
  ON trades(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_orders_lower_user
  ON orders(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_liquidations_lower_user
  ON liquidations(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_vault_events_lower_user
  ON vault_events(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_user_vaults_lower_user
  ON user_vaults(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_account_ledger_lower_user
  ON account_ledger(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_delegates_lower_user
  ON delegates(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_fees_lower_user
  ON fees(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_trade_settlements_lower_user
  ON trade_settlements(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_trading_account_events_lower_user
  ON trading_account_events(LOWER(user_address));

CREATE INDEX IF NOT EXISTS idx_funding_payments_lower_user
  ON funding_payments(LOWER(user_address));

-- spot tables use trader_address column name
CREATE INDEX IF NOT EXISTS idx_spot_orders_lower_trader
  ON spot_orders(LOWER(trader_address));

CREATE INDEX IF NOT EXISTS idx_spot_order_fills_lower_trader
  ON spot_order_fills(LOWER(trader_address));

CREATE INDEX IF NOT EXISTS idx_spot_fast_settlements_lower_user
  ON spot_fast_settlements(LOWER(user_address));

-- ─── 3b. Partial indexes for hot status filters ────────────────────────────

-- Dashboard "open positions" query — most-read query on the entire system
CREATE INDEX IF NOT EXISTS idx_positions_open
  ON positions(LOWER(user_address), market_id)
  WHERE status = 'open';

-- Dashboard "active orders" query
CREATE INDEX IF NOT EXISTS idx_orders_active
  ON orders(LOWER(user_address), market_id)
  WHERE status = 'active';

-- Spot orders open/active filter
CREATE INDEX IF NOT EXISTS idx_spot_orders_open
  ON spot_orders(LOWER(trader_address), market_id)
  WHERE status = 'open';

-- ─── 3c. BRIN indexes on append-only time-series tables ────────────────────
--
-- BRIN works perfectly for these because rows are inserted in
-- block_timestamp order (roughly). A 1M-row BRIN index is ~100KB vs
-- ~30MB for a B-tree on the same column.

CREATE INDEX IF NOT EXISTS brin_price_updates_ts
  ON price_updates USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_mark_price_history_ts
  ON mark_price_history USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_oi_snapshots_ts
  ON oi_snapshots USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_funding_payments_ts
  ON funding_payments USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_market_snapshots_ts
  ON market_snapshots USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_protocol_snapshots_ts
  ON protocol_snapshots USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_keeper_cycles_ts
  ON keeper_cycles USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_spot_keeper_cycles_ts
  ON spot_keeper_cycles USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_vault_balance_history_ts
  ON vault_balance_history USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_trades_ts
  ON trades USING BRIN(block_timestamp, block_number);

CREATE INDEX IF NOT EXISTS brin_fees_ts
  ON fees USING BRIN(block_timestamp, block_number);

-- price_updates also needs a fast per-market lookup for priceHistory query
CREATE INDEX IF NOT EXISTS idx_price_updates_market_block
  ON price_updates(market_id, block_number DESC);

-- mark_price_history per-market lookup
CREATE INDEX IF NOT EXISTS idx_mark_price_history_market_block
  ON mark_price_history(market_id, block_number DESC);

COMMIT;
