const { ethers } = require("hardhat");
const {
  loadDeployment,
  saveDeployment,
  verifyDiamondState,
} = require("../helpers/diamond-helpers");

/**
 * Step 6: Initialize the protocol
 *
 * This script performs all post-deployment configuration:
 *   1. Grant roles (MARKET_ADMIN, ORACLE_POSTER, KEEPER, PAUSER, PROTOCOL_FUNDER, INSURANCE_ADMIN)
 *   2. Whitelist collateral tokens
 *   3. Create initial markets (BTC, ETH)
 *   4. Set fee configuration
 *   5. Set oracle staleness threshold
 *   6. Initialize vAMM pools (requires oracle prices to be posted first)
 *
 * Prerequisites: Steps 1-5 complete
 *
 * IMPORTANT: Update the addresses and parameters below before running on mainnet!
 */

// ============================================================
//  ⚙️  CONFIGURATION — UPDATE THESE BEFORE MAINNET DEPLOYMENT
// ============================================================

const CONFIG = {
  // --- Role Addresses ---
  // Set these to the actual operator addresses for your deployment
  roles: {
    marketAdmin: null,       // Will default to deployer
    oraclePoster: null,      // Will default to deployer
    keeper: null,            // Will default to deployer
    pauser: null,            // Will default to deployer
    protocolFunder: null,    // Will default to deployer
    insuranceAdmin: null,    // Will default to deployer
  },

  // --- Collateral Tokens ---
  // Add the addresses of accepted stablecoin collateral on your target chain
  // Set to null to skip (useful if tokens aren't deployed yet)
  collateral: {
    USDC: null,  // e.g., "0x..."
    USDT: null,
    DAI: null,
  },

  // --- Fee Configuration (basis points) ---
  fees: {
    takerFeeBps: 10,          // 0.10%
    makerFeeBps: 5,           // 0.05%
    liquidationFeeBps: 500,   // 5.00%
    insuranceFeeBps: 2000,    // 20% of trading fees go to insurance
  },

  // --- Oracle ---
  maxPriceStaleness: 120, // seconds

  // --- Markets ---
  markets: [
    {
      name: "Bitcoin",
      symbol: "BTC",
      maxLeverage: ethers.parseEther("1000"),   // 1000x
      maintenanceMarginBps: 50,                  // 0.50%
      maxOpenInterest: ethers.parseEther("10000000"), // $10M
    },
    {
      name: "Ethereum",
      symbol: "ETH",
      maxLeverage: ethers.parseEther("1000"),
      maintenanceMarginBps: 50,
      maxOpenInterest: ethers.parseEther("10000000"),
    },
    {
      name: "Solana",
      symbol: "SOL",
      maxLeverage: ethers.parseEther("500"),
      maintenanceMarginBps: 100,                 // 1.00%
      maxOpenInterest: ethers.parseEther("5000000"),
    },
    {
      name: "Avalanche",
      symbol: "AVAX",
      maxLeverage: ethers.parseEther("500"),
      maintenanceMarginBps: 100,
      maxOpenInterest: ethers.parseEther("5000000"),
    },
    {
      name: "Chainlink",
      symbol: "LINK",
      maxLeverage: ethers.parseEther("200"),
      maintenanceMarginBps: 150,                 // 1.50%
      maxOpenInterest: ethers.parseEther("3000000"),
    },
  ],

  // --- vAMM Initialization ---
  // These require oracle prices to be posted first.
  // Set initialPrices to null to skip vAMM init (do it separately after oracle is live).
  vammPools: {
    virtualLiquidity: ethers.parseEther("1000000"), // $1M per pool
    dampingFactor: 5000,                             // 50%
    // marketId → initial price (set null to skip)
    initialPrices: null, // e.g., { 0: ethers.parseEther("50000"), 1: ethers.parseEther("3000") }
  },
};

// ============================================================

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 6: Initialize Protocol");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("");

  const deployment = loadDeployment(network);
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond not deployed yet. Run steps 01-05 first.");
  }
  console.log(`  Diamond:  ${diamondAddress}\n`);

  // --- Get facet interfaces ---
  const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);
  const collateral = await ethers.getContractAt("CollateralFacet", diamondAddress);
  const marketRegistry = await ethers.getContractAt("MarketRegistryFacet", diamondAddress);
  const oracle = await ethers.getContractAt("OracleFacet", diamondAddress);
  const virtualAMM = await ethers.getContractAt("VirtualAMMFacet", diamondAddress);
  const insuranceFund = await ethers.getContractAt("InsuranceFundFacet", diamondAddress);

  // ============================================================
  //  1. GRANT ROLES
  // ============================================================
  console.log("1️⃣  Granting roles...");

  const MARKET_ADMIN = await accessControl.MARKET_ADMIN_ROLE();
  const ORACLE_POSTER = await accessControl.ORACLE_POSTER_ROLE();
  const KEEPER = await accessControl.KEEPER_ROLE();
  const PAUSER = await accessControl.PAUSER_ROLE();
  const PROTOCOL_FUNDER = await accessControl.PROTOCOL_FUNDER_ROLE();
  const INSURANCE_ADMIN = await accessControl.INSURANCE_ADMIN_ROLE();

  const roleAssignments = [
    { role: MARKET_ADMIN, name: "MARKET_ADMIN", addr: CONFIG.roles.marketAdmin || deployer.address },
    { role: ORACLE_POSTER, name: "ORACLE_POSTER", addr: CONFIG.roles.oraclePoster || deployer.address },
    { role: KEEPER, name: "KEEPER", addr: CONFIG.roles.keeper || deployer.address },
    { role: PAUSER, name: "PAUSER", addr: CONFIG.roles.pauser || deployer.address },
    { role: PROTOCOL_FUNDER, name: "PROTOCOL_FUNDER", addr: CONFIG.roles.protocolFunder || deployer.address },
    { role: INSURANCE_ADMIN, name: "INSURANCE_ADMIN", addr: CONFIG.roles.insuranceAdmin || deployer.address },
  ];

  for (const { role, name, addr } of roleAssignments) {
    const hasRole = await accessControl.hasRole(role, addr);
    if (!hasRole) {
      const tx = await accessControl.grantRole(role, addr);
      await tx.wait();
      console.log(`  ✓ ${name} → ${addr}`);
    } else {
      console.log(`  ○ ${name} → ${addr} (already granted)`);
    }
  }

  // ============================================================
  //  2. WHITELIST COLLATERAL
  // ============================================================
  console.log("\n2️⃣  Whitelisting collateral tokens...");

  for (const [symbol, addr] of Object.entries(CONFIG.collateral)) {
    if (!addr) {
      console.log(`  ○ ${symbol}: skipped (address not set)`);
      continue;
    }
    const isAccepted = await collateral.isAcceptedCollateral(addr);
    if (!isAccepted) {
      const tx = await collateral.addCollateral(addr);
      await tx.wait();
      const decimals = await collateral.getCollateralDecimals(addr);
      console.log(`  ✓ ${symbol} (${addr}) — ${decimals} decimals`);
    } else {
      console.log(`  ○ ${symbol} (${addr}) — already whitelisted`);
    }
  }

  // ============================================================
  //  3. SET FEES
  // ============================================================
  console.log("\n3️⃣  Setting fee configuration...");

  const tx3 = await marketRegistry.setFees(
    CONFIG.fees.takerFeeBps,
    CONFIG.fees.makerFeeBps,
    CONFIG.fees.liquidationFeeBps,
    CONFIG.fees.insuranceFeeBps
  );
  await tx3.wait();
  console.log(`  ✓ Taker: ${CONFIG.fees.takerFeeBps}bps, Maker: ${CONFIG.fees.makerFeeBps}bps`);
  console.log(`  ✓ Liquidation: ${CONFIG.fees.liquidationFeeBps}bps, Insurance cut: ${CONFIG.fees.insuranceFeeBps}bps`);

  // ============================================================
  //  4. SET ORACLE STALENESS
  // ============================================================
  console.log("\n4️⃣  Setting oracle staleness threshold...");

  const tx4 = await oracle.setMaxPriceStaleness(CONFIG.maxPriceStaleness);
  await tx4.wait();
  console.log(`  ✓ Max staleness: ${CONFIG.maxPriceStaleness}s`);

  // ============================================================
  //  5. CREATE MARKETS
  // ============================================================
  console.log("\n5️⃣  Creating markets...");

  for (let i = 0; i < CONFIG.markets.length; i++) {
    const m = CONFIG.markets[i];
    try {
      const tx = await marketRegistry.createMarket(
        m.name,
        m.symbol,
        m.maxLeverage,
        m.maintenanceMarginBps,
        m.maxOpenInterest
      );
      await tx.wait();
      console.log(
        `  ✓ [${i}] ${m.name} (${m.symbol}) — ` +
        `${ethers.formatEther(m.maxLeverage)}x max leverage, ` +
        `${m.maintenanceMarginBps}bps maintenance`
      );
    } catch (err) {
      console.log(`  ⚠ [${i}] ${m.name} (${m.symbol}) — failed: ${err.reason || err.message}`);
    }
  }

  // ============================================================
  //  6. INITIALIZE vAMM POOLS (optional — requires oracle prices)
  // ============================================================
  if (CONFIG.vammPools.initialPrices) {
    console.log("\n6️⃣  Initializing vAMM pools...");

    for (const [marketIdStr, price] of Object.entries(CONFIG.vammPools.initialPrices)) {
      const marketId = Number(marketIdStr);
      try {
        const tx = await virtualAMM.initializePool(
          marketId,
          price,
          CONFIG.vammPools.virtualLiquidity,
          CONFIG.vammPools.dampingFactor
        );
        await tx.wait();
        console.log(
          `  ✓ Market ${marketId}: price=${ethers.formatEther(price)}, ` +
          `liquidity=${ethers.formatEther(CONFIG.vammPools.virtualLiquidity)}`
        );
      } catch (err) {
        console.log(`  ⚠ Market ${marketId}: failed: ${err.reason || err.message}`);
      }
    }
  } else {
    console.log("\n6️⃣  vAMM initialization skipped (no initial prices configured)");
    console.log("    → Post oracle prices first, then call initializePool() per market");
  }

  // ============================================================
  //  7. VERIFY DIAMOND STATE
  // ============================================================
  await verifyDiamondState(diamondAddress, deployment);

  // --- Save deployment with init record ---
  deployment.initialized = {
    roles: roleAssignments.map((r) => ({ name: r.name, address: r.addr })),
    markets: CONFIG.markets.map((m) => m.symbol),
    fees: CONFIG.fees,
    oracleStaleness: CONFIG.maxPriceStaleness,
    timestamp: new Date().toISOString(),
  };
  saveDeployment(network, deployment);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ STEP 6 COMPLETE — Protocol initialized");
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n  📋 Post-deployment checklist:");
  console.log("     □ Fund CentralVault via PROTOCOL_FUNDER");
  console.log("     □ Post initial oracle prices via ORACLE_POSTER");
  console.log("     □ Initialize vAMM pools (if not done above)");
  console.log("     □ Verify all collateral tokens are whitelisted");
  console.log("     □ Transfer ownership if needed");
  console.log("");

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Initialization failed:", error);
    process.exit(1);
  });

module.exports = main;
