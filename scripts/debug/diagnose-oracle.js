const { ethers } = require("hardhat");

/**
 * Diagnose why batchUpdatePrices reverts on-chain.
 *
 * Usage:
 *   npx hardhat run scripts/debug/diagnose-oracle.js --network paxeer-network
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const DIAMOND = "0xeA65FE02665852c615774A3041DFE6f00fb77537";

  console.log("═══════════════════════════════════════════════════════");
  console.log("  ORACLE DIAGNOSTICS");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Caller:  ${deployer.address}`);
  console.log(`  Diamond: ${DIAMOND}\n`);

  const accessControl = await ethers.getContractAt("AccessControlFacet", DIAMOND);
  const oracle = await ethers.getContractAt("OracleFacet", DIAMOND);
  const marketRegistry = await ethers.getContractAt("MarketRegistryFacet", DIAMOND);

  // --- 1. Check roles ---
  console.log("1️⃣  Role checks:");
  const ORACLE_POSTER_ROLE = await accessControl.ORACLE_POSTER_ROLE();
  const hasRole = await accessControl.hasRole(ORACLE_POSTER_ROLE, deployer.address);
  console.log(`   ORACLE_POSTER_ROLE: ${hasRole ? "✓ YES" : "✗ NO"}`);

  const MARKET_ADMIN_ROLE = await accessControl.MARKET_ADMIN_ROLE();
  const hasAdmin = await accessControl.hasRole(MARKET_ADMIN_ROLE, deployer.address);
  console.log(`   MARKET_ADMIN_ROLE:  ${hasAdmin ? "✓ YES" : "✗ NO"}`);

  // --- 2. Check markets exist ---
  console.log("\n2️⃣  Market checks:");
  const totalMarkets = await marketRegistry.totalMarkets();
  console.log(`   Total markets: ${totalMarkets}`);

  for (let i = 0; i < 5; i++) {
    try {
      const info = await marketRegistry.getMarket(i);
      const active = await marketRegistry.isMarketActive(i);
      console.log(`   Market [${i}]: ${info[0]} (${info[1]}) — enabled: ${info[5]}, active: ${active}`);
    } catch (err) {
      console.log(`   Market [${i}]: ERROR — ${err.reason || err.message}`);
    }
  }

  // --- 3. Check oracle staleness config ---
  console.log("\n3️⃣  Oracle config:");
  try {
    const staleness = await oracle.getMaxPriceStaleness();
    console.log(`   Max staleness: ${staleness}s`);
  } catch (err) {
    console.log(`   getMaxPriceStaleness error: ${err.reason || err.message}`);
  }

  // --- 4. Check if poster is authorized ---
  console.log("\n4️⃣  Price poster authorization:");
  try {
    const isAuthorized = await oracle.isAuthorizedPoster(deployer.address);
    console.log(`   isAuthorizedPoster: ${isAuthorized ? "✓ YES" : "✗ NO"}`);
  } catch (err) {
    console.log(`   isAuthorizedPoster error: ${err.reason || err.message}`);
  }

  // --- 5. Try staticCall to get exact revert reason ---
  console.log("\n5️⃣  Static call test (batchUpdatePrices):");
  const testPrices = [
    ethers.parseEther("66000"),  // BTC
    ethers.parseEther("1900"),   // ETH
    ethers.parseEther("78"),     // SOL
    ethers.parseEther("8"),      // AVAX
    ethers.parseEther("8"),      // LINK
  ];

  try {
    await oracle.batchUpdatePrices.staticCall([0, 1, 2, 3, 4], testPrices);
    console.log("   ✓ staticCall succeeded — should work on-chain!");
  } catch (err) {
    console.log(`   ✗ staticCall REVERTED: ${err.reason || err.message}`);
    if (err.data) {
      console.log(`   Raw revert data: ${err.data}`);
    }
  }

  // --- 6. Try single market to isolate which one fails ---
  console.log("\n6️⃣  Per-market static calls:");
  const symbols = ["BTC", "ETH", "SOL", "AVAX", "LINK"];
  for (let i = 0; i < 5; i++) {
    try {
      await oracle.batchUpdatePrices.staticCall([i], [testPrices[i]]);
      console.log(`   Market [${i}] ${symbols[i]}: ✓ OK`);
    } catch (err) {
      console.log(`   Market [${i}] ${symbols[i]}: ✗ REVERTED — ${err.reason || err.message}`);
    }
  }

  // --- 7. Try actual tx with single market ---
  console.log("\n7️⃣  Live tx test (single market — BTC only):");
  try {
    const tx = await oracle.batchUpdatePrices([0], [testPrices[0]], { gasLimit: 300000 });
    const receipt = await tx.wait();
    console.log(`   ✓ TX succeeded! Hash: ${receipt.hash}, Gas: ${receipt.gasUsed}`);
  } catch (err) {
    console.log(`   ✗ TX FAILED: ${err.reason || err.message}`);
    if (err.data) {
      console.log(`   Raw revert data: ${err.data}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Diagnostic failed:", error);
    process.exit(1);
  });
