// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title AppStorage - Shared storage for all Diamond facets
/// @dev All facets read/write this single struct at a fixed diamond storage position.
///      This eliminates storage collision risk across facets.

// ============================================================
//                        SUB-STRUCTS
// ============================================================

struct Market {
    string name;                    // "Bitcoin", "Gold", "S&P 500"
    string symbol;                  // "BTC", "XAU", "SPX"
    uint256 maxLeverage;            // Max leverage in 18 decimals (e.g., 1000e18 = 1000x)
    uint256 maintenanceMarginBps;   // Maintenance margin in basis points (e.g., 50 = 0.5%)
    uint256 maxOpenInterest;        // Max total OI per market (USD, 18 dec)
    bool enabled;
}

struct Position {
    address user;
    uint256 marketId;
    bool isLong;
    uint256 sizeUsd;                // Notional size in USD (18 decimals)
    uint256 collateralUsd;          // Collateral value in USD (18 decimals)
    address collateralToken;        // Which stablecoin was used
    uint256 collateralAmount;       // Raw token amount (token decimals)
    uint256 entryPrice;             // Entry price (18 decimals)
    int256 lastFundingIndex;        // Cumulative funding at last settlement
    uint256 timestamp;              // When position was opened/last modified
    bool active;
}

struct Order {
    address user;
    uint256 marketId;
    bool isLong;
    uint8 orderType;                // 0 = LIMIT, 1 = STOP_LIMIT
    uint256 triggerPrice;           // Price that activates the order (18 dec)
    uint256 limitPrice;             // Max/min execution price for stop-limits (18 dec)
    uint256 sizeUsd;                // Notional size in USD (18 dec)
    uint256 leverage;               // Leverage in 18 decimals
    address collateralToken;
    uint256 collateralAmount;
    bool active;
}

struct VirtualPool {
    uint256 baseReserve;            // Virtual base asset reserve (18 dec)
    uint256 quoteReserve;           // Virtual quote asset reserve (18 dec)
    uint256 lastSyncTimestamp;      // Last time vAMM synced to oracle
    uint256 dampingFactor;          // Convergence speed toward oracle (bps, e.g., 5000 = 50%)
}

struct FundingState {
    int256 cumulativeFundingPerUnitLong;     // Accumulated funding per unit of long OI (18 dec)
    int256 cumulativeFundingPerUnitShort;    // Accumulated funding per unit of short OI (18 dec)
    uint256 lastUpdateTimestamp;             // Last time cumulative values were updated
    int256 currentFundingRatePerSecond;      // Current rate, updated on each oracle sync
}

struct PricePoint {
    uint256 price;                  // Price in USD (18 decimals)
    uint256 timestamp;
}

struct MarketOI {
    uint256 longOI;                 // Total long open interest (USD, 18 dec)
    uint256 shortOI;                // Total short open interest (USD, 18 dec)
}

// ============================================================
//                  SPOT TRADING SUB-STRUCTS (V4)
// ============================================================

struct SpotMarket {
    bytes32 marketId;               // keccak256("ETH/USDC") etc.
    address baseToken;              // e.g., wETH
    address quoteToken;             // e.g., USDC
    uint8   mode;                   // 0 = CONTINUOUS, 1 = BATCH
    bool    active;
    uint128 minOrderSize;           // min order in base asset units (token decimals)
    int16   maxOffsetBps;           // max absolute OROB offset from oracle
    uint16  takerFeeBps;            // taker fee (e.g., 5 = 0.05%)
    int16   makerRebateBps;         // maker rebate (negative = rebate, e.g., -2 = 0.02% rebate)
    uint256 batchModeUntilBlock;    // minimum block to stay in BATCH mode (hysteresis)
}

struct SpotOrder {
    uint256 id;
    address trader;
    bytes32 marketId;
    uint8   side;                   // 0 = BUY, 1 = SELL
    uint8   orderType;              // 0 = MARKET, 1 = LIMIT
    int16   offsetBps;              // OROB offset from oracle price
    uint128 size;                   // base asset units (token decimals)
    uint128 filledSize;             // amount already filled
    uint256 blockSubmitted;
    bool    active;
}

struct BatchQueue {
    int16[]   buyOffsets;
    uint128[] buySizes;
    address[] buyTraders;
    int16[]   sellOffsets;
    uint128[] sellSizes;
    address[] sellTraders;
}

// ============================================================
//                      APP STORAGE
// ============================================================

struct AppStorage {
    // ── Access Control ──
    mapping(bytes32 => mapping(address => bool)) roles;
    mapping(bytes32 => bytes32) roleAdmins;

    // ── Pausable ──
    bool globalPaused;
    mapping(uint256 => bool) marketPaused;

    // ── Reentrancy ──
    uint256 reentrancyStatus;

    // ── Vault Factory ──
    address userVaultImplementation;
    mapping(address => address) userVaults;          // user → vault address
    address[] allVaults;

    // ── Central Vault (Protocol-Funded Only) ──
    mapping(address => uint256) vaultBalances;       // token → balance
    address protocolFunder;                          // network owner address

    // ── Collateral ──
    mapping(address => bool) acceptedCollateral;
    mapping(address => uint8) collateralDecimals;
    address[] collateralTokens;

    // ── Markets ──
    uint256 nextMarketId;
    mapping(uint256 => Market) markets;
    uint256[] activeMarketIds;

    // ── Positions (Net Mode: one direction per market per user) ──
    uint256 nextPositionId;
    mapping(uint256 => Position) positions;
    mapping(address => uint256[]) userPositionIds;
    mapping(address => mapping(uint256 => uint256)) userMarketPosition;  // user → marketId → positionId
    mapping(uint256 => MarketOI) openInterest;

    // ── Orders ──
    uint256 nextOrderId;
    mapping(uint256 => Order) orders;
    mapping(address => uint256[]) userOrderIds;

    // ── Oracle ──
    mapping(uint256 => PricePoint[]) priceHistory;
    mapping(uint256 => uint256) latestPrice;
    mapping(uint256 => uint256) latestPriceTimestamp;
    mapping(address => bool) authorizedPricePosters;
    uint256 maxPriceStaleness;                       // default: 120 seconds

    // ── Virtual AMM ──
    mapping(uint256 => VirtualPool) virtualPools;

    // ── Funding ──
    mapping(uint256 => FundingState) fundingStates;

    // ── Insurance Fund ──
    mapping(address => uint256) insuranceBalances;
    uint256 adlThreshold;

    // ── Fees (basis points) ──
    uint256 makerFeeBps;
    uint256 takerFeeBps;
    uint256 liquidationFeeBps;
    uint256 insuranceFeeBps;

    // ── Robustness Parameters (appended — safe for Diamond upgrade) ──
    uint256 maxPriceDeviationBps;           // Max single-update price move (bps, e.g., 5000 = 50%)
    uint256 minPositionSizeUsd;             // Minimum position notional (18 dec, e.g., 10e18 = $10)
    uint256 minOrderSizeUsd;                // Minimum order notional (18 dec)
    int256 maxFundingRatePerSecond;          // Absolute cap on funding rate per second (18 dec)
    uint256 maxPriceHistoryLength;          // Circular buffer cap per market (e.g., 1000)
    mapping(address => uint256) collateralPriceFeeds; // token → marketId for stablecoin price (0 = assume $1)

    // ── Borrowing Fee (Phase 3) ──
    uint256 borrowingFeeRatePerSecond;             // Per-second borrowing rate (18 dec), e.g., 1e10 ≈ 0.03%/hr
    mapping(uint256 => uint256) lastBorrowingUpdate; // positionId → last borrowing fee timestamp
    mapping(uint256 => uint256) accruedBorrowingFee; // positionId → accrued but unpaid borrowing fee (USD 18 dec)

    // ── Order Enhancements (Phase 3) ──
    uint256 defaultOrderTTL;                       // Default order TTL in seconds (e.g., 604800 = 7 days, 0 = no expiry)
    mapping(uint256 => uint256) orderExpiry;       // orderId → expiry timestamp (0 = no expiry)
    mapping(uint256 => bool) orderCollateralReserved; // orderId → whether collateral is locked in vault

    // ── Mark Price TWAP (Phase 3) ──
    mapping(uint256 => PricePoint[]) markPriceHistory; // marketId → rolling mark price history for TWAP

    // ── Oracle Precompile Integration (Phase 4) ──
    address oraclePrecompile;                      // VOM precompile address (0x903)
    mapping(uint256 => bytes32) marketVomIds;      // marketId → VOM market identifier (bytes32)
    uint256 minOracleQuorum;                       // Minimum validator quorum for VOM prices
    bool usePrecompileOracle;                      // true = read from VOM precompile, false = use legacy push oracle

    // ══════════════════════════════════════════════════════════════
    //                      SPOT TRADING (V4)
    // ══════════════════════════════════════════════════════════════

    // ── Spot Markets ──
    uint256 nextSpotMarketId;
    mapping(bytes32 => SpotMarket) spotMarkets;
    bytes32[] activeSpotMarketIds;

    // ── Spot Order Book (OROB) ──
    uint256 nextSpotOrderId;
    mapping(uint256 => SpotOrder) spotOrders;
    mapping(address => uint256[]) userSpotOrderIds;
    mapping(bytes32 => uint256[]) spotBuyOrderIds;      // marketId → buy order IDs
    mapping(bytes32 => uint256[]) spotSellOrderIds;     // marketId → sell order IDs

    // ── Batch Auction ──
    mapping(bytes32 => BatchQueue) spotBatchQueues;
    mapping(bytes32 => uint256) spotBatchBlock;         // marketId → last cleared block

    // ── Diamond-Owned Spot Vault (real token backing) ──
    mapping(address => uint256) spotVaultBalances;      // token → actual ERC-20 held by diamond for spot
    // INVARIANT: IERC20(t).balanceOf(diamond) >= vaultBalances[t] + spotVaultBalances[t] + insuranceBalances[t]

    // ── Non-Stablecoin Token Whitelist ──
    mapping(address => bool) spotAcceptedTokens;        // wBTC, wETH, wSOL, WPAX, USDC, etc.
    mapping(address => uint8) spotTokenDecimals;
    address[] spotTokenList;

    // ── Virtual Balances & Settlement ──
    mapping(address => mapping(address => int256))  spotVirtualBalances;      // user → token → signed virtual balance
    mapping(address => mapping(address => uint256)) spotDepositedCollateral;  // user → token → deposited raw amount
    mapping(address => mapping(address => int256))  spotEpochNetDelta;        // user → token → epoch net change
    address[] spotEpochDirtyUsers;
    mapping(address => bool) spotIsEpochDirty;
    uint256 spotEpochLength;                            // blocks per epoch (e.g., 5 = ~10s)
    uint256 spotCurrentEpochStart;
    uint256 spotEpochCounter;
    uint256 spotFastSettleFeeBps;                       // default: 1 bps

    // ── PoFQ Reputation ──
    mapping(address => uint256) spotPoFQScores;
    mapping(address => uint256) spotPoFQWeights;
    uint16 spotPoFQDecayBps;                            // decay per update (e.g., 100 = 1%)

    // ── PLV Registry ──
    address[] registeredPLVs;
    mapping(address => bool) isPLVRegistered;
    mapping(address => uint256) plvPoFQScores;
    mapping(address => uint256) plvPoFQWeights;

    // ── Autonomous Mode Switching ──
    mapping(bytes32 => uint256) spotVolatilityRolling;
    mapping(bytes32 => uint256) spotVolumeRolling;
    uint256 spotBatchModeVolThreshold;                  // 3σ volume trigger
    uint256 spotBatchModeConfidenceThreshold;           // min oracle confidence for continuous

    // ── Fee Tiers (Volume Percentile Scale) ──
    mapping(address => uint256) spotTraderVolume30d;    // trader → rolling 30-day volume (USD 18 dec)
    mapping(address => uint8)   spotFeeTier;            // trader → tier (0=standard, 1=P75, 2=P90, 3=P99)
    uint256[4] spotFeeTierRebateBps;                    // tier → rebate bps [0, 1500, 3000, 5000]
    uint256[4] spotFeeTierThresholds;                   // tier → min volume threshold (updated by keeper)

    // ── Anti-Gaming ──
    mapping(address => mapping(bytes32 => int256)) spotNetFlow;  // trader → market → net buy-sell volume
    uint16 spotMinSpreadBps;                                     // min offset magnitude (anti-wash)
}

// ============================================================
//                   STORAGE POSITION
// ============================================================

/// @dev Fixed storage position for AppStorage.
///      keccak256("perpetual.product.market.maker.app.storage") - 1
bytes32 constant APP_STORAGE_POSITION = keccak256("perpetual.product.market.maker.app.storage");

/// @notice Get a reference to the AppStorage struct at the fixed storage position
function appStorage() pure returns (AppStorage storage s) {
    bytes32 position = APP_STORAGE_POSITION;
    assembly {
        s.slot := position
    }
}
