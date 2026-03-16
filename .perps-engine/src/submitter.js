const { ethers } = require("ethers");

const TX_WAIT_TIMEOUT_MS = 30_000;

/**
 * Submits executeCycle() or executePriceCycle() to the KeeperMulticallFacet.
 *
 * Single wallet, single tx per cycle. Manages nonce, gas, retries, and
 * provider reconnection on hangs.
 */
class Submitter {
  constructor(config, combinedAbi, logger) {
    this.config = config;
    this.logger = logger;
    this._combinedAbi = combinedAbi;
    this.submittedPrices = new Map(); // symbol → last submitted price (18 dec bigint)

    this.stats = {
      totalCycles: 0,
      fullCycles: 0,
      priceCycles: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      lastTxHash: null,
      lastCycleTime: null,
    };

    this._initProvider();

    this.logger.info(`Submitter initialized`);
    this.logger.info(`  Wallet:  ${this.wallet.address}`);
    this.logger.info(`  Diamond: ${config.diamondAddress}`);
  }

  _initProvider() {
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl, undefined, {
      staticNetwork: true,
      batchMaxCount: 1,
    });
    this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
    this.diamond = new ethers.Contract(
      this.config.diamondAddress,
      this._combinedAbi,
      this.wallet
    );
  }

  /**
   * Submit a full executeCycle() transaction.
   * @returns {{ success: boolean, txHash?: string, receipt?: object, error?: string }}
   */
  async submitFullCycle(marketIds, prices, orderIds, liquidationIds) {
    return this._submitWithRetry(
      "executeCycle",
      [marketIds, prices, orderIds, liquidationIds],
      () => { this.stats.fullCycles++; }
    );
  }

  /**
   * Submit a lightweight executePriceCycle() transaction.
   * @returns {{ success: boolean, txHash?: string, receipt?: object, error?: string }}
   */
  async submitPriceCycle(marketIds, prices) {
    return this._submitWithRetry(
      "executePriceCycle",
      [marketIds, prices],
      () => { this.stats.priceCycles++; }
    );
  }

  /**
   * Read helpers — delegated to the diamond contract.
   */
  async getOrder(orderId) {
    const r = await this.diamond.getOrder(orderId);
    return {
      user: r[0], marketId: r[1], isLong: r[2], orderType: Number(r[3]),
      triggerPrice: r[4], limitPrice: r[5], sizeUsd: r[6], leverage: r[7],
      collateralToken: r[8], collateralAmount: r[9], active: r[10],
    };
  }

  async getPosition(positionId) {
    const r = await this.diamond.getPosition(positionId);
    return {
      user: r[0], marketId: r[1], isLong: r[2], sizeUsd: r[3],
      collateralUsd: r[4], collateralToken: r[5], collateralAmount: r[6],
      entryPrice: r[7], lastFundingIndex: r[8], timestamp: r[9], active: r[10],
    };
  }

  async checkLiquidatable(positionId) {
    const [liquidatable, marginBps] = await this.diamond.checkLiquidatable(positionId);
    return { liquidatable, marginBps };
  }

  async getLatestPrice(marketId) {
    return await this.diamond.getLatestPrice(marketId);
  }

  async getMarket(marketId) {
    const r = await this.diamond.getMarket(marketId);
    return {
      name: r[0], symbol: r[1], maxLeverage: r[2],
      maintenanceMarginBps: r[3], enabled: r[4],
    };
  }

  async getFundingState(marketId) {
    const r = await this.diamond.getFundingState(marketId);
    return {
      cumulativeFundingPerUnitLong: r[0],
      cumulativeFundingPerUnitShort: r[1],
      lastUpdateTimestamp: r[2],
      currentFundingRatePerSecond: r[3],
    };
  }

  async getRobustnessParams() {
    const r = await this.diamond.getRobustnessParams();
    return {
      maxPriceDeviationBps: r[0],
      minPositionSizeUsd: r[1],
      minOrderSizeUsd: r[2],
      maxFundingRatePerSecond: r[3],
    };
  }

  async hasRole(roleHash, account) {
    return this.diamond.hasRole(roleHash, account);
  }

  async getPool(marketId) {
    const [baseReserve, quoteReserve, lastSyncTimestamp, dampingFactor] =
      await this.diamond.getPool(marketId);
    return { baseReserve, quoteReserve, lastSyncTimestamp, dampingFactor };
  }

  async getBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  getStats() {
    return { ...this.stats };
  }

  // ============================================================
  //  Internal
  // ============================================================

  async _submitWithRetry(method, args, onSuccess) {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const txOptions = { gasLimit: this.config.gasLimit };
        if (this.config.maxFeePerGas) {
          txOptions.maxFeePerGas = ethers.parseUnits(this.config.maxFeePerGas, "gwei");
        }

        const tx = await this.diamond[method](...args, txOptions);
        this.logger.info(`  TX ${method} sent: ${tx.hash} (attempt ${attempt})`);

        const receipt = await this._waitWithTimeout(tx, TX_WAIT_TIMEOUT_MS);

        // Success
        this.stats.totalCycles++;
        this.stats.consecutiveFailures = 0;
        this.stats.lastTxHash = receipt.hash;
        this.stats.lastCycleTime = new Date();
        onSuccess();

        this.logger.info(
          `  Confirmed block ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()}`
        );

        return { success: true, txHash: receipt.hash, receipt };
      } catch (error) {
        const reason = error.reason || error.shortMessage || error.message;

        if (attempt < this.config.maxRetries) {
          this.logger.warn(
            `  Attempt ${attempt}/${this.config.maxRetries} for ${method} failed: ${reason}`
          );
          await this._sleep(this.config.retryDelayMs * attempt);
        } else {
          this.stats.totalFailures++;
          this.stats.consecutiveFailures++;
          this.logger.error(
            `  All ${this.config.maxRetries} attempts failed for ${method}: ${reason}`
          );
          return { success: false, error: reason };
        }
      }
    }
  }

  async _waitWithTimeout(tx, timeoutMs) {
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`tx.wait timed out after ${timeoutMs}ms (hash=${tx.hash})`)),
        timeoutMs
      )
    );
    try {
      return await Promise.race([tx.wait(), timeout]);
    } catch (err) {
      if (err.message.includes("timed out")) {
        this.logger.warn("  RPC hang detected — recreating provider");
        this._initProvider();
      }
      throw err;
    }
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { Submitter };
