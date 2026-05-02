-- ============================================================
--  005-idempotency.sql — Phase 2: per-block atomic commits + dedupe
--
--  Purpose: make every event INSERT idempotent by adding UNIQUE indexes
--  on the natural key (block_number, tx_hash, log_index — or the closest
--  equivalent per table) and removing existing duplicates so the indexes
--  can be created cleanly.
--
--  Operates on a wholly-additive footprint: NO tables are dropped, NO
--  columns are removed. The only data-rewrites are:
--
--    1. DELETE of duplicate rows in event tables (keeps lowest `id`).
--    2. ADD COLUMN trading_account_events.log_index, backfilled from `id`
--       (which is monotonic-by-insert and unique). All other tables already
--       have log_index from the day they were created.
--
--  Run order: this file is invoked by `migrate.js` after migration 004.
-- ============================================================

BEGIN;

-- ─── Step 1: dedupe + UNIQUE indexes on tables with native log_index ────

-- Helper note: the dedupe pattern is the same shape every time
--   DELETE a USING b
--    WHERE a.id > b.id  -- keep lowest id
--      AND <natural key match>;
-- Each runs idempotently — re-running the migration is a no-op.

DELETE FROM trades a USING trades b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trades_natural
  ON trades(block_number, tx_hash, log_index);

DELETE FROM vault_events a USING vault_events b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vault_events_natural
  ON vault_events(block_number, tx_hash, log_index);

DELETE FROM protocol_events a USING protocol_events b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_protocol_events_natural
  ON protocol_events(block_number, tx_hash, log_index);

DELETE FROM fees a USING fees b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fees_natural
  ON fees(block_number, tx_hash, log_index);

DELETE FROM insurance_contributions a USING insurance_contributions b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_insurance_contributions_natural
  ON insurance_contributions(block_number, tx_hash, log_index);

DELETE FROM trade_settlements a USING trade_settlements b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trade_settlements_natural
  ON trade_settlements(block_number, tx_hash, log_index);

DELETE FROM oi_snapshots a USING oi_snapshots b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_oi_snapshots_natural
  ON oi_snapshots(block_number, tx_hash, log_index);

DELETE FROM mark_price_history a USING mark_price_history b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mark_price_history_natural
  ON mark_price_history(block_number, tx_hash, log_index);

DELETE FROM vault_balance_history a USING vault_balance_history b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vault_balance_history_natural
  ON vault_balance_history(block_number, tx_hash, log_index);

DELETE FROM funding_payments a USING funding_payments b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_funding_payments_natural
  ON funding_payments(block_number, tx_hash, log_index);

DELETE FROM market_snapshots a USING market_snapshots b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_market_snapshots_natural
  ON market_snapshots(block_number, tx_hash, log_index);

DELETE FROM protocol_snapshots a USING protocol_snapshots b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_protocol_snapshots_natural
  ON protocol_snapshots(block_number, tx_hash, log_index);

DELETE FROM entry_price_changes a USING entry_price_changes b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_entry_price_changes_natural
  ON entry_price_changes(block_number, tx_hash, log_index);

DELETE FROM spot_volumes a USING spot_volumes b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_volumes_natural
  ON spot_volumes(block_number, tx_hash, log_index);

DELETE FROM spot_virtual_balances a USING spot_virtual_balances b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_virtual_balances_natural
  ON spot_virtual_balances(block_number, tx_hash, log_index);

DELETE FROM spot_vault_balance_history a USING spot_vault_balance_history b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_vault_balance_history_natural
  ON spot_vault_balance_history(block_number, tx_hash, log_index);

DELETE FROM spot_fee_tier_updates a USING spot_fee_tier_updates b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_fee_tier_updates_natural
  ON spot_fee_tier_updates(block_number, tx_hash, log_index);

DELETE FROM collateral_config_changes a USING collateral_config_changes b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_collateral_config_changes_natural
  ON collateral_config_changes(block_number, tx_hash, log_index);

DELETE FROM spot_order_fills a USING spot_order_fills b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_order_fills_natural
  ON spot_order_fills(block_number, tx_hash, log_index);

DELETE FROM spot_batch_clearings a USING spot_batch_clearings b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_batch_clearings_natural
  ON spot_batch_clearings(block_number, tx_hash, log_index);

DELETE FROM spot_fast_settlements a USING spot_fast_settlements b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_fast_settlements_natural
  ON spot_fast_settlements(block_number, tx_hash, log_index);

DELETE FROM spot_collateral_movements a USING spot_collateral_movements b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_collateral_movements_natural
  ON spot_collateral_movements(block_number, tx_hash, log_index);

DELETE FROM spot_pofq_updates a USING spot_pofq_updates b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_pofq_updates_natural
  ON spot_pofq_updates(block_number, tx_hash, log_index);

DELETE FROM spot_batch_clear_failures a USING spot_batch_clear_failures b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_batch_clear_failures_natural
  ON spot_batch_clear_failures(block_number, tx_hash, log_index);

DELETE FROM spot_market_mode_changes a USING spot_market_mode_changes b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_market_mode_changes_natural
  ON spot_market_mode_changes(block_number, tx_hash, log_index);

-- ─── Step 2: tables without log_index — pick the right composite ───────

-- liquidations: one liq per (position_id, tx) — position_id is part of key
-- because a single tx can liquidate multiple positions in theory.
DELETE FROM liquidations a USING liquidations b
 WHERE a.id > b.id AND a.position_id = b.position_id
   AND a.block_number = b.block_number AND a.tx_hash = b.tx_hash;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_liquidations_natural
  ON liquidations(position_id, block_number, tx_hash);

-- price_updates: keeper updates many markets per tx — include market_id.
DELETE FROM price_updates a USING price_updates b
 WHERE a.id > b.id AND a.market_id = b.market_id
   AND a.block_number = b.block_number AND a.tx_hash = b.tx_hash;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_price_updates_natural
  ON price_updates(market_id, block_number, tx_hash);

-- funding_rates: same shape as price_updates.
DELETE FROM funding_rates a USING funding_rates b
 WHERE a.id > b.id AND a.market_id = b.market_id
   AND a.block_number = b.block_number AND a.tx_hash = b.tx_hash;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_funding_rates_natural
  ON funding_rates(market_id, block_number, tx_hash);

-- keeper_cycles: one cycle event per tx.
DELETE FROM keeper_cycles a USING keeper_cycles b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_keeper_cycles_natural
  ON keeper_cycles(block_number, tx_hash);

-- spot_keeper_cycles: same.
DELETE FROM spot_keeper_cycles a USING spot_keeper_cycles b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spot_keeper_cycles_natural
  ON spot_keeper_cycles(block_number, tx_hash);

-- account_ledger: contract emits a globally-unique entry_id per ledger row.
DELETE FROM account_ledger a USING account_ledger b
 WHERE a.id > b.id AND a.entry_id = b.entry_id;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_account_ledger_entry
  ON account_ledger(entry_id);

-- ─── Step 3: trading_account_events — backfill log_index, then UNIQUE ──
--
-- This table never had a log_index column. We add one and backfill from
-- the SERIAL `id` so existing rows remain unique under the new constraint.
-- For new writes, models.js will populate log_index with the actual ABCI
-- log index inside the parent block — the same value other event tables
-- already store. Mixing real-log_index for new rows with id-derived values
-- for old rows is safe: they live in disjoint (block_number, tx_hash)
-- partitions almost always (one tx never appears twice in history under
-- a re-scan, only event ordering within a tx matters for dedupe).

ALTER TABLE trading_account_events ADD COLUMN IF NOT EXISTS log_index INTEGER;

UPDATE trading_account_events
   SET log_index = id
 WHERE log_index IS NULL;

ALTER TABLE trading_account_events ALTER COLUMN log_index SET NOT NULL;

DELETE FROM trading_account_events a USING trading_account_events b
 WHERE a.id > b.id AND a.block_number = b.block_number
   AND a.tx_hash = b.tx_hash AND a.log_index = b.log_index;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trading_account_events_natural
  ON trading_account_events(block_number, tx_hash, log_index);

COMMIT;
