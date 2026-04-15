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
 * V3 Latest Upgrade Script
 *
 * Deploys the latest contract code on top of the V2 robustness upgrade.
 * This is an incremental upgrade — computes selector diffs against on-chain state.
 *
 * Changes deployed:
 *   [A1] TP/SL order execution (OrderBookFacet)
 *   [A2] Liquidation accounting fix (LiquidationFacet)
 *   [A3] ADL insurance threshold (LiquidationFacet)
 *   [B6] FundingSettled event fix (PositionFacet)
 *   [B7] Price staleness on order execution (OrderBookFacet)
 *   [NEW] Borrowing fee (PositionFacet, LibBorrowingFee)
 *   [NEW] Order collateral reservation (OrderBookFacet, TradingAccount)
 *   [NEW] Order TTL / expiry (OrderBookFacet)
 *   [NEW] Mark price TWAP for funding (VirtualAMMFacet, FundingRateFacet)
 *   [NEW] Central vault solvency check (PositionFacet, OrderBookFacet)
 *   [NEW] VOM precompile oracle mode (OracleFacet)
 *   [NEW] removeCollateral (PositionFacet)
 *
 * Phases:
 *   1 — Deploy updated + new facet implementations
 *   2 — Deploy fresh TradingAccount implementation
 *   3 — Compute diamond cut diffs and execute
 *   4 — Set TradingAccount as vault implementation (for NEW vaults only)
 *   5 — Configure borrowing fee rate
 *   6 — Configure VOM oracle precompile + market IDs
 *   7 — Grant KEEPER_ROLE to validator wallet
 *   8 — Update deployment manifest + verify
 *
 * Usage:
 *   npx hardhat run scripts/upgrade/upgrade-v3-latest.js --network paxeer-network
 *
 * Dry run:
 *   DRY_RUN=true npx hardhat run scripts/upgrade/upgrade-v3-latest.js --network paxeer-network
 */

// ============================================================
//                    CONFIGURATION
// ============================================================

// Validator wallet that handles keeper functions
const VALIDATOR_KEEPER_WALLET = "0x4B0e62a3d95c38F68AA47d38634FD4CAEf8471dF";

// VOM Oracle Precompile address
const VOM_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000903";

// Minimum validator quorum for VOM price reads
const MIN_ORACLE_QUORUM = 1;

// Borrowing fee rate: ~0.03%/hr
// 0.03% / 3600 = 8.33e-8 per second = 8.33e10 in 18-dec
const BORROWING_FEE_RATE_PER_SECOND = 83_000_000_000n;

// Whether to enable VOM precompile mode immediately
// Set false to keep legacy oracle mode and enable VOM later via admin call
const ENABLE_VOM_ON_DEPLOY = true;

// All perps markets — VOM ID is keccak256("{SYMBOL}/USDC")
// The VOM precompile only knows USDC-denominated pairs (validator attestations use USDC quote)
const MARKET_VOM_PAIRS = [
  { marketId: 0,  pair: "BTC/USDC" },
  { marketId: 1,  pair: "ETH/USDC" },
  { marketId: 2,  pair: "SOL/USDC" },
  { marketId: 3,  pair: "AVAX/USDC" },
  { marketId: 4,  pair: "LINK/USDC" },
  { marketId: 5,  pair: "TSLA/USDC" },
  { marketId: 6,  pair: "NVDA/USDC" },
  { marketId: 7,  pair: "NAS100/USDC" },
  { marketId: 8,  pair: "XAU/USDC" },
  { marketId: 9,  pair: "SPX500/USDC" },
  { marketId: 10, pair: "GOOGL/USDC" },
  { marketId: 11, pair: "PAX/USDC" },
  { marketId: 12, pair: "SID/USDC" },
  { marketId: 13, pair: "HYPE/USDC" },
  { marketId: 14, pair: "XRP/USDC" },
  { marketId: 15, pair: "ASTER/USDC" },
  { marketId: 16, pair: "TRUMP/USDC" },
  { marketId: 17, pair: "BNB/USDC" },
];

// Facets that were MODIFIED since V2
const UPDATED_FACETS = [
  "PositionFacet",
  "OrderBookFacet",
  "LiquidationFacet",
  "FundingRateFacet",
  "OracleFacet",
  "VirtualAMMFacet",
  "CentralVaultFacet",
  "MarketRegistryFacet",
];

// Facets that may need adding (KeeperMulticallFacet already deployed in V2, but re-deploy if changed)
const FACETS_TO_CHECK = [
  "KeeperMulticallFacet",
];

// ============================================================
//  RESUME: Already-deployed addresses from previous failed run
//  Set RESUME=true to skip Phase 1-2 and use these addresses.
// ============================================================
const RESUME_ADDRESSES = {
  PositionFacet:        "0x6bf3722414b240A2503a512A84f54Ee161fa148e",
  OrderBookFacet:       "0x719B8f35701ff1050EB0Bb87E418Bb321Cc0e979",
  LiquidationFacet:     "0x661320835387532aFDEc3F243B0A328BF42d7cA7",
  FundingRateFacet:     "0x669077515193401ac30984a9d2314903ACcAc25f",
  OracleFacet:          "0xd21135802D8eFD6c00d6332e262A7B2c75d5bF69",
  VirtualAMMFacet:      "0x5c869AC52dd91958E7dd98e570aaeFE6FD6864B5",
  CentralVaultFacet:    "0xE4410832468F0Ec655f26b0f22C1f6864628Ea21",
  MarketRegistryFacet:  "0x819904c316dd0B8259d4486B446A057922F24116",
  KeeperMulticallFacet: "0xa8D4B87B11293086Fa81A7f852dA8df9FC820BC7",
  TradingAccount:       "0x81df19Bae8723B8cfD59Ef287B5fad56a70fecF1",
};

// ============================================================
//                     MAIN
// ============================================================

async function main() {
  const dryRun = process.env.DRY_RUN === "true";
  const resume = process.env.RESUME === "true";
  const resumePhase = parseInt(process.env.RESUME_PHASE || "0");
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║          V3 LATEST UPGRADE                              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Dry run:  ${dryRun}`);
  console.log(`  Resume:   ${resume}`);
  console.log(`  Skip to:  ${resumePhase > 0 ? "Phase " + resumePhase : "none (run all)"}`);
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
  //  PHASE 1: Deploy all facet implementations
  // ────────────────────────────────────────────────────────────
  console.log("━━━ Phase 1: Deploy facet implementations ━━━\n");

  const deployedFacets = {};
  const allFacets = [...UPDATED_FACETS, ...FACETS_TO_CHECK];
  let tradingAccountAddr;

  if (resume) {
    console.log("  RESUME MODE — using already-deployed addresses:\n");
    for (const name of allFacets) {
      const addr = RESUME_ADDRESSES[name];
      if (!addr) throw new Error(`No resume address for ${name}`);
      const facet = await ethers.getContractAt(name, addr);
      const selectors = getSelectors(facet);
      deployedFacets[name] = { contract: facet, address: addr, selectors };
      console.log(`    ${name}: ${addr} (${selectors.length} selectors)`);
    }
    tradingAccountAddr = RESUME_ADDRESSES.TradingAccount;
    console.log(`    TradingAccount: ${tradingAccountAddr}\n`);
  } else {
    for (const name of allFacets) {
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
    tradingAccountAddr = await tradingAccount.getAddress();
    console.log("");
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 3: Compute diamond cuts and execute
  // ────────────────────────────────────────────────────────────
  let totalAdd = 0, totalReplace = 0, totalRemove = 0;

 if (resumePhase > 3) {
    console.log("━━━ Phase 3: SKIPPED (already done) ━━━\n");
  } else {
  console.log("━━━ Phase 3: Compute and execute diamond cut ━━━\n");

  const cuts = [];

  for (const name of allFacets) {
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

    // For new selectors, also check if they already exist on a DIFFERENT facet
    const actuallyNew = [];
    for (const sel of toAdd) {
      try {
        const existingAddr = await loupe.facetAddress(sel);
        if (existingAddr === ethers.ZeroAddress) {
          actuallyNew.push(sel);
        } else {
          // Already exists on another facet — needs Replace, not Add
          toReplace.push(sel);
        }
      } catch {
        actuallyNew.push(sel);
      }
    }

    console.log(`  ${name}:`);
    console.log(`    Replace: ${toReplace.length} | Add: ${actuallyNew.length} | Remove: ${toRemove.length}`);

    if (toReplace.length > 0) {
      cuts.push({
        facetAddress: newAddr,
        action: FacetCutAction.Replace,
        functionSelectors: toReplace,
      });
      totalReplace += toReplace.length;
    }

    if (actuallyNew.length > 0) {
      cuts.push({
        facetAddress: newAddr,
        action: FacetCutAction.Add,
        functionSelectors: actuallyNew,
      });
      totalAdd += actuallyNew.length;
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
  } // end Phase 3 skip

  // ────────────────────────────────────────────────────────────
  //  PHASE 4: Set TradingAccount as vault implementation
  // ────────────────────────────────────────────────────────────
 if (resumePhase > 5) {
    console.log("\n━━━ Phase 4-5: SKIPPED (already done) ━━━\n");
  } else {
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
    console.log("\n  NOTE: Existing user vaults keep their old bytecode (EIP-1167 clones).");
    console.log("  Only NEW vaults created after this point will use TradingAccount.");
    console.log("  Existing UserVault clones remain backward-compatible via lockCollateral/receiveCollateral.");
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 5: Configure borrowing fee rate
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 5: Configure borrowing fee rate ━━━\n");

  console.log(`  Rate: ${BORROWING_FEE_RATE_PER_SECOND} per second (~0.03%/hr, ~0.76%/day)`);

  if (dryRun) {
    console.log("  DRY RUN — would call setBorrowingFeeRate()");
  } else {
    const positionFacet = await ethers.getContractAt("PositionFacet", diamondAddress);
    const tx = await positionFacet.setBorrowingFeeRate(BORROWING_FEE_RATE_PER_SECOND);
    const receipt = await tx.wait();
    console.log(`  setBorrowingFeeRate tx: ${receipt.hash}`);

    const verified = await positionFacet.getBorrowingFeeRate();
    console.log(`  Verified rate: ${verified}`);
  }

  console.log("\n  NOTE: defaultOrderTTL = 0 (no expiry). Add admin setter if needed.");
  } // end Phase 4-5 skip

  // ────────────────────────────────────────────────────────────
  //  PHASE 6: Configure VOM oracle precompile + market IDs
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 6: Configure VOM oracle ━━━\n");

  const oracleFacet = await ethers.getContractAt("OracleFacet", diamondAddress);

  console.log(`  VOM Precompile:     ${VOM_PRECOMPILE_ADDRESS}`);
  console.log(`  Min Quorum:         ${MIN_ORACLE_QUORUM}`);
  console.log(`  Enable VOM on deploy: ${ENABLE_VOM_ON_DEPLOY}`);
  console.log(`  Markets to configure: ${MARKET_VOM_PAIRS.length}`);
  console.log("");

  if (dryRun) {
    console.log("  DRY RUN — would configure VOM oracle:");
    for (const m of MARKET_VOM_PAIRS) {
      const vomId = ethers.keccak256(ethers.toUtf8Bytes(m.pair));
      console.log(`    Market ${m.marketId} (${m.pair}): ${vomId}`);
    }
  } else {
    // Set precompile address
    let tx = await oracleFacet.setOraclePrecompile(VOM_PRECOMPILE_ADDRESS);
    await tx.wait();
    console.log(`  setOraclePrecompile: ${VOM_PRECOMPILE_ADDRESS}`);

    // Set minimum quorum
    tx = await oracleFacet.setMinOracleQuorum(MIN_ORACLE_QUORUM);
    await tx.wait();
    console.log(`  setMinOracleQuorum: ${MIN_ORACLE_QUORUM}`);

    // Set VOM market IDs for each market (idempotent — skips already-set markets)
    for (const m of MARKET_VOM_PAIRS) {
      const vomId = ethers.keccak256(ethers.toUtf8Bytes(m.pair));
      // Check if already set
      try {
        const existing = await oracleFacet.getMarketVomId(m.marketId);
        if (existing === vomId) {
          console.log(`  Market ${m.marketId} (${m.pair}): already set, skipping`);
          continue;
        }
      } catch {}
      tx = await oracleFacet.setMarketVomId(m.marketId, vomId);
      await tx.wait();
      console.log(`  Market ${m.marketId} (${m.pair}): ${vomId}`);
    }

    // Enable VOM mode if configured
    if (ENABLE_VOM_ON_DEPLOY) {
      tx = await oracleFacet.setUsePrecompileOracle(true);
      await tx.wait();
      console.log("\n  VOM precompile mode: ENABLED");
    } else {
      console.log("\n  VOM precompile mode: DISABLED (legacy oracle active)");
      console.log("  Enable later with: oracleFacet.setUsePrecompileOracle(true)");
    }

    // Verify
    const [usePrecompile, precompile, minQuorum] = await oracleFacet.getOracleMode();
    console.log(`  Verified — usePrecompile: ${usePrecompile}, precompile: ${precompile}, minQuorum: ${minQuorum}`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 7: Grant KEEPER_ROLE to validator wallet
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 7: Grant roles to validator keeper ━━━\n");

  console.log(`  Validator wallet: ${VALIDATOR_KEEPER_WALLET}`);

  if (dryRun) {
    console.log("  DRY RUN — would grant KEEPER_ROLE + ORACLE_POSTER_ROLE");
  } else {
    const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);
    const KEEPER_ROLE = await accessControl.KEEPER_ROLE();
    const ORACLE_POSTER_ROLE = await accessControl.ORACLE_POSTER_ROLE();

    // Check and grant KEEPER_ROLE
    const hasKeeper = await accessControl.hasRole(KEEPER_ROLE, VALIDATOR_KEEPER_WALLET);
    if (!hasKeeper) {
      const tx = await accessControl.grantRole(KEEPER_ROLE, VALIDATOR_KEEPER_WALLET);
      await tx.wait();
      console.log(`  Granted KEEPER_ROLE to ${VALIDATOR_KEEPER_WALLET}`);
    } else {
      console.log(`  KEEPER_ROLE already granted to ${VALIDATOR_KEEPER_WALLET}`);
    }

    // Check and grant ORACLE_POSTER_ROLE (needed for executeCycle)
    const hasPoster = await accessControl.hasRole(ORACLE_POSTER_ROLE, VALIDATOR_KEEPER_WALLET);
    if (!hasPoster) {
      const tx = await accessControl.grantRole(ORACLE_POSTER_ROLE, VALIDATOR_KEEPER_WALLET);
      await tx.wait();
      console.log(`  Granted ORACLE_POSTER_ROLE to ${VALIDATOR_KEEPER_WALLET}`);
    } else {
      console.log(`  ORACLE_POSTER_ROLE already granted to ${VALIDATOR_KEEPER_WALLET}`);
    }

    // Verify
    console.log(`  Verified KEEPER_ROLE:        ${await accessControl.hasRole(KEEPER_ROLE, VALIDATOR_KEEPER_WALLET)}`);
    console.log(`  Verified ORACLE_POSTER_ROLE: ${await accessControl.hasRole(ORACLE_POSTER_ROLE, VALIDATOR_KEEPER_WALLET)}`);
  }

  // ────────────────────────────────────────────────────────────
  //  PHASE 8: Update deployment manifest + verify
  // ────────────────────────────────────────────────────────────
  console.log("\n━━━ Phase 8: Update deployment manifest ━━━\n");

  if (!dryRun) {
    for (const name of allFacets) {
      const { address, selectors } = deployedFacets[name];
      recordFacet(deployment, name, address, selectors);
    }

    recordContract(deployment, "TradingAccountImplementation", tradingAccountAddr);

    if (!deployment.upgrades) deployment.upgrades = [];
    deployment.upgrades.push({
      version: "v3-latest",
      updatedFacets: UPDATED_FACETS,
      checkedFacets: FACETS_TO_CHECK,
      tradingAccountImpl: tradingAccountAddr,
      validatorKeeper: VALIDATOR_KEEPER_WALLET,
      vomPrecompile: VOM_PRECOMPILE_ADDRESS,
      vomEnabled: ENABLE_VOM_ON_DEPLOY,
      borrowingFeeRate: BORROWING_FEE_RATE_PER_SECOND.toString(),
      vomMarketIds: MARKET_VOM_PAIRS.map(m => ({
        marketId: m.marketId,
        pair: m.pair,
        vomId: ethers.keccak256(ethers.toUtf8Bytes(m.pair)),
      })),
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
  console.log("║          V3 UPGRADE SUMMARY                             ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("  Updated facets:");
  for (const name of allFacets) {
    console.log(`    ${name}: ${deployedFacets[name].address}`);
  }
  console.log("");
  console.log(`  TradingAccount impl: ${tradingAccountAddr}`);
  console.log(`  Validator keeper:    ${VALIDATOR_KEEPER_WALLET}`);
  console.log(`  VOM precompile:      ${VOM_PRECOMPILE_ADDRESS}`);
  console.log(`  VOM enabled:         ${ENABLE_VOM_ON_DEPLOY}`);
  console.log(`  Borrowing fee rate:  ${BORROWING_FEE_RATE_PER_SECOND}/sec (~0.03%/hr)`);
  console.log("");
  console.log("  Diamond cuts: Add=" + totalAdd + " Replace=" + totalReplace + " Remove=" + totalRemove);
  console.log("");

  if (dryRun) {
    console.log("  STATUS: DRY RUN COMPLETE — no on-chain changes made");
  } else {
    console.log("  STATUS: UPGRADE COMPLETE");
  }

  console.log("\n  Post-upgrade checklist:");
  console.log("    [ ] Verify all facets on Paxscan");
  console.log("    [ ] Test TP/SL order placement + execution on live");
  console.log("    [ ] Test liquidation on live");
  console.log("    [ ] Confirm borrowing fee accrues on open positions");
  console.log("    [ ] When ready: oracleFacet.setUsePrecompileOracle(true) to switch to VOM");
  console.log("    [ ] Update .perps-engine config if validator keeper replaces the bot");
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
