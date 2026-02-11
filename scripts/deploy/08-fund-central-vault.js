const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv/config");

/**
 * Step 8: Fund the CentralVault with protocol capital
 *
 * Deposits 250,000 of each whitelisted stablecoin into the CentralVault.
 * Requires PROTOCOL_FUNDER_ROLE on the signing wallet.
 *
 * Prerequisites:
 *   - Diamond deployed (steps 01-05)
 *   - Protocol initialized (step 06) — roles granted
 *   - Collateral whitelisted (step 07)
 *   - Funder wallet holds sufficient stablecoin balances
 *
 * Usage:
 *   npx hardhat run scripts/deploy/08-fund-central-vault.js --network paxeer-network
 *
 * Environment:
 *   USID, DECIMAL_USID, USDC, DECIMAL_USDC, USDT, DECIMAL_USDT, USDL, DECIMAL_USDL
 */

// ============================================================
//  CONFIG
// ============================================================

const FUND_AMOUNT_USD = 250_000; // $250,000 per stablecoin

const TOKENS = [
  { symbol: "USID", address: process.env.USID, decimals: Number(process.env.DECIMAL_USID) },
  { symbol: "USDC", address: process.env.USDC, decimals: Number(process.env.DECIMAL_USDC) },
  { symbol: "USDT", address: process.env.USDT, decimals: Number(process.env.DECIMAL_USDT) },
  { symbol: "USDL", address: process.env.USDL, decimals: Number(process.env.DECIMAL_USDL) },
];

// ============================================================
//  MAIN
// ============================================================

async function main() {
  const [funder] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("  STEP 8: Fund CentralVault");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network}`);
  console.log(`  Funder:   ${funder.address}`);
  console.log(`  Amount:   ${FUND_AMOUNT_USD.toLocaleString()} per stablecoin`);
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

  // --- Get facet interfaces ---
  const centralVault = await ethers.getContractAt("CentralVaultFacet", diamondAddress);
  const collateral = await ethers.getContractAt("CollateralFacet", diamondAddress);
  const accessControl = await ethers.getContractAt("AccessControlFacet", diamondAddress);

  // --- Verify PROTOCOL_FUNDER_ROLE ---
  const PROTOCOL_FUNDER_ROLE = await accessControl.PROTOCOL_FUNDER_ROLE();
  const hasRole = await accessControl.hasRole(PROTOCOL_FUNDER_ROLE, funder.address);
  if (!hasRole) {
    throw new Error(
      `Funder ${funder.address} does not have PROTOCOL_FUNDER_ROLE.\n` +
      `Grant it first: accessControl.grantRole(${PROTOCOL_FUNDER_ROLE}, "${funder.address}")`
    );
  }
  console.log("  PROTOCOL_FUNDER_ROLE: GRANTED\n");

  // --- Fund each token ---
  const results = [];

  for (const token of TOKENS) {
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

    // Check if accepted
    const isAccepted = await collateral.isAcceptedCollateral(token.address);
    if (!isAccepted) {
      console.log(`  ⚠ ${token.symbol} (${token.address}): not whitelisted, skipping`);
      results.push({ symbol: token.symbol, address: token.address, status: "not_whitelisted" });
      continue;
    }

    const erc20 = await ethers.getContractAt("IERC20", token.address);
    const fundAmount = ethers.parseUnits(FUND_AMOUNT_USD.toString(), token.decimals);

    // Check funder balance
    const balance = await erc20.balanceOf(funder.address);
    const balanceFormatted = ethers.formatUnits(balance, token.decimals);

    if (balance < fundAmount) {
      console.log(
        `  ✗ ${token.symbol}: insufficient balance. ` +
        `Have ${balanceFormatted}, need ${FUND_AMOUNT_USD.toLocaleString()}`
      );
      results.push({
        symbol: token.symbol,
        address: token.address,
        status: "insufficient_balance",
        balance: balanceFormatted,
      });
      continue;
    }

    console.log(`  ${token.symbol} (${token.address}):`);
    console.log(`    Balance:  ${balanceFormatted}`);
    console.log(`    Funding:  ${FUND_AMOUNT_USD.toLocaleString()} (${token.decimals} decimals)`);

    // Step 1: Approve Diamond to spend tokens
    const currentAllowance = await erc20.allowance(funder.address, diamondAddress);
    if (currentAllowance < fundAmount) {
      console.log(`    Approving Diamond...`);
      const approveTx = await erc20.approve(diamondAddress, fundAmount);
      await approveTx.wait();
      console.log(`    Approved: ${approveTx.hash}`);
    } else {
      console.log(`    Allowance sufficient, skipping approve`);
    }

    // Step 2: Fund vault
    try {
      const fundTx = await centralVault.fundVault(token.address, fundAmount);
      console.log(`    TX sent:  ${fundTx.hash}`);
      const receipt = await fundTx.wait();
      console.log(`    Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed})`);

      // Verify
      const vaultBalance = await centralVault.getVaultBalance(token.address);
      console.log(`    Vault balance: ${ethers.formatUnits(vaultBalance, token.decimals)}`);

      results.push({
        symbol: token.symbol,
        address: token.address,
        status: "funded",
        amount: FUND_AMOUNT_USD.toString(),
        txHash: fundTx.hash,
      });
    } catch (err) {
      console.log(`    ✗ FAILED: ${err.reason || err.message}`);
      results.push({
        symbol: token.symbol,
        address: token.address,
        status: "failed",
        error: err.reason || err.message,
      });
    }

    console.log("");
  }

  // --- Final vault balances ---
  console.log("─── CentralVault Balances ──────────────────────────────");
  let totalUsd = 0;
  for (const token of TOKENS) {
    if (!token.address || token.address === "undefined") continue;
    try {
      const vaultBalance = await centralVault.getVaultBalance(token.address);
      const formatted = ethers.formatUnits(vaultBalance, token.decimals);
      const usd = Number(formatted);
      totalUsd += usd;
      console.log(`  ${token.symbol}: ${Number(formatted).toLocaleString()}`);
    } catch {
      console.log(`  ${token.symbol}: query failed`);
    }
  }
  console.log(`  ────────────────────`);
  console.log(`  TOTAL: ~$${totalUsd.toLocaleString()}`);

  // --- Update deployment manifest ---
  deployment.centralVaultFunding = {
    amountPerToken: FUND_AMOUNT_USD,
    tokens: results.filter((r) => r.status === "funded").map((r) => ({
      symbol: r.symbol,
      address: r.address,
      amount: r.amount,
      txHash: r.txHash,
    })),
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  // --- Summary ---
  const funded = results.filter((r) => r.status === "funded").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => ["skipped", "not_whitelisted", "insufficient_balance"].includes(r.status)).length;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  ✓ Funded:   ${funded} tokens × $${FUND_AMOUNT_USD.toLocaleString()} = $${(funded * FUND_AMOUNT_USD).toLocaleString()}`);
  console.log(`  ✗ Failed:   ${failed}`);
  console.log(`  ⚠ Skipped:  ${skipped}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Vault funding failed:", error);
    process.exit(1);
  });
