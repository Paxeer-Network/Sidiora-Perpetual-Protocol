const { ORDER_TYPE } = require("../../config");

/**
 * Order Scanner — detects triggered orders across all 4 types:
 *   LIMIT (0), STOP_LIMIT (1), TAKE_PROFIT (2), STOP_LOSS (3)
 *
 * Trigger logic mirrors the on-chain _checkTrigger() in KeeperMulticallFacet:
 *   LIMIT long:       currentPrice <= triggerPrice
 *   LIMIT short:      currentPrice >= triggerPrice
 *   STOP_LIMIT long:  currentPrice >= triggerPrice AND currentPrice <= limitPrice
 *   STOP_LIMIT short: currentPrice <= triggerPrice AND currentPrice >= limitPrice
 *   TAKE_PROFIT long: currentPrice >= triggerPrice  (close profit on long)
 *   TAKE_PROFIT short:currentPrice <= triggerPrice  (close profit on short)
 *   STOP_LOSS long:   currentPrice <= triggerPrice  (stop loss on long)
 *   STOP_LOSS short:  currentPrice >= triggerPrice  (stop loss on short)
 */
class OrderScanner {
  constructor(stateCache, logger) {
    this.cache = stateCache;
    this.logger = logger;

    this.stats = {
      scansPerformed: 0,
      ordersTriggered: 0,
    };
  }

  /**
   * Scan active orders against current prices and return triggered order IDs.
   * Does NOT execute — the cycle builder collects these and passes them to executeCycle().
   * @param {Map<number, bigint>} prices - marketId → price (18 dec)
   * @returns {bigint[]} Array of triggered order IDs
   */
  scan(prices) {
    this.stats.scansPerformed++;
    const orders = this.cache.getActiveOrders();

    if (orders.length === 0) {
      this.logger.debug("  [Orders] No active orders to scan");
      return [];
    }

    const triggered = [];

    for (const order of orders) {
      const marketId = Number(order.marketId);
      const currentPrice = prices.get(marketId);
      if (!currentPrice || currentPrice === 0n) continue;

      if (this._isTriggered(order, currentPrice)) {
        triggered.push(order.orderId);
      }
    }

    if (triggered.length > 0) {
      this.stats.ordersTriggered += triggered.length;
      this.logger.info(
        `  [Orders] ${triggered.length} triggered out of ${orders.length} active`
      );

      for (const id of triggered) {
        const order = this.cache.getOrder(id);
        if (order) {
          const typeStr = this._orderTypeName(Number(order.orderType));
          const dirStr = order.isLong ? "LONG" : "SHORT";
          this.logger.info(
            `  [Orders]   #${id} ${typeStr} ${dirStr} trigger=$${this._formatUsd(BigInt(order.triggerPrice))}`
          );
        }
      }
    } else {
      this.logger.debug(
        `  [Orders] Scanned ${orders.length} orders, none triggered`
      );
    }

    return triggered;
  }

  /**
   * Check if an order's trigger condition is met.
   * Mirrors KeeperMulticallFacet._checkTrigger() exactly.
   */
  _isTriggered(order, currentPrice) {
    const orderType = Number(order.orderType);
    const triggerPrice = BigInt(order.triggerPrice);
    const isLong = order.isLong;

    if (orderType === ORDER_TYPE.LIMIT) {
      return isLong ? currentPrice <= triggerPrice : currentPrice >= triggerPrice;
    }

    if (orderType === ORDER_TYPE.STOP_LIMIT) {
      const limitPrice = BigInt(order.limitPrice || order.triggerPrice);
      if (isLong) {
        return currentPrice >= triggerPrice && currentPrice <= limitPrice;
      } else {
        return currentPrice <= triggerPrice && currentPrice >= limitPrice;
      }
    }

    if (orderType === ORDER_TYPE.TAKE_PROFIT) {
      return isLong ? currentPrice >= triggerPrice : currentPrice <= triggerPrice;
    }

    if (orderType === ORDER_TYPE.STOP_LOSS) {
      return isLong ? currentPrice <= triggerPrice : currentPrice >= triggerPrice;
    }

    return false;
  }

  _orderTypeName(type) {
    switch (type) {
      case ORDER_TYPE.LIMIT: return "LIMIT";
      case ORDER_TYPE.STOP_LIMIT: return "STOP-LIMIT";
      case ORDER_TYPE.TAKE_PROFIT: return "TAKE-PROFIT";
      case ORDER_TYPE.STOP_LOSS: return "STOP-LOSS";
      default: return `TYPE(${type})`;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  _formatUsd(price18) {
    return (Number(price18 / 10n ** 14n) / 10000).toFixed(2);
  }
}

module.exports = { OrderScanner };
