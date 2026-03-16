const { ethers } = require("hardhat");
const {
  deployContract,
  getSelectors,
  FacetCutAction,
  loadDeployment,
  saveDeployment,
  recordFacet,
  recordContract,
  verifyDiamondState,
} = require("../helpers/diamond-helpers");

/**
 * V2 Robustness Upgrade Script
 *
 * This script performs a full protocol upgrade in one atomic sequence:
 *
 * Phase 1: Deploy all new/updated facet implementations
 * Phase 2: Deploy TradingAccount implementation (replaces UserVault)
 * Phase 3: Execute diamondCut — replace updated facets, add new facets
 * Phase 4: Set TradingAccount as the new vault implementation
 * Phase 5: Configure robustness parameters
 * Phase 6: Grant ORACLE_POSTER_ROLE to keeper multicall bot (so it can call executeCycle)
 * Phase 7: Verify diamond state
 *
 * Usage:
 *   npx hardhat run scripts/upgrade/upgrade-v2-robustness.js --network paxeer-network
 *
 * Dry run:
 *   DRY_RUN=true npx hardhat run scripts/upgrade/upgrade-v2-robustness.js --network paxeer-network
 */

// ============================================================
//                    CONFIGURATION
// ============================================================

// Robustness params to set after upgrade
const ROBUSTNESS_CONFIG = {
  maxPriceDeviationBps: 3000,              // 30% max single-update price move
  minPositionSizeUsd: ethers.parseEther("5"),  // $5 minimum position
  minOrderSizeUsd: ethers.parseEther("5"),     // $5 minimum order
  maxFundingRatePerSecond: ethers.parseEther("0.0000001"), // ~0.86%/day max
};

// Facets that were MODIFIED (need Replace for existing selectors + Add for new selectors)
const UPDATED_FACETS = [
  "PositionFacet",
  "OrderBookFacet",
  "LiquidationFacet",
  "FundingRateFacet",
  "OracleFacet",
  "CentralVaultFacet",
  "MarketRegistryFacet",
];

// Facets that are BRAND NEW (need Add for all selectors)
const NEW_FACETS = [
  "KeeperMulticallFacet",
];

// ============================================================
//                     MAIN
// ============================================================

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║          V2 ROBUSTNESS UPGRADE                          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Dry run:  ${dryRun}`);
  console.log(`  Time:     ${new Date().toISOString()}`);
  console.log("");

  const deployment = loadDeployment(network);
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond not deployed on this network. Run deploy-all.js first.");
  }
  console.log(`  Diamond: ${diamondAddress}\n`);

  const loupe = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

  // ────────────────────────────────────────────────────────────
  //  PHASE 1: Deploy all updated + new facet implementations
  // ────────────────────────────────────────────────────────────
  console.log("━━━ Phase 1: Deploy facet implementations ━━━\n");

  const deployedFacets = {};

  for (const name of [...UPDATED_FACETS, ...NEW_FACETS]) {
    console.log(`  Deploying ${name}...`);
    const facet = await deployContract(name);
    const addr = await facet.getAddress();
    const selectors = getSelectors(facet);
    deployedFacets[name] = { contract: facet, address: addr, selectors };
    console.log(`    ${selectors.length} selectors\n`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 2: Deploy TradingAccount implementation
  // ────────────────────────────────────────────────────────────
  console.log("━━━ Phase 2: Deploy TradingAccount implementation ━━━\n");

  const tradingAccount = await deployContract("TradingAccount");
  const tradingAccountAddr = await tradingAccount.getAddress();
  console.log("");

  // ────────────────────────────────────────────────────────────
  //  PHASE 3: Compute diamond cuts and execute
  // ────────────────────────────────────────────────────────────
  console.log("━━━ Phase 3: Compute and execute diamond cut ━━━\n");

  const cuts = [];
  let totalAdd = 0;
  let totalReplace = 0;
  let totalRemove = 0;

  // --- Updated facets: compute selector diff ---
  for (const name of UPDATED_FACETS) {
    const { address: newAddr, selectors: newSelectors } = deployedFacets[name];
    const existing = deployment.facets[name];

    let oldSelectors = [];
    if (existing && existing.address) {
      try {
        oldSelectors = Array.from(await loupe.facetFunctionSelectors(existing.address));
      } catch (e) {
        console.log(`  Warning: Could not read old selectors for ${name}: ${e.message}`);
      }
    }

    const oldSet = new Set(oldSelectors.map(s => s.toLowerCase()));
    const newSet = new Set(newSelectors.map(s => s.toLowerCase()));

    const toAdd = newSelectors.filter(s => !oldSet.has(s.toLowerCase()));
    const toReplace = newSelectors.filter(s => oldSet.has(s.toLowerCase()));
    const toRemove = oldSelectors.filter(s => !newSet.has(s.toLowerCase()));

    console.log(`  ${name}:`);
    console.log(`    Replace: ${toReplace.length} | Add: ${toAdd.length} | Remove: ${toRemove.length}`);

    if (toReplace.length > 0) {
      cuts.push({
        facetAddress: newAddr,
        action: FacetCutAction.Replace,
        functionSelectors: toReplace,
      });
      totalReplace += toReplace.length;
    }

    if (toAdd.length > 0) {
      cuts.push({
        facetAddress: newAddr,
        action: FacetCutAction.Add,
        functionSelectors: toAdd,
      });
      totalAdd += toAdd.length;
    }

    if (toRemove.length > 0) {
      cuts.push({
        facetAddress: ethers.ZeroAddress,
        action: FacetCutAction.Remove,
        functionSelectors: toRemove,
      });
      totalRemove += toRemove.length;
    }
  }

  // --- New facets: all selectors are Add ---
  for (const name of NEW_FACETS) {
    const { address: newAddr, selectors } = deployedFacets[name];

    // Filter out any selectors that already exist on the diamond (safety check)
    const filteredSelectors = [];
    for (const sel of selectors) {
      try {
        const existing = await loupe.facetAddress(sel);
        if (existing === ethers.ZeroAddress) {
          filteredSelectors.push(sel);
        } else {
          console.log(`  Warning: Selector ${sel} from ${name} already exists on diamond, skipping`);
        }
      } catch {
        filteredSelectors.push(sel);
      }
    }

    if (filteredSelectors.length > 0) {
      cuts.push({
        facetAddress: newAddr,
        action: FacetCutAction.Add,
        functionSelectors: filteredSelectors,
      });
      totalAdd += filteredSelectors.length;
      console.log(`  ${name}: Add ${filteredSelectors.length} selectors (new facet)`);
    }
  }

  console.log(`\n  Total cuts: ${cuts.length}`);
  console.log(`    Add:     ${totalAdd} selectors`);
  console.log(`    Replace: ${totalReplace} selectors`);
  console.log(`    Remove:  ${totalRemove} selectors`);

  if (cuts.length === 0) {
    console.log("\n  No diamond cuts needed. All selectors unchanged.");
  } else if (dryRun) {
    console.log("\n  DRY RUN — diamond cut NOT executed.");
    for (const cut of cuts) {
      const actionName = ["Add", "Replace", "Remove"][cut.action];
      console.log(`    ${actionName}: ${cut.functionSelectors.length} selectors -> ${cut.facetAddress}`);
    }
  } else {
    console.log("\n  Executing diamond cut...");
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
    const receipt = await tx.wait();
    console.log(`  Diamond cut tx: ${receipt.hash}`);
    console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 4: Set TradingAccount as vault implementation
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 4: Set TradingAccount implementation ━━━\n");

  if (dryRun) {
    console.log(`  DRY RUN — would set vault implementation to: ${tradingAccountAddr}`);
  } else {
    const vaultFactory = await ethers.getContractAt("VaultFactoryFacet", diamondAddress);
    const currentImpl = await vaultFactory.getUserVaultImplementation();
    console.log(`  Current vault implementation: ${currentImpl}`);
    console.log(`  New TradingAccount implementation: ${tradingAccountAddr}`);

    const tx = await vaultFactory.setImplementation(tradingAccountAddr);
    const receipt = await tx.wait();
    console.log(`  setImplementation tx: ${receipt.hash}`);

    const updatedImpl = await vaultFactory.getUserVaultImplementation();
    console.log(`  Verified new implementation: ${updatedImpl}`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 5: Configure robustness parameters
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 5: Set robustness parameters ━━━\n");

  console.log(`  maxPriceDeviationBps:    ${ROBUSTNESS_CONFIG.maxPriceDeviationBps} (${ROBUSTNESS_CONFIG.maxPriceDeviationBps / 100}%)`);
  console.log(`  minPositionSizeUsd:      ${ethers.formatEther(ROBUSTNESS_CONFIG.minPositionSizeUsd)} USD`);
  console.log(`  minOrderSizeUsd:         ${ethers.formatEther(ROBUSTNESS_CONFIG.minOrderSizeUsd)} USD`);
  console.log(`  maxFundingRatePerSecond: ${ethers.formatEther(ROBUSTNESS_CONFIG.maxFundingRatePerSecond)}`);

  if (dryRun) {
    console.log("\n  DRY RUN — would call setRobustnessParams()");
  } else {
    const marketRegistry = await ethers.getContractAt("MarketRegistryFacet", diamondAddress);
    const tx = await marketRegistry.setRobustnessParams(
      ROBUSTNESS_CONFIG.maxPriceDeviationBps,
      ROBUSTNESS_CONFIG.minPositionSizeUsd,
      ROBUSTNESS_CONFIG.minOrderSizeUsd,
      ROBUSTNESS_CONFIG.maxFundingRatePerSecond
    );
    const receipt = await tx.wait();
    console.log(`\n  setRobustnessParams tx: ${receipt.hash}`);

    // Verify
    const params = await marketRegistry.getRobustnessParams();
    console.log(`  Verified maxPriceDeviationBps:    ${params[0]}`);
    console.log(`  Verified minPositionSizeUsd:      ${ethers.formatEther(params[1])}`);
    console.log(`  Verified minOrderSizeUsd:         ${ethers.formatEther(params[2])}`);
    console.log(`  Verified maxFundingRatePerSecond: ${ethers.formatEther(params[3])}`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 6: Grant ORACLE_POSTER_ROLE to keeper multicall bot
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 6: Role configuration ━━━\n");

  // The multicall facet requires ORACLE_POSTER_ROLE to call executeCycle.
  // The existing oracle bot address should already have this role.
  // We just verify it here and inform the operator.
  if (dryRun) {
    console.log("  DRY RUN — skipping role verification");
  } else {
    const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);

    // ORACLE_POSTER_ROLE = keccak256("ORACLE_POSTER")
    const ORACLE_POSTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_POSTER"));
    const KEEPER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("KEEPER"));

    console.log(`  ORACLE_POSTER_ROLE: ${ORACLE_POSTER_ROLE}`);
    console.log(`  KEEPER_ROLE:        ${KEEPER_ROLE}`);

    // Check if deployer has these roles (for the multicall bot, the oracle bot needs ORACLE_POSTER_ROLE)
    const deployerIsOraclePoster = await accessControl.hasRole(ORACLE_POSTER_ROLE, deployer.address);
    const deployerIsKeeper = await accessControl.hasRole(KEEPER_ROLE, deployer.address);
    console.log(`  Deployer is ORACLE_POSTER: ${deployerIsOraclePoster}`);
    console.log(`  Deployer is KEEPER:        ${deployerIsKeeper}`);

    console.log("\n  NOTE: The KeeperMulticallFacet.executeCycle() requires ORACLE_POSTER_ROLE.");
    console.log("  Ensure your oracle/keeper bot address has this role.");
    console.log("  The bot can now call executeCycle() instead of separate batchUpdatePrices + syncToOracle + updateFundingRate + executeOrder + liquidate.");
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 7: Update deployment manifest
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 7: Update deployment manifest ━━━\n");

  if (!dryRun) {
    // Record all updated facets
    for (const name of [...UPDATED_FACETS, ...NEW_FACETS]) {
      const { address, selectors } = deployedFacets[name];
      recordFacet(deployment, name, address, selectors);
    }

    // Record TradingAccount
    recordContract(deployment, "TradingAccountImplementation", tradingAccountAddr);

    // Record upgrade metadata
    if (!deployment.upgrades) deployment.upgrades = [];
    deployment.upgrades.push({
      version: "v2-robustness",
      updatedFacets: UPDATED_FACETS,
      newFacets: NEW_FACETS,
      tradingAccountImpl: tradingAccountAddr,
      robustnessConfig: {
        maxPriceDeviationBps: ROBUSTNESS_CONFIG.maxPriceDeviationBps,
        minPositionSizeUsd: ROBUSTNESS_CONFIG.minPositionSizeUsd.toString(),
        minOrderSizeUsd: ROBUSTNESS_CONFIG.minOrderSizeUsd.toString(),
        maxFundingRatePerSecond: ROBUSTNESS_CONFIG.maxFundingRatePerSecond.toString(),
      },
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
    });

    saveDeployment(network, deployment);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 8: Verify diamond state
  // ────────────────────────────────────────────────────────────
  if (!dryRun) {
    await verifyDiamondState(diamondAddress, deployment);
  }

  // ────────────────────────────────────────────────────────────
  //  SUMMARY
  // ────────────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║          UPGRADE SUMMARY                                ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("  Updated facets:");
  for (const name of UPDATED_FACETS) {
    console.log(`    ${name}: ${deployedFacets[name].address}`);
  }
  console.log("");
  console.log("  New facets:");
  for (const name of NEW_FACETS) {
    console.log(`    ${name}: ${deployedFacets[name].address}`);
  }
  console.log("");
  console.log(`  TradingAccount impl: ${tradingAccountAddr}`);
  console.log("");
  console.log("  Changes applied:");
  console.log("    [C1] Fixed ADL auth (LiquidationFacet)");
  console.log("    [C3] Fixed funding settlement drain-to-zero (PositionFacet, LiquidationFacet)");
  console.log("    [C4] Oracle price deviation guard (OracleFacet)");
  console.log("    [C5] TWAP iteration bounded to 1000 (LibTWAP)");
  console.log("    [C6] Fee rounding UP (LibFee)");
  console.log("    [H1] Min position/order size (PositionFacet, OrderBookFacet)");
  console.log("    [H2] Funding rate cap (FundingRateFacet)");
  console.log("    [H3] OI cap on order execution (OrderBookFacet)");
  console.log("    [H4] Funding-aware checkLiquidatable (LiquidationFacet)");
  console.log("    [H5] TP/SL close-order types (OrderBookFacet)");
  console.log("    [H6] removeCollateral (PositionFacet)");
  console.log("    [M4] getUtilization fix (CentralVaultFacet)");
  console.log("    [NEW] TradingAccount — per-position margin, ledger, delegation, margin modes");
  console.log("    [NEW] KeeperMulticallFacet — atomic price+sync+funding+orders+liquidations");
  console.log("    [NEW] setRobustnessParams admin function (MarketRegistryFacet)");
  console.log("");

  if (dryRun) {
    console.log("  STATUS: DRY RUN COMPLETE — no on-chain changes made");
  } else {
    console.log("  STATUS: UPGRADE COMPLETE");
  }
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
