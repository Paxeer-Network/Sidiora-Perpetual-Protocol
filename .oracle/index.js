#!/usr/bin/env node

const { MARKETS, CONFIG, ORACLE_ABI } = require("./config");
const { PythFetcher } = require("./src/pyth-fetcher");
const { OnChainSubmitter } = require("./src/submitter");
const { createLogger } = require("./src/logger");
const fs = require("fs");
const path = require("path");

/**
 * PPMM Oracle Node
 *
 * Continuously fetches prices from Pyth Network (Hermes) and submits
 * them to the OracleFacet on the PPMM Diamond via batchUpdatePrices().
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
  logger.info("  PPMM Oracle Node — Pyth → OracleFacet");
  logger.info("═══════════════════════════════════════════════════════");

  // Validate config
  if (!CONFIG.privateKey) {
    logger.error("ORACLE_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  logger.info(`  Pyth endpoint:    ${CONFIG.pythHermesUrl}`);
  logger.info(`  RPC:              ${CONFIG.rpcUrl}`);
  logger.info(`  Diamond:          ${CONFIG.diamondAddress}`);
  logger.info(`  Update interval:  ${CONFIG.updateIntervalMs}ms`);
  logger.info(`  Deviation trigger: ${CONFIG.deviationThresholdPct}%`);
  logger.info(`  Markets:          ${MARKETS.map((m) => m.symbol).join(", ")}`);
  logger.info("");

  // Initialize components
  const fetcher = new PythFetcher(CONFIG.pythHermesUrl, MARKETS, logger);
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

  while (running) {
    cycleCount++;
    const cycleStart = Date.now();

    try {
      // --- 1. Fetch prices from Pyth ---
      logger.debug(`[Cycle ${cycleCount}] Fetching prices from Pyth...`);
      const prices = await fetcher.fetchPrices();

      if (prices.length === 0) {
        logger.warn(`[Cycle ${cycleCount}] No prices fetched, skipping`);
        await sleep(CONFIG.updateIntervalMs);
        continue;
      }

      // Log prices
      const priceStr = prices
        .map((p) => `${p.symbol}=$${p.rawPrice.toFixed(2)}`)
        .join(" | ");
      logger.info(`[Cycle ${cycleCount}] Pyth: ${priceStr}`);

      // --- 2. Check deviation from last submission ---
      const hasDeviation = fetcher.hasSignificantDeviation(
        submitter.submittedPrices,
        CONFIG.deviationThresholdPct
      );

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
    } catch (error) {
      logger.error(`[Cycle ${cycleCount}] Unhandled error: ${error.message}`);
      logger.debug(error.stack);
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
