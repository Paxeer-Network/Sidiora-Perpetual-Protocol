const { ethers } = require("hardhat");
const {
  deployContract,
  loadDeployment,
  saveDeployment,
  recordContract,
} = require("../helpers/diamond-helpers");

/**
 * Step 5: Deploy UserVault implementation contract
 *
 * This is the EIP-1167 minimal proxy template that VaultFactoryFacet
 * clones for each user. Must be deployed before any user can create a vault.
 *
 * After deployment, calls VaultFactoryFacet.setImplementation() to register it.
 *
 * Prerequisites: Steps 1-4 (Diamond + all facets deployed)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 5: Deploy UserVault Implementation");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("");

  const deployment = loadDeployment(network);
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond not deployed yet. Run steps 01-04 first.");
  }
  console.log(`  Diamond:  ${diamondAddress}\n`);

  // --- Deploy UserVault implementation ---
  console.log("Deploying UserVault implementation...");
  const userVaultImpl = await deployContract("UserVault");
  const implAddr = await userVaultImpl.getAddress();
  recordContract(deployment, "UserVaultImplementation", implAddr);

  // --- Register implementation on VaultFactoryFacet ---
  console.log("\nRegistering implementation on VaultFactoryFacet...");
  const vaultFactory = await ethers.getContractAt(
    "VaultFactoryFacet",
    diamondAddress
  );
  const tx = await vaultFactory.setImplementation(implAddr);
  await tx.wait();
  console.log("  ✓ UserVault implementation set on VaultFactoryFacet");

  // --- Verify ---
  const registeredImpl = await vaultFactory.getUserVaultImplementation();
  if (registeredImpl === implAddr) {
    console.log("  ✓ Verified: implementation matches deployed address");
  } else {
    console.log("  ✗ WARNING: implementation mismatch!");
    console.log(`    Expected: ${implAddr}`);
    console.log(`    Got:      ${registeredImpl}`);
  }

  // --- Save ---
  saveDeployment(network, deployment);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ STEP 5 COMPLETE — UserVault implementation deployed");
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
