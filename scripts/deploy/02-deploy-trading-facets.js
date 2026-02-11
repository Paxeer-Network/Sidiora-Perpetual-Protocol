const { ethers } = require("hardhat");
const {
  deployContract,
  getSelectors,
  batchDiamondCut,
  loadDeployment,
  saveDeployment,
  recordFacet,
  filterNewSelectors,
} = require("../helpers/diamond-helpers");

/**
 * Step 2: Deploy & cut trading facets
 *
 * Facets: PositionFacet, OrderBookFacet, LiquidationFacet, FundingRateFacet
 *
 * Prerequisites: Step 1 (Diamond + core facets deployed)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 2: Deploy Trading Facets");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("");

  const deployment = loadDeployment(network);
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond not deployed yet. Run step 01 first.");
  }
  console.log(`  Diamond:  ${diamondAddress}\n`);

  const loupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

  // --- Deploy trading facets ---
  const tradingFacets = [
    "PositionFacet",
    "OrderBookFacet",
    "LiquidationFacet",
    "FundingRateFacet",
  ];

  const cutEntries = [];

  for (const facetName of tradingFacets) {
    console.log(`Deploying ${facetName}...`);
    const facet = await deployContract(facetName);
    const facetAddr = await facet.getAddress();

    let selectors = getSelectors(facet);
    // Filter out any selectors already on the diamond (dedup safety)
    selectors = await filterNewSelectors(selectors, loupe);

    recordFacet(deployment, facetName, facetAddr, selectors);
    cutEntries.push({ facetAddress: facetAddr, selectors });
  }

  // --- Batch diamond cut ---
  console.log("\nPerforming batch diamond cut for trading facets...");
  await batchDiamondCut(diamondAddress, cutEntries);

  // --- Save ---
  saveDeployment(network, deployment);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ STEP 2 COMPLETE — Trading facets deployed & cut");
  console.log("═══════════════════════════════════════════════════════\n");

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

module.exports = main;
