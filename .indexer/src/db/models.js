"use strict";

const { pool } = require("./pool");

// ============================================================
//  INDEXER STATE
// ============================================================

async function getLastIndexedBlock() {
  const res = await pool.query("SELECT value FROM indexer_state WHERE key = 'last_indexed_block'");
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
    `UPDATE positions SET size_usd = $2, collateral_usd = $3, collateral_amount = $4 WHERE position_id = $1`,
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
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
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
       resolved_at = $4, resolved_block = $5, resolved_tx_hash = $6 WHERE order_id = $1`,
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

async function expireOrder(o) {
  await pool.query(
    `UPDATE orders SET status = 'expired', resolved_at = $2, resolved_block = $3, resolved_tx_hash = $4
     WHERE order_id = $1 AND status = 'active'`,
    [o.orderId, o.timestamp, o.blockNumber, o.txHash]
  );
}

async function setOrderFailed(o) {
  await pool.query(
    `UPDATE orders SET status = 'failed', failure_reason = $2,
       resolved_at = $3, resolved_block = $4, resolved_tx_hash = $5
     WHERE order_id = $1 AND status = 'active'`,
    [o.orderId, o.reason, o.timestamp, o.blockNumber, o.txHash]
  );
}

// ============================================================
//  LIQUIDATIONS
// ============================================================

async function insertLiquidation(l) {
  await pool.query(
    `INSERT INTO liquidations (position_id, user_address, market_id, price, penalty, keeper,
       block_number, tx_hash, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (position_id, block_number, tx_hash) DO NOTHING`,
    [l.positionId, l.user, l.marketId, l.price, l.penalty, l.keeper,
     l.blockNumber, l.txHash, l.timestamp]
  );
}

// ============================================================
//  PRICE UPDATES
// ============================================================

async function insertPriceUpdates(prices) {
  if (prices.length === 0) return;
  for (const p of prices) {
    await pool.query(
      `INSERT INTO price_updates (market_id, price, onchain_timestamp, block_number, tx_hash, block_timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (market_id, block_number, tx_hash) DO NOTHING`,
      [p.marketId, p.price, p.onchainTimestamp, p.blockNumber, p.txHash, p.blockTimestamp]
    );
    await pool.query(
      `INSERT INTO latest_prices (market_id, price, onchain_timestamp, block_number, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (market_id) DO UPDATE SET price = $2, onchain_timestamp = $3, block_number = $4, updated_at = NOW()`,
      [p.marketId, p.price, p.onchainTimestamp, p.blockNumber]
    );
  }
}

// ============================================================
//  FUNDING
// ============================================================

async function insertFundingRate(f) {
  await pool.query(
    `INSERT INTO funding_rates (market_id, rate_per_second, rate_24h, block_number, tx_hash, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (market_id, block_number, tx_hash) DO NOTHING`,
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
  await pool.query("UPDATE markets SET enabled = $2 WHERE market_id = $1", [marketId, enabled]);
}

// ============================================================
//  USER VAULTS
// ============================================================

async function insertUserVault(v) {
  await pool.query(
    `INSERT INTO user_vaults (user_address, vault_address, created_at, block_number, tx_hash)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_address) DO NOTHING`,
    [v.user, v.vault, v.timestamp, v.blockNumber, v.txHash]
  );
}

async function insertVaultEvent(e) {
  await pool.query(
    `INSERT INTO vault_events (event_type, user_address, token_address, amount, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [e.eventType, e.user, e.token, e.amount, e.blockNumber, e.txHash, e.logIndex, e.timestamp]
  );
}

// ============================================================
//  COLLATERAL
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
  await pool.query("UPDATE collateral_tokens SET is_active = FALSE WHERE token_address = $1", [token]);
}

// ============================================================
//  POOL STATE / FEES / PROTOCOL EVENTS
// ============================================================

async function upsertPoolState(p) {
  await pool.query(
    `INSERT INTO pool_state (market_id, base_reserve, quote_reserve, oracle_price, updated_at, block_number)
     VALUES ($1, $2, $3, $4, NOW(), $5)
     ON CONFLICT (market_id) DO UPDATE SET base_reserve=$2, quote_reserve=$3, oracle_price=$4, updated_at=NOW(), block_number=$5`,
    [p.marketId, p.baseReserve, p.quoteReserve, p.oraclePrice || 0, p.blockNumber]
  );
}

async function upsertFeeConfig(f) {
  await pool.query(
    `INSERT INTO fee_config (id, taker_fee_bps, maker_fee_bps, liquidation_fee_bps, insurance_fee_bps, updated_at, block_number)
     VALUES (1, $1, $2, $3, $4, NOW(), $5)
     ON CONFLICT (id) DO UPDATE SET taker_fee_bps=$1, maker_fee_bps=$2, liquidation_fee_bps=$3, insurance_fee_bps=$4, updated_at=NOW(), block_number=$5`,
    [f.takerFeeBps, f.makerFeeBps, f.liquidationFeeBps, f.insuranceFeeBps, f.blockNumber]
  );
}

async function insertProtocolEvent(e) {
  await pool.query(
    `INSERT INTO protocol_events (event_name, event_data, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [e.eventName, JSON.stringify(e.data), e.blockNumber, e.txHash, e.logIndex, e.timestamp]
  );
}

// ============================================================
//  V2 — KEEPER / ACCOUNT / DELEGATE / LEDGER
// ============================================================

async function insertKeeperCycle(c) {
  await pool.query(
    `INSERT INTO keeper_cycles (onchain_timestamp, markets_updated, orders_executed, liquidations_executed,
       orders_failed, liquidations_failed, block_number, tx_hash, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (block_number, tx_hash) DO NOTHING`,
    [c.onchainTimestamp, c.marketsUpdated, c.ordersExecuted, c.liquidationsExecuted,
     c.ordersFailed, c.liquidationsFailed, c.blockNumber, c.txHash, c.timestamp]
  );
}

async function insertLedgerEntry(e) {
  await pool.query(
    `INSERT INTO account_ledger (entry_id, user_address, entry_type, token_address, amount,
       position_id, is_debit, block_number, tx_hash, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (entry_id) DO NOTHING`,
    [e.entryId, e.user, e.entryType, e.token, e.amount,
     e.positionId, e.isDebit, e.blockNumber, e.txHash, e.timestamp]
  );
}

async function upsertDelegate(d) {
  await pool.query(
    `INSERT INTO delegates (user_address, delegate_address, can_trade, can_withdraw,
       can_modify_margin, expiry, is_active, block_number, tx_hash, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9)
     ON CONFLICT (user_address, delegate_address)
     DO UPDATE SET can_trade=$3, can_withdraw=$4, can_modify_margin=$5,
       expiry=$6, is_active=TRUE, block_number=$7, tx_hash=$8, block_timestamp=$9`,
    [d.user, d.delegate, d.canTrade, d.canWithdraw, d.canModifyMargin,
     d.expiry, d.blockNumber, d.txHash, d.timestamp]
  );
}

async function removeDelegate(d) {
  await pool.query(
    `UPDATE delegates SET is_active=FALSE, block_number=$3, tx_hash=$4, block_timestamp=$5
     WHERE user_address=$1 AND delegate_address=$2`,
    [d.user, d.delegate, d.blockNumber, d.txHash, d.timestamp]
  );
}

async function insertTradingAccountEvent(e) {
  await pool.query(
    `INSERT INTO trading_account_events (event_type, user_address, position_id, token_address,
       amount, extra_data, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [e.eventType, e.user, e.positionId || 0, e.token || null,
     e.amount || 0, JSON.stringify(e.extraData || {}), e.blockNumber, e.txHash,
     e.logIndex ?? 0, e.timestamp]
  );
}

async function updateMarginMode(m) {
  await pool.query(
    "UPDATE user_vaults SET margin_mode=$2 WHERE LOWER(user_address)=LOWER($1)",
    [m.user, m.mode]
  );
}

// ============================================================
//  V5 — NON-SPOT EVENTS
// ============================================================

async function insertFee(f) {
  await pool.query(
    `INSERT INTO fees (position_id, user_address, market_id, fee_type, fee_usd, fee_tokens,
       token_address, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [f.positionId, f.user, f.marketId, f.feeType, f.feeUsd, f.feeTokens,
     f.token, f.blockNumber, f.txHash, f.logIndex, f.timestamp]
  );
}

async function insertInsuranceContribution(c) {
  await pool.query(
    `INSERT INTO insurance_contributions (token_address, amount, source, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [c.token, c.amount, c.source, c.blockNumber, c.txHash, c.logIndex, c.timestamp]
  );
}

async function insertTradeSettlement(t) {
  await pool.query(
    `INSERT INTO trade_settlements (position_id, user_address, market_id, trade_type, size_usd,
       execution_price, gross_pnl, total_fees_usd, borrowing_fee_usd, funding_paid_usd,
       net_payout_tokens, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [t.positionId, t.user, t.marketId, t.tradeType, t.sizeUsd,
     t.executionPrice, t.grossPnl, t.totalFeesUsd, t.borrowingFeeUsd, t.fundingPaidUsd,
     t.netPayoutTokens, t.blockNumber, t.txHash, t.logIndex, t.timestamp]
  );
}

async function insertOiSnapshot(o) {
  await pool.query(
    `INSERT INTO oi_snapshots (market_id, long_oi, short_oi, delta_usd, is_increase,
       block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [o.marketId, o.longOI, o.shortOI, o.deltaUsd, o.isIncrease,
     o.blockNumber, o.txHash, o.logIndex, o.timestamp]
  );
}

async function insertMarkPriceHistory(m) {
  await pool.query(
    `INSERT INTO mark_price_history (market_id, mark_price, index_price, base_reserve, quote_reserve,
       block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [m.marketId, m.markPrice, m.indexPrice, m.baseReserve, m.quoteReserve,
     m.blockNumber, m.txHash, m.logIndex, m.timestamp]
  );
}

async function insertVaultBalanceHistory(v) {
  await pool.query(
    `INSERT INTO vault_balance_history (token_address, vault_type, new_balance, delta, is_increase,
       block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [v.token, v.vaultType, v.newBalance, v.delta, v.isIncrease,
     v.blockNumber, v.txHash, v.logIndex, v.timestamp]
  );
}

async function insertFundingPayment(f) {
  await pool.query(
    `INSERT INTO funding_payments (position_id, user_address, market_id, funding_payment_usd,
       new_collateral_usd, new_collateral_amount, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [f.positionId, f.user, f.marketId, f.fundingPaymentUsd,
     f.newCollateralUsd, f.newCollateralAmount, f.blockNumber, f.txHash, f.logIndex, f.timestamp]
  );
}

async function insertMarketSnapshot(s) {
  await pool.query(
    `INSERT INTO market_snapshots (market_id, long_oi, short_oi, mark_price, index_price,
       funding_rate_per_second, funding_rate_24h, volume_24h_usd, onchain_timestamp,
       block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [s.marketId, s.longOI, s.shortOI, s.markPrice, s.indexPrice,
     s.fundingRatePerSecond, s.fundingRate24h, s.volume24hUsd, s.onchainTimestamp,
     s.blockNumber, s.txHash, s.logIndex, s.timestamp]
  );
}

async function insertProtocolSnapshot(s) {
  await pool.query(
    `INSERT INTO protocol_snapshots (total_positions, total_open_positions, total_markets,
       tvl_usd, insurance_total_usd, onchain_timestamp, block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [s.totalPositions, s.totalOpenPositions, s.totalMarkets,
     s.tvlUsd, s.insuranceTotalUsd, s.onchainTimestamp, s.blockNumber, s.txHash, s.logIndex, s.timestamp]
  );
}

async function insertEntryPriceChange(e) {
  await pool.query(
    `INSERT INTO entry_price_changes (position_id, old_entry_price, new_entry_price,
       block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [e.positionId, e.oldEntryPrice, e.newEntryPrice,
     e.blockNumber, e.txHash, e.logIndex, e.timestamp]
  );
}

async function insertCollateralConfigChange(c) {
  await pool.query(
    `INSERT INTO collateral_config_changes (token_address, decimals, accepted, is_spot,
       block_number, tx_hash, log_index, block_timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (block_number, tx_hash, log_index) DO NOTHING`,
    [c.token, c.decimals, c.accepted, c.isSpot,
     c.blockNumber, c.txHash, c.logIndex, c.timestamp]
  );
}

module.exports = {
  getLastIndexedBlock, setLastIndexedBlock,
  insertPosition, updatePositionModified, closePosition,
  insertTrade, insertOrder, executeOrder, cancelOrder, expireOrder, setOrderFailed,
  insertLiquidation, insertPriceUpdates, insertFundingRate,
  upsertMarket, setMarketEnabled,
  insertUserVault, insertVaultEvent,
  upsertCollateralToken, removeCollateralToken,
  upsertPoolState, upsertFeeConfig, insertProtocolEvent,
  insertKeeperCycle, insertLedgerEntry, upsertDelegate, removeDelegate,
  insertTradingAccountEvent, updateMarginMode,
  insertFee, insertInsuranceContribution, insertTradeSettlement,
  insertOiSnapshot, insertMarkPriceHistory, insertVaultBalanceHistory,
  insertFundingPayment, insertMarketSnapshot, insertProtocolSnapshot,
  insertEntryPriceChange, insertCollateralConfigChange,
};
