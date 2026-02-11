const { pool } = require("../db/pool");

/**
 * GraphQL resolvers — all queries read from the PostgreSQL indexer database.
 */

// Helper: apply pagination defaults
function paginate(limit, offset) {
  return {
    limit: Math.min(limit || 50, 500),
    offset: offset || 0,
  };
}

// Helper: format rows to camelCase for GraphQL
function toCamel(row) {
  if (!row) return null;
  const out = {};
  for (const [key, val] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = val;
  }
  return out;
}

function toCamelArray(rows) {
  return rows.map(toCamel);
}

const resolvers = {
  Query: {
    // ============================================================
    //  POSITIONS
    // ============================================================

    position: async (_, { positionId }) => {
      const res = await pool.query("SELECT * FROM positions WHERE position_id = $1", [positionId]);
      return toCamel(res.rows[0]);
    },

    positions: async (_, { userAddress, marketId, status, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM positions WHERE 1=1";
      const params = [];
      let idx = 1;

      if (userAddress) {
        query += ` AND LOWER(user_address) = LOWER($${idx++})`;
        params.push(userAddress);
      }
      if (marketId !== undefined && marketId !== null) {
        query += ` AND market_id = $${idx++}`;
        params.push(marketId);
      }
      if (status) {
        query += ` AND status = $${idx++}`;
        params.push(status);
      }
      query += ` ORDER BY position_id DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);

      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  TRADES
    // ============================================================

    trades: async (_, { userAddress, marketId, positionId, tradeType, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM trades WHERE 1=1";
      const params = [];
      let idx = 1;

      if (userAddress) {
        query += ` AND LOWER(user_address) = LOWER($${idx++})`;
        params.push(userAddress);
      }
      if (marketId !== undefined && marketId !== null) {
        query += ` AND market_id = $${idx++}`;
        params.push(marketId);
      }
      if (positionId) {
        query += ` AND position_id = $${idx++}`;
        params.push(positionId);
      }
      if (tradeType) {
        query += ` AND trade_type = $${idx++}`;
        params.push(tradeType);
      }
      query += ` ORDER BY block_timestamp DESC, log_index DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);

      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  ORDERS
    // ============================================================

    order: async (_, { orderId }) => {
      const res = await pool.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
      return toCamel(res.rows[0]);
    },

    orders: async (_, { userAddress, marketId, status, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM orders WHERE 1=1";
      const params = [];
      let idx = 1;

      if (userAddress) {
        query += ` AND LOWER(user_address) = LOWER($${idx++})`;
        params.push(userAddress);
      }
      if (marketId !== undefined && marketId !== null) {
        query += ` AND market_id = $${idx++}`;
        params.push(marketId);
      }
      if (status) {
        query += ` AND status = $${idx++}`;
        params.push(status);
      }
      query += ` ORDER BY order_id DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);

      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  LIQUIDATIONS
    // ============================================================

    liquidations: async (_, { userAddress, marketId, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM liquidations WHERE 1=1";
      const params = [];
      let idx = 1;

      if (userAddress) {
        query += ` AND LOWER(user_address) = LOWER($${idx++})`;
        params.push(userAddress);
      }
      if (marketId !== undefined && marketId !== null) {
        query += ` AND market_id = $${idx++}`;
        params.push(marketId);
      }
      query += ` ORDER BY block_timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);

      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  MARKETS
    // ============================================================

    market: async (_, { marketId }) => {
      const res = await pool.query("SELECT * FROM markets WHERE market_id = $1", [marketId]);
      return toCamel(res.rows[0]);
    },

    markets: async () => {
      const res = await pool.query("SELECT * FROM markets ORDER BY market_id ASC");
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  PRICES
    // ============================================================

    latestPrices: async () => {
      const res = await pool.query("SELECT * FROM latest_prices ORDER BY market_id ASC");
      return toCamelArray(res.rows);
    },

    priceHistory: async (_, { marketId, limit, offset }) => {
      const p = paginate(limit, offset);
      const res = await pool.query(
        `SELECT * FROM price_updates WHERE market_id = $1
         ORDER BY block_timestamp DESC LIMIT $2 OFFSET $3`,
        [marketId, p.limit, p.offset]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  FUNDING
    // ============================================================

    fundingRates: async (_, { marketId, limit, offset }) => {
      const p = paginate(limit, offset);
      const res = await pool.query(
        `SELECT * FROM funding_rates WHERE market_id = $1
         ORDER BY block_timestamp DESC LIMIT $2 OFFSET $3`,
        [marketId, p.limit, p.offset]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  VAULTS
    // ============================================================

    userVault: async (_, { userAddress }) => {
      const res = await pool.query(
        "SELECT * FROM user_vaults WHERE LOWER(user_address) = LOWER($1)",
        [userAddress]
      );
      return toCamel(res.rows[0]);
    },

    vaultEvents: async (_, { userAddress, eventType, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM vault_events WHERE 1=1";
      const params = [];
      let idx = 1;

      if (userAddress) {
        query += ` AND LOWER(user_address) = LOWER($${idx++})`;
        params.push(userAddress);
      }
      if (eventType) {
        query += ` AND event_type = $${idx++}`;
        params.push(eventType);
      }
      query += ` ORDER BY block_timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);

      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  COLLATERAL
    // ============================================================

    collateralTokens: async () => {
      const res = await pool.query("SELECT * FROM collateral_tokens ORDER BY added_at ASC");
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  POOL STATE
    // ============================================================

    poolStates: async () => {
      const res = await pool.query("SELECT * FROM pool_state ORDER BY market_id ASC");
      return toCamelArray(res.rows);
    },

    poolState: async (_, { marketId }) => {
      const res = await pool.query("SELECT * FROM pool_state WHERE market_id = $1", [marketId]);
      return toCamel(res.rows[0]);
    },

    // ============================================================
    //  FEES
    // ============================================================

    feeConfig: async () => {
      const res = await pool.query("SELECT * FROM fee_config WHERE id = 1");
      return toCamel(res.rows[0]);
    },

    // ============================================================
    //  PROTOCOL EVENTS
    // ============================================================

    protocolEvents: async (_, { eventName, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM protocol_events WHERE 1=1";
      const params = [];
      let idx = 1;

      if (eventName) {
        query += ` AND event_name = $${idx++}`;
        params.push(eventName);
      }
      query += ` ORDER BY block_timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);

      const res = await pool.query(query, params);
      return res.rows.map((r) => ({
        ...toCamel(r),
        eventData: typeof r.event_data === "string" ? r.event_data : JSON.stringify(r.event_data),
      }));
    },

    // ============================================================
    //  STATS
    // ============================================================

    userStats: async (_, { userAddress }) => {
      const addr = userAddress.toLowerCase();

      const posRes = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'closed') as closed,
          COUNT(*) FILTER (WHERE status = 'liquidated') as liquidated,
          COALESCE(SUM(realized_pnl), 0) as total_pnl
        FROM positions WHERE LOWER(user_address) = $1
      `, [addr]);

      const tradeRes = await pool.query(
        "SELECT COUNT(*) as total FROM trades WHERE LOWER(user_address) = $1",
        [addr]
      );

      const orderRes = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active
        FROM orders WHERE LOWER(user_address) = $1
      `, [addr]);

      const p = posRes.rows[0];
      const t = tradeRes.rows[0];
      const o = orderRes.rows[0];

      return {
        userAddress,
        totalPositions: Number(p.total),
        openPositions: Number(p.open),
        closedPositions: Number(p.closed),
        liquidatedPositions: Number(p.liquidated),
        totalTrades: Number(t.total),
        totalRealizedPnl: p.total_pnl,
        totalOrders: Number(o.total),
        activeOrders: Number(o.active),
      };
    },

    marketStats: async (_, { marketId }) => {
      const mRes = await pool.query("SELECT symbol FROM markets WHERE market_id = $1", [marketId]);
      const symbol = mRes.rows[0]?.symbol || null;

      const posRes = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open
        FROM positions WHERE market_id = $1
      `, [marketId]);

      const tradeRes = await pool.query(`
        SELECT COUNT(*) as total, COALESCE(SUM(size_usd), 0) as volume
        FROM trades WHERE market_id = $1
      `, [marketId]);

      const liqRes = await pool.query(
        "SELECT COUNT(*) as total FROM liquidations WHERE market_id = $1",
        [marketId]
      );

      const priceRes = await pool.query(
        "SELECT price FROM latest_prices WHERE market_id = $1",
        [marketId]
      );

      const fundRes = await pool.query(
        "SELECT rate_24h FROM funding_rates WHERE market_id = $1 ORDER BY block_timestamp DESC LIMIT 1",
        [marketId]
      );

      return {
        marketId,
        symbol,
        totalPositions: Number(posRes.rows[0].total),
        openPositions: Number(posRes.rows[0].open),
        totalTrades: Number(tradeRes.rows[0].total),
        totalLiquidations: Number(liqRes.rows[0].total),
        totalVolume: tradeRes.rows[0].volume,
        latestPrice: priceRes.rows[0]?.price || null,
        latestFundingRate: fundRes.rows[0]?.rate_24h || null,
      };
    },

    globalStats: async () => {
      const markets = await pool.query("SELECT COUNT(*) as c FROM markets");
      const positions = await pool.query(`
        SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'open') as open
        FROM positions
      `);
      const trades = await pool.query(
        "SELECT COUNT(*) as total, COALESCE(SUM(size_usd), 0) as volume FROM trades"
      );
      const liqs = await pool.query("SELECT COUNT(*) as total FROM liquidations");
      const users = await pool.query("SELECT COUNT(DISTINCT user_address) as total FROM positions");
      const block = await pool.query(
        "SELECT value FROM indexer_state WHERE key = 'last_indexed_block'"
      );

      return {
        totalMarkets: Number(markets.rows[0].c),
        totalPositions: Number(positions.rows[0].total),
        openPositions: Number(positions.rows[0].open),
        totalTrades: Number(trades.rows[0].total),
        totalLiquidations: Number(liqs.rows[0].total),
        totalVolume: trades.rows[0].volume,
        totalUsers: Number(users.rows[0].total),
        indexerBlock: Number(block.rows[0]?.value || 0),
      };
    },

    indexerStatus: async (_, __, context) => {
      const block = await pool.query(
        "SELECT value FROM indexer_state WHERE key = 'last_indexed_block'"
      );
      const lastBlock = Number(block.rows[0]?.value || 0);
      const scannerStats = context.scanner?.getStats() || {};
      const chainHead = context.chainHead || null;

      return {
        lastIndexedBlock: lastBlock,
        chainHead,
        blocksScanned: scannerStats.blocksScanned || 0,
        eventsProcessed: scannerStats.eventsProcessed || 0,
        isSynced: chainHead ? lastBlock >= chainHead - 5 : null,
      };
    },
  },

  // ============================================================
  //  NESTED RESOLVERS
  // ============================================================

  Position: {
    market: async (parent) => {
      if (!parent.marketId && parent.marketId !== 0) return null;
      const res = await pool.query("SELECT * FROM markets WHERE market_id = $1", [parent.marketId]);
      return toCamel(res.rows[0]);
    },
  },

  Market: {
    latestPrice: async (parent) => {
      const res = await pool.query("SELECT * FROM latest_prices WHERE market_id = $1", [parent.marketId]);
      return toCamel(res.rows[0]);
    },
    poolState: async (parent) => {
      const res = await pool.query("SELECT * FROM pool_state WHERE market_id = $1", [parent.marketId]);
      return toCamel(res.rows[0]);
    },
    fundingRate: async (parent) => {
      const res = await pool.query(
        "SELECT * FROM funding_rates WHERE market_id = $1 ORDER BY block_timestamp DESC LIMIT 1",
        [parent.marketId]
      );
      return toCamel(res.rows[0]);
    },
  },
};

module.exports = { resolvers };
