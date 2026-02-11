const { ethers } = require("hardhat");
const {
  deployContract,
  getSelectors,
  getSelectorsExcept,
  getSelectorsOnly,
  FacetCutAction,
  filterNewSelectors,
  loadDeployment,
  saveDeployment,
  recordFacet,
  verifyDiamondState,
} = require("../helpers/diamond-helpers");

/**
 * Upgrade a single facet on the Diamond
 *
 * Usage:
 *   FACET_NAME=PositionFacet npx hardhat run scripts/upgrade/upgrade-facet.js --network paxeer-network
 *
 * Modes:
 *   - REPLACE (default): Replace all existing selectors with the new facet deployment
 *   - ADD_NEW: Only add selectors that don't exist yet (for adding new functions)
 *   - FULL: Remove old-only selectors, add new-only selectors, replace shared selectors
 *
 * Environment variables:
 *   FACET_NAME    — Required. The contract name of the facet to upgrade (e.g., "PositionFacet")
 *   UPGRADE_MODE  — Optional. One of: REPLACE, ADD_NEW, FULL (default: REPLACE)
 *   DRY_RUN       — Optional. Set to "true" to simulate without executing (default: false)
 */

async function main() {
  const facetName = process.env.FACET_NAME;
  const upgradeMode = process.env.UPGRADE_MODE || "REPLACE";
  const dryRun = process.env.DRY_RUN === "true";

  if (!facetName) {
    console.error("❌ FACET_NAME environment variable is required.");
    console.error("   Usage: FACET_NAME=PositionFacet npx hardhat run scripts/upgrade/upgrade-facet.js --network <network>");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  UPGRADE FACET: ${facetName}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Mode:     ${upgradeMode}`);
  console.log(`  Dry run:  ${dryRun}`);
  console.log("");

  const deployment = loadDeployment(network);
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond not deployed. Deploy first.");
  }
  console.log(`  Diamond: ${diamondAddress}`);

  // --- Check existing facet registration ---
  const existingFacet = deployment.facets[facetName];
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

  let oldSelectors = [];
  if (existingFacet && existingFacet.address) {
    oldSelectors = await loupe.facetFunctionSelectors(existingFacet.address);
    oldSelectors = Array.from(oldSelectors); // Convert from Result to array
    console.log(`  Old facet: ${existingFacet.address}`);
    console.log(`  Old selectors: ${oldSelectors.length}`);
  } else {
    console.log(`  No existing deployment found for ${facetName}`);
  }

  // --- Deploy new facet ---
  console.log(`\nDeploying new ${facetName}...`);
  const newFacet = await deployContract(facetName);
  const newFacetAddr = await newFacet.getAddress();
  const newSelectors = getSelectors(newFacet);
  console.log(`  New selectors: ${newSelectors.length}`);

  // --- Compute selector diff ---
  const oldSet = new Set(oldSelectors.map((s) => s.toLowerCase()));
  const newSet = new Set(newSelectors.map((s) => s.toLowerCase()));

  const toAdd = newSelectors.filter((s) => !oldSet.has(s.toLowerCase()));
  const toRemove = oldSelectors.filter((s) => !newSet.has(s.toLowerCase()));
  const toReplace = newSelectors.filter((s) => oldSet.has(s.toLowerCase()));

  console.log(`\n  📊 Selector diff:`);
  console.log(`     Add:     ${toAdd.length} new selectors`);
  console.log(`     Replace: ${toReplace.length} existing selectors`);
  console.log(`     Remove:  ${toRemove.length} obsolete selectors`);

  if (toAdd.length === 0 && toReplace.length === 0 && toRemove.length === 0) {
    console.log("\n  ⚠ No changes detected. Aborting.");
    return;
  }

  // --- Build diamond cut based on mode ---
  const cuts = [];

  if (upgradeMode === "REPLACE") {
    // Replace all overlapping selectors + add new ones
    if (toReplace.length > 0) {
      cuts.push({
        facetAddress: newFacetAddr,
        action: FacetCutAction.Replace,
        functionSelectors: toReplace,
      });
    }
    if (toAdd.length > 0) {
      cuts.push({
        facetAddress: newFacetAddr,
        action: FacetCutAction.Add,
        functionSelectors: toAdd,
      });
    }
    // Note: REPLACE mode does NOT remove old selectors that aren't in the new facet
    if (toRemove.length > 0) {
      console.log(`\n  ⚠ WARNING: ${toRemove.length} selector(s) in old facet are NOT in new facet.`);
      console.log(`    These will NOT be removed in REPLACE mode.`);
      console.log(`    Use UPGRADE_MODE=FULL to remove them.`);
    }
  } else if (upgradeMode === "ADD_NEW") {
    // Only add new selectors (don't touch existing ones)
    if (toAdd.length > 0) {
      cuts.push({
        facetAddress: newFacetAddr,
        action: FacetCutAction.Add,
        functionSelectors: toAdd,
      });
    } else {
      console.log("\n  ⚠ No new selectors to add. Aborting.");
      return;
    }
  } else if (upgradeMode === "FULL") {
    // Full upgrade: remove old-only, replace shared, add new-only
    if (toRemove.length > 0) {
      cuts.push({
        facetAddress: ethers.ZeroAddress,
        action: FacetCutAction.Remove,
        functionSelectors: toRemove,
      });
    }
    if (toReplace.length > 0) {
      cuts.push({
        facetAddress: newFacetAddr,
        action: FacetCutAction.Replace,
        functionSelectors: toReplace,
      });
    }
    if (toAdd.length > 0) {
      cuts.push({
        facetAddress: newFacetAddr,
        action: FacetCutAction.Add,
        functionSelectors: toAdd,
      });
    }
  } else {
    throw new Error(`Unknown UPGRADE_MODE: ${upgradeMode}. Use REPLACE, ADD_NEW, or FULL.`);
  }

  // --- Execute or dry-run ---
  if (dryRun) {
    console.log("\n  🏜️  DRY RUN — cuts that would be executed:");
    for (const cut of cuts) {
      const actionName = ["Add", "Replace", "Remove"][cut.action];
      console.log(`    ${actionName}: ${cut.functionSelectors.length} selectors → ${cut.facetAddress}`);
    }
    console.log("\n  No state changes made.");
    return;
  }

  console.log("\nExecuting diamond cut...");
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  const receipt = await tx.wait();
  console.log(`  ✓ Diamond cut executed in tx: ${receipt.hash}`);
  console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

  // --- Update deployment manifest ---
  recordFacet(deployment, facetName, newFacetAddr, newSelectors);

  // Record upgrade history
  if (!deployment.upgrades) deployment.upgrades = [];
  deployment.upgrades.push({
    facetName,
    oldAddress: existingFacet?.address || null,
    newAddress: newFacetAddr,
    mode: upgradeMode,
    added: toAdd.length,
    replaced: toReplace.length,
    removed: toRemove.length,
    txHash: receipt.hash,
    timestamp: new Date().toISOString(),
  });

  saveDeployment(network, deployment);

  // --- Verify ---
  console.log("");
  const newRegistered = await loupe.facetFunctionSelectors(newFacetAddr);
  console.log(`  Verified: ${newRegistered.length} selectors now point to new facet`);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  ✅ UPGRADE COMPLETE — ${facetName}`);
  console.log("═══════════════════════════════════════════════════════\n");

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Upgrade failed:", error);
    process.exit(1);
  });

module.exports = main;
