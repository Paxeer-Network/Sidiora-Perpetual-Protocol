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
  //  KEEPER MULTICALL EVENTS (KeeperMulticallFacet — V2)
  // ============================================================
  "event KeeperCycleExecuted(uint256 timestamp, uint256 marketsUpdated, uint256 ordersExecuted, uint256 liquidationsExecuted, uint256 ordersFailed, uint256 liquidationsFailed)",
  "event OrderExecutionFailed(uint256 indexed orderId, string reason)",
  "event LiquidationFailed(uint256 indexed positionId, string reason)",

  // ============================================================
  //  TRADING ACCOUNT EVENTS (TradingAccount — V2)
  // ============================================================
  "event MarginLocked(address indexed user, uint256 indexed positionId, address token, uint256 amount)",
  "event MarginReleased(address indexed user, uint256 indexed positionId, address token, uint256 amount)",
  "event LedgerEntryRecorded(uint256 indexed entryId, address indexed user, uint8 entryType, address token, uint256 amount, uint256 positionId, bool isDebit)",
  "event DelegateAdded(address indexed user, address indexed delegate, bool canTrade, bool canWithdraw, bool canModifyMargin, uint256 expiry)",
  "event DelegateRemoved(address indexed user, address indexed delegate)",
  "event MarginModeChanged(address indexed user, uint8 newMode)",
  "event MarginTransferred(address indexed user, uint256 fromPositionId, uint256 toPositionId, address token, uint256 amount)",

  // ============================================================
  //  MARKET REGISTRY EVENTS (V2)
  // ============================================================
  "event RobustnessParamsUpdated(uint256 maxPriceDeviationBps, uint256 minPositionSizeUsd, uint256 minOrderSizeUsd, uint256 maxFundingRatePerSecond)",

  // ============================================================
  //  DIAMOND / OWNERSHIP / ACCESS CONTROL
  // ============================================================
  "event DiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",

  // ============================================================
  //  V5 — LibIndexerEvents (fee, OI, mark price, funding, vault, spot, snapshots)
  // ============================================================
  "event FeeCollected(uint256 indexed positionId, address indexed user, uint256 indexed marketId, uint8 feeType, uint256 feeUsd, uint256 feeTokens, address token)",
  "event InsuranceContribution(address indexed token, uint256 amount, uint8 source)",
  "event PositionFundingApplied(uint256 indexed positionId, address indexed user, uint256 indexed marketId, int256 fundingPaymentUsd, uint256 newCollateralUsd, uint256 newCollateralAmount)",
  "event OpenInterestChanged(uint256 indexed marketId, uint256 longOI, uint256 shortOI, uint256 deltaUsd, bool isIncrease)",
  "event MarkPriceChanged(uint256 indexed marketId, uint256 markPrice, uint256 indexPrice, uint256 baseReserve, uint256 quoteReserve)",
  "event TradeSettled(uint256 indexed positionId, address indexed user, uint256 indexed marketId, uint8 tradeType, uint256 sizeUsd, uint256 executionPrice, int256 grossPnl, uint256 totalFeesUsd, uint256 borrowingFeeUsd, int256 fundingPaidUsd, uint256 netPayoutTokens)",
  "event VaultBalanceChanged(address indexed token, uint8 vaultType, uint256 newBalance, uint256 delta, bool isIncrease)",
  "event CollateralConfigChanged(address indexed token, uint8 decimals, bool accepted, bool isSpot)",
  "event PositionEntryPriceChanged(uint256 indexed positionId, uint256 oldEntryPrice, uint256 newEntryPrice)",
  "event MarketSnapshot(uint256 indexed marketId, uint256 longOI, uint256 shortOI, uint256 markPrice, uint256 indexPrice, int256 fundingRatePerSecond, int256 fundingRate24h, uint256 volume24hUsd, uint256 timestamp)",
  "event ProtocolSnapshot(uint256 totalPositions, uint256 totalOpenPositions, uint256 totalMarkets, uint256 tvlUsd, uint256 insuranceTotalUsd, uint256 timestamp)",
  "event SpotFeeTierUpdated(address indexed trader, uint8 oldTier, uint8 newTier, uint256 volume30d)",
  "event SpotVolumeRecorded(address indexed trader, bytes32 indexed marketId, uint256 volumeUsd, uint256 newCumulative30d)",
  "event SpotVaultBalanceChanged(address indexed token, uint256 newBalance, uint256 delta, bool isIncrease)",
  "event SpotVirtualBalanceChanged(address indexed user, address indexed token, int256 newBalance, int256 delta)",
  "event OrderExpired(uint256 indexed orderId, address indexed user, uint256 indexed marketId)",

  // ============================================================
  //  V4 — ISpotEvents (primary spot trading events)
  // ============================================================
  "event SpotOrderPlaced(uint256 indexed orderId, address indexed trader, bytes32 indexed marketId, uint8 side, uint8 orderType, int16 offsetBps, uint128 size)",
  "event SpotOrderFilled(uint256 indexed orderId, address indexed trader, bytes32 indexed marketId, uint128 fillSize, int256 fillPrice, uint256 fillScore)",
  "event SpotOrderCancelled(uint256 indexed orderId, address indexed trader)",
  "event BatchCleared(bytes32 indexed marketId, int16 clearingOffsetBps, int256 clearingPrice, uint256 matchedVolume, uint256 numBuysFilled, uint256 numSellsFilled)",
  "event EpochSettled(uint256 indexed epochNumber, uint256 usersProcessed, uint256 blockNumber)",
  "event FastSettled(address indexed user, address indexed token, uint256 amount, uint256 fee)",
  "event SpotCollateralDeposited(address indexed user, address indexed token, uint256 amount)",
  "event SpotCollateralWithdrawn(address indexed user, address indexed token, uint256 amount)",
  "event SpotMarketCreated(bytes32 indexed marketId, address indexed baseToken, address indexed quoteToken, uint8 mode)",
  "event MarketModeChanged(bytes32 indexed marketId, uint8 oldMode, uint8 newMode, uint256 batchModeUntilBlock)",
  "event PoFQUpdated(address indexed entity, uint256 newScore, uint256 newWeight, bool isVault)",
  "event PLVRegistered(address indexed vault)",
  "event PLVDeregistered(address indexed vault)",

  // ============================================================
  //  V4 — SpotKeeperMulticallFacet-local events
  // ============================================================
  "event SpotKeeperCycleExecuted(uint256 timestamp, uint256 marketsEvaluated, uint256 batchesCleared, uint256 epochSettled)",
  "event SpotBatchClearFailed(bytes32 indexed marketId, string reason)",
];

module.exports = { DIAMOND_EVENTS_ABI };
