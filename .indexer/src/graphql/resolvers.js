const { pool } = require("../db/pool");
const orderly = require("../orderly-proxy");
const { gqlPubSub } = require("./subscriptions");
const { withFilter } = require("graphql-subscriptions");

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

    orders: async (_, { userAddress, marketId, status, orderType, limit, offset }) => {
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
      if (orderType !== undefined && orderType !== null) {
        query += ` AND order_type = $${idx++}`;
        params.push(orderType);
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

    // ============================================================
    //  V2 — KEEPER CYCLES
    // ============================================================

    keeperCycles: async (_, { limit, offset }) => {
      const p = paginate(limit, offset);
      const res = await pool.query(
        `SELECT * FROM keeper_cycles ORDER BY block_timestamp DESC LIMIT $1 OFFSET $2`,
        [p.limit, p.offset]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V2 — ACCOUNT LEDGER
    // ============================================================

    accountLedger: async (_, { userAddress, positionId, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM account_ledger WHERE 1=1";
      const params = [];
      let idx = 1;

      if (userAddress) {
        query += ` AND LOWER(user_address) = LOWER($${idx++})`;
        params.push(userAddress);
      }
      if (positionId) {
        query += ` AND position_id = $${idx++}`;
        params.push(positionId);
      }
      query += ` ORDER BY block_timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);

      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V2 — DELEGATES
    // ============================================================

    delegates: async (_, { userAddress }) => {
      const res = await pool.query(
        `SELECT * FROM delegates WHERE LOWER(user_address) = LOWER($1) AND is_active = TRUE
         ORDER BY block_timestamp DESC`,
        [userAddress]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V2 — TRADING ACCOUNT EVENTS
    // ============================================================

    tradingAccountEvents: async (_, { userAddress, eventType, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM trading_account_events WHERE 1=1";
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
      return res.rows.map((r) => ({
        ...toCamel(r),
        extraData: typeof r.extra_data === "string" ? r.extra_data : JSON.stringify(r.extra_data),
      }));
    },

    // ============================================================
    //  V5 — FEES
    // ============================================================

    fees: async (_, { userAddress, marketId, positionId, feeType, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM fees WHERE 1=1";
      const params = [];
      let idx = 1;
      if (userAddress) { query += ` AND LOWER(user_address) = LOWER($${idx++})`; params.push(userAddress); }
      if (marketId !== undefined && marketId !== null) { query += ` AND market_id = $${idx++}`; params.push(marketId); }
      if (positionId) { query += ` AND position_id = $${idx++}`; params.push(positionId); }
      if (feeType !== undefined && feeType !== null) { query += ` AND fee_type = $${idx++}`; params.push(feeType); }
      query += ` ORDER BY block_timestamp DESC, log_index DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);
      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V5 — TRADE SETTLEMENTS
    // ============================================================

    tradeSettlements: async (_, { userAddress, marketId, positionId, tradeType, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM trade_settlements WHERE 1=1";
      const params = [];
      let idx = 1;
      if (userAddress) { query += ` AND LOWER(user_address) = LOWER($${idx++})`; params.push(userAddress); }
      if (marketId !== undefined && marketId !== null) { query += ` AND market_id = $${idx++}`; params.push(marketId); }
      if (positionId) { query += ` AND position_id = $${idx++}`; params.push(positionId); }
      if (tradeType !== undefined && tradeType !== null) { query += ` AND trade_type = $${idx++}`; params.push(tradeType); }
      query += ` ORDER BY block_timestamp DESC, log_index DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);
      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V5 — OI SNAPSHOTS
    // ============================================================

    oiSnapshots: async (_, { marketId, limit, offset }) => {
      const p = paginate(limit, offset);
      const res = await pool.query(
        `SELECT * FROM oi_snapshots WHERE market_id = $1 ORDER BY block_timestamp DESC LIMIT $2 OFFSET $3`,
        [marketId, p.limit, p.offset]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V5 — MARK PRICE HISTORY
    // ============================================================

    markPriceHistory: async (_, { marketId, limit, offset }) => {
      const p = paginate(limit, offset);
      const res = await pool.query(
        `SELECT * FROM mark_price_history WHERE market_id = $1 ORDER BY block_timestamp DESC LIMIT $2 OFFSET $3`,
        [marketId, p.limit, p.offset]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V5 — VAULT BALANCE HISTORY
    // ============================================================

    vaultBalanceHistory: async (_, { tokenAddress, vaultType, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM vault_balance_history WHERE 1=1";
      const params = [];
      let idx = 1;
      if (tokenAddress) { query += ` AND LOWER(token_address) = LOWER($${idx++})`; params.push(tokenAddress); }
      if (vaultType !== undefined && vaultType !== null) { query += ` AND vault_type = $${idx++}`; params.push(vaultType); }
      query += ` ORDER BY block_timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);
      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V5 — FUNDING PAYMENTS
    // ============================================================

    fundingPayments: async (_, { userAddress, marketId, positionId, limit, offset }) => {
      const p = paginate(limit, offset);
      let query = "SELECT * FROM funding_payments WHERE 1=1";
      const params = [];
      let idx = 1;
      if (userAddress) { query += ` AND LOWER(user_address) = LOWER($${idx++})`; params.push(userAddress); }
      if (marketId !== undefined && marketId !== null) { query += ` AND market_id = $${idx++}`; params.push(marketId); }
      if (positionId) { query += ` AND position_id = $${idx++}`; params.push(positionId); }
      query += ` ORDER BY block_timestamp DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(p.limit, p.offset);
      const res = await pool.query(query, params);
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V5 — MARKET SNAPSHOTS
    // ============================================================

    marketSnapshots: async (_, { marketId, limit, offset }) => {
      const p = paginate(limit, offset);
      const res = await pool.query(
        `SELECT * FROM market_snapshots WHERE market_id = $1 ORDER BY block_timestamp DESC LIMIT $2 OFFSET $3`,
        [marketId, p.limit, p.offset]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  V5 — PROTOCOL SNAPSHOTS
    // ============================================================

    protocolSnapshots: async (_, { limit, offset }) => {
      const p = paginate(limit, offset);
      const res = await pool.query(
        `SELECT * FROM protocol_snapshots ORDER BY block_timestamp DESC LIMIT $1 OFFSET $2`,
        [p.limit, p.offset]
      );
      return toCamelArray(res.rows);
    },

    // ============================================================
    //  ENRICHED STATS (on-chain + Orderly)
    // ============================================================

    enrichedGlobalStats: async () => {
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

      const onchain = {
        totalMarkets: Number(markets.rows[0].c),
        totalPositions: Number(positions.rows[0].total),
        openPositions: Number(positions.rows[0].open),
        totalTrades: Number(trades.rows[0].total),
        totalLiquidations: Number(liqs.rows[0].total),
        totalVolume: trades.rows[0].volume,
        totalUsers: Number(users.rows[0].total),
        indexerBlock: Number(block.rows[0]?.value || 0),
      };

      let orderlyStats = null;
      try {
        orderlyStats = await orderly.getVolumeStats();
      } catch {}

      return { onchain, orderly: orderlyStats };
    },

    enrichedMarketStats: async (_, { marketId }) => {
      const mRes = await pool.query("SELECT symbol FROM markets WHERE market_id = $1", [marketId]);
      const symbol = mRes.rows[0]?.symbol || null;

      const posRes = await pool.query(`
        SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'open') as open
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

      const onchain = {
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

      const orderlySymbol = symbol ? orderly.SYMBOL_MAP[symbol] : null;
      let ticker = null;
      let fundingRate = null;
      let openInterest = null;
      let priceChange = null;

      if (orderlySymbol) {
        try {
          const [tickers, rates, ois, changes] = await Promise.all([
            orderly.getTickers(),
            orderly.getFundingRates(),
            orderly.getOpenInterests(),
            orderly.getPriceChanges(),
          ]);
          ticker = tickers.find((t) => t.symbol === orderlySymbol) || null;
          fundingRate = rates.find((r) => r.symbol === orderlySymbol) || null;
          openInterest = ois.find((o) => o.symbol === orderlySymbol) || null;
          priceChange = changes.find((c) => c.symbol === orderlySymbol) || null;
        } catch {}
      }

      return { onchain, ticker, fundingRate, openInterest, priceChange };
    },

    // ============================================================
    //  ORDERLY DATA VIA GRAPHQL
    // ============================================================

    orderlyTickers: async () => {
      const [tickers, custom] = await Promise.all([
        orderly.getTickers().catch(() => []),
        orderly.getCustomPrices().catch(() => []),
      ]);
      return [...tickers, ...custom];
    },

    orderlyFundingRates: async () => {
      return orderly.getFundingRates();
    },

    orderlyPriceChanges: async () => {
      return orderly.getPriceChanges();
    },

    orderlyOpenInterests: async () => {
      return orderly.getOpenInterests();
    },

    // ============================================================
    //  V4 SPOT TRADING
    // ============================================================

  }, // <-- closes Query

  // ============================================================
  //  NESTED RESOLVERS
  // ============================================================

  OrderlyTicker: {
    h24_open: (parent) => parent["24h_open"] ?? null,
    h24_close: (parent) => parent["24h_close"] ?? null,
    h24_high: (parent) => parent["24h_high"] ?? null,
    h24_low: (parent) => parent["24h_low"] ?? null,
    h24_amount: (parent) => parent["24h_amount"] ?? null,
    h24_volume: (parent) => parent["24h_volume"] ?? null,
  },

  OrderlyPriceChange: {
    change_5m: (parent) => parent["5m"] ?? null,
    change_30m: (parent) => parent["30m"] ?? null,
    change_1h: (parent) => parent["1h"] ?? null,
    change_4h: (parent) => parent["4h"] ?? null,
    change_24h: (parent) => parent["24h"] ?? null,
    change_3d: (parent) => parent["3d"] ?? null,
    change_7d: (parent) => parent["7d"] ?? null,
    change_30d: (parent) => parent["30d"] ?? null,
  },

  Order: {
    orderTypeName: (parent) => {
      const names = { 0: "limit", 1: "stop_limit", 2: "take_profit", 3: "stop_loss" };
      return names[parent.orderType] || `unknown_${parent.orderType}`;
    },
  },

  Fee: {
    feeTypeName: (parent) => {
      const names = { 0: "taker", 1: "maker", 2: "liquidation", 3: "borrowing" };
      return names[parent.feeType] || `unknown_${parent.feeType}`;
    },
  },

  TradeSettlement: {
    tradeTypeName: (parent) => {
      const names = { 0: "open", 1: "close", 2: "partial_close", 3: "liquidation", 4: "adl" };
      return names[parent.tradeType] || `unknown_${parent.tradeType}`;
    },
  },

  VaultBalanceRecord: {
    vaultTypeName: (parent) => {
      const names = { 0: "central", 1: "spot", 2: "insurance" };
      return names[parent.vaultType] || `unknown_${parent.vaultType}`;
    },
  },

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

  // ============================================================
  //  SUBSCRIPTIONS
  // ============================================================

  Subscription: {
    indexerStatusUpdated: {
      subscribe: () => gqlPubSub.asyncIterator(["block_committed"]),
      resolve: async () => {
        const block = await pool.query(
          "SELECT value FROM indexer_state WHERE key = 'last_indexed_block'"
        );
        const lastBlock = Number(block.rows[0]?.value || 0);
        return { lastIndexedBlock: lastBlock, chainHead: null, isSynced: null, blocksScanned: 0, eventsProcessed: 0 };
      },
    },

    latestPricesUpdated: {
      subscribe: () => gqlPubSub.asyncIterator(["block_committed"]),
      resolve: async () => {
        const res = await pool.query("SELECT * FROM latest_prices ORDER BY market_id ASC");
        return toCamelArray(res.rows);
      },
    },

    priceUpdated: {
      subscribe: withFilter(
        () => gqlPubSub.asyncIterator(["block_committed"]),
        () => true
      ),
      resolve: async (_, args) => {
        const marketId = args?.marketId;
        if (marketId == null) return null;
        const res = await pool.query(
          "SELECT * FROM latest_prices WHERE market_id = $1",
          [marketId]
        );
        return res.rows[0] ? toCamel(res.rows[0]) : null;
      },
    },

    positionChanged: {
      subscribe: withFilter(
        () => gqlPubSub.asyncIterator(["block_committed"]),
        () => true
      ),
      resolve: async (_, args) => {
        const userAddress = args?.userAddress;
        if (!userAddress) return [];
        const res = await pool.query(
          "SELECT * FROM positions WHERE LOWER(user_address) = LOWER($1) ORDER BY position_id DESC",
          [userAddress]
        );
        return toCamelArray(res.rows);
      },
    },

    tradeCreated: {
      subscribe: withFilter(
        () => gqlPubSub.asyncIterator(["block_committed"]),
        () => true
      ),
      resolve: async (_, args) => {
        const marketId = args?.marketId;
        if (marketId == null) return null;
        const res = await pool.query(
          "SELECT * FROM trades WHERE market_id = $1 ORDER BY block_timestamp DESC, log_index DESC LIMIT 1",
          [marketId]
        );
        return res.rows[0] ? toCamel(res.rows[0]) : null;
      },
    },

    liquidationCreated: {
      subscribe: withFilter(
        () => gqlPubSub.asyncIterator(["block_committed"]),
        () => true
      ),
      resolve: async (_, args) => {
        const marketId = args?.marketId;
        if (marketId == null) return null;
        const res = await pool.query(
          "SELECT * FROM liquidations WHERE market_id = $1 ORDER BY block_timestamp DESC LIMIT 1",
          [marketId]
        );
        return res.rows[0] ? toCamel(res.rows[0]) : null;
      },
    },

    orderChanged: {
      subscribe: withFilter(
        () => gqlPubSub.asyncIterator(["block_committed"]),
        () => true
      ),
      resolve: async (_, args) => {
        const userAddress = args?.userAddress;
        if (!userAddress) return null;
        const res = await pool.query(
          "SELECT * FROM orders WHERE LOWER(user_address) = LOWER($1) ORDER BY order_id DESC LIMIT 1",
          [userAddress]
        );
        return res.rows[0] ? toCamel(res.rows[0]) : null;
      },
    },
  },
};

module.exports = { resolvers };
