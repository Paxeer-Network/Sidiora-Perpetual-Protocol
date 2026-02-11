const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const express = require("express");
const cors = require("cors");
const { typeDefs } = require("./schema");
const { resolvers } = require("./resolvers");

/**
 * Create and start the GraphQL server.
 * @param {number} port
 * @param {object} scanner - Scanner instance for context
 * @param {object} logger
 * @returns {Promise<{app: express.Application, server: ApolloServer}>}
 */
async function startGraphQLServer(port, scanner, logger) {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
  });

  await server.start();

  app.use(
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async () => {
        let chainHead = null;
        try {
          chainHead = await scanner.getChainHead();
        } catch {}
        return { scanner, chainHead };
      },
    })
  );

  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      const { pool } = require("../db/pool");
      await pool.query("SELECT 1");
      const stats = scanner.getStats();
      res.json({
        status: "ok",
        blocksScanned: stats.blocksScanned,
        eventsProcessed: stats.eventsProcessed,
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  return new Promise((resolve) => {
    const httpServer = app.listen(port, () => {
      logger.info(`  GraphQL API:  http://localhost:${port}/graphql`);
      logger.info(`  Health check: http://localhost:${port}/health`);
      resolve({ app, server, httpServer });
    });
  });
}

module.exports = { startGraphQLServer };
