// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title LibEvents - Centralized event definitions and emit helpers
/// @dev All events emit from the Diamond address. Off-chain indexer watches one contract.
library LibEvents {
    // ============================================================
    //                    VAULT EVENTS
    // ============================================================

    event VaultCreated(address indexed user, address indexed vault);
    event CollateralDeposited(address indexed user, address indexed token, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount);

    // ============================================================
    //                   POSITION EVENTS
    // ============================================================

    event PositionOpened(
        uint256 indexed positionId,
        address indexed user,
        uint256 indexed marketId,
        bool isLong,
        uint256 sizeUsd,
        uint256 leverage,
        uint256 entryPrice,
        address collateralToken,
        uint256 collateralAmount
    );

    event PositionModified(
        uint256 indexed positionId,
        uint256 newSizeUsd,
        uint256 newCollateralUsd,
        uint256 newCollateralAmount
    );

    event PositionClosed(
        uint256 indexed positionId,
        address indexed user,
        uint256 indexed marketId,
        uint256 closedSizeUsd,
        uint256 exitPrice,
        int256 realizedPnl,
        bool isFullClose
    );

    // ============================================================
    //                    ORDER EVENTS
    // ============================================================

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed user,
        uint256 indexed marketId,
        uint8 orderType,
        bool isLong,
        uint256 triggerPrice,
        uint256 sizeUsd
    );

    event OrderExecuted(
        uint256 indexed orderId,
        uint256 indexed positionId,
        uint256 executionPrice
    );

    event OrderCancelled(uint256 indexed orderId, address indexed user);

    // ============================================================
    //                  LIQUIDATION EVENTS
    // ============================================================

    event Liquidation(
        uint256 indexed positionId,
        address indexed user,
        uint256 indexed marketId,
        uint256 liquidationPrice,
        uint256 penalty,
        address keeper
    );

    event ADLExecuted(
        uint256 indexed positionId,
        uint256 deleveragedSizeUsd
    );

    // ============================================================
    //                   FUNDING EVENTS
    // ============================================================

    event FundingSettled(
        uint256 indexed marketId,
        int256 fundingRate,
        int256 longPayment,
        int256 shortPayment
    );

    // ============================================================
    //                    PRICE EVENTS
    // ============================================================

    event PriceUpdated(uint256 indexed marketId, uint256 price, uint256 timestamp);

    // ============================================================
    //                    MARKET EVENTS
    // ============================================================

    event MarketCreated(uint256 indexed marketId, string name, string symbol);
    event MarketPausedEvent(uint256 indexed marketId);
}
