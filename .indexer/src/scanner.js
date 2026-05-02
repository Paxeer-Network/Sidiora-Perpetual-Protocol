"use strict";

const { ethers } = require("ethers");
const { DIAMOND_EVENTS_ABI } = require("./abi");
const models = require("./db/models");

const TIMESTAMP_BATCH = 50; // parallel eth_getBlock calls per chunk

class Scanner {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.iface = new ethers.Interface(DIAMOND_EVENTS_ABI);
    this.diamondAddress = config.diamondAddress.toLowerCase();

    // Multi-provider: round-robin with automatic failover
    this.providers = (config.rpcUrls || [config.rpcUrl]).map(
      (u) => new ethers.JsonRpcProvider(u)
    );
    this._providerIdx = 0;

    this.stats = { blocksScanned: 0, eventsProcessed: 0, errors: 0 };
  }

  // ── Provider selection ───────────────────────────────────────

  async _withFallback(fn) {
    for (let i = 0; i < this.providers.length; i++) {
      const idx = (this._providerIdx + i) % this.providers.length;
      try {
        const result = await fn(this.providers[idx]);
        this._providerIdx = idx; // stick to last healthy provider
        return result;
      } catch (err) {
        this.logger.warn(`[scanner] RPC[${idx}] failed: ${err.message}`);
      }
    }
    this.stats.errors++;
    throw new Error("All RPC providers failed");
  }

  // ── Public API ───────────────────────────────────────────────

  async scanBlocks(fromBlock, toBlock) {
    let logs;
    try {
      logs = await this._withFallback((p) =>
        p.getLogs({ address: this.config.diamondAddress, fromBlock, toBlock })
      );
    } catch (err) {
      throw err;
    }

    const rangeSize = toBlock - fromBlock + 1;
    this.stats.blocksScanned += rangeSize;

    if (logs.length === 0) {
      return { events: 0, effectiveTo: toBlock };
    }

    // Fetch timestamps only for blocks that have events
    const blockNums = [...new Set(logs.map((l) => l.blockNumber))];
    const timestamps = await this._fetchTimestamps(blockNums);

    let processed = 0;
    for (const log of logs) {
      try {
        const parsed = this.iface.parseLog({ topics: log.topics, data: log.data });
        if (!parsed) continue;
        const ctx = {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.index,
          timestamp: timestamps.get(log.blockNumber) || new Date(),
        };
        await this._handleEvent(parsed, ctx);
        processed++;
      } catch (err) {
        this.logger.debug(`Failed to decode log in block ${log.blockNumber}: ${err.message}`);
      }
    }

    this.stats.eventsProcessed += processed;

    if (processed > 0) {
      this.logger.info(
        `  Blocks ${fromBlock}-${toBlock}: ${processed} events (${blockNums.length} active blocks)`
      );
    }

    return { events: processed, effectiveTo: toBlock };
  }

  async _fetchTimestamps(blockNums) {
    const timestamps = new Map();
    for (let i = 0; i < blockNums.length; i += TIMESTAMP_BATCH) {
      const batch = blockNums.slice(i, i + TIMESTAMP_BATCH);
      await Promise.all(
        batch.map(async (bn) => {
          try {
            const block = await this._withFallback((p) => p.getBlock(bn));
            timestamps.set(bn, block ? new Date(block.timestamp * 1000) : new Date());
          } catch {
            timestamps.set(bn, new Date());
          }
        })
      );
    }
    return timestamps;
  }

  async getChainHead() {
    return this._withFallback((p) => p.getBlockNumber());
  }

  getStats() { return { ...this.stats }; }
  getPool()  { return null; } // no TendermintPool — satisfies HealthServer interface
  async close() {}

  // ── Event router ────────────────────────────────────────────

  async _handleEvent(parsed, ctx) {
    const { name, args } = parsed;
    switch (name) {
      // --- Positions ---
      case "PositionOpened":   await this._handlePositionOpened(args, ctx); break;
      case "PositionModified": await this._handlePositionModified(args, ctx); break;
      case "PositionClosed":   await this._handlePositionClosed(args, ctx); break;
      // --- Orders ---
      case "OrderPlaced":     await this._handleOrderPlaced(args, ctx); break;
      case "OrderExecuted":   await this._handleOrderExecuted(args, ctx); break;
      case "OrderCancelled":  await this._handleOrderCancelled(args, ctx); break;
      case "OrderExpired":    await this._handleOrderExpired(args, ctx); break;
      // --- Liquidations ---
      case "Liquidation":   await this._handleLiquidation(args, ctx); break;
      case "ADLExecuted":   await this._handleADL(args, ctx); break;
      // --- Prices ---
      case "PricesUpdated": await this._handlePricesUpdated(args, ctx); break;
      // --- Funding ---
      case "FundingRateUpdated": await this._handleFundingRateUpdated(args, ctx); break;
      case "FundingSettled":     await this._handleFundingSettled(args, ctx); break;
      // --- Markets ---
      case "MarketCreated":  await this._handleMarketCreated(args, ctx); break;
      case "MarketUpdated":  await this._handleMarketUpdated(args, ctx); break;
      case "MarketEnabled":  await models.setMarketEnabled(Number(args[0]), true); break;
      case "MarketDisabled": await models.setMarketEnabled(Number(args[0]), false); break;
      // --- Fees ---
      case "FeesUpdated": await this._handleFeesUpdated(args, ctx); break;
      // --- Vaults ---
      case "VaultCreated":         await this._handleVaultCreated(args, ctx); break;
      case "CollateralDeposited":  await this._handleCollateralDeposited(args, ctx); break;
      case "CollateralWithdrawn":  await this._handleCollateralWithdrawn(args, ctx); break;
      case "VaultFunded":          await this._handleVaultFunded(args, ctx); break;
      case "VaultDefunded":        await this._handleVaultDefunded(args, ctx); break;
      // --- Collateral ---
      case "CollateralAdded":   await this._handleCollateralAdded(args, ctx); break;
      case "CollateralRemoved": await models.removeCollateralToken(args[0]); break;
      // --- vAMM ---
      case "PoolInitialized":
      case "PoolSynced":
      case "PoolReservesUpdated": await this._handlePoolEvent(name, args, ctx); break;
      // --- Protocol ---
      case "GlobalPaused": case "GlobalUnpaused":
      case "MarketPaused": case "MarketUnpaused":
      case "RoleGranted":  case "RoleRevoked":
      case "DiamondCut":   case "OwnershipTransferred":
      case "PricePosterAdded":   case "PricePosterRemoved":
      case "MaxPriceStalenessUpdated": case "VaultImplementationUpdated":
      case "ADLThresholdUpdated":      case "InsuranceWithdrawn":
      case "RobustnessParamsUpdated":
        await this._handleProtocolEvent(name, args, ctx); break;
      // --- V2 Keeper ---
      case "KeeperCycleExecuted":  await this._handleKeeperCycleExecuted(args, ctx); break;
      case "OrderExecutionFailed": await this._handleOrderExecutionFailed(args, ctx); break;
      case "LiquidationFailed":    await this._handleProtocolEvent(name, args, ctx); break;
      // --- V2 Account ---
      case "MarginLocked":
      case "MarginReleased":   await this._handleMarginEvent(name, args, ctx); break;
      case "LedgerEntryRecorded": await this._handleLedgerEntry(args, ctx); break;
      case "DelegateAdded":    await this._handleDelegateAdded(args, ctx); break;
      case "DelegateRemoved":  await this._handleDelegateRemoved(args, ctx); break;
      case "MarginModeChanged":  await this._handleMarginModeChanged(args, ctx); break;
      case "MarginTransferred":  await this._handleMarginTransferred(args, ctx); break;
      // --- V5 perps-only ---
      case "FeeCollected":              await this._handleFeeCollected(args, ctx); break;
      case "InsuranceContribution":     await this._handleInsuranceContribution(args, ctx); break;
      case "PositionFundingApplied":    await this._handlePositionFundingApplied(args, ctx); break;
      case "OpenInterestChanged":       await this._handleOpenInterestChanged(args, ctx); break;
      case "MarkPriceChanged":          await this._handleMarkPriceChanged(args, ctx); break;
      case "TradeSettled":              await this._handleTradeSettled(args, ctx); break;
      case "VaultBalanceChanged":       await this._handleVaultBalanceChanged(args, ctx); break;
      case "CollateralConfigChanged":   await this._handleCollateralConfigChanged(args, ctx); break;
      case "PositionEntryPriceChanged": await this._handlePositionEntryPriceChanged(args, ctx); break;
      case "MarketSnapshot":            await this._handleMarketSnapshot(args, ctx); break;
      case "ProtocolSnapshot":          await this._handleProtocolSnapshotEvent(args, ctx); break;
      default:
        this.logger.debug(`Unhandled event: ${name}`);
    }
  }

  // ── V1/V2 handlers ──────────────────────────────────────────

  async _handlePositionOpened(args, ctx) {
    const positionId = args[0].toString();
    const user = args[1]; const marketId = Number(args[2]); const isLong = args[3];
    const sizeUsd = args[4].toString(); const leverage = args[5].toString();
    const entryPrice = args[6].toString(); const collateralToken = args[7];
    const collateralAmount = args[8].toString();
    await models.insertPosition({ positionId, user, marketId, isLong, sizeUsd, leverage,
      entryPrice, collateralToken, collateralAmount, timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash });
    await models.insertTrade({ positionId, user, marketId, tradeType: "open", isLong,
      sizeUsd, price: entryPrice, realizedPnl: 0, blockNumber: ctx.blockNumber,
      txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
    this.logger.debug(`  Position opened: #${positionId} ${isLong?"LONG":"SHORT"} market=${marketId}`);
  }

  async _handlePositionModified(args, ctx) {
    await models.updatePositionModified({ positionId: args[0].toString(),
      newSizeUsd: args[1].toString(), newCollateralUsd: args[2].toString(),
      newCollateralAmount: args[3].toString() });
    await models.insertTrade({ positionId: args[0].toString(), user: null, marketId: null,
      tradeType: "modify", isLong: null, sizeUsd: args[1].toString(), price: "0",
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handlePositionClosed(args, ctx) {
    const positionId = args[0].toString(); const user = args[1]; const marketId = Number(args[2]);
    const closeSizeUsd = args[3].toString(); const exitPrice = args[4].toString();
    const realizedPnl = args[5].toString(); const isFullClose = args[6];
    if (isFullClose) await models.closePosition({ positionId, realizedPnl, exitPrice,
      isLiquidation: false, timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
    await models.insertTrade({ positionId, user, marketId,
      tradeType: isFullClose ? "close" : "partial_close",
      isLong: null, sizeUsd: closeSizeUsd, price: exitPrice, realizedPnl,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
    this.logger.debug(`  Position ${isFullClose?"closed":"partially closed"}: #${positionId} PnL=${realizedPnl}`);
  }

  async _handleOrderPlaced(args, ctx) {
    await models.insertOrder({ orderId: args[0].toString(), user: args[1],
      marketId: Number(args[2]), orderType: Number(args[3]), isLong: args[4],
      triggerPrice: args[5].toString(), sizeUsd: args[6].toString(),
      timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
  }

  async _handleOrderExecuted(args, ctx) {
    await models.executeOrder({ orderId: args[0].toString(), positionId: args[1].toString(),
      executionPrice: args[2].toString(), timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash });
  }

  async _handleOrderCancelled(args, ctx) {
    await models.cancelOrder({ orderId: args[0].toString(),
      timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
  }

  async _handleOrderExpired(args, ctx) {
    await models.expireOrder({ orderId: args[0].toString(),
      timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
    await models.insertProtocolEvent({ eventName: "OrderExpired",
      data: { orderId: args[0].toString(), user: args[1], marketId: Number(args[2]) },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleLiquidation(args, ctx) {
    const positionId = args[0].toString(); const user = args[1];
    const marketId = Number(args[2]); const price = args[3].toString();
    const penalty = args[4].toString(); const keeper = args[5];
    await models.insertLiquidation({ positionId, user, marketId, price, penalty, keeper,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, timestamp: ctx.timestamp });
    await models.closePosition({ positionId, realizedPnl: "0", exitPrice: price,
      isLiquidation: true, timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
    await models.insertTrade({ positionId, user, marketId, tradeType: "liquidation",
      isLong: null, sizeUsd: "0", price, realizedPnl: "0",
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
    this.logger.debug(`  Liquidation: #${positionId} by ${keeper}`);
  }

  async _handleADL(args, ctx) {
    await models.insertProtocolEvent({ eventName: "ADLExecuted",
      data: { positionId: args[0].toString(), deleveragedSizeUsd: args[1].toString() },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handlePricesUpdated(args, ctx) {
    const marketIds = args[0]; const prices = args[1]; const onchainTimestamp = Number(args[2]);
    const records = [];
    for (let i = 0; i < marketIds.length; i++) {
      records.push({ marketId: Number(marketIds[i]), price: prices[i].toString(),
        onchainTimestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash, blockTimestamp: ctx.timestamp });
    }
    await models.insertPriceUpdates(records);
  }

  async _handleFundingRateUpdated(args, ctx) {
    await models.insertFundingRate({ marketId: Number(args[0]),
      ratePerSecond: args[1].toString(), rate24h: args[2].toString(),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, timestamp: ctx.timestamp });
  }

  async _handleFundingSettled(args, ctx) {
    await models.insertProtocolEvent({ eventName: "FundingSettled",
      data: { marketId: Number(args[0]), fundingRate: args[1].toString(),
        longPayment: args[2].toString(), shortPayment: args[3].toString() },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleMarketCreated(args, ctx) {
    await models.upsertMarket({ marketId: Number(args[0]), name: args[1], symbol: args[2],
      maxLeverage: args[3].toString(), timestamp: ctx.timestamp,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash });
    this.logger.debug(`  Market created: [${args[0]}] ${args[2]}`);
  }

  async _handleMarketUpdated(args, ctx) {
    await models.insertProtocolEvent({ eventName: "MarketUpdated",
      data: { marketId: Number(args[0]) },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleFeesUpdated(args, ctx) {
    await models.upsertFeeConfig({ takerFeeBps: Number(args[0]), makerFeeBps: Number(args[1]),
      liquidationFeeBps: Number(args[2]), insuranceFeeBps: Number(args[3]), blockNumber: ctx.blockNumber });
  }

  async _handleVaultCreated(args, ctx) {
    await models.insertUserVault({ user: args[0], vault: args[1],
      timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
  }

  async _handleCollateralDeposited(args, ctx) {
    await models.insertVaultEvent({ eventType: "deposit", user: args[0], token: args[1],
      amount: args[2].toString(), blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleCollateralWithdrawn(args, ctx) {
    await models.insertVaultEvent({ eventType: "withdrawal", user: args[0], token: args[1],
      amount: args[2].toString(), blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleVaultFunded(args, ctx) {
    await models.insertVaultEvent({ eventType: "vault_funded", user: args[2], token: args[0],
      amount: args[1].toString(), blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleVaultDefunded(args, ctx) {
    await models.insertVaultEvent({ eventType: "vault_defunded", user: args[2], token: args[0],
      amount: args[1].toString(), blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleCollateralAdded(args, ctx) {
    await models.upsertCollateralToken({ token: args[0], decimals: Number(args[1]),
      timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
  }

  async _handlePoolEvent(name, args, ctx) {
    await models.upsertPoolState({ marketId: Number(args[0]), baseReserve: args[1].toString(),
      quoteReserve: args[2].toString(), oraclePrice: args.length > 3 ? args[3].toString() : "0",
      blockNumber: ctx.blockNumber });
  }

  async _handleProtocolEvent(name, args, ctx) {
    const data = {};
    for (let i = 0; i < args.length; i++) {
      const v = args[i];
      data[`arg${i}`] = typeof v === "bigint" ? v.toString() : v;
    }
    await models.insertProtocolEvent({ eventName: name, data,
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleKeeperCycleExecuted(args, ctx) {
    await models.insertKeeperCycle({ onchainTimestamp: Number(args[0]),
      marketsUpdated: Number(args[1]), ordersExecuted: Number(args[2]),
      liquidationsExecuted: Number(args[3]), ordersFailed: Number(args[4]),
      liquidationsFailed: Number(args[5]), blockNumber: ctx.blockNumber,
      txHash: ctx.txHash, timestamp: ctx.timestamp });
    this.logger.debug(`  KeeperCycle: markets=${args[1]} orders=${args[2]}/${args[4]} liqs=${args[3]}/${args[5]}`);
  }

  async _handleOrderExecutionFailed(args, ctx) {
    await models.setOrderFailed({ orderId: args[0].toString(), reason: args[1],
      timestamp: ctx.timestamp, blockNumber: ctx.blockNumber, txHash: ctx.txHash });
    await models.insertProtocolEvent({ eventName: "OrderExecutionFailed",
      data: { orderId: args[0].toString(), reason: args[1] },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleMarginEvent(name, args, ctx) {
    await models.insertTradingAccountEvent({
      eventType: name === "MarginLocked" ? "margin_locked" : "margin_released",
      user: args[0], positionId: args[1].toString(), token: args[2], amount: args[3].toString(),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleLedgerEntry(args, ctx) {
    await models.insertLedgerEntry({ entryId: args[0].toString(), user: args[1],
      entryType: Number(args[2]), token: args[3], amount: args[4].toString(),
      positionId: args[5].toString(), isDebit: args[6],
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, timestamp: ctx.timestamp });
  }

  async _handleDelegateAdded(args, ctx) {
    await models.upsertDelegate({ user: args[0], delegate: args[1], canTrade: args[2],
      canWithdraw: args[3], canModifyMargin: args[4], expiry: args[5].toString(),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, timestamp: ctx.timestamp });
  }

  async _handleDelegateRemoved(args, ctx) {
    await models.removeDelegate({ user: args[0], delegate: args[1],
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, timestamp: ctx.timestamp });
  }

  async _handleMarginModeChanged(args, ctx) {
    await models.updateMarginMode({ user: args[0], mode: Number(args[1]) });
    await models.insertTradingAccountEvent({ eventType: "margin_mode_changed",
      user: args[0], extraData: { newMode: Number(args[1]) },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleMarginTransferred(args, ctx) {
    await models.insertTradingAccountEvent({ eventType: "margin_transferred",
      user: args[0], positionId: args[1].toString(), token: args[3], amount: args[4].toString(),
      extraData: { fromPositionId: args[1].toString(), toPositionId: args[2].toString() },
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  // ── V5 handlers (perps only — no spot) ──────────────────────

  async _handleFeeCollected(args, ctx) {
    await models.insertFee({ positionId: args[0].toString(), user: args[1],
      marketId: Number(args[2]), feeType: Number(args[3]), feeUsd: args[4].toString(),
      feeTokens: args[5].toString(), token: args[6],
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleInsuranceContribution(args, ctx) {
    await models.insertInsuranceContribution({ token: args[0], amount: args[1].toString(),
      source: Number(args[2]), blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handlePositionFundingApplied(args, ctx) {
    await models.insertFundingPayment({ positionId: args[0].toString(), user: args[1],
      marketId: Number(args[2]), fundingPaymentUsd: args[3].toString(),
      newCollateralUsd: args[4].toString(), newCollateralAmount: args[5].toString(),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleOpenInterestChanged(args, ctx) {
    await models.insertOiSnapshot({ marketId: Number(args[0]),
      longOI: args[1].toString(), shortOI: args[2].toString(), deltaUsd: args[3].toString(),
      isIncrease: args[4], blockNumber: ctx.blockNumber, txHash: ctx.txHash,
      logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleMarkPriceChanged(args, ctx) {
    await models.insertMarkPriceHistory({ marketId: Number(args[0]),
      markPrice: args[1].toString(), indexPrice: args[2].toString(),
      baseReserve: args[3].toString(), quoteReserve: args[4].toString(),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
    await models.upsertPoolState({ marketId: Number(args[0]),
      baseReserve: args[3].toString(), quoteReserve: args[4].toString(),
      oraclePrice: args[2].toString(), blockNumber: ctx.blockNumber });
  }

  async _handleTradeSettled(args, ctx) {
    await models.insertTradeSettlement({ positionId: args[0].toString(), user: args[1],
      marketId: Number(args[2]), tradeType: Number(args[3]), sizeUsd: args[4].toString(),
      executionPrice: args[5].toString(), grossPnl: args[6].toString(),
      totalFeesUsd: args[7].toString(), borrowingFeeUsd: args[8].toString(),
      fundingPaidUsd: args[9].toString(), netPayoutTokens: args[10].toString(),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleVaultBalanceChanged(args, ctx) {
    await models.insertVaultBalanceHistory({ token: args[0], vaultType: Number(args[1]),
      newBalance: args[2].toString(), delta: args[3].toString(), isIncrease: args[4],
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleCollateralConfigChanged(args, ctx) {
    await models.insertCollateralConfigChange({ token: args[0], decimals: Number(args[1]),
      accepted: args[2], isSpot: args[3],
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handlePositionEntryPriceChanged(args, ctx) {
    await models.insertEntryPriceChange({ positionId: args[0].toString(),
      oldEntryPrice: args[1].toString(), newEntryPrice: args[2].toString(),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleMarketSnapshot(args, ctx) {
    await models.insertMarketSnapshot({ marketId: Number(args[0]),
      longOI: args[1].toString(), shortOI: args[2].toString(),
      markPrice: args[3].toString(), indexPrice: args[4].toString(),
      fundingRatePerSecond: args[5].toString(), fundingRate24h: args[6].toString(),
      volume24hUsd: args[7].toString(), onchainTimestamp: Number(args[8]),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }

  async _handleProtocolSnapshotEvent(args, ctx) {
    await models.insertProtocolSnapshot({ totalPositions: args[0].toString(),
      totalOpenPositions: args[1].toString(), totalMarkets: args[2].toString(),
      tvlUsd: args[3].toString(), insuranceTotalUsd: args[4].toString(),
      onchainTimestamp: Number(args[5]),
      blockNumber: ctx.blockNumber, txHash: ctx.txHash, logIndex: ctx.logIndex, timestamp: ctx.timestamp });
  }
}

module.exports = { Scanner };
