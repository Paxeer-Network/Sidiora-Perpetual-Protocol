#!/usr/bin/env node

/**
 * Initialize vAMM pools for all markets.
 *
 * Reads current oracle prices from the Diamond, then calls initializePool()
 * for each market that hasn't been initialized yet.
 *
 * Requires MARKET_ADMIN_ROLE on the signing wallet.
 *
 * Usage:
 *   ADMIN_PRIVATE_KEY=0x... node scripts/init-pools.js
 *
 * Or set ADMIN_PRIVATE_KEY in .env (falls back to KEEPER_PRIVATE_KEY).
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const { ethers } = require("ethers");

// ============================================================
//  CONFIG
// ============================================================

const RPC_URL = process.env.RPC_URL || "https://public-rpc.paxeer.app/rpc";
const DIAMOND = process.env.DIAMOND_ADDRESS || "0xeA65FE02665852c615774A3041DFE6f00fb77537";

// Use ADMIN_PRIVATE_KEY if set, otherwise fall back to KEEPER_PRIVATE_KEY
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || process.env.KEEPER_PRIVATE_KEY;

const MARKETS = [
  { marketId: 0, symbol: "BTC" },
  { marketId: 1, symbol: "ETH" },
  { marketId: 2, symbol: "SOL" },
  { marketId: 3, symbol: "AVAX" },
  { marketId: 4, symbol: "LINK" },
];

// Pool parameters (matching deploy script defaults)
const VIRTUAL_LIQUIDITY = ethers.parseEther("1000000"); // $1M virtual depth
const DAMPING_FACTOR = 5000; // 50% convergence per sync

const ABI = [
  "function getPrice(uint256 _marketId) external view returns (uint256 price, uint256 timestamp)",
  "function getPool(uint256 _marketId) external view returns (uint256 baseReserve, uint256 quoteReserve, uint256 lastSyncTimestamp, uint256 dampingFactor)",
  "function initializePool(uint256 _marketId, uint256 _initialPrice, uint256 _virtualLiquidity, uint256 _dampingFactor) external",
  "function hasRole(bytes32 _role, address _account) external view returns (bool)",
];

// ============================================================
//  MAIN
// ============================================================

async function main() {
  if (!PRIVATE_KEY) {
    console.error("ERROR: Set ADMIN_PRIVATE_KEY (or KEEPER_PRIVATE_KEY) in .env or environment");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const diamond = new ethers.Contract(DIAMOND, ABI, wallet);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Initialize vAMM Pools");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  RPC:        ${RPC_URL}`);
  console.log(`  Diamond:    ${DIAMOND}`);
  console.log(`  Wallet:     ${wallet.address}`);
  console.log(`  Liquidity:  ${ethers.formatEther(VIRTUAL_LIQUIDITY)}`);
  console.log(`  Damping:    ${DAMPING_FACTOR} bps (${DAMPING_FACTOR / 100}%)`);
  console.log("");

  // Check MARKET_ADMIN_ROLE
  const MARKET_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MARKET_ADMIN"));
  const hasRole = await diamond.hasRole(MARKET_ADMIN_ROLE, wallet.address);
  if (!hasRole) {
    console.error(`ERROR: Wallet ${wallet.address} does not have MARKET_ADMIN_ROLE`);
    console.error(`  Role hash: ${MARKET_ADMIN_ROLE}`);
    console.error("  Use the deployer/owner account or grant the role first.");
    process.exit(1);
  }
  console.log("  MARKET_ADMIN_ROLE: GRANTED\n");

  let initialized = 0;
  let skipped = 0;

  for (const m of MARKETS) {
    // Check if already initialized
    const pool = await diamond.getPool(m.marketId);
    if (pool[0] > 0n) {
      console.log(`  [${m.marketId}] ${m.symbol}: already initialized (base=${ethers.formatEther(pool[0])})`);
      skipped++;
      continue;
    }

    // Get current oracle price
    let price;
    try {
      const [p, ts] = await diamond.getPrice(m.marketId);
      if (p === 0n) {
        console.log(`  [${m.marketId}] ${m.symbol}: NO ORACLE PRICE — skipping`);
        skipped++;
        continue;
      }
      price = p;
      const usd = Number(price / 10n ** 14n) / 10000;
      console.log(`  [${m.marketId}] ${m.symbol}: oracle price = $${usd.toFixed(2)}`);
    } catch (err) {
      console.log(`  [${m.marketId}] ${m.symbol}: getPrice() failed: ${err.message} — skipping`);
      skipped++;
      continue;
    }

    // Initialize
    try {
      const tx = await diamond.initializePool(
        m.marketId,
        price,
        VIRTUAL_LIQUIDITY,
        DAMPING_FACTOR,
        { gasLimit: 500000 }
      );
      console.log(`  [${m.marketId}] ${m.symbol}: TX sent ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  [${m.marketId}] ${m.symbol}: INITIALIZED in block ${receipt.blockNumber} (gas: ${receipt.gasUsed})`);
      initialized++;
    } catch (err) {
      const reason = err.reason || err.shortMessage || err.message;
      console.error(`  [${m.marketId}] ${m.symbol}: FAILED — ${reason}`);
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Done: ${initialized} initialized, ${skipped} skipped`);
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
