/**
 * Combined ABI fragments for ALL events emitted by the PPMM Diamond.
 * The indexer uses these to decode logs from the Diamond address.
 */

const DIAMOND_EVENTS_ABI = [
  // ============================================================
  //  POSITION EVENTS (LibEvents via PositionFacet)
  // ============================================================
  "event PositionOpened(uint256 indexed positionId, address indexed user, uint256 indexed marketId, bool isLong, uint256 sizeUsd, uint256 leverage, uint256 entryPrice, address collateralToken, uint256 collateralAmount)",
  "event PositionModified(uint256 indexed positionId, uint256 newSizeUsd, uint256 newCollateralUsd, uint256 newCollateralAmount)",
  "event PositionClosed(uint256 indexed positionId, address indexed user, uint256 indexed marketId, uint256 closeSizeUsd, uint256 exitPrice, int256 realizedPnl, bool isFullClose)",

  // ============================================================
  //  ORDER EVENTS (LibEvents via OrderBookFacet)
  // ============================================================
  "event OrderPlaced(uint256 indexed orderId, address indexed user, uint256 indexed marketId, uint8 orderType, bool isLong, uint256 triggerPrice, uint256 sizeUsd)",
  "event OrderExecuted(uint256 indexed orderId, uint256 indexed positionId, uint256 executionPrice)",
  "event OrderCancelled(uint256 indexed orderId, address indexed user)",

  // ============================================================
  //  LIQUIDATION EVENTS (LibEvents via LiquidationFacet)
  // ============================================================
  "event Liquidation(uint256 indexed positionId, address indexed user, uint256 indexed marketId, uint256 price, uint256 penalty, address keeper)",
  "event ADLExecuted(uint256 indexed positionId, uint256 deleveragedSizeUsd)",

  // ============================================================
  //  FUNDING EVENTS
  // ============================================================
  "event FundingSettled(uint256 indexed marketId, int256 fundingRate, int256 longPayment, int256 shortPayment)",
  "event FundingRateUpdated(uint256 indexed marketId, int256 newRatePerSecond, int256 fundingRate24h)",

  // ============================================================
  //  ORACLE / PRICE EVENTS
  // ============================================================
  "event PricesUpdated(uint256[] marketIds, uint256[] prices, uint256 timestamp)",
  "event PricePosterAdded(address indexed poster)",
  "event PricePosterRemoved(address indexed poster)",
  "event MaxPriceStalenessUpdated(uint256 oldValue, uint256 newValue)",

  // ============================================================
  //  MARKET EVENTS
  // ============================================================
  "event MarketCreated(uint256 indexed marketId, string name, string symbol, uint256 maxLeverage)",
  "event MarketUpdated(uint256 indexed marketId)",
  "event MarketEnabled(uint256 indexed marketId)",
  "event MarketDisabled(uint256 indexed marketId)",
  "event FeesUpdated(uint256 takerFeeBps, uint256 makerFeeBps, uint256 liquidationFeeBps, uint256 insuranceFeeBps)",

  // ============================================================
  //  VAULT EVENTS
  // ============================================================
  "event VaultCreated(address indexed user, address indexed vault)",
  "event VaultImplementationUpdated(address indexed oldImpl, address indexed newImpl)",
  "event CollateralDeposited(address indexed user, address indexed token, uint256 amount)",
  "event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount)",
  "event VaultFunded(address indexed token, uint256 amount, address indexed funder)",
  "event VaultDefunded(address indexed token, uint256 amount, address indexed to)",

  // ============================================================
  //  COLLATERAL EVENTS
  // ============================================================
  "event CollateralAdded(address indexed token, uint8 decimals)",
  "event CollateralRemoved(address indexed token)",

  // ============================================================
  //  VAMM EVENTS
  // ============================================================
  "event PoolInitialized(uint256 indexed marketId, uint256 baseReserve, uint256 quoteReserve)",
  "event PoolSynced(uint256 indexed marketId, uint256 newBase, uint256 newQuote, uint256 oraclePrice)",
  "event PoolReservesUpdated(uint256 indexed marketId, uint256 newBase, uint256 newQuote)",

  // ============================================================
  //  PAUSABLE EVENTS
  // ============================================================
  "event GlobalPaused(address indexed by)",
  "event GlobalUnpaused(address indexed by)",
  "event MarketPaused(uint256 indexed marketId, address indexed by)",
  "event MarketUnpaused(uint256 indexed marketId, address indexed by)",

  // ============================================================
  //  INSURANCE EVENTS
  // ============================================================
  "event InsuranceWithdrawn(address indexed token, uint256 amount, address indexed to)",
  "event ADLThresholdUpdated(uint256 oldThreshold, uint256 newThreshold)",

  // ============================================================
  //  DIAMOND / OWNERSHIP / ACCESS CONTROL
  // ============================================================
  "event DiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
];

module.exports = { DIAMOND_EVENTS_ABI };
