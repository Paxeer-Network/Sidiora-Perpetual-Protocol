const { ethers } = require("hardhat");
const {
  deployContract,
  getSelectors,
  FacetCutAction,
  loadDeployment,
  saveDeployment,
  recordFacet,
  verifyDiamondState,
} = require("../helpers/diamond-helpers");

/**
 * V4 Spot Upgrade Script
 *
 * Deploys all 8 spot trading facets and cuts them into the existing diamond.
 * This is a pure ADD upgrade — no selectors are replaced or removed.
 *
 * New facets deployed:
 *   [SPOT] SpotMarketRegistryFacet  — spot market creation + configuration
 *   [SPOT] SpotSettlementFacet      — deposit/withdraw/epoch settlement
 *   [SPOT] SpotOrderBookFacet       — OROB order placement + continuous matching
 *   [SPOT] SpotBatchAuctionFacet    — sealed-bid batch auction clearing
 *   [SPOT] SpotModeSwitchFacet      — autonomous continuous↔batch mode switching
 *   [SPOT] PLVRegistryFacet         — Programmable Liquidity Vault management
 *   [SPOT] PoFQFacet                — Proof of Fill Quality reputation + fee tiers
 *   [SPOT] SpotKeeperMulticallFacet — atomic spot keeper cycle
 *
 * Phases:
 *   1 — Deploy all 8 spot facet implementations
 *   2 — Deduplicate selectors against existing diamond state
 *   3 — Execute single batched diamond cut (all adds)
 *   4 — Grant SPOT_ADMIN_ROLE to deployer
 *   5 — Configure initial spot parameters
 *   6 — Update deployment manifest + verify
 *
 * Usage:
 *   npx hardhat run scripts/upgrade/upgrade-v4-spot.js --network paxeer-network
 *
 * Dry run:
 *   DRY_RUN=true npx hardhat run scripts/upgrade/upgrade-v4-spot.js --network paxeer-network
 */

// ============================================================
//                    CONFIGURATION
// ============================================================

// All 8 spot facets in deploy order
const SPOT_FACETS = [
  "SpotMarketRegistryFacet",
  "SpotSettlementFacet",
  "SpotOrderBookFacet",
  "SpotBatchAuctionFacet",
  "SpotModeSwitchFacet",
  "PLVRegistryFacet",
  "PoFQFacet",
  "SpotKeeperMulticallFacet",
];

// Initial spot parameters
const SPOT_CONFIG = {
  epochLength: 5,           // 5 blocks per epoch (~5 seconds on Paxeer)
  fastSettleFeeBps: 1,      // 1 bps for instant settlement
  defaultBatchDuration: 50, // 50 blocks minimum batch mode duration
};

// Validator keeper wallet (same as V3 — already has KEEPER_ROLE)
const VALIDATOR_KEEPER_WALLET = "0x4B0e62a3d95c38F68AA47d38634FD4CAEf8471dF";

// ============================================================
//  RESUME: Already-deployed addresses from previous failed run
//  Set RESUME=true to skip Phase 1 and use these addresses.
// ============================================================
const RESUME_ADDRESSES = {
  // Fill these in if a previous run deployed facets but failed on the cut
  // SpotMarketRegistryFacet: "0x...",
};

// ============================================================
//                     MAIN
// ============================================================

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const resume = process.env.RESUME === "true";
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║          V4 SPOT TRADING UPGRADE                        ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Dry run:  ${dryRun}`);
  console.log(`  Resume:   ${resume}`);
  console.log(`  Time:     ${new Date().toISOString()}`);
  console.log("");

  const deployment = loadDeployment(network);
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond not deployed on this network. Run deploy-all.js first.");
  }
  console.log(`  Diamond: ${diamondAddress}\n`);

  const loupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

  // Build set of all existing selectors for dedup
  const existingSelectors = new Set();
  const existingFacets = await loupe.facets();
  for (const f of existingFacets) {
    for (const sel of f.functionSelectors) {
      existingSelectors.add(sel.toLowerCase());
    }
  }
  console.log(`  Existing selectors on diamond: ${existingSelectors.size}\n`);

  // ────────────────────────────────────────────────────────────
  //  PHASE 1: Deploy all spot facet implementations
  // ────────────────────────────────────────────────────────────
  console.log("━━━ Phase 1: Deploy spot facet implementations ━━━\n");

  const deployedFacets = {};

  if (resume) {
    console.log("  RESUME MODE — using already-deployed addresses:\n");
    for (const name of SPOT_FACETS) {
      const addr = RESUME_ADDRESSES[name];
      if (!addr) throw new Error(`No resume address for ${name}`);
      const facet = await ethers.getContractAt(name, addr);
      const selectors = getSelectors(facet);
      deployedFacets[name] = { contract: facet, address: addr, selectors };
      console.log(`    ${name}: ${addr} (${selectors.length} selectors)`);
    }
    console.log("");
  } else {
    for (const name of SPOT_FACETS) {
      console.log(`  Deploying ${name}...`);
      const facet = await deployContract(name);
      const addr = await facet.getAddress();
      const selectors = getSelectors(facet);
      deployedFacets[name] = { contract: facet, address: addr, selectors };
      console.log(`    ${selectors.length} selectors\n`);
    }
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 2: Deduplicate selectors and build diamond cut
  // ────────────────────────────────────────────────────────────
  console.log("━━━ Phase 2: Compute diamond cut (dedup against existing) ━━━\n");

  const cuts = [];
  let totalAdd = 0;
  let totalSkipped = 0;
  const addedInThisCut = new Set();

  for (const name of SPOT_FACETS) {
    const { address, selectors } = deployedFacets[name];

    // Filter: only selectors that don't exist on diamond AND haven't been added by a prior facet in this batch
    const newSelectors = [];
    const skipped = [];

    for (const sel of selectors) {
      const lower = sel.toLowerCase();
      if (existingSelectors.has(lower) || addedInThisCut.has(lower)) {
        skipped.push(sel);
      } else {
        newSelectors.push(sel);
        addedInThisCut.add(lower);
      }
    }

    console.log(`  ${name}:`);
    console.log(`    Add: ${newSelectors.length} | Skipped (duplicate): ${skipped.length}`);

    if (newSelectors.length > 0) {
      cuts.push({
        facetAddress: address,
        action: FacetCutAction.Add,
        functionSelectors: newSelectors,
      });
      totalAdd += newSelectors.length;
    }
    totalSkipped += skipped.length;
  }

  console.log(`\n  Total: ${totalAdd} selectors to add, ${totalSkipped} skipped`);

  // ────────────────────────────────────────────────────────────
  //  PHASE 3: Execute diamond cut
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 3: Execute diamond cut ━━━\n");

  if (cuts.length === 0) {
    console.log("  No new selectors to add. All spot facets may already be deployed.");
  } else if (dryRun) {
    console.log("  DRY RUN — diamond cut NOT executed.");
    for (const cut of cuts) {
      console.log(`    Add: ${cut.functionSelectors.length} selectors -> ${cut.facetAddress}`);
    }
  } else {
    console.log(`  Executing diamond cut with ${cuts.length} facet entries...`);
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
    const receipt = await tx.wait();
    console.log(`  Diamond cut tx: ${receipt.hash}`);
    console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 4: Grant SPOT_ADMIN_ROLE
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 4: Grant roles ━━━\n");

  const SPOT_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SPOT_ADMIN"));

  if (dryRun) {
    console.log(`  DRY RUN — would grant SPOT_ADMIN_ROLE to deployer: ${deployer.address}`);
    console.log(`  DRY RUN — would grant SPOT_ADMIN_ROLE to validator: ${VALIDATOR_KEEPER_WALLET}`);
  } else {
    const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);

    // Grant SPOT_ADMIN to deployer
    const hasSpotAdmin = await accessControl.hasRole(SPOT_ADMIN_ROLE, deployer.address);
    if (!hasSpotAdmin) {
      const tx = await accessControl.grantRole(SPOT_ADMIN_ROLE, deployer.address);
      await tx.wait();
      console.log(`  Granted SPOT_ADMIN_ROLE to deployer: ${deployer.address}`);
    } else {
      console.log(`  SPOT_ADMIN_ROLE already granted to deployer`);
    }

    // Grant SPOT_ADMIN to validator keeper
    const validatorHasSpotAdmin = await accessControl.hasRole(SPOT_ADMIN_ROLE, VALIDATOR_KEEPER_WALLET);
    if (!validatorHasSpotAdmin) {
      const tx = await accessControl.grantRole(SPOT_ADMIN_ROLE, VALIDATOR_KEEPER_WALLET);
      await tx.wait();
      console.log(`  Granted SPOT_ADMIN_ROLE to validator: ${VALIDATOR_KEEPER_WALLET}`);
    } else {
      console.log(`  SPOT_ADMIN_ROLE already granted to validator`);
    }

    // Verify KEEPER_ROLE (should already exist from V3)
    const KEEPER_ROLE = await accessControl.KEEPER_ROLE();
    const hasKeeper = await accessControl.hasRole(KEEPER_ROLE, VALIDATOR_KEEPER_WALLET);
    console.log(`  Verified KEEPER_ROLE for validator: ${hasKeeper}`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 5: Configure initial spot parameters
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 5: Configure spot parameters ━━━\n");

  console.log(`  Epoch length:       ${SPOT_CONFIG.epochLength} blocks`);
  console.log(`  Fast settle fee:    ${SPOT_CONFIG.fastSettleFeeBps} bps`);
  console.log(`  Batch duration min: ${SPOT_CONFIG.defaultBatchDuration} blocks`);

  if (dryRun) {
    console.log("\n  DRY RUN — would configure spot parameters");
  } else {
    const spotSettlement = await ethers.getContractAt("SpotSettlementFacet", diamondAddress);

    // Set epoch length
    const tx1 = await spotSettlement.setEpochLength(SPOT_CONFIG.epochLength);
    await tx1.wait();
    console.log(`  setEpochLength(${SPOT_CONFIG.epochLength}) tx: ${tx1.hash}`);

    console.log("\n  NOTE: Spot markets must be created separately using SpotMarketRegistryFacet.createSpotMarket()");
    console.log("  NOTE: Spot tokens must be whitelisted using SpotSettlementFacet.addSpotToken()");
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 6: Update deployment manifest + verify
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 6: Update deployment manifest ━━━\n");

  if (!dryRun) {
    for (const name of SPOT_FACETS) {
      const { address, selectors } = deployedFacets[name];
      recordFacet(deployment, name, address, selectors);
    }

    if (!deployment.upgrades) deployment.upgrades = [];
    deployment.upgrades.push({
      version: "v4-spot",
      newFacets: SPOT_FACETS,
      spotConfig: SPOT_CONFIG,
      validatorKeeper: VALIDATOR_KEEPER_WALLET,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
    });

    saveDeployment(network, deployment);

    await verifyDiamondState(diamondAddress, deployment);
  }

  // ────────────────────────────────────────────────────────────
  //  SUMMARY
  // ────────────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║          V4 SPOT UPGRADE SUMMARY                        ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("  Spot facets deployed:");
  for (const name of SPOT_FACETS) {
    console.log(`    ${name}: ${deployedFacets[name].address} (${deployedFacets[name].selectors.length} selectors)`);
  }
  console.log("");
  console.log(`  Total new selectors: ${totalAdd}`);
  console.log(`  Skipped (dedup):     ${totalSkipped}`);
  console.log("");

  if (dryRun) {
    console.log("  STATUS: DRY RUN COMPLETE — no on-chain changes made");
  } else {
    console.log("  STATUS: UPGRADE COMPLETE");
  }

  console.log("\n  Post-upgrade checklist:");
  console.log("    [ ] Whitelist spot tokens: SpotSettlementFacet.addSpotToken(token, decimals)");
  console.log("    [ ] Create spot markets: SpotMarketRegistryFacet.createSpotMarket(base, quote, ...)");
  console.log("    [ ] Register PLVs: PLVRegistryFacet.registerPLV(vaultAddress)");
  console.log("    [ ] Update .perps-engine config for spot cycle");
  console.log("    [ ] Deploy indexer migration 003-v4-spot.sql");
  console.log("    [ ] Verify all facets on Paxscan");
  console.log("    [ ] Test spot order placement + matching on live");
  console.log("");

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nUpgrade failed:", error);
    process.exit(1);
  });

module.exports = main;
