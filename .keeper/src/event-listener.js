const { ethers } = require("ethers");

/**
 * Listens for PricesUpdated events from the Diamond proxy.
 * When new prices are posted by the oracle node, it triggers
 * the keeper execution cycle (orders, liquidations, vAMM sync).
 */
class EventListener {
  constructor(config, combinedAbi, logger) {
    this.config = config;
    this.logger = logger;

    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.diamond = new ethers.Contract(
      config.diamondAddress,
      combinedAbi,
      this.provider
    );

    this._callbacks = [];
    this._pollInterval = null;
    this._lastProcessedBlock = 0;
    this._listening = false;
  }

  /**
   * Register a callback to be invoked on each price update.
   * @param {Function} callback - async (marketIds, prices) => void
   */
  onPriceUpdate(callback) {
    this._callbacks.push(callback);
  }

  /**
   * Start listening for PricesUpdated events.
   * Uses polling since not all RPC endpoints support WebSocket subscriptions.
   */
  async start() {
    this._listening = true;
    this._lastProcessedBlock = await this.provider.getBlockNumber();

    this.logger.info(
      `  Event listener started from block ${this._lastProcessedBlock}`
    );

    // Poll for new events
    this._pollInterval = setInterval(async () => {
      if (!this._listening) return;

      try {
        await this._scanNewBlocks();
      } catch (err) {
        this.logger.warn(`  Event poll error: ${err.message}`);
      }
    }, this.config.fallbackPollMs);
  }

  /**
   * Stop listening.
   */
  stop() {
    this._listening = false;
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    this.logger.info("  Event listener stopped");
  }

  /**
   * Scan for PricesUpdated events in new blocks since last check.
   */
  async _scanNewBlocks() {
    const currentBlock = await this.provider.getBlockNumber();
    if (currentBlock <= this._lastProcessedBlock) return;

    const fromBlock = this._lastProcessedBlock + 1;
    const toBlock = currentBlock;

    try {
      const filter = this.diamond.filters.PricesUpdated();
      const events = await this.diamond.queryFilter(
        filter,
        fromBlock,
        toBlock
      );

      if (events.length > 0) {
        // Process only the latest event if multiple in same scan
        const latest = events[events.length - 1];
        const marketIds = latest.args[0].map((id) => Number(id));
        const prices = latest.args[1].map((p) => BigInt(p));

        this.logger.debug(
          `  PricesUpdated detected in block ${latest.blockNumber} (${events.length} event(s))`
        );

        // Invoke all callbacks
        for (const cb of this._callbacks) {
          try {
            await cb(marketIds, prices);
          } catch (err) {
            this.logger.error(`  Callback error: ${err.message}`);
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `  Event scan error (blocks ${fromBlock}-${toBlock}): ${err.message}`
      );
    }

    this._lastProcessedBlock = toBlock;
  }
}

module.exports = { EventListener };
