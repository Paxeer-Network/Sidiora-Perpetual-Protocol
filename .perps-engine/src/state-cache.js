/**
 * In-memory cache for active orders, positions, prices, market configs, and funding states.
 * Primary data source: indexer GraphQL. Fallback: on-chain reads.
 * Refreshed on a configurable interval (default 30s for orders/positions).
 */
class StateCache {
  constructor(config, submitter, markets, logger) {
    this.config = config;
    this.submitter = submitter;
    this.markets = markets;
    this.logger = logger;

    // Active orders: Map<orderId (bigint), OrderData>
    this.activeOrders = new Map();

    // Active positions: Map<positionId (bigint), PositionData>
    this.activePositions = new Map();

    // Latest prices: Map<marketId (number), bigint>
    this.prices = new Map();

    // Market configs: Map<marketId (number), MarketConfig>
    this.marketConfigs = new Map();

    // Funding states: Map<marketId (number), FundingState>
    this.fundingStates = new Map();

    // Tracking
    this.lastOrderRefresh = 0;
    this.lastPositionRefresh = 0;
    this.lastMarketRefresh = 0;
    this.lastFundingRefresh = 0;
    this.indexerAvailable = true;
  }

  // ============================================================
  //  PRICE CACHE (updated every cycle from fetched prices)
  // ============================================================

  /**
   * Update the price cache with freshly fetched prices.
   * @param {Array<{marketId: number, symbol: string, price: bigint}>} fetchedPrices
   * @returns {Map<number, bigint>} The price map (marketId → price)
   */
  updatePrices(fetchedPrices) {
    for (const p of fetchedPrices) {
      this.prices.set(p.marketId, p.price);
    }
    return this.prices;
  }

  getPrice(marketId) {
    return this.prices.get(marketId) || null;
  }

  // ============================================================
  //  ORDER CACHE
  // ============================================================

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

  getActiveOrders() {
    return Array.from(this.activeOrders.entries()).map(([orderId, data]) => ({
      orderId,
      ...data,
    }));
  }

  getOrder(orderId) {
    return this.activeOrders.get(BigInt(orderId)) || null;
  }

  removeOrder(orderId) {
    this.activeOrders.delete(BigInt(orderId));
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

    const resp = await this._graphqlQuery(query);
    const orders = resp.data.orders || [];
    this.activeOrders.clear();

    for (const o of orders) {
      const orderId = BigInt(o.orderId);
      try {
        const full = await this.submitter.getOrder(orderId);
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
    // Minimal fallback — read recent OrderPlaced events
    try {
      const currentBlock = await this.submitter.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);

      const filter = this.submitter.diamond.filters.OrderPlaced?.();
      if (!filter) {
        this.logger.warn("  OrderPlaced event not in ABI — cannot scan on-chain");
        return;
      }

      const events = await this.submitter.diamond.queryFilter(filter, fromBlock, currentBlock);
      const candidateIds = new Set();
      for (const event of events) {
        candidateIds.add(BigInt(event.args[0]));
      }

      this.activeOrders.clear();
      for (const orderId of candidateIds) {
        try {
          const order = await this.submitter.getOrder(orderId);
          if (order.active) {
            this.activeOrders.set(orderId, order);
          }
        } catch {
          // Skip
        }
      }

      this.logger.info(
        `  Orders refreshed from chain: ${this.activeOrders.size} active`
      );
    } catch (err) {
      this.logger.error(`  Failed to refresh orders from chain: ${err.message}`);
    }
  }

  // ============================================================
  //  POSITION CACHE
  // ============================================================

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

  getActivePositions() {
    return Array.from(this.activePositions.entries()).map(
      ([positionId, data]) => ({ positionId, ...data })
    );
  }

  removePosition(positionId) {
    this.activePositions.delete(BigInt(positionId));
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

    const resp = await this._graphqlQuery(query);
    const positions = resp.data.positions || [];
    this.activePositions.clear();

    for (const p of positions) {
      const positionId = BigInt(p.positionId);
      // Fetch full on-chain data for funding index
      try {
        const full = await this.submitter.getPosition(positionId);
        if (full.active) {
          this.activePositions.set(positionId, full);
        }
      } catch {
        // Fall back to indexer data only
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
    }

    this.logger.info(
      `  Positions refreshed from indexer: ${this.activePositions.size} open`
    );
  }

  async _refreshPositionsFromChain() {
    try {
      const currentBlock = await this.submitter.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000);

      const filter = this.submitter.diamond.filters.PositionOpened?.();
      if (!filter) {
        this.logger.warn("  PositionOpened event not in ABI — cannot scan on-chain");
        return;
      }

      const events = await this.submitter.diamond.queryFilter(filter, fromBlock, currentBlock);
      const candidateIds = new Set();
      for (const event of events) {
        candidateIds.add(BigInt(event.args[0]));
      }

      this.activePositions.clear();
      for (const positionId of candidateIds) {
        try {
          const pos = await this.submitter.getPosition(positionId);
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

  async refreshMarketConfigs() {
    const now = Date.now();
    if (now - this.lastMarketRefresh < this.config.marketConfigRefreshMs) return;

    for (const m of this.markets) {
      try {
        const config = await this.submitter.getMarket(m.marketId);
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

  // ============================================================
  //  FUNDING STATE CACHE
  // ============================================================

  async refreshFundingStates() {
    const now = Date.now();
    // Refresh every 60 seconds (funding changes slowly)
    if (now - this.lastFundingRefresh < 60000) return;

    for (const m of this.markets) {
      try {
        const state = await this.submitter.getFundingState(m.marketId);
        this.fundingStates.set(m.marketId, state);
      } catch (err) {
        this.logger.debug(
          `  Failed to load funding state for ${m.symbol}: ${err.message}`
        );
      }
    }

    this.lastFundingRefresh = now;
  }

  // ============================================================
  //  INDEXER HEALTH
  // ============================================================

  async checkIndexerHealth() {
    if (this.indexerAvailable) return;

    try {
      const resp = await this._graphqlQuery("{ indexerStatus { isSynced } }");
      if (resp.data) {
        this.indexerAvailable = true;
        this.logger.info("  Indexer reconnected");
      }
    } catch {
      // Still unavailable
    }
  }

  // ============================================================
  //  GraphQL helper
  // ============================================================

  async _graphqlQuery(query) {
    const res = await fetch(this.config.indexerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`GraphQL HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }

    return json;
  }
}

module.exports = { StateCache };
