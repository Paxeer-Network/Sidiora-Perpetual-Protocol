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
