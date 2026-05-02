const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/use/ws");
const { createServer } = require("http");
const express = require("express");
const cors = require("cors");
const { typeDefs } = require("./schema");
const { resolvers } = require("./resolvers");
const { startSubscriptionBridge, stopSubscriptionBridge } = require("./subscriptions");
const orderly = require("../orderly-proxy");
const { pool } = require("../db/pool");

/**
 * Create and start the GraphQL server + Orderly REST proxy + WS relay.
 *
 * scanner is optional — when omitted (ROLE=graphql), context falls back
 * to a DB read for chain head. Pass it when running in combined mode.
 *
 * @param {number} port
 * @param {object|null} scanner - Scanner instance (optional)
 * @param {object} logger
 * @returns {Promise<{app, server, httpServer}>}
 */
async function startGraphQLServer(port, scanner, logger) {
  const app = express();

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const apolloServer = new ApolloServer({
    schema,
    introspection: true,
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async () => {
        let chainHead = null;
        try {
          if (scanner) {
            chainHead = await scanner.getChainHead();
          } else {
            const res = await pool.query(
              "SELECT value FROM indexer_state WHERE key = 'last_indexed_block'"
            );
            chainHead = res.rows[0] ? Number(res.rows[0].value) : null;
          }
        } catch {}
        return { scanner, chainHead };
      },
    })
  );

  // ── Start PG LISTEN → in-process PubSub bridge ────────────────────
  const { CONFIG } = require("../config");
  await startSubscriptionBridge(CONFIG.databaseUrl, logger);

  // ============================================================
  //  Orderly REST Proxy Endpoints
  // ============================================================

  app.use("/api", cors());

  // GET /api/tickers — all market tickers with 24h stats (Orderly + custom SID/PAX)
  app.get("/api/tickers", async (req, res) => {
    try {
      const [orderlyData, customData] = await Promise.all([
        orderly.getTickers().catch(() => []),
        orderly.getCustomPrices().catch(() => []),
      ]);
      res.json({ success: true, data: [...orderlyData, ...customData] });
    } catch (err) {
      logger.error(`[API] /api/tickers error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/ticker/:symbol — single market ticker (Orderly or custom)
  app.get("/api/ticker/:symbol", async (req, res) => {
    try {
      const sym = orderly.resolveSymbol(req.params.symbol);
      if (!sym) return res.status(400).json({ success: false, error: "Unknown symbol" });

      // Custom-source tokens (SID, PAX)
      if (sym.startsWith("CUSTOM_")) {
        const customs = await orderly.getCustomPrices();
        const match = customs.find((c) => c.symbol === sym);
        if (!match) return res.status(404).json({ success: false, error: "Price unavailable" });
        return res.json({ success: true, data: match });
      }

      const data = await orderly.getTicker(sym);
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/ticker error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/klines?symbol=BTC&type=1h&limit=100 — OHLCV candles
  app.get("/api/klines", async (req, res) => {
    try {
      const sym = orderly.resolveSymbol(req.query.symbol);
      if (!sym) return res.status(400).json({ success: false, error: "symbol required" });
      const type = req.query.type || "1h";
      const limit = Math.min(Number(req.query.limit) || 100, 1000);
      const data = await orderly.getKlines(sym, type, limit);
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/klines error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/trades/:symbol?limit=50 — recent market trades
  app.get("/api/trades/:symbol", async (req, res) => {
    try {
      const sym = orderly.resolveSymbol(req.params.symbol);
      if (!sym) return res.status(400).json({ success: false, error: "Unknown symbol" });
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const data = await orderly.getMarketTrades(sym, limit);
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/trades error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/orderbook/:symbol?depth=20 — L2 orderbook snapshot
  app.get("/api/orderbook/:symbol", async (req, res) => {
    try {
      const sym = orderly.resolveSymbol(req.params.symbol);
      if (!sym) return res.status(400).json({ success: false, error: "Unknown symbol" });
      const depth = Math.min(Number(req.query.depth) || 20, 100);
      const data = await orderly.getOrderbook(sym, depth);
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/orderbook error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/funding-rates — predicted funding for all markets
  app.get("/api/funding-rates", async (req, res) => {
    try {
      const data = await orderly.getFundingRates();
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/funding-rates error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/funding-rate/:symbol — single market funding
  app.get("/api/funding-rate/:symbol", async (req, res) => {
    try {
      const sym = orderly.resolveSymbol(req.params.symbol);
      if (!sym) return res.status(400).json({ success: false, error: "Unknown symbol" });
      const data = await orderly.getFundingRate(sym);
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/funding-rate error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/funding-history?symbol=BTC&page=1&size=60 — historical funding
  app.get("/api/funding-history", async (req, res) => {
    try {
      const sym = orderly.resolveSymbol(req.query.symbol);
      if (!sym) return res.status(400).json({ success: false, error: "symbol required" });
      const page = Number(req.query.page) || 1;
      const size = Math.min(Number(req.query.size) || 60, 100);
      const data = await orderly.getFundingHistory(sym, page, size);
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/funding-history error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/price-changes — 5m/30m/1h/24h/7d/30d price changes
  app.get("/api/price-changes", async (req, res) => {
    try {
      const data = await orderly.getPriceChanges();
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/price-changes error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/open-interest — long/short OI per symbol
  app.get("/api/open-interest", async (req, res) => {
    try {
      const data = await orderly.getOpenInterests();
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/open-interest error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // GET /api/volume-stats — platform volume stats
  app.get("/api/volume-stats", async (req, res) => {
    try {
      const data = await orderly.getVolumeStats();
      res.json({ success: true, data });
    } catch (err) {
      logger.error(`[API] /api/volume-stats error: ${err.message}`);
      res.status(502).json({ success: false, error: err.message });
    }
  });

  // ============================================================
  //  TradingView Endpoints (rebranded Orderly → Sidiora)
  // ============================================================

  // GET /api/tv/config — TradingView config
  app.get("/api/tv/config", async (req, res) => {
    try {
      const data = await orderly.getTvConfig(req.query.locale || "en");
      res.json(data);
    } catch (err) {
      logger.error(`[API] /api/tv/config error: ${err.message}`);
      res.status(502).json({ s: "error", errmsg: err.message });
    }
  });

  // GET /api/tv/symbol_info — TradingView symbol info (exchange = Sidiora)
  app.get("/api/tv/symbol_info", async (req, res) => {
    try {
      const data = await orderly.getTvSymbolInfo(req.query.group || "perpetual");
      res.json(data);
    } catch (err) {
      logger.error(`[API] /api/tv/symbol_info error: ${err.message}`);
      res.status(502).json({ s: "error", errmsg: err.message });
    }
  });

  // GET /api/tv/history — TradingView OHLCV bars
  app.get("/api/tv/history", async (req, res) => {
    try {
      const { symbol, resolution, from, to } = req.query;
      if (!symbol || !resolution) {
        return res.status(400).json({ s: "error", errmsg: "symbol and resolution required" });
      }
      const data = await orderly.getTvHistory(symbol, resolution, from, to);
      res.json(data);
    } catch (err) {
      logger.error(`[API] /api/tv/history error: ${err.message}`);
      res.status(502).json({ s: "error", errmsg: err.message });
    }
  });

  // GET /api/tv/kline_history — public kline history
  app.get("/api/tv/kline_history", async (req, res) => {
    try {
      const { symbol, resolution, from, to, limit } = req.query;
      if (!symbol || !resolution) {
        return res.status(400).json({ s: "error", errmsg: "symbol and resolution required" });
      }
      const data = await orderly.getTvKlineHistory(symbol, resolution, from, to, limit);
      res.json(data);
    } catch (err) {
      logger.error(`[API] /api/tv/kline_history error: ${err.message}`);
      res.status(502).json({ s: "error", errmsg: err.message });
    }
  });

  // ============================================================
  //  Health check
  // ============================================================

  app.get("/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      const stats = scanner?.getStats() || {};
      res.json({
        status: "ok",
        blocksScanned: stats.blocksScanned || 0,
        eventsProcessed: stats.eventsProcessed || 0,
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  // ============================================================
  //  Start HTTP server + WebSocket servers
  // ============================================================

  return new Promise((resolve) => {
    const httpServer = createServer(app);

    // ── graphql-ws subscription server on /graphql-ws ───────────
    const subscriptionWss = new WebSocketServer({ server: httpServer, path: "/graphql-ws" });
    const wsServerCleanup = useServer({ schema }, subscriptionWss);

    httpServer.listen(port, () => {
      logger.info(`  GraphQL API:  http://localhost:${port}/graphql`);
      logger.info(`  GraphQL WS:   ws://localhost:${port}/graphql-ws`);
      logger.info(`  REST API:     http://localhost:${port}/api/*`);
      logger.info(`  Health check: http://localhost:${port}/health`);

      // Start WebSocket orderbook relay on /ws
      startOrderbookRelay(httpServer, logger);

      resolve({ app, server: apolloServer, httpServer, wsServerCleanup });
    });
  });
}

// ============================================================
//  WebSocket Orderbook Relay
// ============================================================

function startOrderbookRelay(httpServer, logger) {
  let WebSocket;
  try {
    WebSocket = require("ws");
  } catch {
    logger.warn("  ws package not installed — WebSocket relay disabled. Run: npm install ws");
    return;
  }

  const wss = new WebSocket.Server({ server: httpServer, path: "/ws" });

  // Track subscriptions: ws client → Set of orderly symbols
  const clientSubs = new Map();

  // Track upstream connections: orderly symbol → { ws, clients: Set }
  const upstreams = new Map();

  wss.on("connection", (ws) => {
    clientSubs.set(ws, new Set());

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      // Subscribe: { action: "subscribe", symbol: "BTC", channel: "orderbook" }
      if (msg.action === "subscribe" && msg.symbol) {
        const orderlySymbol = orderly.resolveSymbol(msg.symbol);
        if (!orderlySymbol) {
          ws.send(JSON.stringify({ error: `Unknown symbol: ${msg.symbol}` }));
          return;
        }

        const channel = msg.channel || "orderbook";
        const topic = `${orderlySymbol}@${channel}`;

        clientSubs.get(ws).add(topic);
        ensureUpstream(topic, orderlySymbol, channel, logger, WebSocket, upstreams);
        upstreams.get(topic).clients.add(ws);

        ws.send(JSON.stringify({ event: "subscribed", topic, symbol: msg.symbol }));
      }

      // Unsubscribe
      if (msg.action === "unsubscribe" && msg.symbol) {
        const orderlySymbol = orderly.resolveSymbol(msg.symbol);
        if (!orderlySymbol) return;
        const channel = msg.channel || "orderbook";
        const topic = `${orderlySymbol}@${channel}`;

        clientSubs.get(ws).delete(topic);
        const up = upstreams.get(topic);
        if (up) up.clients.delete(ws);

        ws.send(JSON.stringify({ event: "unsubscribed", topic }));
      }

      // Ping
      if (msg.event === "ping" || msg.action === "ping") {
        ws.send(JSON.stringify({ event: "pong", ts: Date.now() }));
      }
    });

    ws.on("close", () => {
      const subs = clientSubs.get(ws) || new Set();
      for (const topic of subs) {
        const up = upstreams.get(topic);
        if (up) up.clients.delete(ws);
      }
      clientSubs.delete(ws);
    });
  });

  logger.info(`  WebSocket:    ws://localhost:${httpServer.address().port}/ws`);
}

function ensureUpstream(topic, orderlySymbol, channel, logger, WebSocket, upstreams) {
  if (upstreams.has(topic)) return;

  const entry = { ws: null, clients: new Set(), reconnectTimer: null };
  upstreams.set(topic, entry);

  function connect() {
    const wsUrl = orderly.ORDERLY_WS_URL;
    const upstream = new WebSocket(wsUrl);

    upstream.on("open", () => {
      logger.info(`  [WS Relay] Connected upstream for ${topic}`);

      // Subscribe to the channel on Orderly's WS
      const subMsg = {
        id: `sub-${topic}`,
        event: "subscribe",
        topic: `${orderlySymbol}@${channel}`,
      };
      upstream.send(JSON.stringify(subMsg));
    });

    upstream.on("message", (data) => {
      const raw = data.toString();

      // Handle Orderly ping
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return; }
      if (parsed.event === "ping") {
        upstream.send(JSON.stringify({ event: "pong" }));
        return;
      }

      // Relay to all subscribed clients
      const clients = upstreams.get(topic)?.clients;
      if (!clients) return;

      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(raw);
        }
      }
    });

    upstream.on("close", () => {
      logger.warn(`  [WS Relay] Upstream closed for ${topic} — reconnecting in 3s`);
      entry.ws = null;
      entry.reconnectTimer = setTimeout(connect, 3000);
    });

    upstream.on("error", (err) => {
      logger.error(`  [WS Relay] Upstream error for ${topic}: ${err.message}`);
    });

    entry.ws = upstream;
  }

  connect();
}

module.exports = { startGraphQLServer };
