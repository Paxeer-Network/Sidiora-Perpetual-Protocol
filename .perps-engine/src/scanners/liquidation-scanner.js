/**
 * Liquidation Scanner — detects undercollateralized positions.
 *
 * Key change from old .keeper/ version:
 *   - Funding-aware margin calc: includes pending (unaccrued) funding in equity.
 *   - Does NOT execute — returns position IDs for the cycle builder.
 *
 * Margin calculation mirrors the on-chain checkLiquidatable() fix (H4):
 *   PnL (long)  = (currentPrice - entryPrice) * sizeUsd / entryPrice
 *   PnL (short) = (entryPrice - currentPrice) * sizeUsd / entryPrice
 *   pendingFunding = (currentCumulative - lastFundingIndex) * sizeUsd / 1e18
 *   equity = collateralUsd + PnL - pendingFunding
 *   marginBps = equity * 10000 / sizeUsd
 *   liquidatable if marginBps < maintenanceMarginBps
 */
class LiquidationScanner {
  constructor(stateCache, logger) {
    this.cache = stateCache;
    this.logger = logger;

    this.stats = {
      scansPerformed: 0,
      positionsChecked: 0,
      liquidationsTriggered: 0,
    };
  }

  /**
   * Scan active positions and return IDs of liquidatable ones.
   * @param {Map<number, bigint>} prices - marketId → price (18 dec)
   * @returns {bigint[]} Array of liquidatable position IDs
   */
  scan(prices) {
    this.stats.scansPerformed++;
    const positions = this.cache.getActivePositions();

    if (positions.length === 0) {
      this.logger.debug("  [Liquidations] No active positions to scan");
      return [];
    }

    const candidates = [];

    for (const pos of positions) {
      const marketId = Number(pos.marketId);
      const currentPrice = prices.get(marketId);
      if (!currentPrice || currentPrice === 0n) continue;

      const marketConfig = this.cache.marketConfigs.get(marketId);
      if (!marketConfig) continue;

      this.stats.positionsChecked++;

      const marginBps = this._calculateMarginBps(pos, currentPrice, marketId);
      const maintenanceMarginBps = BigInt(marketConfig.maintenanceMarginBps);

      if (marginBps < maintenanceMarginBps) {
        candidates.push({
          positionId: pos.positionId,
          marginBps,
          maintenanceMarginBps,
        });
      }
    }

    if (candidates.length === 0) {
      this.logger.debug(
        `  [Liquidations] Scanned ${positions.length} positions, all healthy`
      );
      return [];
    }

    // Sort by margin ascending — most undercollateralized first
    candidates.sort((a, b) => {
      if (a.marginBps < b.marginBps) return -1;
      if (a.marginBps > b.marginBps) return 1;
      return 0;
    });

    this.stats.liquidationsTriggered += candidates.length;

    this.logger.info(
      `  [Liquidations] ${candidates.length} undercollateralized out of ${positions.length} active`
    );

    for (const c of candidates) {
      this.logger.info(
        `  [Liquidations]   #${c.positionId} margin=${Number(c.marginBps)}bps < ${Number(c.maintenanceMarginBps)}bps`
      );
    }

    return candidates.map((c) => c.positionId);
  }

  /**
   * Calculate margin ratio in basis points with funding awareness.
   * @param {object} pos - Position data
   * @param {bigint} currentPrice - Current oracle price (18 dec)
   * @param {number} marketId
   * @returns {bigint} marginBps
   */
  _calculateMarginBps(pos, currentPrice, marketId) {
    const sizeUsd = BigInt(pos.sizeUsd);
    const collateralUsd = BigInt(pos.collateralUsd);
    const entryPrice = BigInt(pos.entryPrice);

    if (sizeUsd === 0n || entryPrice === 0n) return 0n;

    // PnL calculation
    let pnl;
    if (pos.isLong) {
      pnl = ((currentPrice - entryPrice) * sizeUsd) / entryPrice;
    } else {
      pnl = ((entryPrice - currentPrice) * sizeUsd) / entryPrice;
    }

    // Pending funding calculation (if available from cache)
    let pendingFunding = 0n;
    const fundingState = this.cache.fundingStates.get(marketId);
    if (fundingState && pos.lastFundingIndex !== undefined) {
      const lastIndex = BigInt(pos.lastFundingIndex);
      const currentCumulative = pos.isLong
        ? BigInt(fundingState.cumulativeFundingPerUnitLong)
        : BigInt(fundingState.cumulativeFundingPerUnitShort);

      const fundingDelta = currentCumulative - lastIndex;
      // fundingPayment = sizeUsd * fundingDelta / 1e18
      // Positive = position owes funding (reduces equity)
      pendingFunding = (sizeUsd * fundingDelta) / (10n ** 18n);
    }

    // equity = collateralUsd + pnl - pendingFunding
    const equity = BigInt.asIntN(256, collateralUsd) + pnl - pendingFunding;

    if (equity <= 0n) return 0n;

    // marginBps = equity * 10000 / sizeUsd
    return (BigInt.asUintN(256, equity) * 10000n) / sizeUsd;
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { LiquidationScanner };
