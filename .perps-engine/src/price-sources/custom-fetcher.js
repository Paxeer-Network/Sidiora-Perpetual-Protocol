/**
 * Fetches prices from custom REST endpoints for tokens not listed on Orderly.
 *
 * Each market has a `priceUrl` that returns:
 *   { symbol, price, timestamp, open, high, low }
 *
 * Used for: SID, PAX (Paxeer-native tokens)
 */
class CustomFetcher {
  constructor(markets, logger) {
    this.markets = markets; // only markets with source === "custom"
    this.logger = logger;
    this.lastPrices = new Map();
  }

  /**
   * Fetch prices from all custom endpoints in parallel
   * @returns {Array<{marketId: number, symbol: string, price: bigint, rawPrice: number, timestamp: number}>}
   */
  async fetchPrices() {
    const results = [];

    const fetches = this.markets.map(async (market) => {
      try {
        const res = await fetch(market.priceUrl, {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
          this.logger.warn(`Custom: ${market.symbol} HTTP ${res.status}`);
          return null;
        }

        const json = await res.json();
        const rawPrice = Number(json.price);

        if (!rawPrice || rawPrice <= 0 || !isFinite(rawPrice)) {
          this.logger.warn(`Custom: ${market.symbol} invalid price: ${json.price}`);
          return null;
        }

        const price18 = this._toPrice18(rawPrice);

        if (price18 <= 0n) {
          this.logger.warn(`Custom: ${market.symbol} zero price18 (raw=${rawPrice})`);
          return null;
        }

        this.lastPrices.set(market.symbol, price18);

        return {
          marketId: market.marketId,
          symbol: market.symbol,
          price: price18,
          rawPrice,
          timestamp: Math.floor(Date.now() / 1000),
        };
      } catch (err) {
        this.logger.warn(`Custom: ${market.symbol} fetch error: ${err.message}`);
        return null;
      }
    });

    const fetched = await Promise.all(fetches);
    for (const item of fetched) {
      if (item) results.push(item);
    }

    return results;
  }

  /**
   * Convert a floating-point USD price to 18-decimal bigint
   * @param {number} price
   * @returns {bigint}
   */
  _toPrice18(price) {
    const str = price.toString();
    const [intPart, fracPart = ""] = str.split(".");
    const paddedFrac = fracPart.padEnd(18, "0").slice(0, 18);
    return BigInt(intPart) * 10n ** 18n + BigInt(paddedFrac);
  }
}

module.exports = { CustomFetcher };
