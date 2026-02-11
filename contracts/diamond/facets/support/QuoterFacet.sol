// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, Position, Market, VirtualPool, FundingState, MarketOI, appStorage} from "../../storage/AppStorage.sol";
import {LibPosition} from "../../libraries/LibPosition.sol";
import {LibFee} from "../../libraries/LibFee.sol";
import {LibMath} from "../../libraries/LibMath.sol";
import {LibTWAP} from "../../libraries/LibTWAP.sol";

/// @title QuoterFacet - Trade simulation for frontend display and off-chain queries
/// @dev All functions are view-only. Simulates trades without state changes.
///      Frontend and off-chain servers/subgraph can call these to display quotes.
contract QuoterFacet {
    uint256 constant TWAP_WINDOW = 900; // 15-minute TWAP

    // ============================================================
    //                QUOTE STRUCTS (RETURN TYPES)
    // ============================================================

    struct OpenPositionQuote {
        uint256 entryPrice;
        uint256 sizeUsd;
        uint256 collateralUsd;
        uint256 leverage;
        uint256 tradingFee;
        uint256 tradingFeeUsd;
        uint256 priceImpact;
        uint256 liquidationPrice;
        int256 estimatedFunding24h;
        uint256 maintenanceMarginBps;
    }

    struct ClosePositionQuote {
        uint256 exitPrice;
        int256 unrealizedPnl;
        uint256 tradingFee;
        uint256 tradingFeeUsd;
        int256 fundingOwed;
        int256 netPnl;
        uint256 estimatedPayout;
    }

    struct MarketQuote {
        uint256 indexPrice;
        uint256 markPrice;
        uint256 oracleTWAP;
        int256 fundingRatePerSecond;
        int256 fundingRate24h;
        uint256 longOI;
        uint256 shortOI;
        uint256 maxLeverage;
        uint256 maintenanceMarginBps;
        bool enabled;
        bool priceStale;
    }

    // ============================================================
    //                   QUOTE FUNCTIONS
    // ============================================================

    /// @notice Simulate opening a position — returns execution details for frontend
    /// @param _marketId The market to trade
    /// @param _collateralToken The stablecoin for collateral
    /// @param _collateralAmount Raw collateral amount
    /// @param _leverage Desired leverage (18 dec)
    /// @param _isLong True for long, false for short
    /// @return quote Full quote with entry price, fees, liq price, etc.
    function quoteOpenPosition(
        uint256 _marketId,
        address _collateralToken,
        uint256 _collateralAmount,
        uint256 _leverage,
        bool _isLong
    ) external view returns (OpenPositionQuote memory quote) {
        AppStorage storage s = appStorage();
        Market storage market = s.markets[_marketId];

        // Normalize collateral to USD
        uint8 decimals = s.collateralDecimals[_collateralToken];
        uint256 collateralUsd = _normalizeToUsd(decimals, _collateralAmount);
        uint256 sizeUsd = LibMath.mulFp(collateralUsd, _leverage);

        // Calculate fees
        uint256 tradingFeeUsd = (sizeUsd * s.takerFeeBps) / 10000;
        uint256 tradingFeeTokens = _usdToTokens(decimals, tradingFeeUsd);

        uint256 netCollateralAmount = _collateralAmount > tradingFeeTokens
            ? _collateralAmount - tradingFeeTokens
            : 0;
        uint256 netCollateralUsd = _normalizeToUsd(decimals, netCollateralAmount);

        // Get execution price
        uint256 entryPrice = _simulateExecutionPrice(s, _marketId, sizeUsd, _isLong);

        // Price impact
        uint256 oraclePrice = s.latestPrice[_marketId];
        uint256 priceImpact = entryPrice > oraclePrice
            ? entryPrice - oraclePrice
            : oraclePrice - entryPrice;

        // Liquidation price
        uint256 liqPrice = LibPosition.calculateLiquidationPrice(
            entryPrice, netCollateralUsd, sizeUsd, market.maintenanceMarginBps, _isLong
        );

        // Estimated 24h funding
        FundingState storage fs = s.fundingStates[_marketId];
        int256 funding24h = LibMath.mulFpSigned(
            int256(sizeUsd),
            fs.currentFundingRatePerSecond * 86400
        );

        quote = OpenPositionQuote({
            entryPrice: entryPrice,
            sizeUsd: sizeUsd,
            collateralUsd: netCollateralUsd,
            leverage: _leverage,
            tradingFee: tradingFeeTokens,
            tradingFeeUsd: tradingFeeUsd,
            priceImpact: priceImpact,
            liquidationPrice: liqPrice,
            estimatedFunding24h: funding24h,
            maintenanceMarginBps: market.maintenanceMarginBps
        });
    }

    /// @notice Simulate closing a position — returns PnL and payout details
    /// @param _positionId The position to simulate closing
    /// @return quote Full close quote with PnL, fees, payout
    function quoteClosePosition(uint256 _positionId) external view returns (ClosePositionQuote memory quote) {
        AppStorage storage s = appStorage();
        Position storage pos = s.positions[_positionId];
        require(pos.active, "Quoter: position not active");

        uint256 exitPrice = s.latestPrice[pos.marketId];
        int256 pnl = LibPosition.calculatePnl(pos, exitPrice);

        // Trading fee
        uint256 tradingFeeUsd = (pos.sizeUsd * s.takerFeeBps) / 10000;
        uint8 decimals = s.collateralDecimals[pos.collateralToken];
        uint256 tradingFeeTokens = _usdToTokens(decimals, tradingFeeUsd);

        // Pending funding
        int256 fundingOwed = _calculatePendingFunding(s, pos);

        // Net PnL after funding
        int256 netPnl = pnl - fundingOwed;

        // Estimate payout
        uint256 payout;
        if (netPnl >= 0) {
            uint256 pnlTokens = _usdToTokens(decimals, uint256(netPnl));
            payout = pos.collateralAmount + pnlTokens;
        } else {
            uint256 lossTokens = _usdToTokens(decimals, uint256(-netPnl));
            payout = pos.collateralAmount > lossTokens ? pos.collateralAmount - lossTokens : 0;
        }
        payout = payout > tradingFeeTokens ? payout - tradingFeeTokens : 0;

        quote = ClosePositionQuote({
            exitPrice: exitPrice,
            unrealizedPnl: pnl,
            tradingFee: tradingFeeTokens,
            tradingFeeUsd: tradingFeeUsd,
            fundingOwed: fundingOwed,
            netPnl: netPnl,
            estimatedPayout: payout
        });
    }

    /// @notice Simulate a partial close
    /// @param _positionId The position
    /// @param _closeSizeUsd The size to close (18 dec)
    /// @return exitPrice The exit price
    /// @return closedPnl The PnL for the closed portion
    /// @return fee The trading fee
    /// @return estimatedPayout The token amount returned
    function quotePartialClose(
        uint256 _positionId,
        uint256 _closeSizeUsd
    ) external view returns (uint256 exitPrice, int256 closedPnl, uint256 fee, uint256 estimatedPayout) {
        AppStorage storage s = appStorage();
        Position storage pos = s.positions[_positionId];
        require(pos.active, "Quoter: position not active");
        require(_closeSizeUsd > 0 && _closeSizeUsd < pos.sizeUsd, "Quoter: invalid close size");

        exitPrice = s.latestPrice[pos.marketId];
        int256 totalPnl = LibPosition.calculatePnl(pos, exitPrice);
        uint256 closeFraction = LibMath.divFp(_closeSizeUsd, pos.sizeUsd);
        closedPnl = LibMath.mulFpSigned(totalPnl, int256(closeFraction));

        fee = (_closeSizeUsd * s.takerFeeBps) / 10000;
        uint8 decimals = s.collateralDecimals[pos.collateralToken];
        uint256 feeTokens = _usdToTokens(decimals, fee);

        uint256 releasedCollateral = LibMath.mulFp(pos.collateralAmount, closeFraction);

        if (closedPnl >= 0) {
            uint256 pnlTokens = _usdToTokens(decimals, uint256(closedPnl));
            estimatedPayout = releasedCollateral + pnlTokens;
        } else {
            uint256 lossTokens = _usdToTokens(decimals, uint256(-closedPnl));
            estimatedPayout = releasedCollateral > lossTokens ? releasedCollateral - lossTokens : 0;
        }
        estimatedPayout = estimatedPayout > feeTokens ? estimatedPayout - feeTokens : 0;
    }

    /// @notice Get a comprehensive market quote for frontend display
    /// @param _marketId The market ID
    /// @return quote Full market state snapshot
    function quoteMarket(uint256 _marketId) external view returns (MarketQuote memory quote) {
        AppStorage storage s = appStorage();
        Market storage market = s.markets[_marketId];
        VirtualPool storage pool = s.virtualPools[_marketId];
        FundingState storage fs = s.fundingStates[_marketId];
        MarketOI storage oi = s.openInterest[_marketId];

        uint256 markPrice;
        if (pool.baseReserve > 0) {
            markPrice = LibMath.divFp(pool.quoteReserve, pool.baseReserve);
        }

        uint256 oracleTWAP = LibTWAP.calculateTWAP(s.priceHistory[_marketId], TWAP_WINDOW, block.timestamp);

        uint256 maxStale = s.maxPriceStaleness;
        if (maxStale == 0) maxStale = 120;
        bool priceStale = block.timestamp > s.latestPriceTimestamp[_marketId] + maxStale;

        quote = MarketQuote({
            indexPrice: s.latestPrice[_marketId],
            markPrice: markPrice,
            oracleTWAP: oracleTWAP,
            fundingRatePerSecond: fs.currentFundingRatePerSecond,
            fundingRate24h: fs.currentFundingRatePerSecond * 86400,
            longOI: oi.longOI,
            shortOI: oi.shortOI,
            maxLeverage: market.maxLeverage,
            maintenanceMarginBps: market.maintenanceMarginBps,
            enabled: market.enabled,
            priceStale: priceStale
        });
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    function _normalizeToUsd(uint8 _decimals, uint256 _amount) internal pure returns (uint256) {
        if (_decimals < 18) {
            return _amount * (10 ** (18 - _decimals));
        } else if (_decimals > 18) {
            return _amount / (10 ** (_decimals - 18));
        }
        return _amount;
    }

    function _usdToTokens(uint8 _decimals, uint256 _usdAmount) internal pure returns (uint256) {
        if (_decimals < 18) {
            return _usdAmount / (10 ** (18 - _decimals));
        } else if (_decimals > 18) {
            return _usdAmount * (10 ** (_decimals - 18));
        }
        return _usdAmount;
    }

    function _simulateExecutionPrice(
        AppStorage storage s,
        uint256 _marketId,
        uint256 _sizeUsd,
        bool _isLong
    ) internal view returns (uint256) {
        uint256 oraclePrice = s.latestPrice[_marketId];
        VirtualPool storage pool = s.virtualPools[_marketId];

        if (pool.baseReserve == 0 || _sizeUsd == 0) return oraclePrice;

        uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);
        uint256 markPrice = LibMath.divFp(pool.quoteReserve, pool.baseReserve);

        uint256 newQuote;
        uint256 baseDelta;

        if (_isLong) {
            newQuote = pool.quoteReserve + _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            baseDelta = pool.baseReserve > newBase ? pool.baseReserve - newBase : 0;
        } else {
            if (_sizeUsd >= pool.quoteReserve) return oraclePrice;
            newQuote = pool.quoteReserve - _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            baseDelta = newBase > pool.baseReserve ? newBase - pool.baseReserve : 0;
        }

        if (baseDelta == 0) return oraclePrice;

        uint256 vammPrice = LibMath.divFp(_sizeUsd, baseDelta);

        if (vammPrice >= markPrice) {
            uint256 spread = vammPrice - markPrice;
            return oraclePrice + spread;
        } else {
            uint256 spread = markPrice - vammPrice;
            return oraclePrice > spread ? oraclePrice - spread : 1;
        }
    }

    function _calculatePendingFunding(AppStorage storage s, Position storage pos) internal view returns (int256) {
        FundingState storage fs = s.fundingStates[pos.marketId];
        uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
        int256 pendingAccrual = fs.currentFundingRatePerSecond * int256(elapsed);

        int256 currentCumulative;
        if (pos.isLong) {
            currentCumulative = fs.cumulativeFundingPerUnitLong + pendingAccrual;
        } else {
            currentCumulative = fs.cumulativeFundingPerUnitShort - pendingAccrual;
        }

        int256 fundingDelta = currentCumulative - pos.lastFundingIndex;
        return LibMath.mulFpSigned(int256(pos.sizeUsd), fundingDelta);
    }
}
