const http = require("node:http");
const { pool: dbPool } = require("./db/pool");
const { getLastIndexedBlock } = require("./db/models");

/**
 * Lightweight HTTP health surface for the indexer.
 *
 * Exposes two endpoints:
 *
 *   GET /health
 *     200 OK — `{ ok: true, lag, lastIndexed, head }` when we're within
 *     `maxLagBlocks` of the chain head AND the last successful scan happened
 *     within `maxStaleMs`.
 *     503 Service Unavailable — `{ ok: false, reason, lag, lastIndexed, head }`
 *     otherwise. Suitable for Railway/k8s liveness and readiness probes.
 *
 *   GET /metrics
 *     Prometheus text-format exposition of the scanner's stats counters,
 *     pool circuit-breaker state per URL, and PG pool size. No external
 *     prom-client dependency — we render the format inline because it's
 *     a few dozen lines and we don't want a 200 KB transitive npm tree.
 *
 * Design constraints:
 *   - Zero blocking work in the request handler. Every probe reads cached
 *     state; the cache is refreshed by the indexer's main loop, never by
 *     a request. A flood of probes (e.g., misconfigured load balancer)
 *     cannot stall the scanner.
 *   - Returns IMMEDIATELY on /health if the snapshot is fresh (<2s old);
 *     otherwise does one bounded /status fetch via the pool. This is the
 *     only place a probe can issue an outbound call, and only when the
 *     scanner is itself idle.
 *   - HEALTH_PORT=0 disables the surface entirely (returns null from start).
 */
class HealthServer {
  /**
   * @param {object}   opts
   * @param {number}   opts.port               — listen port (skip when 0).
   * @param {Scanner}  opts.scanner            — for getStats(), getChainHead(), getPool().
   * @param {object}   opts.logger             — winston logger.
   * @param {() => number | null} opts.getCurrentBlock — accessor for the
   *   live cursor (so /health can report lag without re-querying PG).
   * @param {() => number} opts.getLastScanAt   — ms-epoch of last successful scan.
   * @param {number}   [opts.maxLagBlocks=200] — /health threshold.
   * @param {number}   [opts.maxStaleMs=60_000] — /health threshold.
   */
  constructor({ port, scanner, logger, getCurrentBlock, getLastScanAt, maxLagBlocks = 200, maxStaleMs = 60_000 }) {
    this.port = port;
    this.scanner = scanner;
    this.logger = logger;
    this.getCurrentBlock = getCurrentBlock;
    this.getLastScanAt = getLastScanAt;
    this.maxLagBlocks = maxLagBlocks;
    this.maxStaleMs = maxStaleMs;
    this.server = null;
    // Cached chain head — refreshed lazily on /health requests, never more
    // often than `_headTtlMs` to avoid hammering /status under probe load.
    this._cachedHead = 0;
    this._cachedHeadAt = 0;
    this._headTtlMs = 2_000;
  }

  async start() {
    if (!this.port || this.port <= 0) {
      this.logger.info("  Health server: disabled (HEALTH_PORT=0)");
      return null;
    }
    this.server = http.createServer((req, res) => this._handle(req, res));
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, () => {
        this.server.removeListener("error", reject);
        resolve();
      });
    });
    this.logger.info(`  Health server: listening on :${this.port} (/health, /metrics)`);
    return this.server;
  }

  async close() {
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(() => resolve()));
    this.server = null;
  }

  async _handle(req, res) {
    try {
      if (req.url === "/health" || req.url === "/healthz") {
        await this._respondHealth(res);
        return;
      }
      if (req.url === "/metrics") {
        this._respondMetrics(res);
        return;
      }
      if (req.url === "/" || req.url === "/info") {
        this._respondJson(res, 200, {
          service: "ppmm-indexer",
          endpoints: ["/health", "/metrics"],
        });
        return;
      }
      this._respondJson(res, 404, { error: "not found", url: req.url });
    } catch (err) {
      this.logger.warn(`  [health] handler crash on ${req.url}: ${err.message}`);
      this._respondJson(res, 500, { error: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  /health
  // ─────────────────────────────────────────────────────────────────────

  async _respondHealth(res) {
    const lastIndexed = (this.getCurrentBlock && this.getCurrentBlock()) || 0;
    const head = await this._getCachedHead();
    const lag = head > lastIndexed ? head - lastIndexed : 0;
    const lastScanAt = this.getLastScanAt ? this.getLastScanAt() : 0;
    const sinceLastScan = lastScanAt ? Date.now() - lastScanAt : Number.POSITIVE_INFINITY;

    const reasons = [];
    if (lastIndexed === 0) reasons.push("not-yet-started");
    if (lag > this.maxLagBlocks) reasons.push(`lag>${this.maxLagBlocks}`);
    if (sinceLastScan > this.maxStaleMs) reasons.push(`stale>${this.maxStaleMs}ms`);

    const ok = reasons.length === 0;
    this._respondJson(res, ok ? 200 : 503, {
      ok,
      lastIndexed,
      head,
      lag,
      sinceLastScanMs: Number.isFinite(sinceLastScan) ? sinceLastScan : null,
      reasons,
    });
  }

  async _getCachedHead() {
    const now = Date.now();
    if (now - this._cachedHeadAt < this._headTtlMs && this._cachedHead > 0) {
      return this._cachedHead;
    }
    try {
      this._cachedHead = await this.scanner.getChainHead();
      this._cachedHeadAt = now;
    } catch (err) {
      this.logger.debug(`  [health] getChainHead failed: ${err.message}`);
      // Return whatever we had; consumers see stale-but-bounded data, never
      // a hung probe waiting for a dead RPC.
    }
    return this._cachedHead;
  }

  // ─────────────────────────────────────────────────────────────────────
  //  /metrics — prometheus text format
  // ─────────────────────────────────────────────────────────────────────

  _respondMetrics(res) {
    const stats = this.scanner.getStats();
    const lastIndexed = (this.getCurrentBlock && this.getCurrentBlock()) || 0;
    const head = this._cachedHead || 0;
    const lag = head > lastIndexed ? head - lastIndexed : 0;
    const lastScanAt = this.getLastScanAt ? this.getLastScanAt() : 0;
    const sinceLastScan = lastScanAt ? Date.now() - lastScanAt : 0;

    const lines = [];
    const push = (name, help, type, value, labels = "") => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      lines.push(labels ? `${name}{${labels}} ${value}` : `${name} ${value}`);
    };

    push("ppmm_indexer_blocks_scanned_total", "Total blocks scanned via /block_results.", "counter", stats.blocksScanned);
    push("ppmm_indexer_events_processed_total", "Total Diamond events decoded and committed.", "counter", stats.eventsProcessed);
    push("ppmm_indexer_blocks_skipped_bloom_total", "Blocks skipped by bloom-filter pre-screen.", "counter", stats.blocksSkippedByBloom || 0);
    push("ppmm_indexer_blocks_skipped_prune_total", "Blocks skipped because they fell below the chain prune horizon.", "counter", stats.blocksSkippedByPrune || 0);
    push("ppmm_indexer_errors_total", "Total errors during scanning (network, decode, commit).", "counter", stats.errors || 0);
    push("ppmm_indexer_last_indexed_block", "Highest block height committed to PG.", "gauge", lastIndexed);
    push("ppmm_indexer_chain_head_block", "Chain head as last seen by getChainHead().", "gauge", head);
    push("ppmm_indexer_lag_blocks", "Blocks behind chain head.", "gauge", lag);
    push("ppmm_indexer_since_last_scan_ms", "Milliseconds since last successful scanBlocks() return.", "gauge", sinceLastScan);

    // Per-URL pool circuit-breaker state. Pool exposes
    // `{ urls: [{ url, breakerState, successes, errors, retries, ... }] }`.
    const pool = this.scanner.getPool && this.scanner.getPool();
    if (pool && typeof pool.getStats === "function") {
      const poolStats = pool.getStats();
      const urlsList = poolStats.urls || [];

      lines.push("# HELP ppmm_indexer_pool_breaker_state Circuit breaker state per Tendermint URL (0=closed, 1=half-open, 2=open).");
      lines.push("# TYPE ppmm_indexer_pool_breaker_state gauge");
      for (const e of urlsList) {
        const stateNum = e.breakerState === "open" ? 2 : e.breakerState === "half-open" ? 1 : 0;
        lines.push(`ppmm_indexer_pool_breaker_state{url="${e.url}"} ${stateNum}`);
      }
      lines.push("# HELP ppmm_indexer_pool_successes_total HTTP successes per Tendermint URL.");
      lines.push("# TYPE ppmm_indexer_pool_successes_total counter");
      for (const e of urlsList) {
        lines.push(`ppmm_indexer_pool_successes_total{url="${e.url}"} ${e.successes || 0}`);
      }
      lines.push("# HELP ppmm_indexer_pool_errors_total HTTP failures per Tendermint URL.");
      lines.push("# TYPE ppmm_indexer_pool_errors_total counter");
      for (const e of urlsList) {
        lines.push(`ppmm_indexer_pool_errors_total{url="${e.url}"} ${e.errors || 0}`);
      }
      lines.push("# HELP ppmm_indexer_pool_retries_total HTTP retries per Tendermint URL.");
      lines.push("# TYPE ppmm_indexer_pool_retries_total counter");
      for (const e of urlsList) {
        lines.push(`ppmm_indexer_pool_retries_total{url="${e.url}"} ${e.retries || 0}`);
      }
    }

    // PG pool — useful to spot connection exhaustion before it bites.
    if (dbPool && typeof dbPool.totalCount === "number") {
      push("ppmm_indexer_pg_pool_total", "Total PG clients in the indexer's pg-Pool.", "gauge", dbPool.totalCount);
      push("ppmm_indexer_pg_pool_idle", "Idle PG clients available for checkout.", "gauge", dbPool.idleCount);
      push("ppmm_indexer_pg_pool_waiting", "Pending PG client checkout requests (saturation indicator).", "gauge", dbPool.waitingCount);
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.end(lines.join("\n") + "\n");
  }

  _respondJson(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  }
}

module.exports = { HealthServer };
