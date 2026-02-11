require("dotenv").config({ path: __dirname + "/../.env" });

const CONFIG = {
  db: {
    connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ppmm_indexer",
  },
  rpcUrl: process.env.RPC_URL || "https://public-rpc.paxeer.app/rpc",
  diamondAddress: process.env.DIAMOND_ADDRESS || "0xeA65FE02665852c615774A3041DFE6f00fb77537",
  startBlock: Number(process.env.START_BLOCK) || 1301600,
  batchSize: Number(process.env.BATCH_SIZE) || 100,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 3000,
  graphqlPort: Number(process.env.GRAPHQL_PORT) || 4000,
  logLevel: process.env.LOG_LEVEL || "info",
};

module.exports = { CONFIG };
