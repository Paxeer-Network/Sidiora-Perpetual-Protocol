#!/usr/bin/env node

const ROLE = (process.env.ROLE || "all").toLowerCase();

if      (ROLE === "graphql")  startGraphQLOnly();
else if (ROLE === "indexer")  require("./index.js");
else                          require("./index.js"); // "all" — index.js starts both

// ── GraphQL-only mode ────────────────────────────────────────
async function startGraphQLOnly() {
  const { CONFIG }             = require("./src/config");
  const { createLogger }       = require("./src/logger");
  const { migrate }            = require("./src/db/migrate");
  const { startGraphQLServer } = require("./src/graphql/server");
  const { stopSubscriptionBridge } = require("./src/graphql/subscriptions");
  const pruner                 = require("./src/db/pruner");

  const logger = createLogger(CONFIG.logLevel);

  logger.info("═══════════════════════════════════════════════════════");
  logger.info("  PPMM GraphQL Server (ROLE=graphql)");
  logger.info("═══════════════════════════════════════════════════════");
  logger.info(`  DB:           ${CONFIG.databaseUrl.replace(/:([^:@]+)@/, ":***@")}`);
  logger.info(`  GraphQL port: ${CONFIG.graphqlPort}`);
  logger.info("");

  logger.info("Running database migrations...");
  try {
    await migrate(false);
    logger.info("  ✓ Database ready");
  } catch (err) {
    logger.error(`  ✗ Migration failed: ${err.message}`);
    process.exit(1);
  }

  pruner.start(logger);

  logger.info("");
  logger.info("Starting GraphQL server...");
  await startGraphQLServer(CONFIG.graphqlPort, null, logger);
  logger.info("GraphQL server ready.\n");

  const shutdown = async (sig) => {
    logger.info(`${sig} received — shutting down...`);
    await stopSubscriptionBridge();
    pruner.stop();
    process.exit(0);
  };
  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
