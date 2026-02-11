#!/usr/bin/env node

const { CONFIG } = require("./src/config");
const { createLogger } = require("./src/logger");
const { Scanner } = require("./src/scanner");
const { migrate } = require("./src/db/migrate");
const { getLastIndexedBlock, setLastIndexedBlock } = require("./src/db/models");
const { startGraphQLServer } = require("./src/graphql/server");

/**
 * PPMM Indexer
 *
 * 1. Runs DB migrations on startup
 * 2. Starts the GraphQL API server
 * 3. Scans historical blocks in batches to catch up
 * 4. Polls for new blocks continuously
 *
 * Usage:
 *   node index.js             # Normal mode
 *   node index.js --verbose   # Debug logging
 */

async function main() {
  const verbose = process.argv.includes("--verbose");
  const logger = createLogger(verbose ? "debug" : CONFIG.logLevel);

  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  PPMM Indexer — On-Chain Event Indexer + GraphQL API");
  logger.info("═══════════════════════════════════════════════════════");
  logger.info(`  RPC:        ${CONFIG.rpcUrl}`);
  logger.info(`  Diamond:    ${CONFIG.diamondAddress}`);
  logger.info(`  Start block: ${CONFIG.startBlock}`);
  logger.info(`  Batch size:  ${CONFIG.batchSize}`);
  logger.info(`  Poll interval: ${CONFIG.pollIntervalMs}ms`);
  logger.info(`  GraphQL port:  ${CONFIG.graphqlPort}`);
  logger.info("");

  // --- 1. Run migrations ---
  logger.info("Running database migrations...");
  try {
    await migrate(false);
    logger.info("  ✓ Database ready");
  } catch (err) {
    logger.error(`  ✗ Migration failed: ${err.message}`);
    process.exit(1);
  }

  // --- 2. Initialize scanner ---
  const scanner = new Scanner(CONFIG, logger);

  // --- 3. Start GraphQL server ---
  logger.info("");
  logger.info("Starting GraphQL server...");
  await startGraphQLServer(CONFIG.graphqlPort, scanner, logger);
  logger.info("");

  // --- 4. Determine starting block ---
  let lastIndexed = await getLastIndexedBlock();
  if (lastIndexed < CONFIG.startBlock) {
    lastIndexed = CONFIG.startBlock - 1;
    await setLastIndexedBlock(lastIndexed);
  }

  const chainHead = await scanner.getChainHead();
  const behind = chainHead - lastIndexed;

  logger.info(`  Last indexed block: ${lastIndexed}`);
  logger.info(`  Chain head:         ${chainHead}`);
  logger.info(`  Blocks behind:      ${behind}`);
  logger.info("");

  // --- Graceful shutdown ---
  let running = true;
  const shutdown = (signal) => {
    logger.info(`\n${signal} received — shutting down...`);
    running = false;
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // --- 5. Catch-up phase ---
  if (behind > 0) {
    logger.info("Starting historical sync...");
    let from = lastIndexed + 1;

    while (from <= chainHead && running) {
      const to = Math.min(from + CONFIG.batchSize - 1, chainHead);
      try {
        await scanner.scanBlocks(from, to);
        await setLastIndexedBlock(to);
        from = to + 1;
      } catch (err) {
        logger.error(`Scan error at ${from}-${to}: ${err.message}`);
        await sleep(5000);
      }
    }

    if (running) {
      const stats = scanner.getStats();
      logger.info("");
      logger.info(`  ✓ Historical sync complete — ${stats.eventsProcessed} events indexed`);
      logger.info("");
    }
  }

  // --- 6. Live polling ---
  logger.info("Entering live polling mode...\n");
  let currentBlock = await getLastIndexedBlock();

  while (running) {
    try {
      const head = await scanner.getChainHead();

      if (head > currentBlock) {
        const from = currentBlock + 1;
        const to = Math.min(from + CONFIG.batchSize - 1, head);

        await scanner.scanBlocks(from, to);
        await setLastIndexedBlock(to);
        currentBlock = to;
      }
    } catch (err) {
      logger.error(`Poll error: ${err.message}`);
    }

    if (running) {
      await sleep(CONFIG.pollIntervalMs);
    }
  }

  // --- Shutdown summary ---
  const stats = scanner.getStats();
  logger.info("");
  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  Indexer Stopped");
  logger.info("═══════════════════════════════════════════════════════");
  logger.info(`  Blocks scanned:    ${stats.blocksScanned}`);
  logger.info(`  Events processed:  ${stats.eventsProcessed}`);
  logger.info(`  Errors:            ${stats.errors}`);
  logger.info("═══════════════════════════════════════════════════════\n");

  process.exit(0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
