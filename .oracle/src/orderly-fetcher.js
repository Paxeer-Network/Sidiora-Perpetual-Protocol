/**
 * Fetches latest prices from Orderly Network's public REST API.
 *
 * Uses GET /v1/public/futures to retrieve mark_price for configured symbols.
 * No authentication required — public endpoint.
 *
 * Orderly symbol format: PERP_<BASE>_USDC  (e.g., PERP_TSLA_USDC)
 */
class OrderlyFetcher {
  constructor(baseUrl, markets, logger) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.markets = markets; // only markets with source === "orderly"
    this.logger = logger;
    this.lastPrices = new Map(); // symbol → last price (18 dec bigint)
  }

  /**
   * Fetch latest prices for all configured Orderly markets
   * @returns {Array<{marketId: number, symbol: string, price: bigint, rawPrice: number}>}
   */
  async fetchPrices() {
    const url = `${this.baseUrl}/v1/public/futures`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Orderly API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    if (!json.success || !json.data || !json.data.rows) {
      throw new Error(`Orderly API: unexpected response shape: ${JSON.stringify(json).slice(0, 200)}`);
    }

    // Build a lookup: PERP_TSLA_USDC → { mark_price, index_price, ... }
    const feedMap = new Map();
    for (const row of json.data.rows) {
      feedMap.set(row.symbol, row);
    }

    const results = [];

    for (const market of this.markets) {
      const feed = feedMap.get(market.orderlySymbol);

      if (!feed) {
        this.logger.warn(
          `Orderly: no data for ${market.symbol} (${market.orderlySymbol})`
        );
        continue;
      }

      // Prefer mark_price, fall back to index_price, then last_price
      const rawPrice =
        feed.mark_price ?? feed.index_price ?? feed.last_price ?? null;

      if (rawPrice == null || rawPrice <= 0) {
        this.logger.warn(
          `Orderly: invalid price for ${market.symbol}: ${rawPrice}`
        );
        continue;
      }

      // Convert to 18-decimal bigint
      const price18 = this._toPrice18(rawPrice);

      if (price18 <= 0n) {
        this.logger.warn(
          `Orderly: zero price18 for ${market.symbol} (raw=${rawPrice})`
        );
        continue;
      }

      results.push({
        marketId: market.marketId,
        symbol: market.symbol,
        price: price18,
        rawPrice,
        timestamp: Math.floor(Date.now() / 1000),
      });

      this.lastPrices.set(market.symbol, price18);
    }

    return results;
  }

  /**
   * Check if any price has deviated beyond threshold from last submission
   * @param {Map<string, bigint>} submittedPrices
   * @param {number} thresholdPct
   * @returns {boolean}
   */
  hasSignificantDeviation(submittedPrices, thresholdPct) {
    for (const [symbol, currentPrice] of this.lastPrices) {
      const lastSubmitted = submittedPrices.get(symbol);
      if (!lastSubmitted || lastSubmitted === 0n) continue;

      const diff =
        currentPrice > lastSubmitted
          ? currentPrice - lastSubmitted
          : lastSubmitted - currentPrice;

      const deviationBps = (diff * 10000n) / lastSubmitted;
      const thresholdBps = BigInt(Math.round(thresholdPct * 100));

      if (deviationBps >= thresholdBps) {
        this.logger.info(
          `Orderly deviation for ${symbol}: ${Number(deviationBps) / 100}%`
        );
        return true;
      }
    }
    return false;
  }

  /**
   * Convert a floating-point USD price to 18-decimal bigint
   * @param {number} price - e.g., 426.21
   * @returns {bigint} - e.g., 426210000000000000000n
   */
  _toPrice18(price) {
    // Use string manipulation to avoid floating-point precision loss
    const str = price.toString();
    const [intPart, fracPart = ""] = str.split(".");
    const paddedFrac = fracPart.padEnd(18, "0").slice(0, 18);
    return BigInt(intPart) * 10n ** 18n + BigInt(paddedFrac);
  }
}

module.exports = { OrderlyFetcher };
