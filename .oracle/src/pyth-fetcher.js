const { HermesClient } = require("@pythnetwork/hermes-client");

/**
 * Fetches latest prices from Pyth Network's Hermes service.
 *
 * Pyth returns prices with a variable exponent (e.g., price=5000000, expo=-2 → $50,000.00).
 * We normalize all prices to 18 decimals for on-chain submission.
 */
class PythFetcher {
  constructor(hermesUrl, markets, logger) {
    this.hermesUrl = hermesUrl;
    this.markets = markets;
    this.logger = logger;
    this.client = new HermesClient(hermesUrl);
    this.lastPrices = new Map(); // symbol → last price (18 dec bigint)
  }

  /**
   * Fetch latest prices for all configured markets
   * @returns {Array<{marketId: number, symbol: string, price: bigint, confidence: bigint, timestamp: number}>}
   */
  async fetchPrices() {
    const pythIds = this.markets.map((m) => m.pythId);

    const response = await this.client.getLatestPriceUpdates(pythIds);

    if (!response || !response.parsed || response.parsed.length === 0) {
      throw new Error("Empty response from Pyth Hermes");
    }

    const results = [];

    for (let i = 0; i < this.markets.length; i++) {
      const market = this.markets[i];
      const feedId = market.pythId.replace("0x", "");

      // Find matching price feed in response
      const feed = response.parsed.find(
        (f) => f.id.toLowerCase() === feedId.toLowerCase()
      );

      if (!feed || !feed.price) {
        this.logger.warn(`No price data for ${market.symbol} (${market.pythId})`);
        continue;
      }

      const priceData = feed.price;
      const price = BigInt(priceData.price);
      const expo = Number(priceData.expo);
      const confidence = BigInt(priceData.conf);
      const publishTime = Number(priceData.publish_time);

      // Normalize to 18 decimals
      // Pyth gives price * 10^expo, we need price * 10^18
      // So multiply by 10^(18 + expo) if expo is negative (which it usually is)
      const price18 = this._normalize(price, expo);
      const confidence18 = this._normalize(confidence, expo);

      // Sanity check: price must be positive
      if (price18 <= 0n) {
        this.logger.warn(`Invalid price for ${market.symbol}: ${price18}`);
        continue;
      }

      results.push({
        marketId: market.marketId,
        symbol: market.symbol,
        price: price18,
        confidence: confidence18,
        timestamp: publishTime,
        rawPrice: Number(price) * Math.pow(10, expo),
      });

      this.lastPrices.set(market.symbol, price18);
    }

    return results;
  }

  /**
   * Check if any price has deviated beyond threshold from last submission
   * @param {Map<string, bigint>} submittedPrices - Last successfully submitted prices
   * @param {number} thresholdPct - Deviation threshold in percent (e.g., 0.5)
   * @returns {boolean}
   */
  hasSignificantDeviation(submittedPrices, thresholdPct) {
    for (const [symbol, currentPrice] of this.lastPrices) {
      const lastSubmitted = submittedPrices.get(symbol);
      if (!lastSubmitted || lastSubmitted === 0n) continue;

      // Calculate deviation: |current - last| / last * 100
      const diff = currentPrice > lastSubmitted
        ? currentPrice - lastSubmitted
        : lastSubmitted - currentPrice;

      // Multiply by 10000 first to avoid precision loss, then compare
      const deviationBps = (diff * 10000n) / lastSubmitted;
      const thresholdBps = BigInt(Math.round(thresholdPct * 100));

      if (deviationBps >= thresholdBps) {
        this.logger.info(
          `Significant deviation detected for ${symbol}: ${Number(deviationBps) / 100}%`
        );
        return true;
      }
    }
    return false;
  }

  /**
   * Normalize a Pyth price (with exponent) to 18 decimals
   * @param {bigint} value
   * @param {number} expo - Negative exponent from Pyth (e.g., -8)
   * @returns {bigint} Value in 18 decimals
   */
  _normalize(value, expo) {
    const targetDecimals = 18;
    const shift = targetDecimals + expo; // e.g., 18 + (-8) = 10

    if (shift >= 0) {
      return value * 10n ** BigInt(shift);
    } else {
      return value / 10n ** BigInt(-shift);
    }
  }
}

module.exports = { PythFetcher };
