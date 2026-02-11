// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, Order, Position, Market, FundingState, VirtualPool, MarketOI, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";
import {LibPosition} from "../../libraries/LibPosition.sol";
import {LibFee} from "../../libraries/LibFee.sol";
import {LibMath} from "../../libraries/LibMath.sol";
import {LibEvents} from "../../libraries/LibEvents.sol";
import {IUserVault} from "../../interfaces/IUserVault.sol";

/// @title OrderBookFacet - On-chain limit and stop-limit order storage
/// @dev Orders are stored on-chain with trigger conditions.
///      Off-chain keepers monitor prices and call executeOrder() when triggers hit.
///      Collateral stays in UserVault until execution.
contract OrderBookFacet {
    uint8 constant ORDER_TYPE_LIMIT = 0;
    uint8 constant ORDER_TYPE_STOP_LIMIT = 1;

    // ============================================================
    //                    USER FUNCTIONS
    // ============================================================

    /// @notice Place a limit order
    /// @param _marketId The market to trade
    /// @param _isLong True for long, false for short
    /// @param _triggerPrice Price that activates the order (18 dec)
    /// @param _sizeUsd Notional size in USD (18 dec)
    /// @param _leverage Desired leverage (18 dec)
    /// @param _collateralToken Stablecoin for collateral
    /// @param _collateralAmount Raw collateral amount
    /// @return orderId The ID of the new order
    function placeLimitOrder(
        uint256 _marketId,
        bool _isLong,
        uint256 _triggerPrice,
        uint256 _sizeUsd,
        uint256 _leverage,
        address _collateralToken,
        uint256 _collateralAmount
    ) external returns (uint256 orderId) {
        return _placeOrder(
            _marketId, _isLong, ORDER_TYPE_LIMIT,
            _triggerPrice, _triggerPrice, // limitPrice = triggerPrice for limit orders
            _sizeUsd, _leverage, _collateralToken, _collateralAmount
        );
    }

    /// @notice Place a stop-limit order
    /// @param _marketId The market to trade
    /// @param _isLong True for long, false for short
    /// @param _triggerPrice Price that activates the order (18 dec)
    /// @param _limitPrice Maximum/minimum execution price (18 dec)
    /// @param _sizeUsd Notional size in USD (18 dec)
    /// @param _leverage Desired leverage (18 dec)
    /// @param _collateralToken Stablecoin for collateral
    /// @param _collateralAmount Raw collateral amount
    /// @return orderId The ID of the new order
    function placeStopLimitOrder(
        uint256 _marketId,
        bool _isLong,
        uint256 _triggerPrice,
        uint256 _limitPrice,
        uint256 _sizeUsd,
        uint256 _leverage,
        address _collateralToken,
        uint256 _collateralAmount
    ) external returns (uint256 orderId) {
        return _placeOrder(
            _marketId, _isLong, ORDER_TYPE_STOP_LIMIT,
            _triggerPrice, _limitPrice,
            _sizeUsd, _leverage, _collateralToken, _collateralAmount
        );
    }

    /// @notice Cancel an active order
    /// @param _orderId The order to cancel
    function cancelOrder(uint256 _orderId) external {
        AppStorage storage s = appStorage();
        Order storage order = s.orders[_orderId];
        require(order.active, "OrderBook: order not active");
        require(order.user == msg.sender, "OrderBook: not owner");

        order.active = false;

        emit LibEvents.OrderCancelled(_orderId, msg.sender);
    }

    // ============================================================
    //                   KEEPER FUNCTIONS
    // ============================================================

    /// @notice Execute a triggered order (called by keepers)
    /// @dev Validates trigger condition on-chain before executing.
    /// @param _orderId The order to execute
    /// @return positionId The ID of the resulting position
    function executeOrder(uint256 _orderId) external returns (uint256 positionId) {
        LibAccessControl.enforceRole(LibAccessControl.KEEPER_ROLE);
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        Order storage order = s.orders[_orderId];

        require(order.active, "OrderBook: order not active");
        require(!s.globalPaused, "OrderBook: protocol paused");
        require(!s.marketPaused[order.marketId], "OrderBook: market paused");

        // Validate trigger condition
        uint256 currentPrice = s.latestPrice[order.marketId];
        require(currentPrice > 0, "OrderBook: no price");
        _validateTriggerCondition(order, currentPrice);

        // Validate limit price for stop-limit orders
        if (order.orderType == ORDER_TYPE_STOP_LIMIT) {
            if (order.isLong) {
                require(currentPrice <= order.limitPrice, "OrderBook: price above limit");
            } else {
                require(currentPrice >= order.limitPrice, "OrderBook: price below limit");
            }
        }

        // Net mode check
        uint256 existingPosId = s.userMarketPosition[order.user][order.marketId];
        if (existingPosId != 0) {
            Position storage existingPos = s.positions[existingPosId];
            require(!existingPos.active, "OrderBook: user has active position in this market");
        }

        Market storage market = s.markets[order.marketId];
        require(market.enabled, "OrderBook: market not enabled");

        // Lock collateral from user vault
        address vault = s.userVaults[order.user];
        require(vault != address(0), "OrderBook: no vault");
        IUserVault(vault).lockCollateral(order.collateralToken, order.collateralAmount, address(this));
        s.vaultBalances[order.collateralToken] += order.collateralAmount;

        // Normalize collateral
        uint8 decimals = s.collateralDecimals[order.collateralToken];
        uint256 collateralUsd;
        if (decimals < 18) {
            collateralUsd = order.collateralAmount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            collateralUsd = order.collateralAmount / (10 ** (decimals - 18));
        } else {
            collateralUsd = order.collateralAmount;
        }

        // Fee
        uint256 fee = LibFee.calculateTradingFee(order.sizeUsd, true); // maker fee for limits
        uint256 feeTokens;
        if (decimals < 18) {
            feeTokens = fee / (10 ** (18 - decimals));
        } else if (decimals > 18) {
            feeTokens = fee * (10 ** (decimals - 18));
        } else {
            feeTokens = fee;
        }

        uint256 netCollateral = order.collateralAmount > feeTokens
            ? order.collateralAmount - feeTokens
            : 0;
        uint256 netCollateralUsd;
        if (decimals < 18) {
            netCollateralUsd = netCollateral * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            netCollateralUsd = netCollateral / (10 ** (decimals - 18));
        } else {
            netCollateralUsd = netCollateral;
        }

        // Insurance cut
        uint256 insuranceCut = LibFee.calculateInsuranceContribution(feeTokens);
        s.insuranceBalances[order.collateralToken] += insuranceCut;

        // Create position
        positionId = ++s.nextPositionId;

        // Accrue funding
        FundingState storage fs = s.fundingStates[order.marketId];
        if (fs.lastUpdateTimestamp > 0) {
            uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
            if (elapsed > 0) {
                int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
                fs.cumulativeFundingPerUnitLong += accrued;
                fs.cumulativeFundingPerUnitShort -= accrued;
                fs.lastUpdateTimestamp = block.timestamp;
            }
        } else {
            fs.lastUpdateTimestamp = block.timestamp;
        }

        s.positions[positionId] = Position({
            user: order.user,
            marketId: order.marketId,
            isLong: order.isLong,
            sizeUsd: order.sizeUsd,
            collateralUsd: netCollateralUsd,
            collateralToken: order.collateralToken,
            collateralAmount: netCollateral,
            entryPrice: currentPrice,
            lastFundingIndex: order.isLong ? fs.cumulativeFundingPerUnitLong : fs.cumulativeFundingPerUnitShort,
            timestamp: block.timestamp,
            active: true
        });

        s.userPositionIds[order.user].push(positionId);
        s.userMarketPosition[order.user][order.marketId] = positionId;

        // Update OI
        MarketOI storage oi = s.openInterest[order.marketId];
        if (order.isLong) {
            oi.longOI += order.sizeUsd;
        } else {
            oi.shortOI += order.sizeUsd;
        }

        // Update vAMM
        VirtualPool storage pool = s.virtualPools[order.marketId];
        if (pool.baseReserve > 0) {
            uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);
            bool addQuote = order.isLong;
            if (addQuote) {
                pool.quoteReserve += order.sizeUsd;
            } else {
                pool.quoteReserve = pool.quoteReserve > order.sizeUsd ? pool.quoteReserve - order.sizeUsd : 1;
            }
            if (pool.quoteReserve > 0) {
                pool.baseReserve = LibMath.divFp(k, pool.quoteReserve);
            }
        }

        // Deactivate order
        order.active = false;

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.OrderExecuted(_orderId, positionId, currentPrice);
        emit LibEvents.PositionOpened(
            positionId, order.user, order.marketId, order.isLong,
            order.sizeUsd, order.leverage, currentPrice,
            order.collateralToken, order.collateralAmount
        );
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get order details
    function getOrder(uint256 _orderId) external view returns (
        address user, uint256 marketId, bool isLong, uint8 orderType,
        uint256 triggerPrice, uint256 limitPrice, uint256 sizeUsd,
        uint256 leverage, address collateralToken, uint256 collateralAmount, bool active
    ) {
        Order storage o = appStorage().orders[_orderId];
        return (o.user, o.marketId, o.isLong, o.orderType,
                o.triggerPrice, o.limitPrice, o.sizeUsd,
                o.leverage, o.collateralToken, o.collateralAmount, o.active);
    }

    /// @notice Get all order IDs for a user
    function getUserOrderIds(address _user) external view returns (uint256[] memory) {
        return appStorage().userOrderIds[_user];
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    function _placeOrder(
        uint256 _marketId,
        bool _isLong,
        uint8 _orderType,
        uint256 _triggerPrice,
        uint256 _limitPrice,
        uint256 _sizeUsd,
        uint256 _leverage,
        address _collateralToken,
        uint256 _collateralAmount
    ) internal returns (uint256 orderId) {
        AppStorage storage s = appStorage();

        require(!s.globalPaused, "OrderBook: protocol paused");
        require(s.markets[_marketId].enabled, "OrderBook: market not enabled");
        require(s.acceptedCollateral[_collateralToken], "OrderBook: collateral not accepted");
        require(_triggerPrice > 0, "OrderBook: zero trigger price");
        require(_sizeUsd > 0, "OrderBook: zero size");
        require(_leverage > 0, "OrderBook: zero leverage");
        require(_collateralAmount > 0, "OrderBook: zero collateral");
        require(s.userVaults[msg.sender] != address(0), "OrderBook: create vault first");

        // Validate leverage
        uint8 decimals = s.collateralDecimals[_collateralToken];
        uint256 collateralUsd;
        if (decimals < 18) {
            collateralUsd = _collateralAmount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            collateralUsd = _collateralAmount / (10 ** (decimals - 18));
        } else {
            collateralUsd = _collateralAmount;
        }
        LibPosition.validateLeverage(_sizeUsd, collateralUsd, s.markets[_marketId].maxLeverage);

        orderId = ++s.nextOrderId;

        s.orders[orderId] = Order({
            user: msg.sender,
            marketId: _marketId,
            isLong: _isLong,
            orderType: _orderType,
            triggerPrice: _triggerPrice,
            limitPrice: _limitPrice,
            sizeUsd: _sizeUsd,
            leverage: _leverage,
            collateralToken: _collateralToken,
            collateralAmount: _collateralAmount,
            active: true
        });

        s.userOrderIds[msg.sender].push(orderId);

        emit LibEvents.OrderPlaced(orderId, msg.sender, _marketId, _orderType, _isLong, _triggerPrice, _sizeUsd);
    }

    function _validateTriggerCondition(Order storage _order, uint256 _currentPrice) internal view {
        if (_order.orderType == ORDER_TYPE_LIMIT) {
            // Limit buy (long): trigger when price <= triggerPrice
            // Limit sell (short): trigger when price >= triggerPrice
            if (_order.isLong) {
                require(_currentPrice <= _order.triggerPrice, "OrderBook: limit long not triggered");
            } else {
                require(_currentPrice >= _order.triggerPrice, "OrderBook: limit short not triggered");
            }
        } else if (_order.orderType == ORDER_TYPE_STOP_LIMIT) {
            // Stop-limit buy: trigger when price >= triggerPrice (breakout)
            // Stop-limit sell: trigger when price <= triggerPrice (breakdown)
            if (_order.isLong) {
                require(_currentPrice >= _order.triggerPrice, "OrderBook: stop long not triggered");
            } else {
                require(_currentPrice <= _order.triggerPrice, "OrderBook: stop short not triggered");
            }
        }
    }
}
