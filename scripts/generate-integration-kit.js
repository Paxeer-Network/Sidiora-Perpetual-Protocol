const fs = require("fs");
const path = require("path");

/**
 * Generate Integration Kit
 *
 * Creates /integration-kit/ with:
 *   /env/       — .env templates for every major framework
 *   /abi/       — .json + .ts + .js ABI files for each contract needed by frontends/backends
 *
 * Usage:
 *   node scripts/generate-integration-kit.js
 */

// ============================================================
//                    CONFIG
// ============================================================

const OUTPUT_DIR = path.join(__dirname, "..", "integration-kit");
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts", "contracts");
const DEPLOYMENT_PATH = path.join(__dirname, "..", "deployments", "paxeer-network.json");

// Diamond address (all facet calls go through this single address)
const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf8"));
const DIAMOND_ADDRESS = deployment.diamondAddress;

// Collateral token addresses from deployment manifest
const COLLATERAL = deployment.collateral || [];

// RPC + chain config
const CHAIN_ID = 125;
const CHAIN_NAME = "Paxeer Network";
const RPC_URL = "https://public-mainnet.rpcpaxeer.online/app";
const EXPLORER_URL = "https://paxscan.paxeer.app";
const NATIVE_SYMBOL = "PAX";

// ============================================================
//   ABIS TO EXTRACT — grouped by use case
// ============================================================

const ABI_SOURCES = {
  // --- Frontend: Trading ---
  PositionFacet: "diamond/facets/trading/PositionFacet.sol/PositionFacet.json",
  OrderBookFacet: "diamond/facets/trading/OrderBookFacet.sol/OrderBookFacet.json",
  LiquidationFacet: "diamond/facets/trading/LiquidationFacet.sol/LiquidationFacet.json",
  FundingRateFacet: "diamond/facets/trading/FundingRateFacet.sol/FundingRateFacet.json",

  // --- Frontend: Pricing & Market Data ---
  OracleFacet: "diamond/facets/pricing/OracleFacet.sol/OracleFacet.json",
  VirtualAMMFacet: "diamond/facets/pricing/VirtualAMMFacet.sol/VirtualAMMFacet.json",
  PriceFeedFacet: "diamond/facets/pricing/PriceFeedFacet.sol/PriceFeedFacet.json",
  QuoterFacet: "diamond/facets/support/QuoterFacet.sol/QuoterFacet.json",

  // --- Frontend: Markets & Collateral ---
  MarketRegistryFacet: "diamond/facets/support/MarketRegistryFacet.sol/MarketRegistryFacet.json",
  CollateralFacet: "diamond/facets/vault/CollateralFacet.sol/CollateralFacet.json",
  CentralVaultFacet: "diamond/facets/vault/CentralVaultFacet.sol/CentralVaultFacet.json",
  InsuranceFundFacet: "diamond/facets/support/InsuranceFundFacet.sol/InsuranceFundFacet.json",

  // --- Frontend: Vault & Account ---
  VaultFactoryFacet: "diamond/facets/vault/VaultFactoryFacet.sol/VaultFactoryFacet.json",
  TradingAccount: "vaults/TradingAccount.sol/TradingAccount.json",

  // --- Backend: Keeper ---
  KeeperMulticallFacet: "diamond/facets/core/KeeperMulticallFacet.sol/KeeperMulticallFacet.json",

  // --- Shared: Tokens ---
  IERC20: "diamond/interfaces/IERC20.sol/IERC20.json",

  // --- Shared: Access Control ---
  AccessControlFacet: "diamond/facets/core/AccessControlFacet.sol/AccessControlFacet.json",

  // --- Shared: Diamond Introspection ---
  DiamondLoupeFacet: "diamond/facets/core/DiamondLoupeFacet.sol/DiamondLoupeFacet.json",

  // --- Spot Trading ---
  SpotMarketRegistryFacet: "diamond/facets/spot/SpotMarketRegistryFacet.sol/SpotMarketRegistryFacet.json",
  SpotSettlementFacet: "diamond/facets/spot/SpotSettlementFacet.sol/SpotSettlementFacet.json",
  SpotOrderBookFacet: "diamond/facets/spot/SpotOrderBookFacet.sol/SpotOrderBookFacet.json",
  SpotBatchAuctionFacet: "diamond/facets/spot/SpotBatchAuctionFacet.sol/SpotBatchAuctionFacet.json",
  SpotModeSwitchFacet: "diamond/facets/spot/SpotModeSwitchFacet.sol/SpotModeSwitchFacet.json",
  PLVRegistryFacet: "diamond/facets/spot/PLVRegistryFacet.sol/PLVRegistryFacet.json",
  PoFQFacet: "diamond/facets/spot/PoFQFacet.sol/PoFQFacet.json",
  SpotKeeperMulticallFacet: "diamond/facets/spot/SpotKeeperMulticallFacet.sol/SpotKeeperMulticallFacet.json",
};

// ============================================================
//                    HELPERS
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function extractAbi(artifactPath) {
  const full = path.join(ARTIFACTS_DIR, artifactPath);
  if (!fs.existsSync(full)) {
    console.error(`  Missing artifact: ${full}`);
    return null;
  }
  const artifact = JSON.parse(fs.readFileSync(full, "utf8"));
  return artifact.abi;
}

// ============================================================
//               GENERATE ABI FILES
// ============================================================

function generateAbis() {
  const abiDir = path.join(OUTPUT_DIR, "abi");
  ensureDir(abiDir);

  const indexExportsJs = [];
  const indexExportsTs = [];

  for (const [name, artifactPath] of Object.entries(ABI_SOURCES)) {
    const abi = extractAbi(artifactPath);
    if (!abi) continue;

    const jsonFile = path.join(abiDir, `${name}.json`);
    const jsFile = path.join(abiDir, `${name}.js`);
    const tsFile = path.join(abiDir, `${name}.ts`);

    // .json — raw ABI array
    fs.writeFileSync(jsonFile, JSON.stringify(abi, null, 2));

    // .js — CommonJS export
    fs.writeFileSync(jsFile,
      `/** ${name} ABI — auto-generated by generate-integration-kit.js */\n` +
      `const ${name}ABI = ${JSON.stringify(abi, null, 2)};\n\n` +
      `module.exports = { ${name}ABI };\n`
    );

    // .ts — TypeScript const assertion for viem/wagmi
    fs.writeFileSync(tsFile,
      `/** ${name} ABI — auto-generated by generate-integration-kit.js */\n` +
      `export const ${name}ABI = ${JSON.stringify(abi, null, 2)} as const;\n`
    );

    indexExportsJs.push(`const { ${name}ABI } = require("./${name}");`);
    indexExportsTs.push(`export { ${name}ABI } from "./${name}";`);

    console.log(`  ${name}: ${abi.length} entries`);
  }

  // index.js — barrel export (CommonJS)
  const jsBarrel =
    `/** Barrel export — all ABIs */\n` +
    indexExportsJs.join("\n") + "\n\n" +
    `module.exports = {\n` +
    Object.keys(ABI_SOURCES).map(n => `  ${n}ABI,`).join("\n") + "\n};\n";
  fs.writeFileSync(path.join(abiDir, "index.js"), jsBarrel);

  // index.ts — barrel export (ESM/TypeScript)
  const tsBarrel =
    `/** Barrel export — all ABIs */\n` +
    indexExportsTs.join("\n") + "\n";
  fs.writeFileSync(path.join(abiDir, "index.ts"), tsBarrel);

  console.log(`\n  index.js + index.ts barrel exports written`);
}

// ============================================================
//              GENERATE ENV FILES
// ============================================================

function buildEnvVars(prefix) {
  const lines = [
    `# Sidiora Perpetual Protocol — Environment Variables`,
    `# Generated: ${new Date().toISOString()}`,
    `# Chain: ${CHAIN_NAME} (ID: ${CHAIN_ID})`,
    ``,
    `# ── Network ──`,
    `${prefix}RPC_URL=${RPC_URL}`,
    `${prefix}CHAIN_ID=${CHAIN_ID}`,
    `${prefix}CHAIN_NAME=${CHAIN_NAME}`,
    `${prefix}EXPLORER_URL=${EXPLORER_URL}`,
    `${prefix}NATIVE_SYMBOL=${NATIVE_SYMBOL}`,
    ``,
    `# ── Core Contract (Diamond Proxy — single entry point for all facets) ──`,
    `${prefix}DIAMOND_ADDRESS=${DIAMOND_ADDRESS}`,
    ``,
    `# ── Collateral Tokens ──`,
  ];

  for (const c of COLLATERAL) {
    lines.push(`${prefix}${c.symbol}_ADDRESS=${c.address}`);
  }

  lines.push(
    ``,
    `# ── WalletConnect / Web3Modal (frontend only) ──`,
    `${prefix}WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID_HERE`,
    ``,
    `# ── Keeper / Backend (server-side only — NEVER prefix with NEXT_PUBLIC_ etc.) ──`,
    `# KEEPER_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE`,
    `# ORACLE_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE`,
  );

  return lines.join("\n") + "\n";
}

function generateEnvFiles() {
  const envDir = path.join(OUTPUT_DIR, "env");
  ensureDir(envDir);

  const frameworks = [
    {
      name: "nextjs",
      file: ".env.local.nextjs",
      prefix: "NEXT_PUBLIC_",
      desc: "Next.js (App Router / Pages Router)",
    },
    {
      name: "vite",
      file: ".env.vite",
      prefix: "VITE_",
      desc: "Vite (React, Vue, Svelte, Solid)",
    },
    {
      name: "create-react-app",
      file: ".env.cra",
      prefix: "REACT_APP_",
      desc: "Create React App",
    },
    {
      name: "nuxt",
      file: ".env.nuxt",
      prefix: "NUXT_PUBLIC_",
      desc: "Nuxt 3",
    },
    {
      name: "sveltekit",
      file: ".env.sveltekit",
      prefix: "PUBLIC_",
      desc: "SvelteKit",
    },
    {
      name: "remix",
      file: ".env.remix",
      prefix: "",
      desc: "Remix (no prefix — use loader to expose to client)",
    },
    {
      name: "node-backend",
      file: ".env.node",
      prefix: "",
      desc: "Node.js / Express / Fastify (backend — no prefix needed)",
    },
    {
      name: "python",
      file: ".env.python",
      prefix: "",
      desc: "Python (FastAPI / Flask / Django)",
    },
  ];

  for (const fw of frameworks) {
    const header =
      `# ═══════════════════════════════════════════════════\n` +
      `# ${fw.desc}\n` +
      `# Framework: ${fw.name}\n` +
      `# Prefix: ${fw.prefix || "(none)"}\n` +
      `# ═══════════════════════════════════════════════════\n\n`;

    const content = header + buildEnvVars(fw.prefix);
    const filePath = path.join(envDir, fw.file);
    fs.writeFileSync(filePath, content);
    console.log(`  ${fw.file} (${fw.desc})`);
  }

  // Also generate a generic .env with NO prefix as the base template
  const genericHeader =
    `# ═══════════════════════════════════════════════════\n` +
    `# Generic .env template (copy and add your framework prefix)\n` +
    `#\n` +
    `# Prefixes by framework:\n` +
    `#   Next.js:    NEXT_PUBLIC_\n` +
    `#   Vite:       VITE_\n` +
    `#   CRA:        REACT_APP_\n` +
    `#   Nuxt 3:     NUXT_PUBLIC_\n` +
    `#   SvelteKit:  PUBLIC_\n` +
    `#   Remix:      (none — use loader)\n` +
    `#   Node/Py:    (none)\n` +
    `# ═══════════════════════════════════════════════════\n\n`;

  fs.writeFileSync(
    path.join(envDir, ".env.template"),
    genericHeader + buildEnvVars("")
  );
  console.log(`  .env.template (generic)`);
}

// ============================================================
//              GENERATE README
// ============================================================

function generateReadme() {
  const abiNames = Object.keys(ABI_SOURCES);

  const readme = `# Sidiora Perpetual Protocol — Integration Kit

Auto-generated by \`scripts/generate-integration-kit.js\`.

## Structure

\`\`\`
integration-kit/
  env/                          # Environment variable templates
    .env.template               # Generic (no prefix)
    .env.local.nextjs           # Next.js (NEXT_PUBLIC_)
    .env.vite                   # Vite (VITE_)
    .env.cra                    # Create React App (REACT_APP_)
    .env.nuxt                   # Nuxt 3 (NUXT_PUBLIC_)
    .env.sveltekit              # SvelteKit (PUBLIC_)
    .env.remix                  # Remix (no prefix)
    .env.node                   # Node.js backend (no prefix)
    .env.python                 # Python backend (no prefix)
  abi/                          # Contract ABIs
    {Name}.json                 # Raw ABI array
    {Name}.js                   # CommonJS export
    {Name}.ts                   # TypeScript const assertion (viem/wagmi)
    index.js                    # Barrel export (CJS)
    index.ts                    # Barrel export (ESM)
\`\`\`

## Diamond Address

All facet calls go through the single Diamond proxy:

\`\`\`
${DIAMOND_ADDRESS}
\`\`\`

Chain: ${CHAIN_NAME} (ID: ${CHAIN_ID})
RPC: ${RPC_URL}
Explorer: ${EXPLORER_URL}

## Available ABIs

| ABI | Use Case |
|-----|----------|
${abiNames.map(n => `| \`${n}ABI\` | ${getUseCaseLabel(n)} |`).join("\n")}

## Quick Start (Next.js + viem)

\`\`\`ts
import { createPublicClient, http } from "viem";
import { PositionFacetABI } from "./abi";

const client = createPublicClient({
  chain: { id: ${CHAIN_ID}, name: "${CHAIN_NAME}", nativeCurrency: { name: "PAX", symbol: "PAX", decimals: 18 }, rpcUrls: { default: { http: ["${RPC_URL}"] } } },
  transport: http(),
});

const position = await client.readContract({
  address: "${DIAMOND_ADDRESS}",
  abi: PositionFacetABI,
  functionName: "getPosition",
  args: [1n],
});
\`\`\`

## Quick Start (Node.js + ethers)

\`\`\`js
const { ethers } = require("ethers");
const { PositionFacetABI } = require("./abi");

const provider = new ethers.JsonRpcProvider("${RPC_URL}");
const diamond = new ethers.Contract("${DIAMOND_ADDRESS}", PositionFacetABI, provider);

const pos = await diamond.getPosition(1);
console.log(pos);
\`\`\`
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, "README.md"), readme);
  console.log(`  README.md`);
}

function getUseCaseLabel(name) {
  const labels = {
    PositionFacet: "Open, close, modify positions",
    OrderBookFacet: "Limit, stop-limit, TP/SL orders",
    LiquidationFacet: "Check liquidation, liquidate",
    FundingRateFacet: "Funding rates, position funding",
    OracleFacet: "Price feeds, VOM oracle",
    VirtualAMMFacet: "Mark price, pool state, impact sim",
    PriceFeedFacet: "Index/mark/execution price, TWAP",
    QuoterFacet: "Quote trades, estimate PnL",
    MarketRegistryFacet: "Market list, params, robustness",
    CollateralFacet: "Accepted tokens, normalization",
    CentralVaultFacet: "Vault balance, utilization",
    InsuranceFundFacet: "Insurance balance, ADL status",
    VaultFactoryFacet: "Create vault, get vault address",
    TradingAccount: "Deposit, withdraw, balances, delegation",
    KeeperMulticallFacet: "Keeper: atomic cycle execution",
    IERC20: "ERC-20 approve, balanceOf, transfer",
    AccessControlFacet: "Role checks, role management",
    DiamondLoupeFacet: "Facet introspection",
    SpotMarketRegistryFacet: "Spot market creation, config, prices",
    SpotSettlementFacet: "Spot deposit, withdraw, epoch settlement",
    SpotOrderBookFacet: "Spot OROB orders, continuous matching",
    SpotBatchAuctionFacet: "Spot batch auction clearing",
    SpotModeSwitchFacet: "Spot mode evaluation (continuous/batch)",
    PLVRegistryFacet: "PLV registration, quotes, scores",
    PoFQFacet: "PoFQ scores, fee tiers, reputation",
    SpotKeeperMulticallFacet: "Spot keeper: atomic spot cycle",
  };
  return labels[name] || name;
}

// ============================================================
//                     MAIN
// ============================================================

console.log("╔═══════════════════════════════════════════════════════════╗");
console.log("║       GENERATE INTEGRATION KIT                          ║");
console.log("╚═══════════════════════════════════════════════════════════╝\n");

ensureDir(OUTPUT_DIR);

console.log("━━━ ABIs ━━━\n");
generateAbis();

console.log("\n━━━ ENV Templates ━━━\n");
generateEnvFiles();

console.log("\n━━━ Docs ━━━\n");
generateReadme();

console.log("\n━━━ Done ━━━\n");
console.log(`  Output: ${OUTPUT_DIR}`);
console.log(`  ABIs:   ${Object.keys(ABI_SOURCES).length} contracts`);
console.log(`  Envs:   9 framework templates`);
console.log("");
