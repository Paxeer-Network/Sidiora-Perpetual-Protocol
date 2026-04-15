/**
 * Orderly Network Data Proxy — fetches and caches market data from Orderly's
 * REST API for serving through the indexer's REST endpoints.
 *
 * Public endpoints: no auth. Private endpoints (kline, orderbook): ed25519 signed.
 * All "Orderly" branding is rewritten to "Sidiora" before serving.
 *
 * Base URL: https://api-evm.orderly.org
 */

const crypto = require("crypto");

const ORDERLY_BASE = process.env.ORDERLY_BASE_URL || "https://api-evm.orderly.org";
const ORDERLY_WS_URL = process.env.ORDERLY_WS_URL || "wss://ws-evm.orderly.org/ws/stream/OqdphuyCtYWxwzhxyLLjOWNdFP7sQt8RPWzmb5xY";

// Orderly API credentials
const ORDERLY_ACCOUNT_ID = process.env.ORDERLY_ACCOUNT_ID || "0xc5108bc5992aa1cf2f16855ef694c0f753f345f74607a5d01a7b833ba205bc43";
const ORDERLY_KEY = process.env.ORDERLY_KEY || "ed25519:3SGhnNYkfi7tLtSbSHKPUnxC1by2fVpsrz7fkTgVFnrw";
const ORDERLY_SECRET = process.env.ORDERLY_SECRET || "ed25519:9MyyX3YxiNA3u3zYmsj7oTUVzR4deJANrkYFWjUNr119";

const EXCHANGE_NAME = "Sidiora";

// Symbol mapping: our market symbols → Orderly PERP symbols
const SYMBOL_MAP = {
  BTC: "PERP_BTC_USDC",
  ETH: "PERP_ETH_USDC",
  SOL: "PERP_SOL_USDC",
  AVAX: "PERP_AVAX_USDC",
  LINK: "PERP_LINK_USDC",
  TSLA: "PERP_TSLA_USDC",
  NVDA: "PERP_NVDA_USDC",
  NAS100: "PERP_NAS100_USDC",
  XAU: "PERP_XAU_USDC",
  SPX500: "PERP_SPX500_USDC",
  GOOGL: "PERP_GOOGL_USDC",
  SID: "CUSTOM_SID_USD",
  PAX: "CUSTOM_PAX_USD",
  HYPE: "PERP_HYPE_USDC",
  XRP: "PERP_XRP_USDC",
  ASTER: "PERP_ASTER_USDC",
  TRUMP: "PERP_TRUMP_USDC",
  BNB: "PERP_BNB_USDC",
};

// Custom price feed URLs (not on Orderly)
const CUSTOM_PRICE_FEEDS = {
  SID: "https://feisty-caring-production-6368.up.railway.app/price",
  PAX: "https://radiant-harmony-production.up.railway.app/price",
};

// Reverse map: PERP_BTC_USDC → BTC
const REVERSE_SYMBOL_MAP = Object.fromEntries(
  Object.entries(SYMBOL_MAP).map(([k, v]) => [v, k])
);

// ============================================================
//  In-memory cache with TTL
// ============================================================

class Cache {
  constructor() {
    this._store = new Map();
  }

  get(key, maxAgeMs) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > maxAgeMs) return null;
    return entry.data;
  }

  set(key, data) {
    this._store.set(key, { data, ts: Date.now() });
  }
}

const cache = new Cache();

// ============================================================
//  Fetch helpers
// ============================================================

async function fetchOrderly(path, timeoutMs = 8000) {
  const url = `${ORDERLY_BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Orderly ${path}: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(`Orderly ${path}: success=false — ${JSON.stringify(json).slice(0, 300)}`);
  }

  return json.data;
}

/**
 * Authenticated GET — signs the request with ed25519 for private endpoints.
 * Orderly signature = base64(ed25519_sign(timestamp + "GET" + path))
 */
async function fetchOrderlyAuth(path, timeoutMs = 8000) {
  const url = `${ORDERLY_BASE}${path}`;
  const timestamp = Date.now().toString();
  const message = `${timestamp}GET${path}`;

  // Decode the base58 secret key (strip "ed25519:" prefix)
  const secretBase58 = ORDERLY_SECRET.replace("ed25519:", "");
  const secretBytes = base58Decode(secretBase58);

  // ed25519 sign using Node.js crypto
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"), // PKCS8 ed25519 prefix
      secretBytes.slice(0, 32),
    ]),
    format: "der",
    type: "pkcs8",
  });

  const signature = crypto.sign(null, Buffer.from(message), privateKey);
  const signatureBase64 = signature.toString("base64");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "orderly-timestamp": timestamp,
      "orderly-account-id": ORDERLY_ACCOUNT_ID,
      "orderly-key": ORDERLY_KEY,
      "orderly-signature": signatureBase64,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Orderly auth ${path}: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(`Orderly auth ${path}: success=false — ${JSON.stringify(json).slice(0, 300)}`);
  }

  return json.data;
}

/**
 * Fetch a raw response (no success/data unwrapping) — for TradingView endpoints
 * that return non-standard shapes.
 */
async function fetchOrderlyRaw(path, timeoutMs = 8000) {
  const url = `${ORDERLY_BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Orderly ${path}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ============================================================
//  Base58 decoder (for Orderly ed25519 keys)
// ============================================================

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(str) {
  const bytes = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 char: ${char}`);
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

// ============================================================
//  Branding — replace "Orderly" with "Sidiora" in any data
// ============================================================

function rebrand(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") {
    return data.replace(/\bOrderly\b/gi, EXCHANGE_NAME);
  }
  if (Array.isArray(data)) {
    return data.map(rebrand);
  }
  if (typeof data === "object") {
    const out = {};
    for (const [key, val] of Object.entries(data)) {
      out[key] = rebrand(val);
    }
    return out;
  }
  return data;
}

// ============================================================
//  Public API methods (called by REST route handlers)
// ============================================================

/**
 * GET /v1/public/futures — all tickers with 24h stats, OI, funding, mark/index price.
 * Cache: 3 seconds.
 */
async function getTickers() {
  const TTL = 3000;
  const cached = cache.get("tickers", TTL);
  if (cached) return cached;

  const data = await fetchOrderly("/v1/public/futures");
  const rows = (data.rows || []).filter((r) => REVERSE_SYMBOL_MAP[r.symbol]);

  // Enrich with our internal symbol
  const enriched = rows.map((r) => ({
    ...r,
    paxeerSymbol: REVERSE_SYMBOL_MAP[r.symbol] || r.symbol,
  }));

  cache.set("tickers", enriched);
  return enriched;
}

/**
 * GET /v1/public/futures/{symbol} — single ticker.
 */
async function getTicker(orderlySymbol) {
  const data = await fetchOrderly(`/v1/public/futures/${orderlySymbol}`);
  if (data) {
    data.paxeerSymbol = REVERSE_SYMBOL_MAP[orderlySymbol] || orderlySymbol;
  }
  return data;
}

/**
 * GET /v1/kline — OHLCV candle data (authenticated).
 * Cache: 5 seconds per key.
 */
async function getKlines(orderlySymbol, type = "1h", limit = 100) {
  const cacheKey = `klines:${orderlySymbol}:${type}:${limit}`;
  const TTL = 5000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  const data = await fetchOrderlyAuth(
    `/v1/kline?symbol=${orderlySymbol}&type=${type}&limit=${limit}`
  );

  const rows = data.rows || [];
  cache.set(cacheKey, rows);
  return rows;
}

/**
 * GET /v1/public/market_trades — recent market trades.
 * Cache: 2 seconds.
 */
async function getMarketTrades(orderlySymbol, limit = 50) {
  const cacheKey = `trades:${orderlySymbol}:${limit}`;
  const TTL = 2000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  const data = await fetchOrderly(
    `/v1/public/market_trades?symbol=${orderlySymbol}&limit=${limit}`
  );

  const rows = data.rows || [];
  cache.set(cacheKey, rows);
  return rows;
}

/**
 * GET /v1/orderbook/{symbol} — L2 orderbook snapshot.
 * Cache: 1 second.
 */
async function getOrderbook(orderlySymbol, maxLevel = 20) {
  const cacheKey = `orderbook:${orderlySymbol}:${maxLevel}`;
  const TTL = 1000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  const data = await fetchOrderly(
    `/v1/orderbook/${orderlySymbol}?max_level=${maxLevel}`
  );

  cache.set(cacheKey, data);
  return data;
}

/**
 * GET /v1/public/funding_rates — predicted funding rates for all markets.
 * Cache: 10 seconds.
 */
async function getFundingRates() {
  const TTL = 10000;
  const cached = cache.get("funding_rates", TTL);
  if (cached) return cached;

  const data = await fetchOrderly("/v1/public/funding_rates");
  const rows = (data.rows || []).filter((r) => REVERSE_SYMBOL_MAP[r.symbol]);

  const enriched = rows.map((r) => ({
    ...r,
    paxeerSymbol: REVERSE_SYMBOL_MAP[r.symbol] || r.symbol,
  }));

  cache.set("funding_rates", enriched);
  return enriched;
}

/**
 * GET /v1/public/funding_rate/{symbol} — single market funding rate.
 */
async function getFundingRate(orderlySymbol) {
  const data = await fetchOrderly(`/v1/public/funding_rate/${orderlySymbol}`);
  if (data) {
    data.paxeerSymbol = REVERSE_SYMBOL_MAP[orderlySymbol] || orderlySymbol;
  }
  return data;
}

/**
 * GET /v1/public/funding_rate_history — historical funding rates.
 * Cache: 30 seconds.
 */
async function getFundingHistory(orderlySymbol, page = 1, size = 60) {
  const cacheKey = `funding_history:${orderlySymbol}:${page}:${size}`;
  const TTL = 30000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  const data = await fetchOrderly(
    `/v1/public/funding_rate_history?symbol=${orderlySymbol}&page=${page}&size=${size}`
  );

  cache.set(cacheKey, data);
  return data;
}

/**
 * GET /v1/public/market_info/price_changes — 5m/30m/1h/24h/7d/30d changes.
 * Cache: 10 seconds.
 */
async function getPriceChanges() {
  const TTL = 10000;
  const cached = cache.get("price_changes", TTL);
  if (cached) return cached;

  const data = await fetchOrderly("/v1/public/market_info/price_changes");
  const rows = (data.rows || []).filter((r) => REVERSE_SYMBOL_MAP[r.symbol]);

  const enriched = rows.map((r) => ({
    ...r,
    paxeerSymbol: REVERSE_SYMBOL_MAP[r.symbol] || r.symbol,
  }));

  cache.set("price_changes", enriched);
  return enriched;
}

/**
 * GET /v1/public/market_info/traders_open_interests — long/short OI.
 * Cache: 10 seconds.
 */
async function getOpenInterests() {
  const TTL = 10000;
  const cached = cache.get("open_interests", TTL);
  if (cached) return cached;

  const data = await fetchOrderly("/v1/public/market_info/traders_open_interests");
  const rows = (data.rows || []).filter((r) => REVERSE_SYMBOL_MAP[r.symbol]);

  const enriched = rows.map((r) => ({
    ...r,
    paxeerSymbol: REVERSE_SYMBOL_MAP[r.symbol] || r.symbol,
  }));

  cache.set("open_interests", enriched);
  return enriched;
}

/**
 * GET /v1/public/volume/stats — platform volume stats.
 * Cache: 60 seconds.
 */
async function getVolumeStats() {
  const TTL = 60000;
  const cached = cache.get("volume_stats", TTL);
  if (cached) return cached;

  const data = await fetchOrderly("/v1/public/volume/stats");
  cache.set("volume_stats", data);
  return data;
}

/**
 * Fetch SID and PAX prices from custom endpoints.
 * Cache: 3 seconds.
 * Returns same shape as tickers for consistency.
 */
async function getCustomPrices() {
  const TTL = 3000;
  const cached = cache.get("custom_prices", TTL);
  if (cached) return cached;

  const results = [];

  for (const [symbol, url] of Object.entries(CUSTOM_PRICE_FEEDS)) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const price = Number(json.price);
      if (!price || price <= 0) continue;

      results.push({
        symbol: `CUSTOM_${symbol}_USD`,
        paxeerSymbol: symbol,
        mark_price: price,
        index_price: price,
        "24h_open": json.open ?? null,
        "24h_high": json.high ?? null,
        "24h_low": json.low ?? null,
        "24h_close": price,
        "24h_volume": null,
        "24h_amount": null,
        open_interest: null,
        est_funding_rate: null,
        last_funding_rate: null,
        next_funding_time: null,
        sum_unitary_funding: null,
        timestamp: json.timestamp || new Date().toISOString(),
      });
    } catch {}
  }

  cache.set("custom_prices", results);
  return results;
}

/**
 * Resolve a symbol parameter to an Orderly symbol.
 * Accepts: "BTC", "PERP_BTC_USDC", or "PERP_BTC_USDC" directly.
 */
function resolveSymbol(input) {
  if (!input) return null;
  const upper = input.toUpperCase();
  if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper];
  if (REVERSE_SYMBOL_MAP[upper]) return upper;
  if (upper.startsWith("PERP_")) return upper;
  return SYMBOL_MAP[upper] || null;
}

// ============================================================
//  TradingView endpoints (rebranded Orderly → Sidiora)
// ============================================================

/**
 * GET /v1/tv/symbol_info — TradingView symbol info.
 * Rewrites exchange-listed and exchange-traded from "Orderly" to "Sidiora".
 * Cache: 5 minutes.
 */
async function getTvSymbolInfo(group = "perpetual") {
  const cacheKey = `tv_symbol_info:${group}`;
  const TTL = 300000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  const data = await fetchOrderlyRaw(`/v1/tv/symbol_info?group=${group}`);
  const rebranded = rebrand(data);
  cache.set(cacheKey, rebranded);
  return rebranded;
}

/**
 * GET /v1/tv/config — TradingView config.
 * Cache: 5 minutes.
 */
async function getTvConfig(locale = "en") {
  const cacheKey = `tv_config:${locale}`;
  const TTL = 300000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  const data = await fetchOrderlyRaw(`/v1/tv/config?locale=${locale}`);
  const rebranded = rebrand(data);
  cache.set(cacheKey, rebranded);
  return rebranded;
}

/**
 * GET /v1/tv/history — TradingView OHLCV bars (public, no auth).
 * Cache: 5 seconds.
 */
async function getTvHistory(symbol, resolution, from, to) {
  const cacheKey = `tv_history:${symbol}:${resolution}:${from}:${to}`;
  const TTL = 5000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  let path = `/v1/tv/history?symbol=${symbol}&resolution=${resolution}`;
  if (from) path += `&from=${from}`;
  if (to) path += `&to=${to}`;

  const data = await fetchOrderlyRaw(path);
  const rebranded = rebrand(data);
  cache.set(cacheKey, rebranded);
  return rebranded;
}

/**
 * GET /v1/tv/kline_history — public kline history (no auth).
 * Cache: 5 seconds.
 */
async function getTvKlineHistory(symbol, resolution, from, to, limit) {
  const cacheKey = `tv_kline_history:${symbol}:${resolution}:${from}:${to}:${limit}`;
  const TTL = 5000;
  const cached = cache.get(cacheKey, TTL);
  if (cached) return cached;

  let path = `/v1/tv/kline_history?symbol=${symbol}&resolution=${resolution}`;
  if (from) path += `&from=${from}`;
  if (to) path += `&to=${to}`;
  if (limit) path += `&limit=${limit}`;

  const data = await fetchOrderlyRaw(path);
  const rebranded = rebrand(data);
  cache.set(cacheKey, rebranded);
  return rebranded;
}

module.exports = {
  SYMBOL_MAP,
  REVERSE_SYMBOL_MAP,
  ORDERLY_BASE,
  ORDERLY_WS_URL,
  EXCHANGE_NAME,
  resolveSymbol,
  rebrand,
  getTickers,
  getTicker,
  getKlines,
  getMarketTrades,
  getOrderbook,
  getFundingRates,
  getFundingRate,
  getFundingHistory,
  getPriceChanges,
  getOpenInterests,
  getVolumeStats,
  getCustomPrices,
  CUSTOM_PRICE_FEEDS,
  getTvSymbolInfo,
  getTvConfig,
  getTvHistory,
  getTvKlineHistory,
};
