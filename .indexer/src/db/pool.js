const { Pool } = require("pg");
const { CONFIG } = require("../config");

const pool = new Pool(CONFIG.db);

module.exports = { pool };
