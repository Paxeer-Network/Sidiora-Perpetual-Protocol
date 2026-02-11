const { ethers } = require("ethers");

/**
 * Shared transaction executor with nonce management, retry logic,
 * gas estimation, and failure tracking.
 */
class Executor {
  constructor(config, combinedAbi, logger) {
    this.config = config;
    this.logger = logger;

    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.diamond = new ethers.Contract(
      config.diamondAddress,
      combinedAbi,
      this.wallet
    );

    // Nonce tracking
    this._pendingNonce = null;
    this._nonceLock = false;

    // Stats
    this.stats = {
      ordersExecuted: 0,
      liquidationsExecuted: 0,
      vammSyncs: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      lastTxHash: null,
      lastActionTime: null,
    };

    this.logger.info(`Executor initialized`);
    this.logger.info(`  Wallet:  ${this.wallet.address}`);
    this.logger.info(`  Diamond: ${config.diamondAddress}`);
  }

  /**
   * Execute a limit/stop-limit order on-chain.
   * @param {number|bigint} orderId
   * @returns {{ success: boolean, positionId?: bigint, txHash?: string, error?: string }}
   */
  async executeOrder(orderId) {
    return this._submitTx(
      "executeOrder",
      [orderId],
      this.config.gasLimitExecuteOrder,
      () => {
        this.stats.ordersExecuted++;
      }
    );
  }

  /**
   * Liquidate an undercollateralized position.
   * @param {number|bigint} positionId
   * @returns {{ success: boolean, txHash?: string, error?: string }}
   */
  async liquidate(positionId) {
    return this._submitTx(
      "liquidate",
      [positionId],
      this.config.gasLimitLiquidate,
      () => {
        this.stats.liquidationsExecuted++;
      }
    );
  }

  /**
   * Sync a market's vAMM reserves toward the oracle price.
   * @param {number|bigint} marketId
   * @returns {{ success: boolean, txHash?: string, error?: string }}
   */
  async syncVamm(marketId) {
    return this._submitTx(
      "syncToOracle",
      [marketId],
      this.config.gasLimitSyncVamm,
      () => {
        this.stats.vammSyncs++;
      }
    );
  }

  /**
   * Read order details from chain.
   * @param {bigint} orderId
   */
  async getOrder(orderId) {
    const result = await this.diamond.getOrder(orderId);
    return {
      user: result[0],
      marketId: result[1],
      isLong: result[2],
      orderType: Number(result[3]),
      triggerPrice: result[4],
      limitPrice: result[5],
      sizeUsd: result[6],
      leverage: result[7],
      collateralToken: result[8],
      collateralAmount: result[9],
      active: result[10],
    };
  }

  /**
   * Read position details from chain.
   * @param {bigint} positionId
   */
  async getPosition(positionId) {
    const result = await this.diamond.getPosition(positionId);
    return {
      user: result[0],
      marketId: result[1],
      isLong: result[2],
      sizeUsd: result[3],
      collateralUsd: result[4],
      collateralToken: result[5],
      collateralAmount: result[6],
      entryPrice: result[7],
      lastFundingIndex: result[8],
      timestamp: result[9],
      active: result[10],
    };
  }

  /**
   * Check if a position is liquidatable.
   * @param {bigint} positionId
   * @returns {{ liquidatable: boolean, marginBps: bigint }}
   */
  async checkLiquidatable(positionId) {
    const [liquidatable, marginBps] =
      await this.diamond.checkLiquidatable(positionId);
    return { liquidatable, marginBps };
  }

  /**
   * Get current price for a market.
   * @param {number} marketId
   * @returns {{ price: bigint, timestamp: bigint }}
   */
  async getPrice(marketId) {
    const [price, timestamp] = await this.diamond.getPrice(marketId);
    return { price, timestamp };
  }

  /**
   * Get market configuration.
   * @param {number} marketId
   */
  async getMarket(marketId) {
    const result = await this.diamond.getMarket(marketId);
    return {
      name: result[0],
      symbol: result[1],
      maxLeverage: result[2],
      maintenanceMarginBps: result[3],
      enabled: result[4],
    };
  }

  /**
   * Check if an address has a specific role on the Diamond.
   * @param {string} roleHash - bytes32 role hash
   * @param {string} account - address to check
   * @returns {boolean}
   */
  async hasRole(roleHash, account) {
    return this.diamond.hasRole(roleHash, account);
  }

  /**
   * Get virtual pool state for a market.
   * @param {number} marketId
   * @returns {{ baseReserve: bigint, quoteReserve: bigint, lastSyncTimestamp: bigint, dampingFactor: bigint }}
   */
  async getPool(marketId) {
    const [baseReserve, quoteReserve, lastSyncTimestamp, dampingFactor] =
      await this.diamond.getPool(marketId);
    return { baseReserve, quoteReserve, lastSyncTimestamp, dampingFactor };
  }

  /**
   * Get wallet balance in ETH/PAX.
   * @returns {string}
   */
  async getBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Get execution statistics.
   */
  getStats() {
    return { ...this.stats };
  }

  // ============================================================
  //  Internal
  // ============================================================

  /**
   * Core transaction submission with retry and nonce management.
   * @param {string} method - Contract method name
   * @param {any[]} args - Method arguments
   * @param {number} gasLimit - Gas limit for this call
   * @param {Function} onSuccess - Callback on successful confirmation
   */
  async _submitTx(method, args, gasLimit, onSuccess) {
    // Pre-flight: simulate via eth_call to get revert reason before spending gas
    try {
      await this.diamond[method].staticCall(...args);
    } catch (simError) {
      const reason = this._extractReason(simError);
      if (this._isNonRetryable(reason)) {
        this.logger.warn(
          `  ${method}(${args.join(",")}) static-call reverted: ${reason}`
        );
        return { success: false, error: reason, reverted: true };
      }
      // Log but continue — static call might fail for non-view reasons
      this.logger.debug(
        `  ${method}(${args.join(",")}) static-call hint: ${reason}`
      );
    }

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const nonce = await this._getNextNonce();
        const txOptions = { gasLimit, nonce };

        const tx = await this.diamond[method](...args, txOptions);

        this.logger.info(
          `  TX ${method}(${args.join(",")}) sent: ${tx.hash} (attempt ${attempt})`
        );

        const receipt = await tx.wait();

        // Success
        this.stats.consecutiveFailures = 0;
        this.stats.lastTxHash = receipt.hash;
        this.stats.lastActionTime = new Date();
        onSuccess();

        this.logger.info(
          `  Confirmed in block ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()}`
        );

        return { success: true, txHash: receipt.hash };
      } catch (error) {
        const reason = this._extractReason(error);

        // Non-retryable reverts — the on-chain state makes this tx invalid
        if (this._isNonRetryable(reason)) {
          this.logger.warn(
            `  ${method}(${args.join(",")}) reverted (non-retryable): ${reason}`
          );
          this._pendingNonce = null;
          return { success: false, error: reason, reverted: true };
        }

        if (attempt < this.config.maxRetries) {
          this.logger.warn(
            `  Attempt ${attempt}/${this.config.maxRetries} for ${method} failed: ${reason}`
          );
          // Reset nonce on failure
          this._pendingNonce = null;
          await this._sleep(this.config.retryDelayMs * attempt);
        } else {
          this.stats.totalFailures++;
          this.stats.consecutiveFailures++;

          this.logger.error(
            `  All ${this.config.maxRetries} attempts failed for ${method}(${args.join(",")}): ${reason}`
          );

          if (
            this.stats.consecutiveFailures >=
            this.config.maxConsecutiveFailures
          ) {
            this.logger.error(
              `  ALERT: ${this.stats.consecutiveFailures} consecutive failures!`
            );
          }

          return { success: false, error: reason };
        }
      }
    }
  }

  /**
   * Get next nonce, tracking pending submissions.
   */
  async _getNextNonce() {
    if (this._pendingNonce !== null) {
      return this._pendingNonce++;
    }
    const nonce = await this.provider.getTransactionCount(
      this.wallet.address,
      "pending"
    );
    this._pendingNonce = nonce + 1;
    return nonce;
  }

  /**
   * Extract human-readable revert reason from error.
   */
  _extractReason(error) {
    if (error.reason) return error.reason;
    if (error.shortMessage) return error.shortMessage;
    if (error.data) {
      try {
        const iface = this.diamond.interface;
        const decoded = iface.parseError(error.data);
        if (decoded) return `${decoded.name}(${decoded.args.join(",")})`;
      } catch {
        // ignore decode errors
      }
    }
    return error.message || "unknown error";
  }

  /**
   * Detect non-retryable revert reasons (on-chain state changed).
   */
  _isNonRetryable(reason) {
    const permanent = [
      "order not active",
      "not owner",
      "position not active",
      "position is healthy",
      "no price",
      "no oracle price",
      "limit long not triggered",
      "limit short not triggered",
      "stop long not triggered",
      "stop short not triggered",
      "price above limit",
      "price below limit",
      "user has active position",
      "market not enabled",
      "protocol paused",
      "market paused",
      "pool not initialized",
      "account is missing role",
    ];
    const lower = reason.toLowerCase();
    return permanent.some((r) => lower.includes(r));
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { Executor };
