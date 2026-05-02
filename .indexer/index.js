#!/usr/bin/env node

const { CONFIG }         = require("./src/config");
const { createLogger }   = require("./src/logger");
const { Scanner }        = require("./src/scanner");
const { HealthServer }   = require("./src/health-server");
const { migrate }        = require("./src/db/migrate");
const { getLastIndexedBlock, setLastIndexedBlock } = require("./src/db/models");
const { startGraphQLServer } = require("./src/graphql/server");
const { notify }         = require("./src/db/pubsub");
const pruner             = require("./src/db/pruner");
const { pool }           = require("./src/db/pool");

async function main() {
  const verbose = process.argv.includes("--verbose");
  const logger  = createLogger(verbose ? "debug" : CONFIG.logLevel);

  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  PPMM Indexer — EVM eth_getLogs + GraphQL API");
  logger.info("═══════════════════════════════════════════════════════");
  CONFIG.rpcUrls.forEach((u, i) => logger.info(`  RPC[${i}]:      ${u}`));
  logger.info(`  Diamond:     ${CONFIG.diamondAddress}`);
  logger.info(`  Start block: ${CONFIG.startBlock}`);
  logger.info(`  Batch size:  ${CONFIG.batchSize}`);
  logger.info(`  Poll:        ${CONFIG.pollIntervalMs}ms`);
  logger.info(`  GraphQL:     port ${CONFIG.graphqlPort}`);
  logger.info("");

  // 1. Migrations
  logger.info("Running database migrations...");
  try {
    await migrate(false);
    logger.info("  ✓ Database ready");
  } catch (err) {
    logger.error(`  ✗ Migration failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Pruner
  pruner.start(logger);

  // 3. Scanner
  const scanner = new Scanner(CONFIG, logger);

  // 4. GraphQL server
  logger.info("");
  logger.info("Starting GraphQL server...");
  await startGraphQLServer(CONFIG.graphqlPort, scanner, logger);

  // 5. Health surface
  let lastScanAt  = Date.now();
  let currentCursor = 0;
  const healthServer = new HealthServer({
    port: CONFIG.healthPort,
    scanner,
    logger,
    getCurrentBlock: () => currentCursor,
    getLastScanAt:   () => lastScanAt,
  });
  await healthServer.start();
  logger.info("");

  // 6. Cursor bootstrap
  let lastIndexed = await getLastIndexedBlock();
  if (lastIndexed < CONFIG.startBlock) {
    lastIndexed = CONFIG.startBlock - 1;
    await setLastIndexedBlock(lastIndexed);
  }
  currentCursor = lastIndexed;

  const initialHead = await scanner.getChainHead();
  logger.info(`  Last indexed block: ${lastIndexed}`);
  logger.info(`  Chain head:         ${initialHead}`);
  logger.info(`  Blocks behind:      ${initialHead - lastIndexed}`);
  logger.info("");

  // Graceful shutdown
  let running = true;
  process.on("SIGINT",  () => { logger.info("\nSIGINT — shutting down..."); running = false; });
  process.on("SIGTERM", () => { logger.info("\nSIGTERM — shutting down..."); running = false; });

  const safeScan = async (from, to) => {
    try {
      const result = await scanner.scanBlocks(from, to);
      const advanceTo = result?.effectiveTo ?? to;
      await setLastIndexedBlock(advanceTo);
      currentCursor = advanceTo;
      lastScanAt    = Date.now();
      notify(pool, "block_committed", { blockNumber: advanceTo, eventsCount: result?.events || 0 }).catch(() => {});
      return advanceTo;
    } catch (err) {
      logger.error(`Scan error at ${from}-${to}: ${err.message}`);
      throw err;
    }
  };

  // 7. Catchup
  if (initialHead > lastIndexed) {
    logger.info("Starting historical sync...");
    let from = lastIndexed + 1;
    let head = initialHead;

    while (from <= head && running) {
      const to = Math.min(from + CONFIG.batchSize - 1, head);
      try {
        const next = await safeScan(from, to);
        from = next + 1;
      } catch {
        await sleep(2000);
      }
      if (from > head) {
        try { head = await scanner.getChainHead(); } catch {}
      }
    }

    if (running) {
      const s = scanner.getStats();
      logger.info(`  ✓ Sync complete — ${s.eventsProcessed} events indexed`);
      logger.info("");
    }
  }

  // 8. Live mode — simple poll
  logger.info("Entering live mode...\n");
  while (running) {
    try {
      const head = await scanner.getChainHead();
      if (head > currentCursor) {
        const from = currentCursor + 1;
        const to   = Math.min(from + CONFIG.batchSize - 1, head);
        await safeScan(from, to);
      } else {
        lastScanAt = Date.now();
        await sleep(CONFIG.pollIntervalMs);
      }
    } catch (err) {
      logger.error(`Live mode error: ${err.message}`);
      await sleep(2000);
    }
  }

  // 9. Shutdown
  const s = scanner.getStats();
  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  Indexer Stopped");
  logger.info(`  Blocks scanned:   ${s.blocksScanned}`);
  logger.info(`  Events processed: ${s.eventsProcessed}`);
  logger.info(`  Errors:           ${s.errors}`);
  logger.info("═══════════════════════════════════════════════════════\n");

  await scanner.close();
  await healthServer.close();
  pruner.stop();
  process.exit(0);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
