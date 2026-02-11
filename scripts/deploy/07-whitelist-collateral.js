const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv/config");

/**
 * Step 7: Whitelist collateral tokens on the deployed Diamond
 *
 * Reads token addresses and decimals from .env:
 *   USID, DECIMAL_USID, USDC, DECIMAL_USDC, USDT, DECIMAL_USDT, USDL, DECIMAL_USDL
 *
 * Usage:
 *   npx hardhat run scripts/deploy/07-whitelist-collateral.js --network paxeer-network
 */

const COLLATERAL_TOKENS = [
  { symbol: "USID", address: process.env.USID, decimals: Number(process.env.DECIMAL_USID) },
  { symbol: "USDC", address: process.env.USDC, decimals: Number(process.env.DECIMAL_USDC) },
  { symbol: "USDT", address: process.env.USDT, decimals: Number(process.env.DECIMAL_USDT) },
  { symbol: "USDL", address: process.env.USDL, decimals: Number(process.env.DECIMAL_USDL) },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 7: Whitelist Collateral Tokens");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("");

  // --- Load deployment manifest ---
  const deploymentPath = path.join(__dirname, "..", "..", "deployments", `${network}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment manifest not found: ${deploymentPath}\nRun deploy-all.js first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const diamondAddress = deployment.diamondAddress;

  if (!diamondAddress) {
    throw new Error("Diamond address not found in deployment manifest.");
  }
  console.log(`  Diamond:  ${diamondAddress}\n`);

  // --- Get CollateralFacet interface on diamond ---
  const collateral = await ethers.getContractAt("CollateralFacet", diamondAddress);

  // --- Whitelist each token ---
  const results = [];

  for (const token of COLLATERAL_TOKENS) {
    if (!token.address || token.address === "undefined") {
      console.log(`  ⚠ ${token.symbol}: address not set in .env, skipping`);
      results.push({ symbol: token.symbol, status: "skipped" });
      continue;
    }

    if (isNaN(token.decimals)) {
      console.log(`  ⚠ ${token.symbol}: decimals not set in .env, skipping`);
      results.push({ symbol: token.symbol, status: "skipped" });
      continue;
    }

    // Check if already whitelisted
    const isAccepted = await collateral.isAcceptedCollateral(token.address);
    if (isAccepted) {
      console.log(`  ○ ${token.symbol} (${token.address}) — already whitelisted (${token.decimals} decimals)`);
      results.push({ symbol: token.symbol, address: token.address, decimals: token.decimals, status: "already_whitelisted" });
      continue;
    }

    // Add collateral
    try {
      const tx = await collateral.addCollateral(token.address);
      await tx.wait();

      // Verify
      const accepted = await collateral.isAcceptedCollateral(token.address);
      const storedDecimals = await collateral.getCollateralDecimals(token.address);

      if (accepted) {
        console.log(`  ✓ ${token.symbol} (${token.address}) — whitelisted, ${storedDecimals} decimals`);
        results.push({ symbol: token.symbol, address: token.address, decimals: Number(storedDecimals), status: "whitelisted" });
      } else {
        console.log(`  ✗ ${token.symbol} — addCollateral succeeded but verification failed`);
        results.push({ symbol: token.symbol, address: token.address, status: "failed" });
      }
    } catch (err) {
      console.log(`  ✗ ${token.symbol} (${token.address}) — failed: ${err.reason || err.message}`);
      results.push({ symbol: token.symbol, address: token.address, status: "failed", error: err.reason || err.message });
    }
  }

  // --- List all accepted collateral tokens ---
  console.log("\n─── Accepted Collateral Tokens ─────────────────────");
  try {
    const tokens = await collateral.getCollateralTokens();
    for (let i = 0; i < tokens.length; i++) {
      const decimals = await collateral.getCollateralDecimals(tokens[i]);
      const match = COLLATERAL_TOKENS.find(
        (t) => t.address && t.address.toLowerCase() === tokens[i].toLowerCase()
      );
      const symbol = match ? match.symbol : "???";
      console.log(`  [${i}] ${symbol} — ${tokens[i]} (${decimals} decimals)`);
    }
  } catch (err) {
    console.log(`  Could not fetch token list: ${err.message}`);
  }

  // --- Update deployment manifest ---
  deployment.collateral = results
    .filter((r) => r.status === "whitelisted" || r.status === "already_whitelisted")
    .map((r) => ({ symbol: r.symbol, address: r.address, decimals: r.decimals }));
  deployment.timestamp = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\n  💾 Deployment manifest updated`);

  // --- Summary ---
  const whitelisted = results.filter((r) => r.status === "whitelisted").length;
  const already = results.filter((r) => r.status === "already_whitelisted").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  ✓ Whitelisted:         ${whitelisted}`);
  console.log(`  ○ Already whitelisted: ${already}`);
  console.log(`  ✗ Failed:              ${failed}`);
  console.log(`  ⚠ Skipped:             ${skipped}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Collateral whitelisting failed:", error);
    process.exit(1);
  });
