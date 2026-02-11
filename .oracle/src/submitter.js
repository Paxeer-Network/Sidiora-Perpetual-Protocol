const { ethers } = require("ethers");

/**
 * Submits prices on-chain to the OracleFacet via batchUpdatePrices().
 *
 * Manages wallet connection, nonce tracking, gas estimation, and retries.
 */
class OnChainSubmitter {
  constructor(config, oracleAbi, logger) {
    this.config = config;
    this.logger = logger;
    this.submittedPrices = new Map(); // symbol → last submitted price (18 dec bigint)
    this.stats = {
      totalSubmissions: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      lastSubmissionTime: null,
      lastTxHash: null,
    };

    // Setup provider + wallet
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.oracle = new ethers.Contract(config.diamondAddress, oracleAbi, this.wallet);

    this.logger.info(`Submitter initialized`);
    this.logger.info(`  Wallet:  ${this.wallet.address}`);
    this.logger.info(`  Diamond: ${config.diamondAddress}`);
  }

  /**
   * Submit prices on-chain via batchUpdatePrices
   * @param {Array<{marketId: number, symbol: string, price: bigint}>} prices
   * @returns {{success: boolean, txHash?: string, error?: string}}
   */
  async submitPrices(prices) {
    if (prices.length === 0) {
      this.logger.warn("No prices to submit");
      return { success: false, error: "No prices" };
    }

    const marketIds = prices.map((p) => p.marketId);
    const priceValues = prices.map((p) => p.price);

    // Build log string
    const priceLog = prices
      .map((p) => `${p.symbol}=$${this._formatUsd(p.price)}`)
      .join(", ");

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Estimate gas
        const txOptions = { gasLimit: this.config.gasLimit };
        if (this.config.maxFeePerGas) {
          txOptions.maxFeePerGas = ethers.parseUnits(this.config.maxFeePerGas, "gwei");
        }

        const tx = await this.oracle.batchUpdatePrices(
          marketIds,
          priceValues,
          txOptions
        );

        this.logger.info(`  TX sent: ${tx.hash} (attempt ${attempt})`);

        const receipt = await tx.wait();

        // Update stats
        this.stats.totalSubmissions++;
        this.stats.consecutiveFailures = 0;
        this.stats.lastSubmissionTime = new Date();
        this.stats.lastTxHash = receipt.hash;

        // Track submitted prices
        for (const p of prices) {
          this.submittedPrices.set(p.symbol, p.price);
        }

        this.logger.info(
          `  ✓ Confirmed in block ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()} | ${priceLog}`
        );

        return { success: true, txHash: receipt.hash };
      } catch (error) {
        const reason = error.reason || error.shortMessage || error.message;

        if (attempt < this.config.maxRetries) {
          this.logger.warn(
            `  Attempt ${attempt}/${this.config.maxRetries} failed: ${reason}`
          );
          await this._sleep(this.config.retryDelayMs * attempt);
        } else {
          this.stats.totalFailures++;
          this.stats.consecutiveFailures++;

          this.logger.error(`  ✗ All ${this.config.maxRetries} attempts failed: ${reason}`);

          if (this.stats.consecutiveFailures >= this.config.maxConsecutiveFailures) {
            this.logger.error(
              `  🚨 ALERT: ${this.stats.consecutiveFailures} consecutive failures!`
            );
          }

          return { success: false, error: reason };
        }
      }
    }
  }

  /**
   * Check current on-chain prices for all markets
   * @param {number[]} marketIds
   * @returns {Map<number, {price: bigint, timestamp: number, stale: boolean}>}
   */
  async getOnChainPrices(marketIds) {
    const results = new Map();

    for (const id of marketIds) {
      try {
        const [price, timestamp, stale] = await Promise.all([
          this.oracle.getLatestPrice(id),
          this.oracle.getLatestPriceTimestamp(id),
          this.oracle.isPriceStale(id),
        ]);
        results.set(id, {
          price: BigInt(price),
          timestamp: Number(timestamp),
          stale,
        });
      } catch {
        results.set(id, { price: 0n, timestamp: 0, stale: true });
      }
    }

    return results;
  }

  /**
   * Get wallet balance
   * @returns {string} Balance in ETH
   */
  async getBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Get submission statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Format a price in 18 decimals to human-readable USD string
   */
  _formatUsd(price18) {
    return Number(price18 / 10n ** 14n) / 10000;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { OnChainSubmitter };
