const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv/config");

/**
 * Step 9: Add a new perpetual market to the protocol
 *
 * Full pipeline:
 *   1. createMarket()       — register the market on MarketRegistryFacet
 *   2. batchUpdatePrices()  — post the initial oracle price
 *   3. initializePool()     — initialize the vAMM pool
 *
 * Roles required on the signer:
 *   - MARKET_ADMIN_ROLE   (createMarket, initializePool)
 *   - ORACLE_POSTER_ROLE  (batchUpdatePrices)
 *
 * After running this script you must also:
 *   - Add the new market entry to .keeper/config.js MARKETS array
 *   - Restart the keeper so it picks up the new market
 *   - Ensure the oracle poster service includes the new market's price feed
 *
 * Usage:
 *   npx hardhat run scripts/deploy/09-add-market.js --network paxeer-network
 *
 * To add more markets later, append entries to the NEW_MARKETS array.
 */

// ============================================================
//  MARKET DEFINITIONS — add your new markets here
// ============================================================

const NEW_MARKETS = [
  {
    name: "Tesla",
    symbol: "TSLA",
    price: "426.21",
    maxLeverage: "500",
    maintenanceMarginBps: "100",       // 1.00%
    maxOpenInterest: "5000000",        // $5M
    virtualLiquidity: "1000000",       // $1M depth
    dampingFactor: "5000",             // 50%
  },
  {
    name: "NVIDIA",
    symbol: "NVDA",
    price: "187.66",
    maxLeverage: "500",
    maintenanceMarginBps: "100",       // 1.00%
    maxOpenInterest: "10000000",       // $10M
    virtualLiquidity: "1000000",
    dampingFactor: "5000",
  },
  {
    name: "Nasdaq 100",
    symbol: "NAS100",
    price: "25195.0",
    maxLeverage: "500",
    maintenanceMarginBps: "100",       // 1.00%
    maxOpenInterest: "10000000",       // $10M
    virtualLiquidity: "1000000",
    dampingFactor: "5000",
  },
  {
    name: "Gold",
    symbol: "XAU",
    price: "5072.5",
    maxLeverage: "500",
    maintenanceMarginBps: "100",       // 1.00%
    maxOpenInterest: "10000000",       // $10M
    virtualLiquidity: "1000000",
    dampingFactor: "5000",
  },
  {
    name: "S&P 500",
    symbol: "SPX500",
    price: "6943.33",
    maxLeverage: "500",
    maintenanceMarginBps: "100",       // 1.00%
    maxOpenInterest: "10000000",       // $10M
    virtualLiquidity: "1000000",
    dampingFactor: "5000",
  },
  {
    name: "Alphabet",
    symbol: "GOOGL",
    price: "311.84",
    maxLeverage: "500",
    maintenanceMarginBps: "100",       // 1.00%
    maxOpenInterest: "5000000",        // $5M
    virtualLiquidity: "1000000",
    dampingFactor: "5000",
  },
];

// ============================================================
//  MAIN
// ============================================================

async function main() {
  const [admin] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  ADD NEW MARKET(S)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Admin:    ${admin.address}`);
  console.log(`  Markets:  ${NEW_MARKETS.length}`);
  console.log("");

  // --- Load deployment manifest ---
  const deploymentPath = path.join(__dirname, "..", "..", "deployments", `${network}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment manifest not found: ${deploymentPath}\nRun deploy-all.js first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond address not found in deployment manifest.");
  }
  console.log(`  Diamond:  ${diamondAddress}\n`);

  // --- Get facet interfaces ---
  const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);
  const marketRegistry = await ethers.getContractAt("MarketRegistryFacet", diamondAddress);
  const oracle = await ethers.getContractAt("OracleFacet", diamondAddress);
  const virtualAMM = await ethers.getContractAt("VirtualAMMFacet", diamondAddress);

  // --- Verify roles ---
  const MARKET_ADMIN_ROLE = await accessControl.MARKET_ADMIN_ROLE();
  const ORACLE_POSTER_ROLE = await accessControl.ORACLE_POSTER_ROLE();

  const hasMarketAdmin = await accessControl.hasRole(MARKET_ADMIN_ROLE, admin.address);
  const hasOraclePoster = await accessControl.hasRole(ORACLE_POSTER_ROLE, admin.address);

  if (!hasMarketAdmin) {
    throw new Error(`Signer ${admin.address} does not have MARKET_ADMIN_ROLE.`);
  }
  if (!hasOraclePoster) {
    throw new Error(`Signer ${admin.address} does not have ORACLE_POSTER_ROLE.`);
  }
  console.log("  Roles verified: MARKET_ADMIN ✓  ORACLE_POSTER ✓\n");

  // --- List existing markets ---
  const totalExisting = await marketRegistry.totalMarkets();
  console.log(`  Existing markets: ${totalExisting}\n`);

  // --- Process each new market ---
  const results = [];

  for (const m of NEW_MARKETS) {
    console.log("─── Adding: " + m.name + " (" + m.symbol + ") ───────────────────");

    const maxLev = ethers.parseEther(m.maxLeverage);
    const maintenanceBps = Number(m.maintenanceMarginBps);
    const maxOI = ethers.parseEther(m.maxOpenInterest);
    const initialPrice = ethers.parseEther(m.price);
    const virtualLiq = ethers.parseEther(m.virtualLiquidity);
    const damping = Number(m.dampingFactor);

    console.log(`  Max leverage:     ${m.maxLeverage}x`);
    console.log(`  Maintenance:      ${maintenanceBps} bps (${maintenanceBps / 100}%)`);
    console.log(`  Max OI:           $${Number(m.maxOpenInterest).toLocaleString()}`);
    console.log(`  Initial price:    $${m.price}`);
    console.log(`  Virtual liq:      $${Number(m.virtualLiquidity).toLocaleString()}`);
    console.log(`  Damping factor:   ${damping} bps (${damping / 100}%)`);

    // ── Step 1: Create Market ──────────────────────────────────
    let marketId;
    try {
      console.log("\n  [1/3] Creating market...");
      const tx = await marketRegistry.createMarket(
        m.name,
        m.symbol,
        maxLev,
        maintenanceBps,
        maxOI
      );
      const receipt = await tx.wait();

      // Parse MarketCreated event to get the assigned marketId
      const event = receipt.logs.find((log) => {
        try {
          const parsed = marketRegistry.interface.parseLog(log);
          return parsed && parsed.name === "MarketCreated";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = marketRegistry.interface.parseLog(event);
        marketId = Number(parsed.args.marketId);
      } else {
        // Fallback: read totalMarkets - 1
        const total = await marketRegistry.totalMarkets();
        marketId = Number(total) - 1;
      }

      console.log(`         Market ID: ${marketId}`);
      console.log(`         TX: ${tx.hash}`);
    } catch (err) {
      console.log(`         FAILED: ${err.reason || err.message}`);
      results.push({ symbol: m.symbol, status: "failed", step: "createMarket", error: err.reason || err.message });
      continue;
    }

    // ── Step 2: Post Initial Oracle Price ──────────────────────
    try {
      console.log("  [2/3] Posting initial oracle price...");
      const tx = await oracle.batchUpdatePrices([marketId], [initialPrice]);
      await tx.wait();
      console.log(`         Price: $${m.price} → market ${marketId}`);
      console.log(`         TX: ${tx.hash}`);
    } catch (err) {
      console.log(`         FAILED: ${err.reason || err.message}`);
      console.log("         ⚠ Market created but oracle price not set — pool init will fail.");
      results.push({ symbol: m.symbol, marketId, status: "partial", step: "batchUpdatePrices", error: err.reason || err.message });
      continue;
    }

    // ── Step 3: Initialize vAMM Pool ───────────────────────────
    try {
      console.log("  [3/3] Initializing vAMM pool...");
      const tx = await virtualAMM.initializePool(
        marketId,
        initialPrice,
        virtualLiq,
        damping
      );
      await tx.wait();
      console.log(`         Pool initialized for market ${marketId}`);
      console.log(`         TX: ${tx.hash}`);
    } catch (err) {
      console.log(`         FAILED: ${err.reason || err.message}`);
      results.push({ symbol: m.symbol, marketId, status: "partial", step: "initializePool", error: err.reason || err.message });
      continue;
    }

    // ── Verify ─────────────────────────────────────────────────
    const [name, symbol, maxLeverage, maintenanceMarginBps, maxOpenInterest, enabled] =
      await marketRegistry.getMarket(marketId);
    const [price, timestamp] = await oracle.getPrice(marketId);

    console.log("\n  ✓ VERIFIED:");
    console.log(`    Market:  [${marketId}] ${name} (${symbol})`);
    console.log(`    Enabled: ${enabled}`);
    console.log(`    Leverage: ${ethers.formatEther(maxLeverage)}x`);
    console.log(`    Price:   $${ethers.formatEther(price)}`);
    console.log("");

    results.push({
      symbol: m.symbol,
      name: m.name,
      marketId,
      status: "success",
      maxLeverage: m.maxLeverage,
      maintenanceMarginBps: maintenanceBps,
      maxOpenInterest: m.maxOpenInterest,
      initialPrice: m.price,
    });
  }

  // --- Update deployment manifest ---
  if (!deployment.markets) deployment.markets = [];
  for (const r of results.filter((r) => r.status === "success")) {
    deployment.markets.push({
      marketId: r.marketId,
      name: r.name,
      symbol: r.symbol,
      maxLeverage: r.maxLeverage + "x",
      maintenanceMarginBps: r.maintenanceMarginBps,
      maxOpenInterest: "$" + Number(r.maxOpenInterest).toLocaleString(),
      initialPrice: "$" + r.initialPrice,
      addedAt: new Date().toISOString(),
    });
  }
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  // --- Summary ---
  const succeeded = results.filter((r) => r.status === "success");
  const partial = results.filter((r) => r.status === "partial");
  const failed = results.filter((r) => r.status === "failed");

  console.log("═══════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  ✓ Success: ${succeeded.length}`);
  for (const r of succeeded) {
    console.log(`    [${r.marketId}] ${r.name} (${r.symbol}) — $${r.initialPrice}`);
  }
  if (partial.length > 0) {
    console.log(`  ⚠ Partial: ${partial.length}`);
    for (const r of partial) {
      console.log(`    [${r.marketId}] ${r.symbol} — failed at ${r.step}: ${r.error}`);
    }
  }
  if (failed.length > 0) {
    console.log(`  ✗ Failed:  ${failed.length}`);
    for (const r of failed) {
      console.log(`    ${r.symbol} — failed at ${r.step}: ${r.error}`);
    }
  }
  console.log("═══════════════════════════════════════════════════════");

  if (succeeded.length > 0) {
    console.log("\n  📋 NEXT STEPS:");
    console.log("  1. Add new market(s) to .keeper/config.js MARKETS array:");
    for (const r of succeeded) {
      console.log(`     { marketId: ${r.marketId}, symbol: "${r.symbol}" },`);
    }
    console.log("  2. Add the symbol(s) to the oracle poster price feed list");
    console.log("  3. Restart the keeper: cd .keeper && node index.js");
    console.log("  4. The indexer will pick up MarketCreated events automatically");
    console.log("");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Add market failed:", error);
    process.exit(1);
  });
