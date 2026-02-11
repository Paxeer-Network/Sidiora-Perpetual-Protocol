/**
 * Order Scanner — detects triggered limit and stop-limit orders
 * and submits executeOrder() transactions via the Executor.
 *
 * Trigger logic mirrors the on-chain _validateTriggerCondition():
 *   LIMIT long:       currentPrice <= triggerPrice
 *   LIMIT short:      currentPrice >= triggerPrice
 *   STOP_LIMIT long:  currentPrice >= triggerPrice AND currentPrice <= limitPrice
 *   STOP_LIMIT short: currentPrice <= triggerPrice AND currentPrice >= limitPrice
 */

const ORDER_TYPE_LIMIT = 0;
const ORDER_TYPE_STOP_LIMIT = 1;

class OrderScanner {
  constructor(stateCache, executor, logger) {
    this.cache = stateCache;
    this.executor = executor;
    this.logger = logger;

    this.stats = {
      scansPerformed: 0,
      ordersTriggered: 0,
      ordersExecuted: 0,
      ordersFailed: 0,
    };
  }

  /**
   * Run a full scan of active orders against current cached prices.
   * Called after each PricesUpdated event.
   * @param {number[]} [updatedMarketIds] - If provided, only scan orders for these markets
   */
  async scan(updatedMarketIds = null) {
    this.stats.scansPerformed++;
    const orders = this.cache.getActiveOrders();

    if (orders.length === 0) {
      this.logger.debug("  [Orders] No active orders to scan");
      return;
    }

    const triggered = [];

    for (const order of orders) {
      const marketId = Number(order.marketId);

      // If we know which markets updated, skip orders for other markets
      if (updatedMarketIds && !updatedMarketIds.includes(marketId)) {
        continue;
      }

      const currentPrice = this.cache.getPrice(marketId);
      if (!currentPrice || currentPrice === 0n) continue;

      if (this._isTriggered(order, currentPrice)) {
        triggered.push(order);
      }
    }

    if (triggered.length === 0) {
      this.logger.debug(
        `  [Orders] Scanned ${orders.length} orders, none triggered`
      );
      return;
    }

    this.logger.info(
      `  [Orders] ${triggered.length} order(s) triggered out of ${orders.length} active`
    );

    // Execute triggered orders sequentially
    for (const order of triggered) {
      await this._executeTriggeredOrder(order);
    }
  }

  /**
   * Check if an order's trigger condition is met.
   * @param {object} order
   * @param {bigint} currentPrice
   * @returns {boolean}
   */
  _isTriggered(order, currentPrice) {
    const orderType = Number(order.orderType);
    const triggerPrice = BigInt(order.triggerPrice);
    const limitPrice = BigInt(order.limitPrice);

    if (orderType === ORDER_TYPE_LIMIT) {
      // Limit buy (long): trigger when price <= triggerPrice
      // Limit sell (short): trigger when price >= triggerPrice
      if (order.isLong) {
        return currentPrice <= triggerPrice;
      } else {
        return currentPrice >= triggerPrice;
      }
    } else if (orderType === ORDER_TYPE_STOP_LIMIT) {
      // Stop-limit buy: trigger when price >= triggerPrice (breakout)
      //   AND price <= limitPrice (max acceptable)
      // Stop-limit sell: trigger when price <= triggerPrice (breakdown)
      //   AND price >= limitPrice (min acceptable)
      if (order.isLong) {
        return currentPrice >= triggerPrice && currentPrice <= limitPrice;
      } else {
        return currentPrice <= triggerPrice && currentPrice >= limitPrice;
      }
    }

    return false;
  }

  /**
   * Execute a single triggered order.
   * @param {object} order - Order data with orderId
   */
  async _executeTriggeredOrder(order) {
    const marketId = Number(order.marketId);
    const price = this.cache.getPrice(marketId);
    const priceStr = price ? this._formatUsd(price) : "?";
    const typeStr = Number(order.orderType) === ORDER_TYPE_LIMIT ? "LIMIT" : "STOP-LIMIT";
    const dirStr = order.isLong ? "LONG" : "SHORT";
    const triggerStr = this._formatUsd(BigInt(order.triggerPrice));

    this.logger.info(
      `  [Orders] Executing #${order.orderId} ${typeStr} ${dirStr} ` +
        `(trigger=$${triggerStr}, price=$${priceStr})`
    );

    this.stats.ordersTriggered++;

    const result = await this.executor.executeOrder(order.orderId);

    if (result.success) {
      this.stats.ordersExecuted++;
      this.cache.removeOrder(order.orderId);
      this.logger.info(
        `  [Orders] #${order.orderId} executed -> TX ${result.txHash}`
      );
    } else {
      this.stats.ordersFailed++;
      // If it reverted (non-retryable), remove from cache
      if (result.reverted) {
        this.cache.removeOrder(order.orderId);
        this.logger.warn(
          `  [Orders] #${order.orderId} reverted: ${result.error} (removed from queue)`
        );
      } else {
        this.logger.error(
          `  [Orders] #${order.orderId} failed: ${result.error} (will retry next cycle)`
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

module.exports = { OrderScanner };
