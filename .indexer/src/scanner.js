const { ethers } = require("ethers");
const { DIAMOND_EVENTS_ABI } = require("./abi");
const models = require("./db/models");

/**
 * Block scanner — fetches logs from the Diamond address, decodes events,
 * and routes them to the appropriate database handler.
 */
class Scanner {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.iface = new ethers.Interface(DIAMOND_EVENTS_ABI);
    this.diamondAddress = config.diamondAddress.toLowerCase();

    this.stats = {
      blocksScanned: 0,
      eventsProcessed: 0,
      errors: 0,
    };
  }

  /**
   * Scan a range of blocks for Diamond events
   * @param {number} fromBlock
   * @param {number} toBlock
   * @returns {number} Number of events processed
   */
  async scanBlocks(fromBlock, toBlock) {
    const filter = {
      address: this.config.diamondAddress,
      fromBlock,
      toBlock,
    };

    let logs;
    try {
      logs = await this.provider.getLogs(filter);
    } catch (err) {
      this.logger.error(`Failed to fetch logs ${fromBlock}-${toBlock}: ${err.message}`);
      throw err;
    }

    if (logs.length === 0) {
      this.stats.blocksScanned += toBlock - fromBlock + 1;
      return 0;
    }

    // Fetch block timestamps (batch unique blocks)
    const blockTimestamps = new Map();
    const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))];
    await Promise.all(
      uniqueBlocks.map(async (bn) => {
        try {
          const block = await this.provider.getBlock(bn);
          blockTimestamps.set(bn, block ? new Date(block.timestamp * 1000) : new Date());
        } catch {
          blockTimestamps.set(bn, new Date());
        }
      })
    );

    let processed = 0;

    for (const log of logs) {
      try {
        const parsed = this.iface.parseLog({
          topics: log.topics,
          data: log.data,
        });

        if (!parsed) continue;

        const ctx = {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.index,
          timestamp: blockTimestamps.get(log.blockNumber) || new Date(),
        };

        await this._handleEvent(parsed, ctx);
        processed++;
      } catch (err) {
        // Log decode failures at debug level — some events may not be in our ABI
        this.logger.debug(`Failed to decode log in block ${log.blockNumber}: ${err.message}`);
      }
    }

    this.stats.blocksScanned += toBlock - fromBlock + 1;
    this.stats.eventsProcessed += processed;

    if (processed > 0) {
      this.logger.info(`  Blocks ${fromBlock}-${toBlock}: ${processed} events indexed`);
    }

    return processed;
  }

  /**
   * Route a decoded event to the appropriate handler
   */
  async _handleEvent(parsed, ctx) {
    const name = parsed.name;
    const args = parsed.args;

    switch (name) {
      // --- Positions ---
      case "PositionOpened":
        await this._handlePositionOpened(args, ctx);
        break;
      case "PositionModified":
        await this._handlePositionModified(args, ctx);
        break;
      case "PositionClosed":
        await this._handlePositionClosed(args, ctx);
        break;

      // --- Orders ---
      case "OrderPlaced":
        await this._handleOrderPlaced(args, ctx);
        break;
      case "OrderExecuted":
        await this._handleOrderExecuted(args, ctx);
        break;
      case "OrderCancelled":
        await this._handleOrderCancelled(args, ctx);
        break;

      // --- Liquidations ---
      case "Liquidation":
        await this._handleLiquidation(args, ctx);
        break;
      case "ADLExecuted":
        await this._handleADL(args, ctx);
        break;

      // --- Prices ---
      case "PricesUpdated":
        await this._handlePricesUpdated(args, ctx);
        break;

      // --- Funding ---
      case "FundingRateUpdated":
        await this._handleFundingRateUpdated(args, ctx);
        break;
      case "FundingSettled":
        await this._handleFundingSettled(args, ctx);
        break;

      // --- Markets ---
      case "MarketCreated":
        await this._handleMarketCreated(args, ctx);
        break;
      case "MarketUpdated":
        await this._handleMarketUpdated(args, ctx);
        break;
      case "MarketEnabled":
        await models.setMarketEnabled(Number(args[0]), true);
        break;
      case "MarketDisabled":
        await models.setMarketEnabled(Number(args[0]), false);
        break;

      // --- Fees ---
      case "FeesUpdated":
        await this._handleFeesUpdated(args, ctx);
        break;

      // --- Vaults ---
      case "VaultCreated":
        await this._handleVaultCreated(args, ctx);
        break;
      case "CollateralDeposited":
        await this._handleCollateralDeposited(args, ctx);
        break;
      case "CollateralWithdrawn":
        await this._handleCollateralWithdrawn(args, ctx);
        break;
      case "VaultFunded":
        await this._handleVaultFunded(args, ctx);
        break;
      case "VaultDefunded":
        await this._handleVaultDefunded(args, ctx);
        break;

      // --- Collateral tokens ---
      case "CollateralAdded":
        await this._handleCollateralAdded(args, ctx);
        break;
      case "CollateralRemoved":
        await models.removeCollateralToken(args[0]);
        break;

      // --- vAMM ---
      case "PoolInitialized":
      case "PoolSynced":
      case "PoolReservesUpdated":
        await this._handlePoolEvent(name, args, ctx);
        break;

      // --- Pause events ---
      case "GlobalPaused":
      case "GlobalUnpaused":
      case "MarketPaused":
      case "MarketUnpaused":
        await this._handleProtocolEvent(name, args, ctx);
        break;

      // --- Access control ---
      case "RoleGranted":
      case "RoleRevoked":
        await this._handleProtocolEvent(name, args, ctx);
        break;

      // --- Diamond ---
      case "DiamondCut":
      case "OwnershipTransferred":
        await this._handleProtocolEvent(name, args, ctx);
        break;

      // --- Oracle admin ---
      case "PricePosterAdded":
      case "PricePosterRemoved":
      case "MaxPriceStalenessUpdated":
      case "VaultImplementationUpdated":
      case "ADLThresholdUpdated":
      case "InsuranceWithdrawn":
        await this._handleProtocolEvent(name, args, ctx);
        break;

      default:
        this.logger.debug(`Unhandled event: ${name}`);
    }
  }

  // ============================================================
  //  EVENT HANDLERS
  // ============================================================

  async _handlePositionOpened(args, ctx) {
    const positionId = args[0].toString();
    const user = args[1];
    const marketId = Number(args[2]);
    const isLong = args[3];
    const sizeUsd = args[4].toString();
    const leverage = args[5].toString();
    const entryPrice = args[6].toString();
    const collateralToken = args[7];
    const collateralAmount = args[8].toString();

    await models.insertPosition({
      positionId, user, marketId, isLong, sizeUsd, leverage, entryPrice,
      collateralToken, collateralAmount, timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash,
    });

    await models.insertTrade({
      positionId, user, marketId, tradeType: "open", isLong, sizeUsd,
      price: entryPrice, realizedPnl: 0, blockNumber: ctx.blockNumber,
      txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp,
    });

    this.logger.debug(`  Position opened: #${positionId} ${isLong ? "LONG" : "SHORT"} market=${marketId}`);
  }

  async _handlePositionModified(args, ctx) {
    await models.updatePositionModified({
      positionId: args[0].toString(),
      newSizeUsd: args[1].toString(),
      newCollateralUsd: args[2].toString(),
      newCollateralAmount: args[3].toString(),
    });

    await models.insertTrade({
      positionId: args[0].toString(), user: null, marketId: null,
      tradeType: "modify", isLong: null, sizeUsd: args[1].toString(),
      price: "0", blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      logIndex: ctx.logIndex, timestamp: ctx.timestamp,
    });
  }

  async _handlePositionClosed(args, ctx) {
    const positionId = args[0].toString();
    const user = args[1];
    const marketId = Number(args[2]);
    const closeSizeUsd = args[3].toString();
    const exitPrice = args[4].toString();
    const realizedPnl = args[5].toString();
    const isFullClose = args[6];

    if (isFullClose) {
      await models.closePosition({
        positionId, realizedPnl, exitPrice, isLiquidation: false,
        timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      });
    }

    await models.insertTrade({
      positionId, user, marketId, tradeType: isFullClose ? "close" : "partial_close",
      isLong: null, sizeUsd: closeSizeUsd, price: exitPrice, realizedPnl,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });

    this.logger.debug(`  Position ${isFullClose ? "closed" : "partially closed"}: #${positionId} PnL=${realizedPnl}`);
  }

  async _handleOrderPlaced(args, ctx) {
    await models.insertOrder({
      orderId: args[0].toString(),
      user: args[1],
      marketId: Number(args[2]),
      orderType: Number(args[3]),
      isLong: args[4],
      triggerPrice: args[5].toString(),
      sizeUsd: args[6].toString(),
      timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
    });
  }

  async _handleOrderExecuted(args, ctx) {
    await models.executeOrder({
      orderId: args[0].toString(),
      positionId: args[1].toString(),
      executionPrice: args[2].toString(),
      timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
    });
  }

  async _handleOrderCancelled(args, ctx) {
    await models.cancelOrder({
      orderId: args[0].toString(),
      timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
    });
  }

  async _handleLiquidation(args, ctx) {
    const positionId = args[0].toString();
    const user = args[1];
    const marketId = Number(args[2]);
    const price = args[3].toString();
    const penalty = args[4].toString();
    const keeper = args[5];

    await models.insertLiquidation({
      positionId, user, marketId, price, penalty, keeper,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, timestamp: ctx.timestamp,
    });

    await models.closePosition({
      positionId, realizedPnl: "0", exitPrice: price, isLiquidation: true,
      timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash,
    });

    await models.insertTrade({
      positionId, user, marketId, tradeType: "liquidation", isLong: null,
      sizeUsd: "0", price, realizedPnl: "0", blockNumber: ctx.blockNumber,
      txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp,
    });

    this.logger.debug(`  Liquidation: #${positionId} by ${keeper}`);
  }

  async _handleADL(args, ctx) {
    await models.insertProtocolEvent({
      eventName: "ADLExecuted",
      data: { positionId: args[0].toString(), deleveragedSizeUsd: args[1].toString() },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  async _handlePricesUpdated(args, ctx) {
    const marketIds = args[0];
    const prices = args[1];
    const onchainTimestamp = Number(args[2]);

    const records = [];
    for (let i = 0; i < marketIds.length; i++) {
      records.push({
        marketId: Number(marketIds[i]),
        price: prices[i].toString(),
        onchainTimestamp,
        blockNumber: ctx.blockNumber,
        txHash: ctx.txHash,
        blockTimestamp: ctx.timestamp,
      });
    }

    await models.insertPriceUpdates(records);
  }

  async _handleFundingRateUpdated(args, ctx) {
    await models.insertFundingRate({
      marketId: Number(args[0]),
      ratePerSecond: args[1].toString(),
      rate24h: args[2].toString(),
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
      timestamp: ctx.timestamp,
    });
  }

  async _handleFundingSettled(args, ctx) {
    await models.insertProtocolEvent({
      eventName: "FundingSettled",
      data: {
        marketId: Number(args[0]),
        fundingRate: args[1].toString(),
        longPayment: args[2].toString(),
        shortPayment: args[3].toString(),
      },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  async _handleMarketCreated(args, ctx) {
    await models.upsertMarket({
      marketId: Number(args[0]),
      name: args[1],
      symbol: args[2],
      maxLeverage: args[3].toString(),
      timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
    });
    this.logger.debug(`  Market created: [${args[0]}] ${args[2]}`);
  }

  async _handleMarketUpdated(args, ctx) {
    await models.insertProtocolEvent({
      eventName: "MarketUpdated",
      data: { marketId: Number(args[0]) },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  async _handleFeesUpdated(args, ctx) {
    await models.upsertFeeConfig({
      takerFeeBps: Number(args[0]),
      makerFeeBps: Number(args[1]),
      liquidationFeeBps: Number(args[2]),
      insuranceFeeBps: Number(args[3]),
      blockNumber: ctx.blockNumber,
    });
  }

  async _handleVaultCreated(args, ctx) {
    await models.insertUserVault({
      user: args[0],
      vault: args[1],
      timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
    });
  }

  async _handleCollateralDeposited(args, ctx) {
    await models.insertVaultEvent({
      eventType: "deposit",
      user: args[0],
      token: args[1],
      amount: args[2].toString(),
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
      logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  async _handleCollateralWithdrawn(args, ctx) {
    await models.insertVaultEvent({
      eventType: "withdrawal",
      user: args[0],
      token: args[1],
      amount: args[2].toString(),
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
      logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  async _handleVaultFunded(args, ctx) {
    await models.insertVaultEvent({
      eventType: "vault_funded",
      user: args[2],
      token: args[0],
      amount: args[1].toString(),
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
      logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  async _handleVaultDefunded(args, ctx) {
    await models.insertVaultEvent({
      eventType: "vault_defunded",
      user: args[2],
      token: args[0],
      amount: args[1].toString(),
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
      logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  async _handleCollateralAdded(args, ctx) {
    await models.upsertCollateralToken({
      token: args[0],
      decimals: Number(args[1]),
      timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
    });
  }

  async _handlePoolEvent(name, args, ctx) {
    const marketId = Number(args[0]);
    const baseReserve = args[1].toString();
    const quoteReserve = args[2].toString();
    const oraclePrice = args.length > 3 ? args[3].toString() : "0";

    await models.upsertPoolState({
      marketId, baseReserve, quoteReserve, oraclePrice, blockNumber: ctx.blockNumber,
    });
  }

  async _handleProtocolEvent(name, args, ctx) {
    const data = {};
    for (let i = 0; i < args.length; i++) {
      const val = args[i];
      data[`arg${i}`] = typeof val === "bigint" ? val.toString() : val;
    }

    await models.insertProtocolEvent({
      eventName: name,
      data,
      blockNumber: ctx.blockNumber,
      txHash: ctx.txHash,
      logIndex: ctx.logIndex,
      timestamp: ctx.timestamp,
    });
  }

  /**
   * Get current chain head block number
   */
  async getChainHead() {
    return await this.provider.getBlockNumber();
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { Scanner };
