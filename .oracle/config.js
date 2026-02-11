require("dotenv").config({ path: __dirname + "/.env" });

// ============================================================
//  MARKET → PYTH PRICE FEED MAPPING
// ============================================================
// marketId corresponds to the on-chain market ID from MarketRegistryFacet
// pythId is the Pyth Network price feed ID (Hermes)

const MARKETS = [
  {
    marketId: 0,
    symbol: "BTC",
    pythId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  },
  {
    marketId: 1,
    symbol: "ETH",
    pythId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  },
  {
    marketId: 2,
    symbol: "SOL",
    pythId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  },
  {
    marketId: 3,
    symbol: "AVAX",
    pythId: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  },
  {
    marketId: 4,
    symbol: "LINK",
    pythId: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  },
];

// ============================================================
//  NODE CONFIGURATION
// ============================================================

const CONFIG = {
  // Pyth Hermes endpoint (mainnet)
  pythHermesUrl: process.env.PYTH_HERMES_URL || "https://hermes.pyth.network",

  // Paxeer Network RPC
  rpcUrl: process.env.RPC_URL || "https://public-rpc.paxeer.app/rpc",

  // Private key of the ORACLE_POSTER account
  privateKey: process.env.ORACLE_PRIVATE_KEY,

  // Diamond address on Paxeer Network
  diamondAddress: process.env.DIAMOND_ADDRESS || "0xeA65FE02665852c615774A3041DFE6f00fb77537",

  // How often to fetch + submit prices (milliseconds)
  updateIntervalMs: Number(process.env.UPDATE_INTERVAL_MS) || 5000, // 5 seconds

  // Maximum price deviation (%) to trigger an immediate update between intervals
  deviationThresholdPct: Number(process.env.DEVIATION_THRESHOLD_PCT) || 0.5,

  // Maximum number of consecutive failures before alerting
  maxConsecutiveFailures: Number(process.env.MAX_CONSECUTIVE_FAILURES) || 10,

  // Gas settings
  gasLimit: Number(process.env.GAS_LIMIT) || 500000,
  maxFeePerGas: process.env.MAX_FEE_PER_GAS || undefined, // in gwei, auto if not set

  // Retry settings
  maxRetries: 3,
  retryDelayMs: 2000,
};

// ============================================================
//  OracleFacet ABI (minimal — only what the node needs)
// ============================================================

const ORACLE_ABI = [
  "function batchUpdatePrices(uint256[] calldata _marketIds, uint256[] calldata _prices) external",
  "function getLatestPrice(uint256 _marketId) external view returns (uint256)",
  "function getLatestPriceTimestamp(uint256 _marketId) external view returns (uint256)",
  "function isPriceStale(uint256 _marketId) external view returns (bool)",
];

module.exports = { MARKETS, CONFIG, ORACLE_ABI };
