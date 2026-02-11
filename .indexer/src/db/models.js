const { pool } = require("./pool");

// ============================================================
//  INDEXER STATE
// ============================================================

async function getLastIndexedBlock() {
  const res = await pool.query(
    "SELECT value FROM indexer_state WHERE key = 'last_indexed_block'"
  );
  return res.rows.length > 0 ? Number(res.rows[0].value) : 0;
}

async function setLastIndexedBlock(blockNumber) {
  await pool.query(
    `INSERT INTO indexer_state (key, value, updated_at) VALUES ('last_indexed_block', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [String(blockNumber)]
  );
}

// ============================================================
//  POSITIONS
// ============================================================

async function insertPosition(p) {
  await pool.query(
    `INSERT INTO positions (position_id, user_address, market_id, is_long, size_usd, leverage, entry_price,
       collateral_token, collateral_amount, status, opened_at, open_block, open_tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10, $11, $12)
     ON CONFLICT (position_id) DO NOTHING`,
    [p.positionId, p.user, p.marketId, p.isLong, p.sizeUsd, p.leverage, p.entryPrice,
     p.collateralToken, p.collateralAmount, p.timestamp, p.blockNumber, p.txHash]
  );
}

async function updatePositionModified(p) {
  await pool.query(
    `UPDATE positions SET size_usd = $2, collateral_usd = $3, collateral_amount = $4
     WHERE position_id = $1`,
    [p.positionId, p.newSizeUsd, p.newCollateralUsd, p.newCollateralAmount]
  );
}

async function closePosition(p) {
  const status = p.isLiquidation ? "liquidated" : "closed";
  await pool.query(
    `UPDATE positions SET status = $2, realized_pnl = $3, exit_price = $4,
       closed_at = $5, close_block = $6, close_tx_hash = $7
     WHERE position_id = $1`,
    [p.positionId, status, p.realizedPnl, p.exitPrice, p.timestamp, p.blockNumber, p.txHash]
  );
}

// ============================================================
//  TRADES
// ============================================================

async function insertTrade(t) {
  await pool.query(
    `INSERT INTO trades (position_id, user_address, market_id, trade_type, is_long, size_usd, price,
       realized_pnl, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [t.positionId, t.user, t.marketId, t.tradeType, t.isLong, t.sizeUsd, t.price,
     t.realizedPnl || 0, t.blockNumber, t.txHash, t.logIndex, t.timestamp]
  );
}

// ============================================================
//  ORDERS
// ============================================================

async function insertOrder(o) {
  await pool.query(
    `INSERT INTO orders (order_id, user_address, market_id, order_type, is_long, trigger_price, size_usd,
       status, placed_at, placed_block, placed_tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)
     ON CONFLICT (order_id) DO NOTHING`,
    [o.orderId, o.user, o.marketId, o.orderType, o.isLong, o.triggerPrice, o.sizeUsd,
     o.timestamp, o.blockNumber, o.txHash]
  );
}

async function executeOrder(o) {
  await pool.query(
    `UPDATE orders SET status = 'executed', position_id = $2, execution_price = $3,
       resolved_at = $4, resolved_block = $5, resolved_tx_hash = $6
     WHERE order_id = $1`,
    [o.orderId, o.positionId, o.executionPrice, o.timestamp, o.blockNumber, o.txHash]
  );
}

async function cancelOrder(o) {
  await pool.query(
    `UPDATE orders SET status = 'cancelled', resolved_at = $2, resolved_block = $3, resolved_tx_hash = $4
     WHERE order_id = $1`,
    [o.orderId, o.timestamp, o.blockNumber, o.txHash]
  );
}

// ============================================================
//  LIQUIDATIONS
// ============================================================

async function insertLiquidation(l) {
  await pool.query(
    `INSERT INTO liquidations (position_id, user_address, market_id, price, penalty, keeper,
       block_number, tx_hash, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [l.positionId, l.user, l.marketId, l.price, l.penalty, l.keeper,
     l.blockNumber, l.txHash, l.timestamp]
  );
}

// ============================================================
//  PRICE UPDATES
// ============================================================

async function insertPriceUpdates(prices) {
  if (prices.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of prices) {
      await client.query(
        `INSERT INTO price_updates (market_id, price, onchain_timestamp, block_number, tx_hash, block_timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [p.marketId, p.price, p.onchainTimestamp, p.blockNumber, p.txHash, p.blockTimestamp]
      );
      await client.query(
        `INSERT INTO latest_prices (market_id, price, onchain_timestamp, block_number, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (market_id) DO UPDATE SET price = $2, onchain_timestamp = $3, block_number = $4, updated_at = NOW()`,
        [p.marketId, p.price, p.onchainTimestamp, p.blockNumber]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
//  FUNDING RATES
// ============================================================

async function insertFundingRate(f) {
  await pool.query(
    `INSERT INTO funding_rates (market_id, rate_per_second, rate_24h, block_number, tx_hash, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [f.marketId, f.ratePerSecond, f.rate24h, f.blockNumber, f.txHash, f.timestamp]
  );
}

// ============================================================
//  MARKETS
// ============================================================

async function upsertMarket(m) {
  await pool.query(
    `INSERT INTO markets (market_id, name, symbol, max_leverage, enabled, created_at, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7)
     ON CONFLICT (market_id) DO UPDATE SET name = $2, symbol = $3, max_leverage = $4`,
    [m.marketId, m.name, m.symbol, m.maxLeverage, m.timestamp, m.blockNumber, m.txHash]
  );
}

async function setMarketEnabled(marketId, enabled) {
  await pool.query(
    "UPDATE markets SET enabled = $2 WHERE market_id = $1",
    [marketId, enabled]
  );
}

// ============================================================
//  USER VAULTS
// ============================================================

async function insertUserVault(v) {
  await pool.query(
    `INSERT INTO user_vaults (user_address, vault_address, created_at, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_address) DO NOTHING`,
    [v.user, v.vault, v.timestamp, v.blockNumber, v.txHash]
  );
}

// ============================================================
//  VAULT EVENTS
// ============================================================

async function insertVaultEvent(e) {
  await pool.query(
    `INSERT INTO vault_events (event_type, user_address, token_address, amount, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [e.eventType, e.user, e.token, e.amount, e.blockNumber, e.txHash, e.logIndex, e.timestamp]
  );
}

// ============================================================
//  COLLATERAL TOKENS
// ============================================================

async function upsertCollateralToken(c) {
  await pool.query(
    `INSERT INTO collateral_tokens (token_address, decimals, is_active, added_at, block_number, tx_hash)
     VALUES ($1, $2, TRUE, $3, $4, $5)
     ON CONFLICT (token_address) DO UPDATE SET is_active = TRUE, decimals = $2`,
    [c.token, c.decimals, c.timestamp, c.blockNumber, c.txHash]
  );
}

async function removeCollateralToken(token) {
  await pool.query(
    "UPDATE collateral_tokens SET is_active = FALSE WHERE token_address = $1",
    [token]
  );
}

// ============================================================
//  POOL STATE
// ============================================================

async function upsertPoolState(p) {
  await pool.query(
    `INSERT INTO pool_state (market_id, base_reserve, quote_reserve, oracle_price, updated_at, block_number)
     VALUES ($1, $2, $3, $4, NOW(), $5)
     ON CONFLICT (market_id) DO UPDATE SET base_reserve = $2, quote_reserve = $3, oracle_price = $4, updated_at = NOW(), block_number = $5`,
    [p.marketId, p.baseReserve, p.quoteReserve, p.oraclePrice || 0, p.blockNumber]
  );
}

// ============================================================
//  FEE CONFIG
// ============================================================

async function upsertFeeConfig(f) {
  await pool.query(
    `INSERT INTO fee_config (id, taker_fee_bps, maker_fee_bps, liquidation_fee_bps, insurance_fee_bps, updated_at, block_number)
     VALUES (1, $1, $2, $3, $4, NOW(), $5)
     ON CONFLICT (id) DO UPDATE SET taker_fee_bps = $1, maker_fee_bps = $2, liquidation_fee_bps = $3, insurance_fee_bps = $4, updated_at = NOW(), block_number = $5`,
    [f.takerFeeBps, f.makerFeeBps, f.liquidationFeeBps, f.insuranceFeeBps, f.blockNumber]
  );
}

// ============================================================
//  PROTOCOL EVENTS (generic)
// ============================================================

async function insertProtocolEvent(e) {
  await pool.query(
    `INSERT INTO protocol_events (event_name, event_data, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.eventName, JSON.stringify(e.data), e.blockNumber, e.txHash, e.logIndex, e.timestamp]
  );
}

module.exports = {
  getLastIndexedBlock,
  setLastIndexedBlock,
  insertPosition,
  updatePositionModified,
  closePosition,
  insertTrade,
  insertOrder,
  executeOrder,
  cancelOrder,
  insertLiquidation,
  insertPriceUpdates,
  insertFundingRate,
  upsertMarket,
  setMarketEnabled,
  insertUserVault,
  insertVaultEvent,
  upsertCollateralToken,
  removeCollateralToken,
  upsertPoolState,
  upsertFeeConfig,
  insertProtocolEvent,
};
