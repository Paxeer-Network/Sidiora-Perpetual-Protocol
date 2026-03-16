// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, PricePoint, Position, Order, Market, MarketOI, VirtualPool, FundingState, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibMath} from "../../libraries/LibMath.sol";
import {LibTWAP} from "../../libraries/LibTWAP.sol";
import {LibPosition} from "../../libraries/LibPosition.sol";
import {LibFee} from "../../libraries/LibFee.sol";
import {LibEvents} from "../../libraries/LibEvents.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";
import {ITradingAccount} from "../../interfaces/ITradingAccount.sol";

/// @title KeeperMulticallFacet - Atomic oracle push + keeper pipeline in one tx
/// @dev Called every ~10 seconds by the oracle/keeper bot.
///      Single tx: push prices → sync vAMMs → update funding rates → execute orders → liquidate.
///      Requires ORACLE_POSTER_ROLE (the bot is both oracle poster and keeper).
///      Partial failures in order execution and liquidation are caught — one revert doesn't block the batch.
contract KeeperMulticallFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event KeeperCycleExecuted(
        uint256 timestamp,
        uint256 marketsUpdated,
        uint256 ordersExecuted,
        uint256 liquidationsExecuted,
        uint256 ordersFailed,
        uint256 liquidationsFailed
    );

    event OrderExecutionFailed(uint256 indexed orderId, string reason);
    event LiquidationFailed(uint256 indexed positionId, string reason);

    // ============================================================
    //                    STRUCTS
    // ============================================================

    struct CycleResult {
        uint256 marketsUpdated;
        uint256 ordersExecuted;
        uint256 liquidationsExecuted;
        uint256 ordersFailed;
        uint256 liquidationsFailed;
    }

    // ============================================================
    //                  MAIN ENTRY POINT
    // ============================================================

    /// @notice Execute a full keeper cycle: prices → sync → funding → orders → liquidations
    /// @dev Atomic — all price updates and syncs succeed or the whole tx reverts.
    ///      Order execution and liquidation failures are caught individually (non-fatal).
    /// @param _marketIds Markets to update prices for
    /// @param _prices New prices (18 dec, USD)
    /// @param _orderIds Orders to attempt execution on
    /// @param _liquidationIds Positions to attempt liquidation on
    function executeCycle(
        uint256[] calldata _marketIds,
        uint256[] calldata _prices,
        uint256[] calldata _orderIds,
        uint256[] calldata _liquidationIds
    ) external {
        LibAccessControl.enforceRole(LibAccessControl.ORACLE_POSTER_ROLE);
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        CycleResult memory result;

        // ── Phase 1: Push prices (must succeed) ──
        result.marketsUpdated = _pushPrices(s, _marketIds, _prices);

        // ── Phase 2: Sync vAMMs to new oracle prices (must succeed) ──
        _syncAllVAMMs(s, _marketIds);

        // ── Phase 3: Update funding rates for all updated markets (must succeed) ──
        _updateAllFundingRates(s, _marketIds);

        // ── Phase 4: Execute triggered orders (soft fail per order) ──
        (result.ordersExecuted, result.ordersFailed) = _executeOrders(s, _orderIds);

        // ── Phase 5: Liquidate undercollateralized positions (soft fail per position) ──
        (result.liquidationsExecuted, result.liquidationsFailed) = _executeLiquidations(s, _liquidationIds);

        LibReentrancyGuard.nonReentrantAfter();

        emit KeeperCycleExecuted(
            block.timestamp,
            result.marketsUpdated,
            result.ordersExecuted,
            result.liquidationsExecuted,
            result.ordersFailed,
            result.liquidationsFailed
        );
    }

    /// @notice Lightweight cycle: push prices + sync + funding only (no order/liq execution)
    /// @dev For cycles where the bot has no pending orders or liquidations to process.
    function executePriceCycle(
        uint256[] calldata _marketIds,
        uint256[] calldata _prices
    ) external {
        LibAccessControl.enforceRole(LibAccessControl.ORACLE_POSTER_ROLE);
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        _pushPrices(s, _marketIds, _prices);
        _syncAllVAMMs(s, _marketIds);
        _updateAllFundingRates(s, _marketIds);

        LibReentrancyGuard.nonReentrantAfter();
    }

    // ============================================================
    //                 PHASE 1: PUSH PRICES
    // ============================================================

    function _pushPrices(
        AppStorage storage s,
        uint256[] calldata _marketIds,
        uint256[] calldata _prices
    ) internal returns (uint256 count) {
        require(_marketIds.length == _prices.length, "KeeperMulticall: length mismatch");
        uint256 ts = block.timestamp;
        uint256 maxDevBps = s.maxPriceDeviationBps;

        for (uint256 i; i < _marketIds.length; ++i) {
            uint256 marketId = _marketIds[i];
            uint256 price = _prices[i];
            require(price > 0, "KeeperMulticall: zero price");

            // Deviation check
            uint256 lastPrice = s.latestPrice[marketId];
            if (lastPrice > 0 && maxDevBps > 0) {
                uint256 delta = price > lastPrice ? price - lastPrice : lastPrice - price;
                uint256 deviationBps = (delta * 10000) / lastPrice;
                require(deviationBps <= maxDevBps, "KeeperMulticall: price deviation");
            }

            s.latestPrice[marketId] = price;
            s.latestPriceTimestamp[marketId] = ts;
            s.priceHistory[marketId].push(PricePoint({price: price, timestamp: ts}));
        }

        count = _marketIds.length;
        emit LibEvents.PriceUpdated(0, 0, ts); // batch signal
    }

    // ============================================================
    //                 PHASE 2: SYNC vAMMs
    // ============================================================

    function _syncAllVAMMs(AppStorage storage s, uint256[] calldata _marketIds) internal {
        for (uint256 i; i < _marketIds.length; ++i) {
            uint256 marketId = _marketIds[i];
            VirtualPool storage pool = s.virtualPools[marketId];
            if (pool.baseReserve == 0) continue;

            uint256 oraclePrice = s.latestPrice[marketId];
            if (oraclePrice == 0) continue;

            uint256 targetQuote = LibMath.mulFp(pool.baseReserve, oraclePrice);
            uint256 damping = pool.dampingFactor;
            uint256 currentQuote = pool.quoteReserve;

            if (targetQuote > currentQuote) {
                uint256 delta = targetQuote - currentQuote;
                pool.quoteReserve = currentQuote + (delta * damping) / 10000;
            } else {
                uint256 delta = currentQuote - targetQuote;
                pool.quoteReserve = currentQuote - (delta * damping) / 10000;
            }
            pool.lastSyncTimestamp = block.timestamp;
        }
    }

    // ============================================================
    //              PHASE 3: UPDATE FUNDING RATES
    // ============================================================

    function _updateAllFundingRates(AppStorage storage s, uint256[] calldata _marketIds) internal {
        uint256 twapWindow = 900; // 15 minutes

        for (uint256 i; i < _marketIds.length; ++i) {
            uint256 marketId = _marketIds[i];
            FundingState storage fs = s.fundingStates[marketId];

            // Accrue pending at old rate
            if (fs.lastUpdateTimestamp > 0) {
                uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
                if (elapsed > 0) {
                    int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
                    fs.cumulativeFundingPerUnitLong += accrued;
                    fs.cumulativeFundingPerUnitShort -= accrued;
                }
            }
            fs.lastUpdateTimestamp = block.timestamp;

            // Compute new rate
            uint256 indexTWAP = LibTWAP.calculateTWAP(s.priceHistory[marketId], twapWindow, block.timestamp);
            if (indexTWAP == 0) continue;

            VirtualPool storage pool = s.virtualPools[marketId];
            uint256 markPrice;
            if (pool.baseReserve > 0) {
                markPrice = LibMath.divFp(pool.quoteReserve, pool.baseReserve);
            } else {
                markPrice = indexTWAP;
            }

            int256 priceDelta = int256(markPrice) - int256(indexTWAP);
            int256 fundingRate24h = LibMath.divFpSigned(priceDelta, int256(indexTWAP));
            int256 ratePerSecond = fundingRate24h / 86400;

            // OI imbalance amplification
            MarketOI storage oi = s.openInterest[marketId];
            uint256 totalOI = oi.longOI + oi.shortOI;
            if (totalOI > 0) {
                int256 imbalance;
                if (oi.longOI > oi.shortOI) {
                    imbalance = int256((oi.longOI - oi.shortOI) * 1e18 / totalOI);
                } else {
                    imbalance = -int256((oi.shortOI - oi.longOI) * 1e18 / totalOI);
                }
                int256 amplifier = int256(1e18) + (imbalance >= 0 ? imbalance : -imbalance);
                ratePerSecond = LibMath.mulFpSigned(ratePerSecond, amplifier);
            }

            // Clamp
            int256 maxRate = s.maxFundingRatePerSecond;
            if (maxRate > 0) {
                if (ratePerSecond > maxRate) ratePerSecond = maxRate;
                if (ratePerSecond < -maxRate) ratePerSecond = -maxRate;
            }

            fs.currentFundingRatePerSecond = ratePerSecond;
        }
    }

    // ============================================================
    //             PHASE 4: EXECUTE ORDERS (SOFT FAIL)
    // ============================================================

    function _executeOrders(
        AppStorage storage s,
        uint256[] calldata _orderIds
    ) internal returns (uint256 executed, uint256 failed) {
        for (uint256 i; i < _orderIds.length; ++i) {
            uint256 orderId = _orderIds[i];
            Order storage order = s.orders[orderId];

            // --- Pre-checks (skip on failure, don't revert batch) ---
            if (!order.active) { ++failed; continue; }
            if (s.globalPaused || s.marketPaused[order.marketId]) { ++failed; continue; }

            uint256 currentPrice = s.latestPrice[order.marketId];
            if (currentPrice == 0) { ++failed; continue; }

            bool triggered = _checkTrigger(order, currentPrice);
            if (!triggered) { continue; } // not triggered yet — not a failure, just skip

            // --- Route by order type ---
            if (order.orderType <= 1) {
                // LIMIT (0) or STOP_LIMIT (1) → open a new position
                bool ok = _executeOpenOrder(s, orderId, order, currentPrice);
                if (ok) { ++executed; } else { ++failed; }
            } else {
                // TAKE_PROFIT (2) or STOP_LOSS (3) → close existing position
                bool ok = _executeCloseOrder(s, orderId, order, currentPrice);
                if (ok) { ++executed; } else { ++failed; }
            }
        }
    }

    /// @dev Execute an open order (LIMIT / STOP_LIMIT) — creates a new position
    function _executeOpenOrder(
        AppStorage storage s,
        uint256 _orderId,
        Order storage order,
        uint256 _currentPrice
    ) internal returns (bool) {
        // Net mode: skip if user already has active position in this market
        uint256 existingPosId = s.userMarketPosition[order.user][order.marketId];
        if (existingPosId != 0 && s.positions[existingPosId].active) return false;

        Market storage market = s.markets[order.marketId];
        if (!market.enabled) return false;

        address vault = s.userVaults[order.user];
        if (vault == address(0)) return false;

        // Assign position ID before locking (needed for TradingAccount tracking)
        uint256 positionId = ++s.nextPositionId;

        // Lock collateral from trading account → central vault
        ITradingAccount(vault).lockForPosition(
            order.collateralToken, order.collateralAmount,
            positionId, order.marketId, order.isLong, address(this)
        );
        s.vaultBalances[order.collateralToken] += order.collateralAmount;

        // Normalize collateral to USD
        uint8 decimals = s.collateralDecimals[order.collateralToken];

        // Fee (maker fee for limit orders)
        uint256 fee = LibFee.calculateTradingFee(order.sizeUsd, true);
        uint256 feeTokens = _usdToTokensD(decimals, fee);

        uint256 netCollateral = order.collateralAmount > feeTokens
            ? order.collateralAmount - feeTokens
            : 0;
        uint256 netCollateralUsd = _normalizeToUsd(decimals, netCollateral);

        // Insurance cut from fee
        uint256 insuranceCut = LibFee.calculateInsuranceContribution(feeTokens);
        s.insuranceBalances[order.collateralToken] += insuranceCut;

        // Funding already accrued in Phase 3, just read current cumulative
        FundingState storage fs = s.fundingStates[order.marketId];

        // Create position
        s.positions[positionId] = Position({
            user: order.user,
            marketId: order.marketId,
            isLong: order.isLong,
            sizeUsd: order.sizeUsd,
            collateralUsd: netCollateralUsd,
            collateralToken: order.collateralToken,
            collateralAmount: netCollateral,
            entryPrice: _currentPrice,
            lastFundingIndex: order.isLong
                ? fs.cumulativeFundingPerUnitLong
                : fs.cumulativeFundingPerUnitShort,
            timestamp: block.timestamp,
            active: true
        });

        s.userPositionIds[order.user].push(positionId);
        s.userMarketPosition[order.user][order.marketId] = positionId;

        // Check and update OI
        MarketOI storage oi = s.openInterest[order.marketId];
        uint256 newOI = order.isLong
            ? oi.longOI + order.sizeUsd
            : oi.shortOI + order.sizeUsd;
        if (newOI > market.maxOpenInterest) return false; // OI cap exceeded — skip

        if (order.isLong) {
            oi.longOI += order.sizeUsd;
        } else {
            oi.shortOI += order.sizeUsd;
        }

        // Update vAMM
        _applyVirtualTrade(s, order.marketId, order.sizeUsd, order.isLong);

        // Deactivate order
        order.active = false;

        emit LibEvents.OrderExecuted(_orderId, positionId, _currentPrice);
        emit LibEvents.PositionOpened(
            positionId, order.user, order.marketId, order.isLong,
            order.sizeUsd, order.leverage, _currentPrice,
            order.collateralToken, order.collateralAmount
        );
        return true;
    }

    /// @dev Execute a close order (TP / SL) — closes the user's existing position
    function _executeCloseOrder(
        AppStorage storage s,
        uint256 _orderId,
        Order storage order,
        uint256 _currentPrice
    ) internal returns (bool) {
        // Find the user's active position in this market
        uint256 posId = s.userMarketPosition[order.user][order.marketId];
        if (posId == 0) return false;

        Position storage pos = s.positions[posId];
        if (!pos.active) return false;

        // Settle funding
        _settleFundingInline(s, pos);

        // Calculate PnL
        int256 pnl = LibPosition.calculatePnl(pos, _currentPrice);

        // Fee on full close
        uint256 fee = LibFee.calculateTradingFee(pos.sizeUsd, false);
        uint8 decimals = s.collateralDecimals[pos.collateralToken];
        uint256 feeTokens = _usdToTokensD(decimals, fee);

        // Calculate payout
        uint256 payout;
        if (pnl > 0) {
            uint256 pnlTokens = _usdToTokensD(decimals, uint256(pnl));
            payout = pos.collateralAmount + pnlTokens;
        } else if (pnl < 0) {
            uint256 lossTokens = _usdToTokensD(decimals, uint256(-pnl));
            payout = pos.collateralAmount > lossTokens ? pos.collateralAmount - lossTokens : 0;
        } else {
            payout = pos.collateralAmount;
        }
        payout = payout > feeTokens ? payout - feeTokens : 0;

        // Insurance cut from fee
        uint256 insuranceCut = LibFee.calculateInsuranceContribution(feeTokens);
        s.insuranceBalances[pos.collateralToken] += insuranceCut;

        uint256 closedSize = pos.sizeUsd;

        // Deactivate position
        pos.active = false;
        s.userMarketPosition[pos.user][pos.marketId] = 0;

        // Update OI
        MarketOI storage oi = s.openInterest[pos.marketId];
        if (pos.isLong) {
            oi.longOI = oi.longOI > closedSize ? oi.longOI - closedSize : 0;
        } else {
            oi.shortOI = oi.shortOI > closedSize ? oi.shortOI - closedSize : 0;
        }

        // Reverse vAMM impact
        _applyVirtualTrade(s, pos.marketId, closedSize, !pos.isLong);

        // Transfer payout to user vault
        if (payout > 0) {
            address vault = s.userVaults[pos.user];
            if (vault != address(0)) {
                s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > payout
                    ? s.vaultBalances[pos.collateralToken] - payout
                    : 0;
                LibSafeERC20.safeTransfer(pos.collateralToken, vault, payout);
                ITradingAccount(vault).unlockFromPosition(pos.collateralToken, payout, posId);
            }
        }

        // Deduct original collateral from vault tracking
        s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > pos.collateralAmount
            ? s.vaultBalances[pos.collateralToken] - pos.collateralAmount
            : 0;

        // Deactivate order
        order.active = false;

        emit LibEvents.OrderExecuted(_orderId, posId, _currentPrice);
        emit LibEvents.PositionClosed(posId, pos.user, pos.marketId, closedSize, _currentPrice, pnl, true);
        return true;
    }

    function _checkTrigger(Order storage _order, uint256 _price) internal view returns (bool) {
        uint8 ot = _order.orderType;
        bool isLong = _order.isLong;
        uint256 trigger = _order.triggerPrice;

        if (ot == 0) { // LIMIT
            return isLong ? _price <= trigger : _price >= trigger;
        } else if (ot == 1) { // STOP_LIMIT
            if (isLong) {
                return _price >= trigger && _price <= _order.limitPrice;
            } else {
                return _price <= trigger && _price >= _order.limitPrice;
            }
        } else if (ot == 2) { // TAKE_PROFIT
            return isLong ? _price >= trigger : _price <= trigger;
        } else if (ot == 3) { // STOP_LOSS
            return isLong ? _price <= trigger : _price >= trigger;
        }
        return false;
    }

    // ============================================================
    //          PHASE 5: LIQUIDATIONS (SOFT FAIL)
    // ============================================================

    function _executeLiquidations(
        AppStorage storage s,
        uint256[] calldata _positionIds
    ) internal returns (uint256 executed, uint256 failed) {
        for (uint256 i; i < _positionIds.length; ++i) {
            uint256 posId = _positionIds[i];
            Position storage pos = s.positions[posId];

            if (!pos.active) { ++failed; continue; }

            uint256 currentPrice = s.latestPrice[pos.marketId];
            if (currentPrice == 0) { ++failed; continue; }

            // Check if liquidatable
            Market storage market = s.markets[pos.marketId];
            uint256 marginBps = LibPosition.calculateMarginRatio(pos, currentPrice);
            if (marginBps >= market.maintenanceMarginBps) { ++failed; continue; }

            // Deactivate position
            pos.active = false;
            s.userMarketPosition[pos.user][pos.marketId] = 0;

            // Update OI
            MarketOI storage oi = s.openInterest[pos.marketId];
            uint256 closedSize = pos.sizeUsd;
            if (pos.isLong) {
                oi.longOI = oi.longOI > closedSize ? oi.longOI - closedSize : 0;
            } else {
                oi.shortOI = oi.shortOI > closedSize ? oi.shortOI - closedSize : 0;
            }

            // Calculate penalty
            int256 pnl = LibPosition.calculatePnl(pos, currentPrice);
            int256 equity = int256(pos.collateralUsd) + pnl;
            uint256 remainingCollateral;
            if (equity > 0) {
                remainingCollateral = _usdToTokens(s, pos.collateralToken, uint256(equity));
            }

            (uint256 penalty, uint256 keeperReward, uint256 insurancePortion) =
                LibFee.calculateLiquidationPenalty(remainingCollateral);

            // Insurance fund
            if (insurancePortion > 0) {
                s.insuranceBalances[pos.collateralToken] += insurancePortion;
            }

            // Keeper reward — send to msg.sender (the multicall bot)
            if (keeperReward > 0 && keeperReward <= remainingCollateral) {
                s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > keeperReward
                    ? s.vaultBalances[pos.collateralToken] - keeperReward
                    : 0;
                LibSafeERC20.safeTransfer(pos.collateralToken, msg.sender, keeperReward);
            }

            // Deduct collateral from vault tracking
            uint256 posCollateral = pos.collateralAmount;
            s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > posCollateral
                ? s.vaultBalances[pos.collateralToken] - posCollateral
                : 0;

            ++executed;

            emit LibEvents.Liquidation(posId, pos.user, pos.marketId, currentPrice, penalty, msg.sender);
        }
    }

    // ============================================================
    //                  INTERNAL HELPERS
    // ============================================================

    function _usdToTokens(AppStorage storage s, address _token, uint256 _usdAmount) internal view returns (uint256) {
        uint8 decimals = s.collateralDecimals[_token];
        if (decimals < 18) return _usdAmount / (10 ** (18 - decimals));
        if (decimals > 18) return _usdAmount * (10 ** (decimals - 18));
        return _usdAmount;
    }

    function _normalizeToUsd(uint8 _decimals, uint256 _amount) internal pure returns (uint256) {
        if (_decimals < 18) return _amount * (10 ** (18 - _decimals));
        if (_decimals > 18) return _amount / (10 ** (_decimals - 18));
        return _amount;
    }

    function _usdToTokensD(uint8 _decimals, uint256 _usdAmount) internal pure returns (uint256) {
        if (_decimals < 18) return _usdAmount / (10 ** (18 - _decimals));
        if (_decimals > 18) return _usdAmount * (10 ** (_decimals - 18));
        return _usdAmount;
    }

    function _applyVirtualTrade(AppStorage storage s, uint256 _marketId, uint256 _sizeUsd, bool _isLong) internal {
        VirtualPool storage pool = s.virtualPools[_marketId];
        if (pool.baseReserve == 0) return;

        uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);

        if (_isLong) {
            pool.quoteReserve += _sizeUsd;
        } else {
            pool.quoteReserve = pool.quoteReserve > _sizeUsd ? pool.quoteReserve - _sizeUsd : 1;
        }

        if (pool.quoteReserve > 0) {
            pool.baseReserve = LibMath.divFp(k, pool.quoteReserve);
        }
    }

    function _settleFundingInline(AppStorage storage s, Position storage pos) internal {
        FundingState storage fs = s.fundingStates[pos.marketId];
        // Funding already accrued in Phase 3, so just compute delta and apply
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
}
