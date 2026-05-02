require("dotenv").config({ path: __dirname + "/../.env" });

const rpcUrls = process.env.RPC_URLS
  ? process.env.RPC_URLS.split(",").map((u) => u.trim()).filter(Boolean)
  : [process.env.RPC_URL || "https://public-mainnet.rpcpaxeer.online/app"];

const CONFIG = {
  db: {
    connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ppmm_indexer",
  },
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ppmm_indexer",
  rpcUrl: rpcUrls[0],
  rpcUrls,
  diamondAddress: process.env.DIAMOND_ADDRESS || "0xeA65FE02665852c615774A3041DFE6f00fb77537",
  startBlock: Number(process.env.START_BLOCK) || 1301600,
  batchSize: Number(process.env.BATCH_SIZE) || 2000,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 2000,
  graphqlPort: Number(process.env.GRAPHQL_PORT) || 4000,
  healthPort: Number(process.env.HEALTH_PORT) || 9090,
  logLevel: process.env.LOG_LEVEL || "info",
};

module.exports = { CONFIG };
