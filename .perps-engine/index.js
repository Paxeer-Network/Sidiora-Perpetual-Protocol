#!/usr/bin/env node

const { MARKETS, CONFIG, COMBINED_ABI } = require("./config");
const { OrderlyFetcher } = require("./src/price-sources/orderly-fetcher");
const { CustomFetcher } = require("./src/price-sources/custom-fetcher");
const { OrderScanner } = require("./src/scanners/order-scanner");
const { LiquidationScanner } = require("./src/scanners/liquidation-scanner");
const { CycleBuilder } = require("./src/cycle-builder");
const { Submitter } = require("./src/submitter");
const { StateCache } = require("./src/state-cache");
const { HealthMonitor } = require("./src/health-monitor");
const { createLogger } = require("./src/logger");
const fs = require("fs");
const path = require("path");

/**
 * PPMM Perps Engine — Unified Oracle + Keeper
 *
 * Every ~3 seconds:
 *   1. Fetch prices from Orderly (crypto/stocks) + custom feeds (SID/PAX)
 *   2. Scan cached orders for trigger conditions
 *   3. Scan cached positions for liquidation conditions
 *   4. Submit executeCycle() or executePriceCycle() — single atomic tx
 *   5. Refresh order/position cache from indexer (every 30s)
 *
 * Usage:
 *   node index.js             # Normal mode
 *   node index.js --verbose   # Debug logging
 */

async function main() {
  const verbose = process.argv.includes("--verbose");
  const logger = createLogger(verbose ? "debug" : CONFIG.logLevel);

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Banner
  logger.info("================================================================");
  logger.info("  PPMM Perps Engine — Unified Oracle + Keeper");
  logger.info("================================================================");

  // Validate config
  if (!CONFIG.privateKey) {
    logger.error("ORACLE_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  logger.info(`  Orderly endpoint: ${CONFIG.orderlyBaseUrl}`);
  logger.info(`  RPC:              ${CONFIG.rpcUrl}`);
  logger.info(`  Diamond:          ${CONFIG.diamondAddress}`);
  logger.info(`  Indexer:          ${CONFIG.indexerUrl}`);
  logger.info(`  Cycle interval:   ${CONFIG.cycleIntervalMs}ms`);
  logger.info(`  Markets (${MARKETS.length}):   ${MARKETS.map((m) => m.symbol).join(", ")}`);
  logger.info("");

  // ── Initialize components ──────────────────────────────────

  const submitter = new Submitter(CONFIG, COMBINED_ABI, logger);
  const stateCache = new StateCache(CONFIG, submitter, MARKETS, logger);
  const healthMonitor = new HealthMonitor(CONFIG, submitter, logger);
  const orderlyMarkets = MARKETS.filter((m) => m.source === "orderly");
  const customMarkets = MARKETS.filter((m) => m.source === "custom");
  const orderlyFetcher = new OrderlyFetcher(CONFIG.orderlyBaseUrl, orderlyMarkets, logger);
  const customFetcher = customMarkets.length > 0 ? new CustomFetcher(customMarkets, logger) : null;
  const orderScanner = new OrderScanner(stateCache, logger);
  const liquidationScanner = new LiquidationScanner(stateCache, logger);
  const cycleBuilder = new CycleBuilder(logger);

  logger.info("");

  // ── Startup diagnostics ──────────────────────────────────

  logger.info("Running startup diagnostics...");
  const diagnostics = await healthMonitor.runStartupDiagnostics();

  if (!diagnostics.healthy) {
    logger.warn(`  Startup issues: ${diagnostics.issues.join("; ")}`);
  }
  logger.info("");

  // ── Load initial state ─────────────────────────────────────

  logger.info("Loading initial state...");

  await stateCache.refreshMarketConfigs();
  stateCache.lastOrderRefresh = 0;
  stateCache.lastPositionRefresh = 0;
  await stateCache.refreshOrders();
  await stateCache.refreshPositions();
  await stateCache.refreshFundingStates();

  logger.info("");

  // ── Graceful shutdown ──────────────────────────────────────

  let running = true;
  const shutdown = (signal) => {
    logger.info(`\n${signal} received — shutting down gracefully...`);
    running = false;
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // ── Main loop ──────────────────────────────────────────────

  let cycleCount = 0;

  logger.info("Starting engine loop...\n");

  while (running) {
    cycleCount++;
    const cycleStart = Date.now();

    try {
      await Promise.race([
        (async () => {

      logger.info(`── Cycle ${cycleCount} ──────────────────────────────────────`);

      // --- 1. Fetch prices from all sources in parallel ---
      const fetchPromises = [
        orderlyFetcher.fetchPrices().catch((err) => {
          logger.error(`  [Cycle ${cycleCount}] Orderly fetch error: ${err.message}`);
          return [];
        }),
      ];

      if (customFetcher) {
        fetchPromises.push(
          customFetcher.fetchPrices().catch((err) => {
            logger.error(`  [Cycle ${cycleCount}] Custom fetch error: ${err.message}`);
            return [];
          })
        );
      }

      const [orderlyPrices, customPrices = []] = await Promise.all(fetchPromises);
      const allPrices = [...orderlyPrices, ...customPrices];

      if (allPrices.length === 0) {
        logger.warn(`  [Cycle ${cycleCount}] No prices fetched — skipping`);
        return; // exit IIFE
      }

      if (orderlyPrices.length > 0) {
        const str = orderlyPrices.map((p) => `${p.symbol}=$${p.rawPrice.toFixed(2)}`).join(" | ");
        logger.info(`  Orderly (${orderlyPrices.length}): ${str}`);
      }
      if (customPrices.length > 0) {
        const str = customPrices.map((p) => `${p.symbol}=$${p.rawPrice.toFixed(2)}`).join(" | ");
        logger.info(`  Custom (${customPrices.length}): ${str}`);
      }

      // --- 2. Update price cache ---
      const priceMap = stateCache.updatePrices(allPrices);

      // --- 3. Scan orders for triggers ---
      const triggeredOrderIds = orderScanner.scan(priceMap);

      // --- 4. Scan positions for liquidation ---
      const liquidatableIds = liquidationScanner.scan(priceMap);

      // --- 5. Build and submit cycle ---
      const cycle = cycleBuilder.buildFullCycle(allPrices, triggeredOrderIds, liquidatableIds);
      let result;
      let fullCycleSucceeded = false;

      if (cycle.isFullCycle) {
        logger.info(
          `  Submitting executeCycle: ${cycle.marketIds.length} markets, ` +
          `${cycle.orderIds.length} orders, ${cycle.liquidationIds.length} liquidations`
        );
        result = await submitter.submitFullCycle(
          cycle.marketIds,
          cycle.prices,
          cycle.orderIds,
          cycle.liquidationIds
        );

        if (result.success) {
          fullCycleSucceeded = true;
        } else {
          logger.warn(
            `  [Cycle ${cycleCount}] executeCycle failed, falling back to executePriceCycle so prices still update on-chain`
          );
          const priceFallback = await submitter.submitPriceCycle(cycle.marketIds, cycle.prices);
          if (priceFallback.success) {
            logger.info(`  [Cycle ${cycleCount}] Price fallback succeeded: ${priceFallback.txHash}`);
          } else {
            logger.error(`  [Cycle ${cycleCount}] Price fallback failed: ${priceFallback.error}`);
          }
          result = priceFallback;
        }
      } else {
        logger.debug(`  Submitting executePriceCycle: ${cycle.marketIds.length} markets`);
        result = await submitter.submitPriceCycle(cycle.marketIds, cycle.prices);
      }

      if (result.success) {
        // Track submitted prices for deviation detection
        for (const p of allPrices) {
          submitter.submittedPrices.set(p.symbol, p.price);
        }

        // Remove executed orders/liquidations only when full executeCycle succeeds.
        // Price-only fallback updates prices/funding but does not execute orders/liquidations.
        if (fullCycleSucceeded) {
          for (const id of triggeredOrderIds) {
            stateCache.removeOrder(id);
          }
          for (const id of liquidatableIds) {
            stateCache.removePosition(id);
          }
        }
      } else {
        logger.error(`  [Cycle ${cycleCount}] Submission failed: ${result.error}`);
      }

      // --- 6. Health check ---
      await healthMonitor.checkAfterCycle(result);

      // --- 7. Periodic cache refresh ---
      await stateCache.refreshOrders();
      await stateCache.refreshPositions();
      await stateCache.refreshFundingStates();
      await stateCache.checkIndexerHealth();

      // Refresh market configs very infrequently
      await stateCache.refreshMarketConfigs();

      // --- 8. Periodic status log ---
      if (cycleCount % 50 === 0) {
        const stats = submitter.getStats();
        const bal = healthMonitor.getLastBalance() || await submitter.getBalance().catch(() => "?");
        logger.info("── Status ──────────────────────────────────────────");
        logger.info(`  Cycles: ${cycleCount} | Full: ${stats.fullCycles} | Price-only: ${stats.priceCycles}`);
        logger.info(`  Failures: ${stats.totalFailures} (consecutive: ${stats.consecutiveFailures})`);
        logger.info(`  Balance: ${bal} PAX | Last TX: ${stats.lastTxHash || "none"}`);
        logger.info(`  Orders in cache: ${stateCache.activeOrders.size} | Positions: ${stateCache.activePositions.size}`);

        const os = orderScanner.getStats();
        const ls = liquidationScanner.getStats();
        logger.info(`  [Orders] scans=${os.scansPerformed} triggered=${os.ordersTriggered}`);
        logger.info(`  [Liquidations] scans=${ls.scansPerformed} checked=${ls.positionsChecked} triggered=${ls.liquidationsTriggered}`);
        logger.info("────────────────────────────────────────────────────");
      }

        })(), // end async IIFE
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("cycle timeout")), CONFIG.cycleTimeoutMs)
        ),
      ]); // end Promise.race

    } catch (error) {
      if (error.message === "cycle timeout") {
        logger.error(`  [Cycle ${cycleCount}] TIMED OUT after ${CONFIG.cycleTimeoutMs / 1000}s — skipping`);
      } else {
        logger.error(`  [Cycle ${cycleCount}] Unhandled error: ${error.message}`);
        logger.debug(error.stack);
      }
    }

    // --- Wait for next cycle ---
    const elapsed = Date.now() - cycleStart;
    const waitTime = Math.max(0, CONFIG.cycleIntervalMs - elapsed);

    if (waitTime > 0 && running) {
      await sleep(waitTime);
    }
  }

  // ── Shutdown summary ───────────────────────────────────────

  const stats = submitter.getStats();
  logger.info("");
  logger.info("================================================================");
  logger.info("  Perps Engine Stopped");
  logger.info("================================================================");
  logger.info(`  Total cycles:      ${cycleCount}`);
  logger.info(`  Full cycles:       ${stats.fullCycles}`);
  logger.info(`  Price-only cycles: ${stats.priceCycles}`);
  logger.info(`  Total failures:    ${stats.totalFailures}`);
  logger.info(`  Last TX:           ${stats.lastTxHash || "none"}`);
  logger.info("================================================================\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
