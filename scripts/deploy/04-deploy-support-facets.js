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
 * Step 4: Deploy & cut support facets
 *
 * Facets: AccessControlFacet, PausableFacet, VaultFactoryFacet,
 *         CentralVaultFacet, CollateralFacet, MarketRegistryFacet,
 *         InsuranceFundFacet, QuoterFacet
 *
 * Prerequisites: Step 1 (Diamond deployed)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 4: Deploy Support Facets");
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

  // --- Deploy support facets ---
  const supportFacets = [
    "AccessControlFacet",
    "PausableFacet",
    "VaultFactoryFacet",
    "CentralVaultFacet",
    "CollateralFacet",
    "MarketRegistryFacet",
    "InsuranceFundFacet",
    "QuoterFacet",
  ];

  const cutEntries = [];

  for (const facetName of supportFacets) {
    console.log(`Deploying ${facetName}...`);
    const facet = await deployContract(facetName);
    const facetAddr = await facet.getAddress();

    let selectors = getSelectors(facet);
    selectors = await filterNewSelectors(selectors, loupe);

    if (selectors.length === 0) {
      console.log(`  ⚠ ${facetName}: all selectors already registered, skipping`);
      recordFacet(deployment, facetName, facetAddr, []);
      continue;
    }

    recordFacet(deployment, facetName, facetAddr, selectors);
    cutEntries.push({ facetAddress: facetAddr, selectors });
  }

  // --- Batch diamond cut ---
  console.log("\nPerforming batch diamond cut for support facets...");
  await batchDiamondCut(diamondAddress, cutEntries);

  // --- Save ---
  saveDeployment(network, deployment);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ STEP 4 COMPLETE — Support facets deployed & cut");
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
