const { pool } = require("./pool");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS markets (
  market_id INTEGER PRIMARY KEY, name TEXT NOT NULL, symbol TEXT NOT NULL,
  max_leverage NUMERIC NOT NULL DEFAULT 0, enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), block_number BIGINT, tx_hash TEXT
);
CREATE TABLE IF NOT EXISTS collateral_tokens (
  token_address TEXT PRIMARY KEY, decimals INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, added_at TIMESTAMPTZ DEFAULT NOW(),
  block_number BIGINT, tx_hash TEXT
);
CREATE TABLE IF NOT EXISTS positions (
  position_id NUMERIC PRIMARY KEY, user_address TEXT NOT NULL, market_id INTEGER NOT NULL,
  is_long BOOLEAN NOT NULL, size_usd NUMERIC NOT NULL, leverage NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL, collateral_token TEXT,
  collateral_amount NUMERIC NOT NULL DEFAULT 0, collateral_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', realized_pnl NUMERIC DEFAULT 0,
  exit_price NUMERIC, opened_at TIMESTAMPTZ DEFAULT NOW(), closed_at TIMESTAMPTZ,
  open_block BIGINT, close_block BIGINT, open_tx_hash TEXT, close_tx_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_address);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY, position_id NUMERIC, user_address TEXT, market_id INTEGER,
  trade_type TEXT NOT NULL, is_long BOOLEAN, size_usd NUMERIC, price NUMERIC,
  realized_pnl NUMERIC DEFAULT 0, block_number BIGINT, tx_hash TEXT,
  log_index INTEGER, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_position ON trades(position_id);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_address);
CREATE TABLE IF NOT EXISTS orders (
  order_id NUMERIC PRIMARY KEY, user_address TEXT NOT NULL, market_id INTEGER NOT NULL,
  order_type INTEGER NOT NULL, is_long BOOLEAN, trigger_price NUMERIC, size_usd NUMERIC,
  status TEXT NOT NULL DEFAULT 'active', position_id NUMERIC, execution_price NUMERIC,
  failure_reason TEXT, placed_at TIMESTAMPTZ DEFAULT NOW(), resolved_at TIMESTAMPTZ,
  placed_block BIGINT, resolved_block BIGINT, placed_tx_hash TEXT, resolved_tx_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_address);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE TABLE IF NOT EXISTS liquidations (
  id SERIAL PRIMARY KEY, position_id NUMERIC NOT NULL, user_address TEXT NOT NULL,
  market_id INTEGER NOT NULL, price NUMERIC, penalty NUMERIC, keeper TEXT,
  block_number BIGINT, tx_hash TEXT, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liquidations_user ON liquidations(user_address);
CREATE INDEX IF NOT EXISTS idx_liquidations_market ON liquidations(market_id);
CREATE TABLE IF NOT EXISTS price_updates (
  id SERIAL PRIMARY KEY, market_id INTEGER NOT NULL, price NUMERIC NOT NULL,
  onchain_timestamp BIGINT, block_number BIGINT, tx_hash TEXT,
  block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_updates_market ON price_updates(market_id);
CREATE TABLE IF NOT EXISTS latest_prices (
  market_id INTEGER PRIMARY KEY, price NUMERIC NOT NULL,
  onchain_timestamp BIGINT, block_number BIGINT, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS funding_rates (
  id SERIAL PRIMARY KEY, market_id INTEGER NOT NULL,
  rate_per_second NUMERIC, rate_24h NUMERIC,
  block_number BIGINT, tx_hash TEXT, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_funding_rates_market ON funding_rates(market_id);
CREATE TABLE IF NOT EXISTS user_vaults (
  user_address TEXT PRIMARY KEY, vault_address TEXT NOT NULL,
  margin_mode INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), block_number BIGINT, tx_hash TEXT
);
CREATE TABLE IF NOT EXISTS vault_events (
  id SERIAL PRIMARY KEY, event_type TEXT NOT NULL, user_address TEXT NOT NULL,
  token_address TEXT, amount NUMERIC, block_number BIGINT, tx_hash TEXT,
  log_index INTEGER, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vault_events_user ON vault_events(user_address);
CREATE TABLE IF NOT EXISTS pool_state (
  market_id INTEGER PRIMARY KEY, base_reserve NUMERIC DEFAULT 0,
  quote_reserve NUMERIC DEFAULT 0, oracle_price NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(), block_number BIGINT
);
CREATE TABLE IF NOT EXISTS fee_config (
  id INTEGER PRIMARY KEY DEFAULT 1, taker_fee_bps INTEGER, maker_fee_bps INTEGER,
  liquidation_fee_bps INTEGER, insurance_fee_bps INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(), block_number BIGINT
);
CREATE TABLE IF NOT EXISTS protocol_events (
  id SERIAL PRIMARY KEY, event_name TEXT NOT NULL, event_data JSONB,
  block_number BIGINT, tx_hash TEXT, log_index INTEGER,
  block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_protocol_events_name ON protocol_events(event_name);
CREATE TABLE IF NOT EXISTS indexer_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS block_hashes (
  block_number BIGINT PRIMARY KEY, block_hash TEXT NOT NULL,
  parent_hash TEXT, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS keeper_cycles (
  id SERIAL PRIMARY KEY, onchain_timestamp BIGINT,
  markets_updated INTEGER, orders_executed INTEGER, liquidations_executed INTEGER,
  orders_failed INTEGER DEFAULT 0, liquidations_failed INTEGER DEFAULT 0,
  block_number BIGINT, tx_hash TEXT, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS account_ledger (
  id SERIAL PRIMARY KEY, entry_id NUMERIC NOT NULL,
  user_address TEXT NOT NULL, entry_type INTEGER, token_address TEXT,
  amount NUMERIC, position_id NUMERIC, is_debit BOOLEAN,
  block_number BIGINT, tx_hash TEXT, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_ledger_user ON account_ledger(user_address);
CREATE TABLE IF NOT EXISTS delegates (
  id SERIAL PRIMARY KEY, user_address TEXT NOT NULL, delegate_address TEXT NOT NULL,
  can_trade BOOLEAN, can_withdraw BOOLEAN, can_modify_margin BOOLEAN,
  expiry NUMERIC, is_active BOOLEAN DEFAULT TRUE,
  block_number BIGINT, tx_hash TEXT, block_timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_address, delegate_address)
);
CREATE INDEX IF NOT EXISTS idx_delegates_user ON delegates(user_address);
CREATE TABLE IF NOT EXISTS trading_account_events (
  id SERIAL PRIMARY KEY, event_type TEXT NOT NULL, user_address TEXT NOT NULL,
  position_id NUMERIC, token_address TEXT, amount NUMERIC,
  extra_data JSONB DEFAULT '{}',
  block_number BIGINT, tx_hash TEXT, block_timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trading_account_events_user ON trading_account_events(user_address);
`;

async function migrate(reset) {
  const client = await pool.connect();
  try {
    if (reset) {
      console.log("Resetting database...");
      await client.query(`
        DROP TABLE IF EXISTS indexer_state, markets, collateral_tokens, positions, trades,
          orders, liquidations, price_updates, latest_prices, funding_rates, user_vaults,
          vault_events, pool_state, fee_config, protocol_events, block_hashes, keeper_cycles,
          account_ledger, delegates, trading_account_events CASCADE
      `);
    }

    console.log("Creating tables...");
    await client.query(SCHEMA);
    console.log("Migration complete.");

    await client.query(`
      INSERT INTO indexer_state (key, value) VALUES ('last_indexed_block', '0')
      ON CONFLICT (key) DO NOTHING
    `);

    const fs = require("fs");
    const path = require("path");

    const migrations = [
      "002-v2-robustness.sql",
      "003-v5-indexer-events.sql",
      "004-v4-spot-trading.sql",
      "005-idempotency.sql",
      "006-performance-indexes.sql",
    ];

    for (const file of migrations) {
      console.log(`Running ${file}...`);
      const sql = fs.readFileSync(path.join(__dirname, "migrations", file), "utf8");
      await client.query(sql);
      console.log(`  ${file} complete.`);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const reset = process.argv.includes("--reset");
  migrate(reset)
    .then(() => { console.log("Done."); process.exit(0); })
    .catch((err) => { console.error("Migration failed:", err); process.exit(1); });
}

module.exports = { migrate };
