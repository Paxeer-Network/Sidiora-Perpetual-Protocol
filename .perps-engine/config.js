require("dotenv").config({ path: __dirname + "/.env" });

// ============================================================
//  MARKET → PRICE SOURCE MAPPING
// ============================================================

const PYTH_MARKETS = [
  {
    marketId: 0,
    symbol: "BTC",
    source: "pyth",
    pythId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  },
  {
    marketId: 1,
    symbol: "ETH",
    source: "pyth",
    pythId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  },
  {
    marketId: 2,
    symbol: "SOL",
    source: "pyth",
    pythId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  },
  {
    marketId: 3,
    symbol: "AVAX",
    source: "pyth",
    pythId: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  },
  {
    marketId: 4,
    symbol: "LINK",
    source: "pyth",
    pythId: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  },
];

const ORDERLY_MARKETS = [
  { marketId: 5, symbol: "TSLA", source: "orderly", orderlySymbol: "PERP_TSLA_USDC" },
  { marketId: 6, symbol: "NVDA", source: "orderly", orderlySymbol: "PERP_NVDA_USDC" },
  { marketId: 7, symbol: "NAS100", source: "orderly", orderlySymbol: "PERP_NAS100_USDC" },
  { marketId: 8, symbol: "XAU", source: "orderly", orderlySymbol: "PERP_XAU_USDC" },
  { marketId: 9, symbol: "SPX500", source: "orderly", orderlySymbol: "PERP_SPX500_USDC" },
  { marketId: 10, symbol: "GOOGL", source: "orderly", orderlySymbol: "PERP_GOOGL_USDC" },
];

const MARKETS = [...PYTH_MARKETS, ...ORDERLY_MARKETS];

// ============================================================
//  ENGINE CONFIGURATION
// ============================================================

const CONFIG = {
  // Price sources
  pythHermesUrl: process.env.PYTH_HERMES_URL || "https://hermes.pyth.network",
  orderlyBaseUrl: process.env.ORDERLY_BASE_URL || "https://api-evm.orderly.org",

  // Paxeer Network
  rpcUrl: process.env.RPC_URL || "https://public-rpc.paxeer.app/rpc",
  diamondAddress: process.env.DIAMOND_ADDRESS || "0xeA65FE02665852c615774A3041DFE6f00fb77537",
  privateKey: process.env.ORACLE_PRIVATE_KEY,

  // Indexer GraphQL
  indexerUrl: process.env.INDEXER_GRAPHQL_URL || "http://localhost:4000/graphql",

  // Cycle timing
  cycleIntervalMs: Number(process.env.CYCLE_INTERVAL_MS) || 10000,
  cycleTimeoutMs: Number(process.env.CYCLE_TIMEOUT_MS) || 30000,

  // Cache refresh intervals (ms)
  orderRefreshMs: Number(process.env.ORDER_REFRESH_MS) || 30000,
  positionRefreshMs: Number(process.env.POSITION_REFRESH_MS) || 30000,
  marketConfigRefreshMs: Number(process.env.MARKET_CONFIG_REFRESH_MS) || 1800000,

  // Price deviation threshold (%) — for logging, not for skipping submission
  deviationThresholdPct: Number(process.env.DEVIATION_THRESHOLD_PCT) || 0.5,

  // Gas
  gasLimit: Number(process.env.GAS_LIMIT) || 2000000,
  maxFeePerGas: process.env.MAX_FEE_PER_GAS || undefined,

  // Retry
  maxRetries: 3,
  retryDelayMs: 2000,

  // Health
  maxConsecutiveFailures: Number(process.env.MAX_CONSECUTIVE_FAILURES) || 10,
  minWalletBalancePax: Number(process.env.MIN_WALLET_BALANCE_PAX) || 0.1,

  // Alerting
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || null,
  alertTelegramBotToken: process.env.ALERT_TELEGRAM_BOT_TOKEN || null,
  alertTelegramChatId: process.env.ALERT_TELEGRAM_CHAT_ID || null,

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",
};

// ============================================================
//  ABI — KeeperMulticallFacet + read helpers
// ============================================================

const KEEPER_MULTICALL_ABI = [
  // KeeperMulticallFacet
  "function executeCycle(uint256[] calldata _marketIds, uint256[] calldata _prices, uint256[] calldata _orderIds, uint256[] calldata _liquidationIds) external",
  "function executePriceCycle(uint256[] calldata _marketIds, uint256[] calldata _prices) external",
  "event KeeperCycleExecuted(uint256 timestamp, uint256 marketsUpdated, uint256 ordersExecuted, uint256 liquidationsExecuted, uint256 ordersFailed, uint256 liquidationsFailed)",
  "event OrderExecutionFailed(uint256 indexed orderId, string reason)",
  "event LiquidationFailed(uint256 indexed positionId, string reason)",
];

const READ_ABI = [
  // OracleFacet
  "function getLatestPrice(uint256 _marketId) external view returns (uint256)",
  "function isPriceStale(uint256 _marketId) external view returns (bool)",

  // OrderBookFacet
  "function getOrder(uint256 _orderId) external view returns (address user, uint256 marketId, bool isLong, uint8 orderType, uint256 triggerPrice, uint256 limitPrice, uint256 sizeUsd, uint256 leverage, address collateralToken, uint256 collateralAmount, bool active)",

  // PositionFacet
  "function getPosition(uint256 _positionId) external view returns (address user, uint256 marketId, bool isLong, uint256 sizeUsd, uint256 collateralUsd, address collateralToken, uint256 collateralAmount, uint256 entryPrice, int256 lastFundingIndex, uint256 timestamp, bool active)",

  // LiquidationFacet
  "function checkLiquidatable(uint256 _positionId) external view returns (bool liquidatable, uint256 marginBps)",

  // MarketRegistryFacet
  "function getMarket(uint256 _marketId) external view returns (string name, string symbol, uint256 maxLeverage, uint256 maintenanceMarginBps, bool enabled)",
  "function getRobustnessParams() external view returns (uint256 maxPriceDeviationBps, uint256 minPositionSizeUsd, uint256 minOrderSizeUsd, uint256 maxFundingRatePerSecond)",

  // FundingRateFacet
  "function getFundingState(uint256 _marketId) external view returns (int256 cumulativeFundingPerUnitLong, int256 cumulativeFundingPerUnitShort, uint256 lastUpdateTimestamp, int256 currentFundingRatePerSecond)",

  // AccessControlFacet
  "function hasRole(bytes32 _role, address _account) external view returns (bool)",

  // VirtualAMMFacet
  "function getPool(uint256 _marketId) external view returns (uint256 baseReserve, uint256 quoteReserve, uint256 lastSyncTimestamp, uint256 dampingFactor)",

  // Events needed for on-chain fallback scanning in state-cache
  "event OrderPlaced(uint256 indexed orderId, address indexed user, uint256 indexed marketId, uint8 orderType, bool isLong, uint256 triggerPrice, uint256 sizeUsd)",
  "event OrderExecuted(uint256 indexed orderId, uint256 indexed positionId, uint256 executionPrice)",
  "event OrderCancelled(uint256 indexed orderId, address indexed user)",
  "event PositionOpened(uint256 indexed positionId, address indexed user, uint256 indexed marketId, bool isLong, uint256 sizeUsd, uint256 leverage, uint256 entryPrice, address collateralToken, uint256 collateralAmount)",
  "event PositionClosed(uint256 indexed positionId, address indexed user, uint256 indexed marketId, uint256 closeSizeUsd, uint256 exitPrice, int256 realizedPnl, bool isFullClose)",
];

const COMBINED_ABI = [...KEEPER_MULTICALL_ABI, ...READ_ABI];

// ============================================================
//  ORDER TYPE CONSTANTS
// ============================================================

const ORDER_TYPE = {
  LIMIT: 0,
  STOP_LIMIT: 1,
  TAKE_PROFIT: 2,
  STOP_LOSS: 3,
};

module.exports = {
  MARKETS,
  PYTH_MARKETS,
  ORDERLY_MARKETS,
  CONFIG,
  KEEPER_MULTICALL_ABI,
  READ_ABI,
  COMBINED_ABI,
  ORDER_TYPE,
};
