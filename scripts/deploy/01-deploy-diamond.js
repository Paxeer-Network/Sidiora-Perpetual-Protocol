const { ethers } = require("hardhat");
const {
  deployContract,
  getSelectors,
  FacetCutAction,
  loadDeployment,
  saveDeployment,
  recordFacet,
} = require("../helpers/diamond-helpers");

/**
 * Step 1: Deploy Diamond proxy + core facets (DiamondCut, DiamondLoupe, Ownership)
 *
 * This is the foundation — must run first.
 * Creates the Diamond contract and registers the three core EIP-2535 facets.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 1: Deploy Diamond + Core Facets");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("");

  const deployment = loadDeployment(network);

  // --- 1. Deploy DiamondCutFacet ---
  console.log("Deploying DiamondCutFacet...");
  const diamondCutFacet = await deployContract("DiamondCutFacet");
  const diamondCutFacetAddr = await diamondCutFacet.getAddress();
  recordFacet(deployment, "DiamondCutFacet", diamondCutFacetAddr, getSelectors(diamondCutFacet));

  // --- 2. Deploy Diamond ---
  console.log("\nDeploying Diamond proxy...");
  const diamond = await deployContract("Diamond", deployer.address, diamondCutFacetAddr);
  const diamondAddress = await diamond.getAddress();
  deployment.diamondAddress = diamondAddress;
  console.log(`\n  💎 Diamond deployed at: ${diamondAddress}`);

  // --- 3. Deploy DiamondLoupeFacet ---
  console.log("\nDeploying DiamondLoupeFacet...");
  const loupeFacet = await deployContract("DiamondLoupeFacet");
  const loupeAddr = await loupeFacet.getAddress();
  const loupeSelectors = getSelectors(loupeFacet);
  recordFacet(deployment, "DiamondLoupeFacet", loupeAddr, loupeSelectors);

  // --- 4. Deploy OwnershipFacet ---
  console.log("\nDeploying OwnershipFacet...");
  const ownershipFacet = await deployContract("OwnershipFacet");
  const ownershipAddr = await ownershipFacet.getAddress();
  const ownershipSelectors = getSelectors(ownershipFacet);
  recordFacet(deployment, "OwnershipFacet", ownershipAddr, ownershipSelectors);

  // --- 5. Diamond Cut: add Loupe + Ownership ---
  console.log("\nPerforming diamond cut to add core facets...");
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  const tx = await diamondCut.diamondCut(
    [
      {
        facetAddress: loupeAddr,
        action: FacetCutAction.Add,
        functionSelectors: loupeSelectors,
      },
      {
        facetAddress: ownershipAddr,
        action: FacetCutAction.Add,
        functionSelectors: ownershipSelectors,
      },
    ],
    ethers.ZeroAddress,
    "0x"
  );
  await tx.wait();
  console.log("  ✓ DiamondLoupeFacet + OwnershipFacet added to diamond");

  // --- 6. Verify ---
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);
  const facets = await loupe.facets();
  console.log(`\n  Registered facets: ${facets.length}`);

  const ownership = await ethers.getContractAt("OwnershipFacet", diamondAddress);
  const owner = await ownership.owner();
  console.log(`  Diamond owner: ${owner}`);

  // --- Save ---
  saveDeployment(network, deployment);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ STEP 1 COMPLETE — Diamond + Core Facets deployed");
  console.log("═══════════════════════════════════════════════════════\n");

  return { diamondAddress, deployment };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

module.exports = main;
