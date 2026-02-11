#!/usr/bin/env node

const { ethers } = require("ethers");
const { MARKETS, CONFIG, COMBINED_ABI } = require("./config");
const { Executor } = require("./src/executor");
const { StateCache } = require("./src/state-cache");
const { EventListener } = require("./src/event-listener");
const { OrderScanner } = require("./src/order-scanner");
const { LiquidationScanner } = require("./src/liquidation-scanner");
const { VammSyncer } = require("./src/vamm-syncer");
const { createLogger } = require("./src/logger");
const fs = require("fs");
const path = require("path");

/**
 * PPMM Keeper Node
 *
 * Monitors on-chain state and executes keeper duties:
 *   1. Order execution — triggers limit/stop-limit orders when price conditions are met
 *   2. Liquidation — liquidates undercollateralized positions (earns keeper reward)
 *   3. vAMM sync — syncs virtual AMM reserves toward oracle price
 *
 * Driven by PricesUpdated events from the oracle node.
 * Falls back to polling if events are missed.
 *
 * Usage:
 *   node index.js                     # Full keeper (all modules)
 *   node index.js --verbose           # Debug logging
 *   node index.js --orders-only       # Only order execution
 *   node index.js --liquidations-only # Only liquidation scanning
 */

// ============================================================
//  PARSE CLI FLAGS
// ============================================================

const verbose = process.argv.includes("--verbose");
const ordersOnly = process.argv.includes("--orders-only");
const liquidationsOnly = process.argv.includes("--liquidations-only");

const enableOrders = !liquidationsOnly;
const enableLiquidations = !ordersOnly;
const enableVammSync = !ordersOnly && !liquidationsOnly;

// ============================================================
//  MAIN
// ============================================================

async function main() {
  const logger = createLogger(verbose);

  // Ensure logs directory
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Banner
  logger.info("================================================================");
  logger.info("  PPMM Keeper Node");
  logger.info("================================================================");

  // Validate config
  if (!CONFIG.privateKey) {
    logger.error("KEEPER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const modules = [];
  if (enableOrders) modules.push("Orders");
  if (enableLiquidations) modules.push("Liquidations");
  if (enableVammSync) modules.push("vAMM Sync");

  logger.info(`  RPC:              ${CONFIG.rpcUrl}`);
  logger.info(`  Diamond:          ${CONFIG.diamondAddress}`);
  logger.info(`  Indexer:          ${CONFIG.indexerUrl}`);
  logger.info(`  Modules:          ${modules.join(", ")}`);
  logger.info(`  Markets:          ${MARKETS.map((m) => m.symbol).join(", ")}`);
  logger.info(`  Fallback poll:    ${CONFIG.fallbackPollMs}ms`);
  logger.info("");

  // ── Initialize components ──────────────────────────────────

  const executor = new Executor(CONFIG, COMBINED_ABI, logger);
  const stateCache = new StateCache(CONFIG, executor, MARKETS, logger);
  const eventListener = new EventListener(CONFIG, COMBINED_ABI, logger);

  const orderScanner = enableOrders
    ? new OrderScanner(stateCache, executor, logger)
    : null;
  const liquidationScanner = enableLiquidations
    ? new LiquidationScanner(stateCache, executor, logger)
    : null;
  const vammSyncer = enableVammSync
    ? new VammSyncer(MARKETS, executor, logger)
    : null;

  // ── Check wallet ───────────────────────────────────────────

  const balance = await executor.getBalance();
  logger.info(`  Wallet balance:   ${balance} PAX`);

  if (parseFloat(balance) < CONFIG.minWalletBalanceEth) {
    logger.warn(
      `  LOW BALANCE! Minimum recommended: ${CONFIG.minWalletBalanceEth} PAX`
    );
  }
  logger.info("");

  // ── Startup diagnostics ────────────────────────────────────

  logger.info("Running startup diagnostics...");

  // Check KEEPER_ROLE
  const KEEPER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("KEEPER"));
  try {
    const hasKeeper = await executor.hasRole(KEEPER_ROLE, executor.wallet.address);
    if (hasKeeper) {
      logger.info(`  KEEPER_ROLE:      GRANTED`);
    } else {
      logger.warn(`  KEEPER_ROLE:      NOT GRANTED`);
      logger.warn(`  executeOrder() and syncToOracle() will revert!`);
      logger.warn(`  Grant role: diamond.grantRole(${KEEPER_ROLE}, "${executor.wallet.address}")`);
    }
  } catch (err) {
    logger.warn(`  KEEPER_ROLE check failed: ${err.message}`);
  }

  // Check pool initialization for each market
  for (const m of MARKETS) {
    try {
      const pool = await executor.getPool(m.marketId);
      if (pool.baseReserve === 0n) {
        logger.warn(`  Pool ${m.symbol} (id=${m.marketId}): NOT INITIALIZED`);
      } else {
        logger.info(`  Pool ${m.symbol} (id=${m.marketId}): OK (damping=${pool.dampingFactor}bps)`);
      }
    } catch (err) {
      logger.warn(`  Pool ${m.symbol} (id=${m.marketId}): query failed — ${err.message}`);
    }
  }

  logger.info("");

  // ── Load initial state ─────────────────────────────────────

  logger.info("Loading initial state...");

  await stateCache.refreshMarketConfigs();
  await stateCache.refreshPrices();

  if (enableOrders) {
    // Force initial order refresh regardless of interval
    stateCache.lastOrderRefresh = 0;
    await stateCache.refreshOrders();
  }

  if (enableLiquidations) {
    // Force initial position refresh regardless of interval
    stateCache.lastPositionRefresh = 0;
    await stateCache.refreshPositions();
  }

  logger.info("");

  // ── Execution cycle ────────────────────────────────────────

  let cycleCount = 0;
  let cycleBusy = false;

  /**
   * Core execution cycle — runs after each price update.
   * Guarded by a mutex to prevent overlapping cycles.
   * @param {number[]} marketIds - Markets that received new prices
   * @param {bigint[]} prices - New prices (18 dec)
   */
  async function executionCycle(marketIds, prices) {
    if (cycleBusy) {
      logger.debug("  Cycle skipped (previous cycle still running)");
      return;
    }
    cycleBusy = true;

    cycleCount++;
    const cycleStart = Date.now();

    logger.info(
      `── Cycle ${cycleCount} ──────────────────────────────────────`
    );

    // Update price cache with the event data
    for (let i = 0; i < marketIds.length; i++) {
      const mid = marketIds[i];
      stateCache.prices.set(mid, {
        price: prices[i],
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      });
    }

    // Log current prices
    const priceStr = marketIds
      .map((mid, i) => {
        const sym = MARKETS.find((m) => m.marketId === mid)?.symbol || mid;
        const usd = Number(prices[i] / 10n ** 14n) / 10000;
        return `${sym}=$${usd.toFixed(2)}`;
      })
      .join(" | ");
    logger.info(`  Prices: ${priceStr}`);

    try {
      // 1. vAMM Sync (do first so mark price is updated for funding calculations)
      if (vammSyncer) {
        await vammSyncer.syncAll(marketIds);
      }

      // 2. Order execution
      if (orderScanner) {
        await orderScanner.scan(marketIds);
      }

      // 3. Liquidation scan
      if (liquidationScanner) {
        await liquidationScanner.scan(marketIds);
      }
    } catch (err) {
      logger.error(`  Cycle ${cycleCount} error: ${err.message}`);
      logger.debug(err.stack);
    }

    const elapsed = Date.now() - cycleStart;
    logger.info(`  Cycle ${cycleCount} completed in ${elapsed}ms`);

    cycleBusy = false;
  }

  // ── Register event listener ────────────────────────────────

  eventListener.onPriceUpdate(async (marketIds, prices) => {
    await executionCycle(marketIds, prices);
  });

  // ── Periodic state refresh ─────────────────────────────────

  let running = true;

  const refreshInterval = setInterval(async () => {
    if (!running) return;

    try {
      // Refresh order and position caches periodically
      if (enableOrders) await stateCache.refreshOrders();
      if (enableLiquidations) await stateCache.refreshPositions();

      // Re-check indexer health
      await stateCache.checkIndexerHealth();

      // Refresh market configs (very infrequently)
      await stateCache.refreshMarketConfigs();

      // Re-check pool initialization in case admin initializes new pools
      if (vammSyncer) vammSyncer.resetPoolChecks();
    } catch (err) {
      logger.warn(`  Refresh cycle error: ${err.message}`);
    }
  }, Math.min(CONFIG.orderRefreshMs, CONFIG.positionRefreshMs));

  // ── Fallback poll cycle ────────────────────────────────────
  // In case PricesUpdated events are missed, poll prices directly

  const fallbackInterval = setInterval(async () => {
    if (!running) return;

    try {
      // Fetch all prices from chain
      const marketIds = [];
      const prices = [];

      for (const m of MARKETS) {
        const data = await executor.getPrice(m.marketId);
        if (data.price > 0n) {
          marketIds.push(m.marketId);
          prices.push(data.price);
        }
      }

      if (marketIds.length > 0) {
        // Check if prices have changed since last cycle
        let changed = false;
        for (let i = 0; i < marketIds.length; i++) {
          const cached = stateCache.getPrice(marketIds[i]);
          if (!cached || cached !== prices[i]) {
            changed = true;
            break;
          }
        }

        if (changed) {
          logger.debug("  [Fallback] Price change detected via polling");
          await executionCycle(marketIds, prices);
        }
      }
    } catch (err) {
      logger.debug(`  [Fallback] Poll error: ${err.message}`);
    }
  }, CONFIG.fallbackPollMs);

  // ── Status reporting ───────────────────────────────────────

  const statusInterval = setInterval(async () => {
    if (!running) return;

    const execStats = executor.getStats();
    const bal = await executor.getBalance().catch(() => "?");

    logger.info("── Status ──────────────────────────────────────────");
    logger.info(`  Cycles: ${cycleCount} | Balance: ${bal} PAX`);
    logger.info(
      `  Orders executed: ${execStats.ordersExecuted} | Liquidations: ${execStats.liquidationsExecuted} | vAMM syncs: ${execStats.vammSyncs}`
    );
    logger.info(
      `  Failures: ${execStats.totalFailures} (consecutive: ${execStats.consecutiveFailures})`
    );

    if (orderScanner) {
      const os = orderScanner.getStats();
      logger.info(
        `  [Orders] scans=${os.scansPerformed} triggered=${os.ordersTriggered} executed=${os.ordersExecuted} failed=${os.ordersFailed}`
      );
      logger.info(`  [Orders] active in cache: ${stateCache.activeOrders.size}`);
    }

    if (liquidationScanner) {
      const ls = liquidationScanner.getStats();
      logger.info(
        `  [Liquidations] scans=${ls.scansPerformed} checked=${ls.positionsChecked} triggered=${ls.liquidationsTriggered} executed=${ls.liquidationsExecuted}`
      );
      logger.info(
        `  [Liquidations] positions in cache: ${stateCache.activePositions.size}`
      );
    }

    if (vammSyncer) {
      const vs = vammSyncer.getStats();
      logger.info(
        `  [vAMM] cycles=${vs.syncCycles} succeeded=${vs.syncsSucceeded} failed=${vs.syncsFailed}`
      );
    }

    logger.info(`  Last TX: ${execStats.lastTxHash || "none"}`);
    logger.info("────────────────────────────────────────────────────");

    // Wallet balance warning
    if (parseFloat(bal) < CONFIG.minWalletBalanceEth) {
      logger.warn(`  LOW BALANCE: ${bal} PAX. Refill keeper wallet!`);
    }
  }, 300000); // Every 5 minutes

  // ── Graceful shutdown ──────────────────────────────────────

  const shutdown = (signal) => {
    logger.info(`\n${signal} received — shutting down gracefully...`);
    running = false;

    eventListener.stop();
    clearInterval(refreshInterval);
    clearInterval(fallbackInterval);
    clearInterval(statusInterval);

    // Final stats
    const execStats = executor.getStats();

    logger.info("");
    logger.info("================================================================");
    logger.info("  Keeper Node Stopped");
    logger.info("================================================================");
    logger.info(`  Total cycles:        ${cycleCount}`);
    logger.info(`  Orders executed:     ${execStats.ordersExecuted}`);
    logger.info(`  Liquidations:        ${execStats.liquidationsExecuted}`);
    logger.info(`  vAMM syncs:          ${execStats.vammSyncs}`);
    logger.info(`  Total failures:      ${execStats.totalFailures}`);
    logger.info(`  Last TX:             ${execStats.lastTxHash || "none"}`);
    logger.info("================================================================\n");

    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // ── Start ──────────────────────────────────────────────────

  logger.info("Starting keeper...\n");
  await eventListener.start();

  // Keep process alive
  await new Promise(() => {});
}

// ============================================================
//  RUN
// ============================================================

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
