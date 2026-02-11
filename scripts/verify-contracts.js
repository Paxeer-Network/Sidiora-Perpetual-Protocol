const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Verify all deployed contracts on the Paxeer block explorer (paxscan.paxeer.app)
 *
 * Usage:
 *   npx hardhat run scripts/verify-contracts.js --network paxeer-network
 *
 * Reads addresses from deployments/paxeer-network.json and verifies each contract.
 * Skips contracts that are already verified. Continues on failure.
 */

// Delay between verification requests to avoid rate limiting
const DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyContract(address, contractName, constructorArgs = []) {
  try {
    console.log(`  Verifying ${contractName} at ${address}...`);
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`  ✓ ${contractName} verified successfully\n`);
    return { name: contractName, address, status: "verified" };
  } catch (error) {
    const msg = error.message || "";
    if (msg.includes("Already Verified") || msg.includes("already verified")) {
      console.log(`  ○ ${contractName} already verified\n`);
      return { name: contractName, address, status: "already_verified" };
    }
    console.log(`  ✗ ${contractName} verification failed: ${msg}\n`);
    return { name: contractName, address, status: "failed", error: msg };
  }
}

async function main() {
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  CONTRACT VERIFICATION — Paxeer Block Explorer");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Explorer: https://paxscan.paxeer.app`);
  console.log("");

  // --- Load deployment manifest ---
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network}.json`
  );
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `Deployment manifest not found: ${deploymentPath}\nRun deploy-all.js first.`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond address not found in deployment manifest.");
  }

  console.log(`  Diamond:  ${diamondAddress}`);
  console.log(`  Deployed: ${deployment.timestamp}`);
  console.log("");

  const results = [];

  // ============================================================
  //  1. Verify DiamondCutFacet (no constructor args)
  // ============================================================
  console.log("─── Core Contracts ─────────────────────────────────");

  const diamondCutAddr = deployment.facets["DiamondCutFacet"]?.address;
  if (diamondCutAddr) {
    results.push(
      await verifyContract(diamondCutAddr, "DiamondCutFacet")
    );
    await sleep(DELAY_MS);
  }

  // ============================================================
  //  2. Verify Diamond proxy (constructor args: owner, diamondCutFacet)
  // ============================================================
  const [deployer] = await ethers.getSigners();
  results.push(
    await verifyContract(diamondAddress, "Diamond", [
      deployer.address,
      diamondCutAddr,
    ])
  );
  await sleep(DELAY_MS);

  // ============================================================
  //  3. Verify all facets (no constructor args)
  // ============================================================
  console.log("─── Facets ─────────────────────────────────────────");

  const facetNames = [
    "DiamondLoupeFacet",
    "OwnershipFacet",
    "PositionFacet",
    "OrderBookFacet",
    "LiquidationFacet",
    "FundingRateFacet",
    "OracleFacet",
    "VirtualAMMFacet",
    "PriceFeedFacet",
    "AccessControlFacet",
    "PausableFacet",
    "VaultFactoryFacet",
    "CentralVaultFacet",
    "CollateralFacet",
    "MarketRegistryFacet",
    "InsuranceFundFacet",
    "QuoterFacet",
  ];

  for (const facetName of facetNames) {
    const info = deployment.facets[facetName];
    if (!info || !info.address) {
      console.log(`  ⚠ ${facetName}: not found in deployment manifest, skipping\n`);
      continue;
    }
    results.push(await verifyContract(info.address, facetName));
    await sleep(DELAY_MS);
  }

  // ============================================================
  //  4. Verify UserVault implementation (no constructor args)
  // ============================================================
  console.log("─── Standalone Contracts ───────────────────────────");

  const userVaultAddr = deployment.contracts?.["UserVaultImplementation"]?.address;
  if (userVaultAddr) {
    results.push(await verifyContract(userVaultAddr, "UserVault"));
    await sleep(DELAY_MS);
  }

  // ============================================================
  //  SUMMARY
  // ============================================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("  VERIFICATION SUMMARY");
  console.log("═══════════════════════════════════════════════════════");

  const verified = results.filter((r) => r.status === "verified");
  const alreadyVerified = results.filter((r) => r.status === "already_verified");
  const failed = results.filter((r) => r.status === "failed");

  console.log(`  ✓ Verified:         ${verified.length}`);
  console.log(`  ○ Already verified: ${alreadyVerified.length}`);
  console.log(`  ✗ Failed:           ${failed.length}`);
  console.log(`  Total:              ${results.length}`);

  if (failed.length > 0) {
    console.log("\n  Failed contracts:");
    for (const f of failed) {
      console.log(`    ✗ ${f.name} (${f.address})`);
      console.log(`      Error: ${f.error.substring(0, 120)}`);
    }
  }

  console.log("\n  Explorer links:");
  console.log(`    Diamond: https://paxscan.paxeer.app/address/${diamondAddress}#code`);
  for (const r of results) {
    if (r.status === "verified" || r.status === "already_verified") {
      console.log(`    ${r.name}: https://paxscan.paxeer.app/address/${r.address}#code`);
    }
  }

  // --- Save verification results to manifest ---
  deployment.verification = {
    results: results.map((r) => ({
      name: r.name,
      address: r.address,
      status: r.status,
    })),
    timestamp: new Date().toISOString(),
    verified: verified.length,
    alreadyVerified: alreadyVerified.length,
    failed: failed.length,
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\n  💾 Results saved to: ${deploymentPath}`);

  console.log("\n═══════════════════════════════════════════════════════");
  if (failed.length === 0) {
    console.log("  ✅ ALL CONTRACTS VERIFIED SUCCESSFULLY");
  } else {
    console.log(`  ⚠ ${failed.length} contract(s) failed — re-run to retry`);
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Verification script failed:", error);
    process.exit(1);
  });
