const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const {
  deployContract,
  getSelectors,
  FacetCutAction,
  batchDiamondCut,
  loadDeployment,
  saveDeployment,
  recordFacet,
  recordContract,
  verifyDiamondState,
} = require("../helpers/diamond-helpers");

/**
 * Full deployment script — runs all 6 steps sequentially in a single transaction context.
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-all.js --network paxeer-network
 *
 * This is equivalent to running steps 01-06 individually but in one go,
 * which is useful for fresh deployments and local testing.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║      PERPETUAL PRODUCT MARKET MAKER — FULL DEPLOY    ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("");

  const deployment = loadDeployment(network);

  // ============================================================
  //  STEP 1: Diamond + Core Facets
  // ============================================================
  console.log("═══ STEP 1: Diamond + Core Facets ═══════════════════");

  const diamondCutFacet = await deployContract("DiamondCutFacet");
  const diamondCutFacetAddr = await diamondCutFacet.getAddress();
  recordFacet(deployment, "DiamondCutFacet", diamondCutFacetAddr, getSelectors(diamondCutFacet));

  const diamond = await deployContract("Diamond", deployer.address, diamondCutFacetAddr);
  const diamondAddress = await diamond.getAddress();
  deployment.diamondAddress = diamondAddress;
  console.log(`\n  💎 Diamond: ${diamondAddress}\n`);

  const loupeFacet = await deployContract("DiamondLoupeFacet");
  const ownershipFacet = await deployContract("OwnershipFacet");

  const loupeAddr = await loupeFacet.getAddress();
  const ownershipAddr = await ownershipFacet.getAddress();
  const loupeSelectors = getSelectors(loupeFacet);
  const ownershipSelectors = getSelectors(ownershipFacet);

  recordFacet(deployment, "DiamondLoupeFacet", loupeAddr, loupeSelectors);
  recordFacet(deployment, "OwnershipFacet", ownershipAddr, ownershipSelectors);

  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  await (await diamondCut.diamondCut(
    [
      { facetAddress: loupeAddr, action: FacetCutAction.Add, functionSelectors: loupeSelectors },
      { facetAddress: ownershipAddr, action: FacetCutAction.Add, functionSelectors: ownershipSelectors },
    ],
    ethers.ZeroAddress, "0x"
  )).wait();
  console.log("  ✓ Core facets added\n");

  const loupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

  // Local selector tracker — prevents duplicates across all batches within this script
  const registeredSelectors = new Set();
  // Seed with selectors already on-chain (DiamondCut + Loupe + Ownership)
  for (const s of getSelectors(diamondCutFacet)) registeredSelectors.add(s);
  for (const s of loupeSelectors) registeredSelectors.add(s);
  for (const s of ownershipSelectors) registeredSelectors.add(s);

  // Helper: deduplicate against local tracker
  function dedup(allSels) {
    const fresh = allSels.filter((s) => !registeredSelectors.has(s));
    for (const s of fresh) registeredSelectors.add(s);
    return fresh;
  }

  // ============================================================
  //  STEP 2: Trading Facets
  // ============================================================
  console.log("═══ STEP 2: Trading Facets ══════════════════════════");

  const tradingFacets = ["PositionFacet", "OrderBookFacet", "LiquidationFacet", "FundingRateFacet"];
  let cutEntries = [];

  for (const name of tradingFacets) {
    const facet = await deployContract(name);
    const addr = await facet.getAddress();
    let sels = dedup(getSelectors(facet));
    recordFacet(deployment, name, addr, sels);
    cutEntries.push({ facetAddress: addr, selectors: sels });
  }

  await batchDiamondCut(diamondAddress, cutEntries);
  console.log("");

  // ============================================================
  //  STEP 3: Pricing Facets
  // ============================================================
  console.log("═══ STEP 3: Pricing Facets ══════════════════════════");

  const pricingFacets = ["OracleFacet", "VirtualAMMFacet", "PriceFeedFacet"];
  cutEntries = [];

  for (const name of pricingFacets) {
    const facet = await deployContract(name);
    const addr = await facet.getAddress();
    const allSels = getSelectors(facet);
    let sels = dedup(allSels);
    if (sels.length < allSels.length) {
      console.log(`  ⚠ ${name}: ${allSels.length - sels.length} duplicate(s) skipped`);
    }
    recordFacet(deployment, name, addr, sels);
    cutEntries.push({ facetAddress: addr, selectors: sels });
  }

  await batchDiamondCut(diamondAddress, cutEntries);
  console.log("");

  // ============================================================
  //  STEP 4: Support Facets
  // ============================================================
  console.log("═══ STEP 4: Support Facets ══════════════════════════");

  const supportFacets = [
    "AccessControlFacet", "PausableFacet", "VaultFactoryFacet",
    "CentralVaultFacet", "CollateralFacet", "MarketRegistryFacet",
    "InsuranceFundFacet", "QuoterFacet",
  ];
  cutEntries = [];

  for (const name of supportFacets) {
    const facet = await deployContract(name);
    const addr = await facet.getAddress();
    let sels = dedup(getSelectors(facet));
    recordFacet(deployment, name, addr, sels);
    if (sels.length > 0) {
      cutEntries.push({ facetAddress: addr, selectors: sels });
    } else {
      console.log(`  ⚠ ${name}: all selectors already registered, skipping`);
    }
  }

  await batchDiamondCut(diamondAddress, cutEntries);
  console.log("");

  // ============================================================
  //  STEP 5: UserVault Implementation
  // ============================================================
  console.log("═══ STEP 5: UserVault Implementation ════════════════");

  const userVaultImpl = await deployContract("UserVault");
  const implAddr = await userVaultImpl.getAddress();
  recordContract(deployment, "UserVaultImplementation", implAddr);

  const vaultFactory = await ethers.getContractAt("VaultFactoryFacet", diamondAddress);
  await (await vaultFactory.setImplementation(implAddr)).wait();
  console.log("  ✓ UserVault implementation registered\n");

  // ============================================================
  //  STEP 6: Initialize Protocol
  // ============================================================
  console.log("═══ STEP 6: Initialize Protocol ═════════════════════");

  const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);
  const marketRegistry = await ethers.getContractAt("MarketRegistryFacet", diamondAddress);
  const oracle = await ethers.getContractAt("OracleFacet", diamondAddress);

  // Grant all roles to deployer
  const roleNames = [
    "MARKET_ADMIN_ROLE", "ORACLE_POSTER_ROLE", "KEEPER_ROLE",
    "PAUSER_ROLE", "PROTOCOL_FUNDER_ROLE", "INSURANCE_ADMIN_ROLE",
  ];
  for (const roleName of roleNames) {
    const role = await accessControl[roleName]();
    const hasRole = await accessControl.hasRole(role, deployer.address);
    if (!hasRole) {
      await (await accessControl.grantRole(role, deployer.address)).wait();
    }
    console.log(`  ✓ ${roleName} → deployer`);
  }

  // Set fees
  await (await marketRegistry.setFees(10, 5, 500, 2000)).wait();
  console.log("  ✓ Fees configured (10/5/500/2000 bps)");

  // Set oracle staleness
  await (await oracle.setMaxPriceStaleness(120)).wait();
  console.log("  ✓ Oracle staleness: 120s");

  // Create markets
  const markets = [
    ["Bitcoin", "BTC", ethers.parseEther("1000"), 50, ethers.parseEther("10000000")],
    ["Ethereum", "ETH", ethers.parseEther("1000"), 50, ethers.parseEther("10000000")],
    ["Solana", "SOL", ethers.parseEther("500"), 100, ethers.parseEther("5000000")],
    ["Avalanche", "AVAX", ethers.parseEther("500"), 100, ethers.parseEther("5000000")],
    ["Chainlink", "LINK", ethers.parseEther("200"), 150, ethers.parseEther("3000000")],
  ];

  for (let i = 0; i < markets.length; i++) {
    const [name, symbol, maxLev, margin, maxOI] = markets[i];
    await (await marketRegistry.createMarket(name, symbol, maxLev, margin, maxOI)).wait();
    console.log(`  ✓ Market [${i}]: ${name} (${symbol})`);
  }

  // ============================================================
  //  VERIFICATION
  // ============================================================
  await verifyDiamondState(diamondAddress, deployment);

  // Save
  deployment.initialized = {
    markets: markets.map((m) => m[1]),
    fees: { taker: 10, maker: 5, liquidation: 500, insurance: 2000 },
    oracleStaleness: 120,
    timestamp: new Date().toISOString(),
  };
  saveDeployment(network, deployment);

  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║           ✅ FULL DEPLOYMENT COMPLETE                ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log(`\n  Diamond Address: ${diamondAddress}`);
  console.log(`  Total Facets:   ${Object.keys(deployment.facets).length}`);
  console.log(`  Markets:        ${markets.length}`);
  console.log("");
  console.log("  📋 Remaining steps:");
  console.log("     □ Set collateral token addresses & whitelist them");
  console.log("     □ Fund CentralVault");
  console.log("     □ Post initial oracle prices");
  console.log("     □ Initialize vAMM pools per market");
  console.log("     □ Assign production role addresses (replace deployer)");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Full deployment failed:", error);
    process.exit(1);
  });
