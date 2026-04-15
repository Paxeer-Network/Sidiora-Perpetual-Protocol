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
import {ITradingAccount} from "../../interfaces/ITradingAccount.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

/// @title OrderBookFacet - On-chain limit and stop-limit order storage
/// @dev Orders are stored on-chain with trigger conditions.
///      Off-chain keepers monitor prices and call executeOrder() when triggers hit.
///      Collateral stays in UserVault until execution.
contract OrderBookFacet {
    uint8 constant ORDER_TYPE_LIMIT = 0;
    uint8 constant ORDER_TYPE_STOP_LIMIT = 1;
    uint8 constant ORDER_TYPE_TAKE_PROFIT = 2;
    uint8 constant ORDER_TYPE_STOP_LOSS = 3;

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

    /// @notice Place a take-profit close order on an existing position
    /// @param _positionId The position to close when trigger hits
    /// @param _triggerPrice Price that activates the TP (18 dec)
    /// @return orderId The ID of the new order
    function placeTakeProfitOrder(
        uint256 _positionId,
        uint256 _triggerPrice
    ) external returns (uint256 orderId) {
        return _placeCloseOrder(_positionId, _triggerPrice, ORDER_TYPE_TAKE_PROFIT);
    }

    /// @notice Place a stop-loss close order on an existing position
    /// @param _positionId The position to close when trigger hits
    /// @param _triggerPrice Price that activates the SL (18 dec)
    /// @return orderId The ID of the new order
    function placeStopLossOrder(
        uint256 _positionId,
        uint256 _triggerPrice
    ) external returns (uint256 orderId) {
        return _placeCloseOrder(_positionId, _triggerPrice, ORDER_TYPE_STOP_LOSS);
    }

    /// @notice Cancel an active order
    /// @param _orderId The order to cancel
    function cancelOrder(uint256 _orderId) external {
        AppStorage storage s = appStorage();
        Order storage order = s.orders[_orderId];
        require(order.active, "OrderBook: order not active");
        require(order.user == msg.sender, "OrderBook: not owner");

        order.active = false;

        // Release reserved collateral back to user vault (only for open orders, not TP/SL)
        if (s.orderCollateralReserved[_orderId] && order.collateralAmount > 0) {
            address vault = s.userVaults[msg.sender];
            if (vault != address(0)) {
                ITradingAccount(vault).releaseReservation(order.collateralToken, order.collateralAmount, _orderId);
            }
            s.orderCollateralReserved[_orderId] = false;
        }

        emit LibEvents.OrderCancelled(_orderId, msg.sender);
    }

    // ============================================================
    //                   KEEPER FUNCTIONS
    // ============================================================

    /// @notice Execute a triggered order (called by keepers)
    /// @dev Validates trigger condition on-chain before executing.
    ///      For LIMIT/STOP_LIMIT orders, opens a new position.
    ///      For TAKE_PROFIT/STOP_LOSS orders, closes the existing position.
    /// @param _orderId The order to execute
    /// @return positionId The ID of the resulting position (0 for close orders)
    function executeOrder(uint256 _orderId) external returns (uint256 positionId) {
        LibAccessControl.enforceRole(LibAccessControl.KEEPER_ROLE);
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        Order storage order = s.orders[_orderId];

        require(order.active, "OrderBook: order not active");
        require(!s.globalPaused, "OrderBook: protocol paused");
        require(!s.marketPaused[order.marketId], "OrderBook: market paused");

        // Order expiry check
        uint256 expiry = s.orderExpiry[_orderId];
        if (expiry > 0) {
            require(block.timestamp <= expiry, "OrderBook: order expired");
        }

        // Price staleness check
        _enforcePriceNotStale(s, order.marketId);

        // Validate trigger condition
        uint256 currentPrice = s.latestPrice[order.marketId];
        require(currentPrice > 0, "OrderBook: no price");
        _validateTriggerCondition(order, currentPrice);

        // Route to close path for TP/SL orders
        if (order.orderType == ORDER_TYPE_TAKE_PROFIT || order.orderType == ORDER_TYPE_STOP_LOSS) {
            _executeCloseOrder(s, order, _orderId, currentPrice);
            order.active = false;
            LibReentrancyGuard.nonReentrantAfter();
            return 0;
        }

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

        // Lock collateral from trading account
        address vault = s.userVaults[order.user];
        require(vault != address(0), "OrderBook: no vault");
        ITradingAccount(vault).lockForPosition(order.collateralToken, order.collateralAmount, positionId, order.marketId, order.isLong, address(this));
        s.vaultBalances[order.collateralToken] += order.collateralAmount;

        // Normalize collateral
        uint256 collateralUsd = _normalizeToUsd(s, order.collateralToken, order.collateralAmount);

        // Fee
        uint256 fee = LibFee.calculateTradingFee(order.sizeUsd, true); // maker fee for limits
        uint256 feeTokens = _usdToTokens(s, order.collateralToken, fee);

        uint256 netCollateral = order.collateralAmount > feeTokens
            ? order.collateralAmount - feeTokens
            : 0;
        uint256 netCollateralUsd = _normalizeToUsd(s, order.collateralToken, netCollateral);

        // Insurance cut
        uint256 insuranceCut = LibFee.calculateInsuranceContribution(feeTokens);
        s.insuranceBalances[order.collateralToken] += insuranceCut;

        // Create position
        positionId = ++s.nextPositionId;

        // Accrue funding
        _accrueFunding(s, order.marketId);
        FundingState storage fs = s.fundingStates[order.marketId];

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

        // Check and update OI
        MarketOI storage oi = s.openInterest[order.marketId];
        {
            uint256 newOI = order.isLong ? oi.longOI + order.sizeUsd : oi.shortOI + order.sizeUsd;
            require(newOI <= market.maxOpenInterest, "OrderBook: exceeds max open interest");
        }
        if (order.isLong) {
            oi.longOI += order.sizeUsd;
        } else {
            oi.shortOI += order.sizeUsd;
        }

        // Update vAMM
        _applyVirtualTrade(s, order.marketId, order.sizeUsd, order.isLong, true);

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

    // ============================================================
    //              INTERNAL: CLOSE ORDER EXECUTION
    // ============================================================

    /// @dev Execute a TP/SL close order — closes the user's existing position
    function _executeCloseOrder(
        AppStorage storage s,
        Order storage order,
        uint256 _orderId,
        uint256 _currentPrice
    ) internal {
        // Find the user's active position in this market
        uint256 posId = s.userMarketPosition[order.user][order.marketId];
        require(posId != 0, "OrderBook: no position to close");

        Position storage pos = s.positions[posId];
        require(pos.active, "OrderBook: position already closed");
        require(pos.isLong == order.isLong, "OrderBook: direction mismatch");

        // Settle funding
        _accrueFunding(s, pos.marketId);
        _settleFundingForPosition(s, pos);

        // Calculate PnL
        int256 pnl = LibPosition.calculatePnl(pos, _currentPrice);

        // Fee on position size
        uint256 fee = LibFee.calculateTradingFee(pos.sizeUsd, false);
        uint256 feeInTokens = _usdToTokens(s, pos.collateralToken, fee);

        // Calculate payout
        uint256 payout = _calculatePayout(pos.collateralAmount, pnl, feeInTokens, pos.collateralToken, s);

        uint256 closedSize = pos.sizeUsd;

        // Update OI
        MarketOI storage oi = s.openInterest[pos.marketId];
        if (pos.isLong) {
            oi.longOI = oi.longOI > closedSize ? oi.longOI - closedSize : 0;
        } else {
            oi.shortOI = oi.shortOI > closedSize ? oi.shortOI - closedSize : 0;
        }

        // Reverse vAMM impact
        _applyVirtualTrade(s, pos.marketId, closedSize, pos.isLong, false);

        // Deactivate position
        pos.active = false;
        s.userMarketPosition[pos.user][pos.marketId] = 0;

        // Transfer payout
        if (payout > 0) {
            _payoutToVault(s, pos.user, pos.collateralToken, payout);
        }

        emit LibEvents.OrderExecuted(_orderId, posId, _currentPrice);
        emit LibEvents.PositionClosed(
            posId, pos.user, pos.marketId,
            closedSize, _currentPrice, pnl, true
        );
    }

    // ============================================================
    //              INTERNAL: ORDER PLACEMENT
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
        if (s.minOrderSizeUsd > 0) {
            require(_sizeUsd >= s.minOrderSizeUsd, "OrderBook: below minimum order size");
        }
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

        // Set order expiry (TTL)
        if (s.defaultOrderTTL > 0) {
            s.orderExpiry[orderId] = block.timestamp + s.defaultOrderTTL;
        }

        // Reserve collateral in user vault so it can't be withdrawn
        address vault = s.userVaults[msg.sender];
        ITradingAccount(vault).reserveForOrder(_collateralToken, _collateralAmount, orderId);
        s.orderCollateralReserved[orderId] = true;

        emit LibEvents.OrderPlaced(orderId, msg.sender, _marketId, _orderType, _isLong, _triggerPrice, _sizeUsd);
    }

    function _placeCloseOrder(
        uint256 _positionId,
        uint256 _triggerPrice,
        uint8 _orderType
    ) internal returns (uint256 orderId) {
        AppStorage storage s = appStorage();
        require(!s.globalPaused, "OrderBook: protocol paused");
        require(_triggerPrice > 0, "OrderBook: zero trigger price");

        Position storage pos = s.positions[_positionId];
        require(pos.active, "OrderBook: position not active");
        require(pos.user == msg.sender, "OrderBook: not position owner");

        orderId = ++s.nextOrderId;
        s.orders[orderId] = Order({
            user: msg.sender,
            marketId: pos.marketId,
            isLong: pos.isLong,
            orderType: _orderType,
            triggerPrice: _triggerPrice,
            limitPrice: _triggerPrice,
            sizeUsd: pos.sizeUsd,
            leverage: 0,
            collateralToken: pos.collateralToken,
            collateralAmount: 0,
            active: true
        });
        s.userOrderIds[msg.sender].push(orderId);

        // Set order expiry (TTL)
        if (s.defaultOrderTTL > 0) {
            s.orderExpiry[orderId] = block.timestamp + s.defaultOrderTTL;
        }

        emit LibEvents.OrderPlaced(orderId, msg.sender, pos.marketId, _orderType, pos.isLong, _triggerPrice, pos.sizeUsd);
    }

    // ============================================================
    //              INTERNAL: SHARED HELPERS
    // ============================================================

    function _normalizeToUsd(AppStorage storage s, address _token, uint256 _amount) internal view returns (uint256) {
        uint8 decimals = s.collateralDecimals[_token];
        if (decimals < 18) {
            return _amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            return _amount / (10 ** (decimals - 18));
        }
        return _amount;
    }

    function _usdToTokens(AppStorage storage s, address _token, uint256 _usdAmount) internal view returns (uint256) {
        uint8 decimals = s.collateralDecimals[_token];
        if (decimals < 18) {
            return _usdAmount / (10 ** (18 - decimals));
        } else if (decimals > 18) {
            return _usdAmount * (10 ** (decimals - 18));
        }
        return _usdAmount;
    }

    function _enforcePriceNotStale(AppStorage storage s, uint256 _marketId) internal view {
        uint256 maxStale = s.maxPriceStaleness;
        if (maxStale == 0) maxStale = 120;
        require(
            block.timestamp <= s.latestPriceTimestamp[_marketId] + maxStale,
            "OrderBook: price is stale"
        );
    }

    function _accrueFunding(AppStorage storage s, uint256 _marketId) internal {
        FundingState storage fs = s.fundingStates[_marketId];
        if (fs.lastUpdateTimestamp == 0) {
            fs.lastUpdateTimestamp = block.timestamp;
            return;
        }
        uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
        if (elapsed == 0) return;

        int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
        fs.cumulativeFundingPerUnitLong += accrued;
        fs.cumulativeFundingPerUnitShort -= accrued;
        fs.lastUpdateTimestamp = block.timestamp;
    }

    function _settleFundingForPosition(AppStorage storage s, Position storage pos) internal {
        FundingState storage fs = s.fundingStates[pos.marketId];

        int256 currentIndex = pos.isLong
            ? fs.cumulativeFundingPerUnitLong
            : fs.cumulativeFundingPerUnitShort;

        int256 fundingDelta = currentIndex - pos.lastFundingIndex;
        int256 fundingPayment = LibMath.mulFpSigned(int256(pos.sizeUsd), fundingDelta);

        if (fundingPayment > 0) {
            uint256 owed = uint256(fundingPayment);
            uint256 owedTokens = _usdToTokens(s, pos.collateralToken, owed);
            if (owedTokens >= pos.collateralAmount) {
                pos.collateralAmount = 0;
                pos.collateralUsd = 0;
            } else {
                pos.collateralAmount -= owedTokens;
                pos.collateralUsd = pos.collateralUsd > owed ? pos.collateralUsd - owed : 0;
            }
        } else if (fundingPayment < 0) {
            uint256 received = uint256(-fundingPayment);
            uint256 receivedTokens = _usdToTokens(s, pos.collateralToken, received);
            pos.collateralAmount += receivedTokens;
            pos.collateralUsd += received;
        }

        pos.lastFundingIndex = currentIndex;
    }

    function _applyVirtualTrade(
        AppStorage storage s,
        uint256 _marketId,
        uint256 _sizeUsd,
        bool _isLong,
        bool _isOpen
    ) internal {
        VirtualPool storage pool = s.virtualPools[_marketId];
        if (pool.baseReserve == 0) return;

        uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);
        bool addQuote = (_isLong && _isOpen) || (!_isLong && !_isOpen);

        if (addQuote) {
            pool.quoteReserve += _sizeUsd;
        } else {
            pool.quoteReserve = pool.quoteReserve > _sizeUsd ? pool.quoteReserve - _sizeUsd : 1;
        }

        if (pool.quoteReserve > 0) {
            pool.baseReserve = LibMath.divFp(k, pool.quoteReserve);
        }
    }

    function _calculatePayout(
        uint256 _collateralAmount,
        int256 _pnl,
        uint256 _feeInTokens,
        address _token,
        AppStorage storage s
    ) internal returns (uint256 payout) {
        uint256 pnlTokens;
        if (_pnl > 0) {
            pnlTokens = _usdToTokens(s, _token, uint256(_pnl));
            payout = _collateralAmount + pnlTokens;
        } else if (_pnl < 0) {
            pnlTokens = _usdToTokens(s, _token, uint256(-_pnl));
            payout = _collateralAmount > pnlTokens ? _collateralAmount - pnlTokens : 0;
        } else {
            payout = _collateralAmount;
        }

        payout = payout > _feeInTokens ? payout - _feeInTokens : 0;

        uint256 insuranceCut = LibFee.calculateInsuranceContribution(_feeInTokens);
        s.insuranceBalances[_token] += insuranceCut;
    }

    function _payoutToVault(
        AppStorage storage s,
        address _user,
        address _token,
        uint256 _amount
    ) internal {
        address vault = s.userVaults[_user];
        require(vault != address(0), "OrderBook: no vault");

        // Central vault solvency check
        uint256 actualBalance = IERC20(_token).balanceOf(address(this));
        uint256 payout = _amount;
        if (payout > actualBalance) {
            payout = actualBalance;
            emit LibEvents.VaultDeficit(_token, _amount - payout);
        }

        if (payout == 0) return;

        s.vaultBalances[_token] = s.vaultBalances[_token] > payout
            ? s.vaultBalances[_token] - payout
            : 0;

        LibSafeERC20.safeTransfer(_token, vault, payout);
        ITradingAccount(vault).unlockFromPosition(_token, payout, 0);
    }

    // ============================================================
    //              INTERNAL: TRIGGER VALIDATION
    // ============================================================

    function _validateTriggerCondition(Order storage _order, uint256 _currentPrice) internal view {
        if (_order.orderType == ORDER_TYPE_LIMIT) {
            if (_order.isLong) {
                require(_currentPrice <= _order.triggerPrice, "OrderBook: limit long not triggered");
            } else {
                require(_currentPrice >= _order.triggerPrice, "OrderBook: limit short not triggered");
            }
        } else if (_order.orderType == ORDER_TYPE_STOP_LIMIT) {
            if (_order.isLong) {
                require(_currentPrice >= _order.triggerPrice, "OrderBook: stop long not triggered");
            } else {
                require(_currentPrice <= _order.triggerPrice, "OrderBook: stop short not triggered");
            }
        } else if (_order.orderType == ORDER_TYPE_TAKE_PROFIT) {
            // TP on long: close when price >= trigger (take profit at high)
            // TP on short: close when price <= trigger (take profit at low)
            if (_order.isLong) {
                require(_currentPrice >= _order.triggerPrice, "OrderBook: TP long not triggered");
            } else {
                require(_currentPrice <= _order.triggerPrice, "OrderBook: TP short not triggered");
            }
        } else if (_order.orderType == ORDER_TYPE_STOP_LOSS) {
            // SL on long: close when price <= trigger (stop loss on drop)
            // SL on short: close when price >= trigger (stop loss on rise)
            if (_order.isLong) {
                require(_currentPrice <= _order.triggerPrice, "OrderBook: SL long not triggered");
            } else {
                require(_currentPrice >= _order.triggerPrice, "OrderBook: SL short not triggered");
            }
        }
    }
}
