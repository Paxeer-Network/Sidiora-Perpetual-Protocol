// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title ISpotEvents - All spot trading event definitions
/// @dev Events emit from the Diamond address. Indexer watches one contract.
///      Separated from LibEvents to keep perps/spot event namespaces clean.
interface ISpotEvents {
    // ============================================================
    //                    SPOT ORDER EVENTS
    // ============================================================

    event SpotOrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        bytes32 indexed marketId,
        uint8   side,
        uint8   orderType,
        int16   offsetBps,
        uint128 size
    );

    event SpotOrderFilled(
        uint256 indexed orderId,
        address indexed trader,
        bytes32 indexed marketId,
        uint128 fillSize,
        int256  fillPrice,
        uint256 fillScore
    );

    event SpotOrderCancelled(
        uint256 indexed orderId,
        address indexed trader
    );

    // ============================================================
    //                  BATCH AUCTION EVENTS
    // ============================================================

    event BatchCleared(
        bytes32 indexed marketId,
        int16   clearingOffsetBps,
        int256  clearingPrice,
        uint256 matchedVolume,
        uint256 numBuysFilled,
        uint256 numSellsFilled
    );

    // ============================================================
    //                  SETTLEMENT EVENTS
    // ============================================================

    event EpochSettled(
        uint256 indexed epochNumber,
        uint256 usersProcessed,
        uint256 blockNumber
    );

    event FastSettled(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 fee
    );

    event SpotCollateralDeposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    event SpotCollateralWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    // ============================================================
    //                  MARKET EVENTS
    // ============================================================

    event SpotMarketCreated(
        bytes32 indexed marketId,
        address indexed baseToken,
        address indexed quoteToken,
        uint8   mode
    );

    event MarketModeChanged(
        bytes32 indexed marketId,
        uint8   oldMode,
        uint8   newMode,
        uint256 batchModeUntilBlock
    );

    // ============================================================
    //                  REPUTATION EVENTS
    // ============================================================

    event PoFQUpdated(
        address indexed entity,
        uint256 newScore,
        uint256 newWeight,
        bool    isVault
    );

    // ============================================================
    //                  PLV REGISTRY EVENTS
    // ============================================================

    event PLVRegistered(address indexed vault);
    event PLVDeregistered(address indexed vault);
}
