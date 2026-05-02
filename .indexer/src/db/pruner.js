"use strict";

const { pool } = require("./pool");

/**
 * Retention policy (days). Override via env vars prefixed PRUNE_.
 * Set to 0 to disable pruning for a given table.
 */
const DEFAULT_RETENTION = {
  block_hashes:              Number(process.env.PRUNE_BLOCK_HASHES)              || 0,   // pruned by row count not age
  price_updates:             Number(process.env.PRUNE_PRICE_UPDATES)             || 30,
  mark_price_history:        Number(process.env.PRUNE_MARK_PRICE_HISTORY)        || 30,
  oi_snapshots:              Number(process.env.PRUNE_OI_SNAPSHOTS)              || 30,
  market_snapshots:          Number(process.env.PRUNE_MARKET_SNAPSHOTS)          || 90,
  protocol_snapshots:        Number(process.env.PRUNE_PROTOCOL_SNAPSHOTS)        || 90,
  funding_payments:          Number(process.env.PRUNE_FUNDING_PAYMENTS)          || 90,
  keeper_cycles:             Number(process.env.PRUNE_KEEPER_CYCLES)             || 30,
  spot_keeper_cycles:        Number(process.env.PRUNE_SPOT_KEEPER_CYCLES)        || 30,
  insurance_contributions:   Number(process.env.PRUNE_INSURANCE_CONTRIBUTIONS)   || 180,
  trading_account_events:    Number(process.env.PRUNE_TRADING_ACCOUNT_EVENTS)    || 90,
  account_ledger:            Number(process.env.PRUNE_ACCOUNT_LEDGER)            || 180,
  protocol_events:           Number(process.env.PRUNE_PROTOCOL_EVENTS)           || 180,
  spot_batch_clear_failures: Number(process.env.PRUNE_SPOT_BATCH_CLEAR_FAILURES) || 30,
};

const BLOCK_HASHES_KEEP_ROWS = Number(process.env.PRUNE_BLOCK_HASHES_KEEP) || 50_000;
const BATCH_SIZE              = Number(process.env.PRUNE_BATCH_SIZE)         || 5_000;
const INTERVAL_MS             = Number(process.env.PRUNE_INTERVAL_MS)        || 24 * 60 * 60 * 1000; // 24h

let _timer = null;

/**
 * Delete old rows from a single table in batches to avoid table locks.
 * @param {string} table
 * @param {number} days  retention window (0 = skip)
 * @param {object} logger
 * @returns {number} total rows deleted
 */
async function pruneTable(table, days, logger) {
  if (!days) return 0;

  const cutoff = new Date(Date.now() - days * 86_400_000);
  let total = 0;

  for (;;) {
    const res = await pool.query(
      `DELETE FROM ${table}
         WHERE id IN (
           SELECT id FROM ${table}
           WHERE block_timestamp < $1
           LIMIT $2
         )`,
      [cutoff, BATCH_SIZE]
    );
    total += res.rowCount;
    if (res.rowCount < BATCH_SIZE) break;
    // Yield to the event loop between batches to avoid monopolizing the connection
    await new Promise((r) => setTimeout(r, 50));
  }

  if (total > 0) {
    logger.info(`[pruner] ${table}: deleted ${total.toLocaleString()} rows older than ${days}d`);
  }
  return total;
}

/**
 * Prune block_hashes by row count (keep the most recent N rows only).
 * block_hashes doesn't have a block_timestamp column — it uses a serial id.
 */
async function pruneBlockHashes(logger) {
  const countRes = await pool.query("SELECT COUNT(*) AS c FROM block_hashes");
  const count = Number(countRes.rows[0].c);
  if (count <= BLOCK_HASHES_KEEP_ROWS) return 0;

  const toDelete = count - BLOCK_HASHES_KEEP_ROWS;
  let total = 0;

  for (let deleted = 0; deleted < toDelete;) {
    const batch = Math.min(BATCH_SIZE, toDelete - deleted);
    const res = await pool.query(
      `DELETE FROM block_hashes
         WHERE id IN (
           SELECT id FROM block_hashes ORDER BY id ASC LIMIT $1
         )`,
      [batch]
    );
    total += res.rowCount;
    deleted += res.rowCount;
    if (res.rowCount === 0) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  if (total > 0) {
    logger.info(`[pruner] block_hashes: deleted ${total.toLocaleString()} oldest rows (kept ${BLOCK_HASHES_KEEP_ROWS})`);
  }
  return total;
}

/**
 * Run a full prune cycle across all configured tables.
 */
async function runPrune(logger) {
  const started = Date.now();
  logger.info("[pruner] Starting prune cycle...");

  let totalDeleted = 0;
  for (const [table, days] of Object.entries(DEFAULT_RETENTION)) {
    try {
      if (table === "block_hashes") {
        totalDeleted += await pruneBlockHashes(logger);
      } else {
        totalDeleted += await pruneTable(table, days, logger);
      }
    } catch (err) {
      logger.warn(`[pruner] ${table}: skipped — ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  logger.info(`[pruner] Cycle complete in ${elapsed}s — ${totalDeleted.toLocaleString()} rows deleted`);
}

/**
 * Start the pruner: run once immediately, then on a daily interval.
 * Call stop() to cancel the timer on graceful shutdown.
 */
function start(logger) {
  runPrune(logger).catch((err) => logger.error(`[pruner] Run failed: ${err.message}`));
  _timer = setInterval(() => {
    runPrune(logger).catch((err) => logger.error(`[pruner] Run failed: ${err.message}`));
  }, INTERVAL_MS);
  _timer.unref(); // don't keep the process alive if everything else has exited
  logger.info(`[pruner] Scheduled — runs every ${Math.round(INTERVAL_MS / 3600000)}h`);
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { start, stop, runPrune };
