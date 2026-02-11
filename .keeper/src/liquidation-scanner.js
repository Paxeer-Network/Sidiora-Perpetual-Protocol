/**
 * Liquidation Scanner — detects undercollateralized positions
 * and submits liquidate() transactions.
 *
 * liquidate() is permissionless — anyone can call it.
 * The keeper earns 60% of the liquidation penalty as a reward.
 *
 * Margin calculation mirrors LibPosition.calculateMarginRatio():
 *   PnL (long)  = (currentPrice - entryPrice) * sizeUsd / entryPrice
 *   PnL (short) = (entryPrice - currentPrice) * sizeUsd / entryPrice
 *   equity = collateralUsd + PnL
 *   marginBps = equity * 10000 / sizeUsd
 *   liquidatable if marginBps < maintenanceMarginBps
 */

class LiquidationScanner {
  constructor(stateCache, executor, logger) {
    this.cache = stateCache;
    this.executor = executor;
    this.logger = logger;

    this.stats = {
      scansPerformed: 0,
      positionsChecked: 0,
      liquidationsTriggered: 0,
      liquidationsExecuted: 0,
      liquidationsFailed: 0,
    };
  }

  /**
   * Run a full scan of active positions against current prices.
   * Called after each PricesUpdated event.
   * @param {number[]} [updatedMarketIds] - If provided, only scan positions in these markets
   */
  async scan(updatedMarketIds = null) {
    this.stats.scansPerformed++;
    const positions = this.cache.getActivePositions();

    if (positions.length === 0) {
      this.logger.debug("  [Liquidations] No active positions to scan");
      return;
    }

    const candidates = [];

    for (const pos of positions) {
      const marketId = Number(pos.marketId);

      // Skip positions in markets that didn't get a price update
      if (updatedMarketIds && !updatedMarketIds.includes(marketId)) {
        continue;
      }

      const currentPrice = this.cache.getPrice(marketId);
      if (!currentPrice || currentPrice === 0n) continue;

      const marketConfig = this.cache.marketConfigs.get(marketId);
      if (!marketConfig) continue;

      const marginBps = this._calculateMarginBps(pos, currentPrice);
      const maintenanceMarginBps = BigInt(marketConfig.maintenanceMarginBps);

      this.stats.positionsChecked++;

      if (marginBps < maintenanceMarginBps) {
        candidates.push({
          ...pos,
          marginBps,
          maintenanceMarginBps,
          currentPrice,
        });
      }
    }

    if (candidates.length === 0) {
      this.logger.debug(
        `  [Liquidations] Scanned ${positions.length} positions, all healthy`
      );
      return;
    }

    // Sort by margin ascending — liquidate most undercollateralized first
    candidates.sort((a, b) => {
      if (a.marginBps < b.marginBps) return -1;
      if (a.marginBps > b.marginBps) return 1;
      return 0;
    });

    this.logger.info(
      `  [Liquidations] ${candidates.length} position(s) undercollateralized out of ${positions.length} active`
    );

    // Execute liquidations sequentially
    for (const candidate of candidates) {
      await this._executeLiquidation(candidate);
    }
  }

  /**
   * Calculate margin ratio in basis points (mirrors on-chain logic).
   * @param {object} pos - Position data
   * @param {bigint} currentPrice - Current oracle price (18 dec)
   * @returns {bigint} marginBps
   */
  _calculateMarginBps(pos, currentPrice) {
    const sizeUsd = BigInt(pos.sizeUsd);
    const collateralUsd = BigInt(pos.collateralUsd);
    const entryPrice = BigInt(pos.entryPrice);

    if (sizeUsd === 0n || entryPrice === 0n) return 0n;

    // PnL calculation
    let pnl;
    if (pos.isLong) {
      // (currentPrice - entryPrice) * sizeUsd / entryPrice
      pnl = ((currentPrice - entryPrice) * sizeUsd) / entryPrice;
    } else {
      // (entryPrice - currentPrice) * sizeUsd / entryPrice
      pnl = ((entryPrice - currentPrice) * sizeUsd) / entryPrice;
    }

    // equity = collateralUsd + pnl (can go negative)
    const equity = BigInt.asIntN(256, collateralUsd) + pnl;

    if (equity <= 0n) return 0n;

    // marginBps = equity * 10000 / sizeUsd
    return (BigInt.asUintN(256, equity) * 10000n) / sizeUsd;
  }

  /**
   * Execute a single liquidation.
   * @param {object} candidate - Position data with margin info
   */
  async _executeLiquidation(candidate) {
    const dirStr = candidate.isLong ? "LONG" : "SHORT";
    const priceStr = this._formatUsd(candidate.currentPrice);
    const entryStr = this._formatUsd(BigInt(candidate.entryPrice));
    const marginStr = Number(candidate.marginBps);
    const maintStr = Number(candidate.maintenanceMarginBps);

    this.logger.info(
      `  [Liquidations] Liquidating #${candidate.positionId} ${dirStr} ` +
        `(entry=$${entryStr}, price=$${priceStr}, margin=${marginStr}bps < ${maintStr}bps)`
    );

    this.stats.liquidationsTriggered++;

    // Use on-chain check first to confirm (accounts for funding settlement)
    try {
      const check = await this.executor.checkLiquidatable(
        candidate.positionId
      );
      if (!check.liquidatable) {
        this.logger.info(
          `  [Liquidations] #${candidate.positionId} passed on-chain check (margin=${check.marginBps}bps) — skipping`
        );
        return;
      }
    } catch (err) {
      this.logger.warn(
        `  [Liquidations] #${candidate.positionId} on-chain check failed: ${err.message} — attempting liquidation anyway`
      );
    }

    const result = await this.executor.liquidate(candidate.positionId);

    if (result.success) {
      this.stats.liquidationsExecuted++;
      this.cache.removePosition(candidate.positionId);
      this.logger.info(
        `  [Liquidations] #${candidate.positionId} liquidated -> TX ${result.txHash}`
      );
    } else {
      this.stats.liquidationsFailed++;
      if (result.reverted) {
        this.cache.removePosition(candidate.positionId);
        this.logger.warn(
          `  [Liquidations] #${candidate.positionId} reverted: ${result.error} (removed)`
        );
      } else {
        this.logger.error(
          `  [Liquidations] #${candidate.positionId} failed: ${result.error}`
        );
      }
    }
  }

  /**
   * Get scanner statistics.
   */
  getStats() {
    return { ...this.stats };
  }

  _formatUsd(price18) {
    return (Number(price18 / 10n ** 14n) / 10000).toFixed(2);
  }
}

module.exports = { LiquidationScanner };
