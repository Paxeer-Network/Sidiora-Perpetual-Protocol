#!/usr/bin/env node

const { MARKETS, PYTH_MARKETS, ORDERLY_MARKETS, CONFIG, ORACLE_ABI } = require("./config");
const { PythFetcher } = require("./src/pyth-fetcher");
const { OrderlyFetcher } = require("./src/orderly-fetcher");
const { OnChainSubmitter } = require("./src/submitter");
const { createLogger } = require("./src/logger");
const fs = require("fs");
const path = require("path");

/**
 * PPMM Oracle Node
 *
 * Continuously fetches prices from multiple sources and submits
 * them to the OracleFacet on the PPMM Diamond via batchUpdatePrices().
 *
 * Price sources:
 *   - Pyth Network (Hermes)  → crypto markets (BTC, ETH, SOL, AVAX, LINK)
 *   - Orderly Network (REST) → stocks, indices, commodities (TSLA, NVDA, NAS100, XAU, SPX500, GOOGL)
 *
 * Features:
 *   - Configurable update interval (default 5s)
 *   - Deviation-triggered immediate updates
 *   - Automatic retry with backoff
 *   - Consecutive failure alerting
 *   - Structured logging to console + file
 *   - Graceful shutdown (SIGINT/SIGTERM)
 *
 * Usage:
 *   node index.js             # Normal mode
 *   node index.js --verbose   # Debug logging
 */

// ============================================================
//  MAIN
// ============================================================

async function main() {
  const verbose = process.argv.includes("--verbose");
  const logger = createLogger(verbose);

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Banner
  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  PPMM Oracle Node — Multi-Source → OracleFacet");
  logger.info("═══════════════════════════════════════════════════════");

  // Validate config
  if (!CONFIG.privateKey) {
    logger.error("ORACLE_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  logger.info(`  Pyth endpoint:    ${CONFIG.pythHermesUrl}`);
  logger.info(`  Orderly endpoint: ${CONFIG.orderlyBaseUrl}`);
  logger.info(`  RPC:              ${CONFIG.rpcUrl}`);
  logger.info(`  Diamond:          ${CONFIG.diamondAddress}`);
  logger.info(`  Update interval:  ${CONFIG.updateIntervalMs}ms`);
  logger.info(`  Deviation trigger: ${CONFIG.deviationThresholdPct}%`);
  logger.info(`  Pyth markets:     ${PYTH_MARKETS.map((m) => m.symbol).join(", ")}`);
  logger.info(`  Orderly markets:  ${ORDERLY_MARKETS.map((m) => m.symbol).join(", ")}`);
  logger.info(`  Total markets:    ${MARKETS.length}`);
  logger.info("");

  // Initialize components
  const pythFetcher = new PythFetcher(CONFIG.pythHermesUrl, PYTH_MARKETS, logger);
  const orderlyFetcher = ORDERLY_MARKETS.length > 0
    ? new OrderlyFetcher(CONFIG.orderlyBaseUrl, ORDERLY_MARKETS, logger)
    : null;
  const submitter = new OnChainSubmitter(CONFIG, ORACLE_ABI, logger);

  // Check wallet balance
  const balance = await submitter.getBalance();
  logger.info(`  Wallet balance:   ${balance} ETH`);

  if (parseFloat(balance) < 0.01) {
    logger.warn("  ⚠ Low wallet balance! May run out of gas soon.");
  }
  logger.info("");

  // Graceful shutdown
  let running = true;
  const shutdown = (signal) => {
    logger.info(`\n${signal} received — shutting down gracefully...`);
    running = false;
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // ============================================================
  //  MAIN LOOP
  // ============================================================

  let cycleCount = 0;

  logger.info("Starting oracle loop...\n");

  const CYCLE_TIMEOUT_MS = 90_000; // 90s max per cycle

  while (running) {
    cycleCount++;
    const cycleStart = Date.now();

    try {
      // Wrap entire cycle in a timeout to recover from any hung call
      await Promise.race([
        (async () => {

      // --- 1. Fetch prices from all sources in parallel ---
      logger.debug(`[Cycle ${cycleCount}] Fetching prices...`);

      const fetchPromises = [
        pythFetcher.fetchPrices().catch((err) => {
          logger.error(`[Cycle ${cycleCount}] Pyth fetch error: ${err.message}`);
          return [];
        }),
      ];

      if (orderlyFetcher) {
        fetchPromises.push(
          orderlyFetcher.fetchPrices().catch((err) => {
            logger.error(`[Cycle ${cycleCount}] Orderly fetch error: ${err.message}`);
            return [];
          })
        );
      }

      const [pythPrices, orderlyPrices = []] = await Promise.all(fetchPromises);
      const prices = [...pythPrices, ...orderlyPrices];

      if (prices.length === 0) {
        logger.warn(`[Cycle ${cycleCount}] No prices fetched, skipping`);
        return; // exit IIFE, skip rest of cycle
      }

      // Log prices by source
      if (pythPrices.length > 0) {
        const pythStr = pythPrices
          .map((p) => `${p.symbol}=$${p.rawPrice.toFixed(2)}`)
          .join(" | ");
        logger.info(`[Cycle ${cycleCount}] Pyth (${pythPrices.length}): ${pythStr}`);
      }
      if (orderlyPrices.length > 0) {
        const orderlyStr = orderlyPrices
          .map((p) => `${p.symbol}=$${p.rawPrice.toFixed(2)}`)
          .join(" | ");
        logger.info(`[Cycle ${cycleCount}] Orderly (${orderlyPrices.length}): ${orderlyStr}`);
      }

      // --- 2. Check deviation from last submission ---
      const hasPythDeviation = pythFetcher.hasSignificantDeviation(
        submitter.submittedPrices,
        CONFIG.deviationThresholdPct
      );
      const hasOrderlyDeviation = orderlyFetcher
        ? orderlyFetcher.hasSignificantDeviation(
            submitter.submittedPrices,
            CONFIG.deviationThresholdPct
          )
        : false;
      const hasDeviation = hasPythDeviation || hasOrderlyDeviation;

      if (cycleCount > 1 && !hasDeviation) {
        logger.debug(`[Cycle ${cycleCount}] No significant deviation, submitting anyway on interval`);
      }

      // --- 3. Submit on-chain ---
      logger.debug(`[Cycle ${cycleCount}] Submitting ${prices.length} prices on-chain...`);
      const result = await submitter.submitPrices(prices);

      if (!result.success) {
        logger.error(`[Cycle ${cycleCount}] Submission failed: ${result.error}`);
      }

      // --- 4. Periodic status log every 100 cycles ---
      if (cycleCount % 100 === 0) {
        const stats = submitter.getStats();
        const bal = await submitter.getBalance();
        logger.info("─── Status ─────────────────────────────────────");
        logger.info(`  Cycles: ${cycleCount} | Submissions: ${stats.totalSubmissions} | Failures: ${stats.totalFailures}`);
        logger.info(`  Balance: ${bal} ETH | Last TX: ${stats.lastTxHash || "none"}`);
        logger.info("────────────────────────────────────────────────");
      }

        })(), // end async IIFE
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('cycle timeout')), CYCLE_TIMEOUT_MS)
        ),
      ]); // end Promise.race

    } catch (error) {
      if (error.message === 'cycle timeout') {
        logger.error(`[Cycle ${cycleCount}] ⚠ CYCLE TIMED OUT after ${CYCLE_TIMEOUT_MS / 1000}s — skipping to next`);
      } else {
        logger.error(`[Cycle ${cycleCount}] Unhandled error: ${error.message}`);
        logger.debug(error.stack);
      }
    }

    // --- 5. Wait for next cycle ---
    const elapsed = Date.now() - cycleStart;
    const waitTime = Math.max(0, CONFIG.updateIntervalMs - elapsed);

    if (waitTime > 0 && running) {
      await sleep(waitTime);
    }
  }

  // Shutdown summary
  const stats = submitter.getStats();
  logger.info("");
  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  Oracle Node Stopped");
  logger.info("═══════════════════════════════════════════════════════");
  logger.info(`  Total cycles:      ${cycleCount}`);
  logger.info(`  Total submissions: ${stats.totalSubmissions}`);
  logger.info(`  Total failures:    ${stats.totalFailures}`);
  logger.info(`  Last TX:           ${stats.lastTxHash || "none"}`);
  logger.info("═══════════════════════════════════════════════════════\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
//  RUN
// ============================================================

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
