const { Pool } = require("pg");
const { CONFIG } = require("../config");

const pool = new Pool({
  connectionString: CONFIG.db.connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

module.exports = { pool };
