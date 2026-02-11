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
 * Step 3: Deploy & cut pricing facets
 *
 * Facets: OracleFacet, VirtualAMMFacet, PriceFeedFacet
 *
 * Note: PriceFeedFacet shares getMarkPrice(uint256) with VirtualAMMFacet.
 *       The filterNewSelectors() call ensures no duplicate selector is added.
 *
 * Prerequisites: Step 1 (Diamond deployed)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 3: Deploy Pricing Facets");
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

  // --- Deploy pricing facets ---
  const pricingFacets = [
    "OracleFacet",
    "VirtualAMMFacet",
    "PriceFeedFacet",
  ];

  const cutEntries = [];

  for (const facetName of pricingFacets) {
    console.log(`Deploying ${facetName}...`);
    const facet = await deployContract(facetName);
    const facetAddr = await facet.getAddress();

    let selectors = getSelectors(facet);
    // Filter out duplicates — PriceFeedFacet.getMarkPrice overlaps with VirtualAMMFacet
    selectors = await filterNewSelectors(selectors, loupe);

    if (selectors.length < getSelectors(facet).length) {
      const skipped = getSelectors(facet).length - selectors.length;
      console.log(`  ⚠ ${facetName}: ${skipped} duplicate selector(s) skipped`);
    }

    recordFacet(deployment, facetName, facetAddr, selectors);
    cutEntries.push({ facetAddress: facetAddr, selectors });
  }

  // --- Batch diamond cut ---
  console.log("\nPerforming batch diamond cut for pricing facets...");
  await batchDiamondCut(diamondAddress, cutEntries);

  // --- Save ---
  saveDeployment(network, deployment);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ STEP 3 COMPLETE — Pricing facets deployed & cut");
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
