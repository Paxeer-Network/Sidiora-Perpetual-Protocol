const axios = require("axios");

/**
 * In-memory cache for active orders, positions, prices, and market configs.
 * Minimizes RPC calls by querying the indexer GraphQL and refreshing periodically.
 * Falls back to on-chain reads when the indexer is unavailable.
 */
class StateCache {
  constructor(config, executor, markets, logger) {
    this.config = config;
    this.executor = executor;
    this.markets = markets;
    this.logger = logger;

    // Active orders: Map<orderId, OrderData>
    this.activeOrders = new Map();

    // Active positions: Map<positionId, PositionData>
    this.activePositions = new Map();

    // Latest prices: Map<marketId, { price: bigint, timestamp: bigint }>
    this.prices = new Map();

    // Market configs: Map<marketId, MarketConfig>
    this.marketConfigs = new Map();

    // Tracking
    this.lastOrderRefresh = 0;
    this.lastPositionRefresh = 0;
    this.lastMarketRefresh = 0;
    this.indexerAvailable = true;
  }

  // ============================================================
  //  PRICE CACHE
  // ============================================================

  /**
   * Update prices from on-chain OracleFacet.
   * Called on each cycle or after PricesUpdated event.
   */
  async refreshPrices() {
    const updated = [];
    for (const m of this.markets) {
      try {
        const { price, timestamp } = await this.executor.getPrice(m.marketId);
        this.prices.set(m.marketId, { price, timestamp });
        updated.push(m.symbol);
      } catch (err) {
        this.logger.warn(
          `  Failed to fetch price for ${m.symbol}: ${err.message}`
        );
      }
    }
    if (updated.length > 0) {
      this.logger.debug(`  Prices refreshed: ${updated.join(", ")}`);
    }
  }

  /**
   * Get cached price for a market.
   * @param {number} marketId
   * @returns {bigint|null}
   */
  getPrice(marketId) {
    const entry = this.prices.get(marketId);
    return entry ? entry.price : null;
  }

  // ============================================================
  //  ORDER CACHE
  // ============================================================

  /**
   * Refresh the active order set.
   * Tries indexer first, falls back to on-chain event scanning.
   */
  async refreshOrders() {
    const now = Date.now();
    if (now - this.lastOrderRefresh < this.config.orderRefreshMs) return;

    this.logger.debug("  Refreshing active orders...");

    if (this.indexerAvailable) {
      try {
        await this._refreshOrdersFromIndexer();
        this.lastOrderRefresh = now;
        return;
      } catch (err) {
        this.logger.warn(
          `  Indexer unavailable for orders: ${err.message}. Falling back to on-chain.`
        );
        this.indexerAvailable = false;
      }
    }

    await this._refreshOrdersFromChain();
    this.lastOrderRefresh = now;
  }

  /**
   * Remove an order from the active set (after execution, cancellation, or revert).
   * @param {bigint|number} orderId
   */
  removeOrder(orderId) {
    this.activeOrders.delete(BigInt(orderId));
  }

  /**
   * Get all active orders as an array.
   * @returns {Array<{ orderId: bigint, ...OrderData }>}
   */
  getActiveOrders() {
    return Array.from(this.activeOrders.entries()).map(([orderId, data]) => ({
      orderId,
      ...data,
    }));
  }

  async _refreshOrdersFromIndexer() {
    const query = `{
      orders(status: "active", limit: 1000) {
        orderId
        userAddress
        marketId
        orderType
        isLong
        triggerPrice
        sizeUsd
      }
    }`;

    const resp = await axios.post(
      this.config.indexerUrl,
      { query },
      { timeout: 5000 }
    );

    if (resp.data.errors) {
      throw new Error(resp.data.errors[0].message);
    }

    const orders = resp.data.data.orders || [];
    this.activeOrders.clear();

    for (const o of orders) {
      const orderId = BigInt(o.orderId);
      // Fetch full order details from chain (indexer may not have limitPrice etc.)
      try {
        const full = await this.executor.getOrder(orderId);
        if (full.active) {
          this.activeOrders.set(orderId, full);
        }
      } catch {
        // Skip orders that fail to read
      }
    }

    this.logger.info(`  Orders refreshed from indexer: ${this.activeOrders.size} active`);
  }

  async _refreshOrdersFromChain() {
    // Scan OrderPlaced events from recent blocks and verify on-chain
    // This is a fallback — less efficient but works without the indexer
    try {
      const currentBlock = await this.executor.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);

      const filter = this.executor.diamond.filters.OrderPlaced();
      const events = await this.executor.diamond.queryFilter(
        filter,
        fromBlock,
        currentBlock
      );

      const candidateIds = new Set();
      for (const event of events) {
        candidateIds.add(BigInt(event.args[0]));
      }

      // Also remove cancelled/executed
      const cancelFilter = this.executor.diamond.filters.OrderCancelled();
      const cancelEvents = await this.executor.diamond.queryFilter(
        cancelFilter,
        fromBlock,
        currentBlock
      );
      for (const event of cancelEvents) {
        candidateIds.delete(BigInt(event.args[0]));
      }

      const execFilter = this.executor.diamond.filters.OrderExecuted();
      const execEvents = await this.executor.diamond.queryFilter(
        execFilter,
        fromBlock,
        currentBlock
      );
      for (const event of execEvents) {
        candidateIds.delete(BigInt(event.args[0]));
      }

      // Verify each candidate on-chain
      this.activeOrders.clear();
      for (const orderId of candidateIds) {
        try {
          const order = await this.executor.getOrder(orderId);
          if (order.active) {
            this.activeOrders.set(orderId, order);
          }
        } catch {
          // Skip
        }
      }

      this.logger.info(
        `  Orders refreshed from chain: ${this.activeOrders.size} active (scanned ${candidateIds.size} candidates)`
      );
    } catch (err) {
      this.logger.error(`  Failed to refresh orders from chain: ${err.message}`);
    }
  }

  // ============================================================
  //  POSITION CACHE
  // ============================================================

  /**
   * Refresh active positions from indexer or chain.
   */
  async refreshPositions() {
    const now = Date.now();
    if (now - this.lastPositionRefresh < this.config.positionRefreshMs) return;

    this.logger.debug("  Refreshing active positions...");

    if (this.indexerAvailable) {
      try {
        await this._refreshPositionsFromIndexer();
        this.lastPositionRefresh = now;
        return;
      } catch (err) {
        this.logger.warn(
          `  Indexer unavailable for positions: ${err.message}. Falling back to on-chain.`
        );
      }
    }

    await this._refreshPositionsFromChain();
    this.lastPositionRefresh = now;
  }

  /**
   * Remove a position from the active set.
   * @param {bigint|number} positionId
   */
  removePosition(positionId) {
    this.activePositions.delete(BigInt(positionId));
  }

  /**
   * Get all active positions as an array.
   * @returns {Array<{ positionId: bigint, ...PositionData }>}
   */
  getActivePositions() {
    return Array.from(this.activePositions.entries()).map(
      ([positionId, data]) => ({
        positionId,
        ...data,
      })
    );
  }

  async _refreshPositionsFromIndexer() {
    const query = `{
      positions(status: "open", limit: 5000) {
        positionId
        userAddress
        marketId
        isLong
        sizeUsd
        entryPrice
        collateralUsd
      }
    }`;

    const resp = await axios.post(
      this.config.indexerUrl,
      { query },
      { timeout: 10000 }
    );

    if (resp.data.errors) {
      throw new Error(resp.data.errors[0].message);
    }

    const positions = resp.data.data.positions || [];
    this.activePositions.clear();

    for (const p of positions) {
      const positionId = BigInt(p.positionId);
      this.activePositions.set(positionId, {
        user: p.userAddress,
        marketId: BigInt(p.marketId),
        isLong: p.isLong,
        sizeUsd: BigInt(p.sizeUsd),
        entryPrice: BigInt(p.entryPrice),
        collateralUsd: BigInt(p.collateralUsd),
        active: true,
      });
    }

    this.logger.info(
      `  Positions refreshed from indexer: ${this.activePositions.size} open`
    );
  }

  async _refreshPositionsFromChain() {
    // Scan recent PositionOpened events and verify on-chain
    try {
      const currentBlock = await this.executor.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000);

      const filter = this.executor.diamond.filters.PositionOpened();
      const events = await this.executor.diamond.queryFilter(
        filter,
        fromBlock,
        currentBlock
      );

      const candidateIds = new Set();
      for (const event of events) {
        candidateIds.add(BigInt(event.args[0]));
      }

      this.activePositions.clear();
      for (const positionId of candidateIds) {
        try {
          const pos = await this.executor.getPosition(positionId);
          if (pos.active) {
            this.activePositions.set(positionId, pos);
          }
        } catch {
          // Skip
        }
      }

      this.logger.info(
        `  Positions refreshed from chain: ${this.activePositions.size} open`
      );
    } catch (err) {
      this.logger.error(
        `  Failed to refresh positions from chain: ${err.message}`
      );
    }
  }

  // ============================================================
  //  MARKET CONFIG CACHE
  // ============================================================

  /**
   * Load market configurations (rarely changes, refresh every 30 min).
   */
  async refreshMarketConfigs() {
    const now = Date.now();
    if (now - this.lastMarketRefresh < 1800000) return; // 30 min

    for (const m of this.markets) {
      try {
        const config = await this.executor.getMarket(m.marketId);
        this.marketConfigs.set(m.marketId, config);
      } catch (err) {
        this.logger.warn(
          `  Failed to load market config for ${m.symbol}: ${err.message}`
        );
      }
    }

    this.lastMarketRefresh = now;
    this.logger.debug(
      `  Market configs refreshed: ${this.marketConfigs.size} markets`
    );
  }

  /**
   * Retry indexer connection periodically.
   */
  async checkIndexerHealth() {
    if (this.indexerAvailable) return;

    try {
      const resp = await axios.post(
        this.config.indexerUrl,
        { query: "{ indexerStatus { isSynced } }" },
        { timeout: 3000 }
      );
      if (resp.data.data) {
        this.indexerAvailable = true;
        this.logger.info("  Indexer reconnected");
      }
    } catch {
      // Still unavailable
    }
  }
}

module.exports = { StateCache };
