/**
 * Cycle Builder — assembles the arguments for executeCycle() or executePriceCycle().
 *
 * Takes fetched prices + scanner results and produces the exact arrays
 * that KeeperMulticallFacet expects.
 */
class CycleBuilder {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Build the arguments for a full executeCycle() call.
   * @param {Array<{marketId: number, price: bigint}>} prices - Fetched prices
   * @param {bigint[]} triggeredOrderIds - Order IDs from order scanner
   * @param {bigint[]} liquidatablePositionIds - Position IDs from liquidation scanner
   * @returns {{ marketIds: bigint[], prices: bigint[], orderIds: bigint[], liquidationIds: bigint[], isFullCycle: boolean }}
   */
  buildFullCycle(prices, triggeredOrderIds, liquidatablePositionIds) {
    const marketIds = prices.map((p) => BigInt(p.marketId));
    const priceValues = prices.map((p) => p.price);
    const orderIds = triggeredOrderIds.map((id) => BigInt(id));
    const liquidationIds = liquidatablePositionIds.map((id) => BigInt(id));

    const hasWork = orderIds.length > 0 || liquidationIds.length > 0;

    this.logger.debug(
      `  [CycleBuilder] ${marketIds.length} markets, ${orderIds.length} orders, ${liquidationIds.length} liquidations → ${hasWork ? "executeCycle" : "executePriceCycle"}`
    );

    return {
      marketIds,
      prices: priceValues,
      orderIds,
      liquidationIds,
      isFullCycle: hasWork,
    };
  }

  /**
   * Build a price-only cycle (no orders or liquidations).
   * @param {Array<{marketId: number, price: bigint}>} prices
   * @returns {{ marketIds: bigint[], prices: bigint[] }}
   */
  buildPriceCycle(prices) {
    return {
      marketIds: prices.map((p) => BigInt(p.marketId)),
      prices: prices.map((p) => p.price),
    };
  }
}

module.exports = { CycleBuilder };
