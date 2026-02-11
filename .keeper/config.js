require("dotenv").config({ path: __dirname + "/.env" });

// ============================================================
//  MARKET CONFIGURATION
// ============================================================

const MARKETS = [
  { marketId: 0, symbol: "BTC" },
  { marketId: 1, symbol: "ETH" },
  { marketId: 2, symbol: "SOL" },
  { marketId: 3, symbol: "AVAX" },
  { marketId: 4, symbol: "LINK" },
];

// ============================================================
//  NODE CONFIGURATION
// ============================================================

const CONFIG = {
  // Paxeer Network RPC
  rpcUrl: process.env.RPC_URL || "https://public-rpc.paxeer.app/rpc",

  // Private key of the KEEPER_ROLE account
  privateKey: process.env.KEEPER_PRIVATE_KEY,

  // Diamond address
  diamondAddress:
    process.env.DIAMOND_ADDRESS ||
    "0xeA65FE02665852c615774A3041DFE6f00fb77537",

  // Indexer GraphQL endpoint
  indexerUrl:
    process.env.INDEXER_GRAPHQL_URL || "http://localhost:4000/graphql",

  // Scan intervals
  orderRefreshMs: Number(process.env.ORDER_REFRESH_INTERVAL_MS) || 300000,
  positionRefreshMs:
    Number(process.env.POSITION_REFRESH_INTERVAL_MS) || 120000,
  fallbackPollMs: Number(process.env.FALLBACK_POLL_INTERVAL_MS) || 15000,

  // Gas limits
  gasLimitExecuteOrder:
    Number(process.env.GAS_LIMIT_EXECUTE_ORDER) || 800000,
  gasLimitLiquidate: Number(process.env.GAS_LIMIT_LIQUIDATE) || 1000000,
  gasLimitSyncVamm: Number(process.env.GAS_LIMIT_SYNC_VAMM) || 300000,

  // Retry
  maxRetries: 3,
  retryDelayMs: 2000,

  // Alerting
  maxConsecutiveFailures:
    Number(process.env.MAX_CONSECUTIVE_FAILURES) || 5,
  minWalletBalanceEth:
    Number(process.env.MIN_WALLET_BALANCE_ETH) || 0.1,
};

// ============================================================
//  ABI FRAGMENTS (only the functions the keeper needs)
// ============================================================

const ORDER_BOOK_ABI = [
  "function executeOrder(uint256 _orderId) external returns (uint256 positionId)",
  "function getOrder(uint256 _orderId) external view returns (address user, uint256 marketId, bool isLong, uint8 orderType, uint256 triggerPrice, uint256 limitPrice, uint256 sizeUsd, uint256 leverage, address collateralToken, uint256 collateralAmount, bool active)",
  "function getUserOrderIds(address _user) external view returns (uint256[])",
  "event OrderPlaced(uint256 indexed orderId, address indexed user, uint256 indexed marketId, uint8 orderType, bool isLong, uint256 triggerPrice, uint256 sizeUsd)",
  "event OrderExecuted(uint256 indexed orderId, uint256 indexed positionId, uint256 executionPrice)",
  "event OrderCancelled(uint256 indexed orderId, address indexed user)",
];

const ORACLE_ABI = [
  "function getPrice(uint256 _marketId) external view returns (uint256 price, uint256 timestamp)",
  "function isPriceStale(uint256 _marketId) external view returns (bool)",
  "event PricesUpdated(uint256[] marketIds, uint256[] prices, uint256 timestamp)",
];

const LIQUIDATION_ABI = [
  "function liquidate(uint256 _positionId) external",
  "function checkLiquidatable(uint256 _positionId) external view returns (bool liquidatable, uint256 marginBps)",
];

const POSITION_ABI = [
  "function getPosition(uint256 _positionId) external view returns (address user, uint256 marketId, bool isLong, uint256 sizeUsd, uint256 collateralUsd, address collateralToken, uint256 collateralAmount, uint256 entryPrice, int256 lastFundingIndex, uint256 timestamp, bool active)",
  "function getUserPositionIds(address _user) external view returns (uint256[])",
  "function getOpenInterest(uint256 _marketId) external view returns (uint256 longOI, uint256 shortOI)",
];

const VAMM_ABI = [
  "function syncToOracle(uint256 _marketId) external",
  "function getPool(uint256 _marketId) external view returns (uint256 baseReserve, uint256 quoteReserve, uint256 lastSyncTimestamp, uint256 dampingFactor)",
  "event PoolSynced(uint256 indexed marketId, uint256 newBase, uint256 newQuote, uint256 oraclePrice)",
];

const MARKET_ABI = [
  "function getMarket(uint256 _marketId) external view returns (string name, string symbol, uint256 maxLeverage, uint256 maintenanceMarginBps, bool enabled)",
];

const ACCESS_CONTROL_ABI = [
  "function hasRole(bytes32 _role, address _account) external view returns (bool)",
  "function grantRole(bytes32 _role, address _account) external",
];

// Combined ABI for a single contract instance
const COMBINED_ABI = [
  ...ORDER_BOOK_ABI,
  ...ORACLE_ABI,
  ...LIQUIDATION_ABI,
  ...POSITION_ABI,
  ...VAMM_ABI,
  ...MARKET_ABI,
  ...ACCESS_CONTROL_ABI,
];

module.exports = {
  MARKETS,
  CONFIG,
  ORDER_BOOK_ABI,
  ORACLE_ABI,
  LIQUIDATION_ABI,
  POSITION_ABI,
  VAMM_ABI,
  MARKET_ABI,
  ACCESS_CONTROL_ABI,
  COMBINED_ABI,
};
