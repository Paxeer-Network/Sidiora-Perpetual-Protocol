/**
 * vAMM Syncer — calls syncToOracle() for each market after oracle price updates.
 *
 * syncToOracle() pulls the vAMM reserves toward the oracle price by the
 * configured dampingFactor. This keeps the mark price (derived from vAMM)
 * aligned with the index price (from oracle), which directly affects
 * funding rates and execution pricing.
 *
 * Requires KEEPER_ROLE.
 */

class VammSyncer {
  constructor(markets, executor, logger) {
    this.markets = markets;
    this.executor = executor;
    this.logger = logger;

    // Track which pools are initialized (skip uninitialized ones)
    this._initializedPools = new Set();
    this._checkedPools = new Set();

    this.stats = {
      syncCycles: 0,
      syncsSucceeded: 0,
      syncsFailed: 0,
      skippedUninitialized: 0,
    };
  }

  /**
   * Sync all markets' vAMM pools to their oracle prices.
   * Called after each PricesUpdated event.
   * @param {number[]} [updatedMarketIds] - If provided, only sync these markets
   */
  async syncAll(updatedMarketIds = null) {
    this.stats.syncCycles++;

    const marketsToSync = updatedMarketIds
      ? this.markets.filter((m) => updatedMarketIds.includes(m.marketId))
      : this.markets;

    if (marketsToSync.length === 0) return;

    this.logger.debug(
      `  [vAMM] Syncing ${marketsToSync.length} market(s): ${marketsToSync.map((m) => m.symbol).join(", ")}`
    );

    for (const market of marketsToSync) {
      await this._syncMarket(market);
    }
  }

  /**
   * Sync a single market's vAMM to oracle.
   * Checks pool initialization first to avoid wasting gas.
   * @param {{ marketId: number, symbol: string }} market
   */
  async _syncMarket(market) {
    // Check if pool is initialized (only query once per market)
    if (!this._initializedPools.has(market.marketId)) {
      if (!this._checkedPools.has(market.marketId)) {
        this._checkedPools.add(market.marketId);
        try {
          const pool = await this.executor.getPool(market.marketId);
          if (pool.baseReserve === 0n) {
            this.logger.warn(
              `  [vAMM] ${market.symbol} (id=${market.marketId}) pool not initialized — skipping`
            );
            this.stats.skippedUninitialized++;
            return;
          }
          this._initializedPools.add(market.marketId);
          this.logger.info(
            `  [vAMM] ${market.symbol} pool OK (damping=${pool.dampingFactor}bps)`
          );
        } catch (err) {
          this.logger.warn(
            `  [vAMM] ${market.symbol} getPool() failed: ${err.message} — skipping`
          );
          this.stats.skippedUninitialized++;
          return;
        }
      } else {
        // Already checked and was not initialized — skip silently
        this.stats.skippedUninitialized++;
        return;
      }
    }

    const result = await this.executor.syncVamm(market.marketId);

    if (result.success) {
      this.stats.syncsSucceeded++;
      this.logger.debug(
        `  [vAMM] ${market.symbol} synced -> TX ${result.txHash}`
      );
    } else {
      this.stats.syncsFailed++;
      if (result.reverted) {
        this.logger.debug(
          `  [vAMM] ${market.symbol} sync reverted: ${result.error}`
        );
      } else {
        this.logger.warn(
          `  [vAMM] ${market.symbol} sync failed: ${result.error}`
        );
      }
    }
  }

  /**
   * Re-check pool initialization (call periodically in case admin initializes pools).
   */
  resetPoolChecks() {
    this._checkedPools.clear();
  }

  /**
   * Get syncer statistics.
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = { VammSyncer };
