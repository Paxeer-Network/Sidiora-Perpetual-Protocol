// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, VirtualPool, appStorage} from "../../storage/AppStorage.sol";
import {LibMath} from "../../libraries/LibMath.sol";
import {LibTWAP} from "../../libraries/LibTWAP.sol";

/// @title PriceFeedFacet - Price aggregation (oracle + vAMM + TWAP)
/// @dev Provides execution prices for trades and liquidations.
///      - Market orders: oracle index price + vAMM price impact
///      - Limit orders: trigger on oracle price, execute at limit price
///      - Liquidations: oracle index price (no impact — fair liquidation)
contract PriceFeedFacet {
    uint256 constant TWAP_WINDOW = 900; // 15 minutes default

    // ============================================================
    //                     PRICE FUNCTIONS
    // ============================================================

    /// @notice Get the execution price for a market order
    /// @dev Combines oracle index price with vAMM price impact
    /// @param _marketId The market ID
    /// @param _sizeUsd The trade size in USD (18 dec)
    /// @param _isLong True for long, false for short
    /// @return executionPrice The price to execute at (18 dec)
    function getExecutionPrice(
        uint256 _marketId,
        uint256 _sizeUsd,
        bool _isLong
    ) external view returns (uint256 executionPrice) {
        AppStorage storage s = appStorage();
        _enforcePriceNotStale(s, _marketId);

        uint256 oraclePrice = s.latestPrice[_marketId];
        VirtualPool storage pool = s.virtualPools[_marketId];

        if (pool.baseReserve == 0 || _sizeUsd == 0) {
            // No vAMM or zero size — return oracle price
            return oraclePrice;
        }

        // Simulate vAMM impact
        uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);
        uint256 newQuote;
        uint256 baseDelta;

        if (_isLong) {
            newQuote = pool.quoteReserve + _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            baseDelta = pool.baseReserve - newBase;
        } else {
            require(_sizeUsd < pool.quoteReserve, "PriceFeed: trade too large for vAMM");
            newQuote = pool.quoteReserve - _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            baseDelta = newBase - pool.baseReserve;
        }

        if (baseDelta == 0) return oraclePrice;

        // vAMM execution price
        uint256 vammPrice = LibMath.divFp(_sizeUsd, baseDelta);

        // Blend: use oracle as base, apply vAMM spread
        // executionPrice = oraclePrice + (vammPrice - markPrice)
        uint256 markPrice = LibMath.divFp(pool.quoteReserve, pool.baseReserve);

        if (vammPrice >= markPrice) {
            uint256 spread = vammPrice - markPrice;
            executionPrice = oraclePrice + spread;
        } else {
            uint256 spread = markPrice - vammPrice;
            executionPrice = oraclePrice > spread ? oraclePrice - spread : 1;
        }
    }

    /// @notice Get the oracle index price for a market
    /// @param _marketId The market ID
    /// @return price The latest oracle price (18 dec)
    function getIndexPrice(uint256 _marketId) external view returns (uint256 price) {
        return appStorage().latestPrice[_marketId];
    }

    /// @notice Get the vAMM mark price for a market
    /// @param _marketId The market ID
    /// @return price The mark price (18 dec)
    function getMarkPrice(uint256 _marketId) external view returns (uint256 price) {
        VirtualPool storage pool = appStorage().virtualPools[_marketId];
        if (pool.baseReserve == 0) return 0;
        return LibMath.divFp(pool.quoteReserve, pool.baseReserve);
    }

    /// @notice Get the oracle TWAP over the default window
    /// @param _marketId The market ID
    /// @return twap The time-weighted average price (18 dec)
    function getOracleTWAP(uint256 _marketId) external view returns (uint256 twap) {
        AppStorage storage s = appStorage();
        return LibTWAP.calculateTWAP(s.priceHistory[_marketId], TWAP_WINDOW, block.timestamp);
    }

    /// @notice Get the oracle TWAP over a custom window
    /// @param _marketId The market ID
    /// @param _windowSeconds The TWAP window in seconds
    /// @return twap The time-weighted average price (18 dec)
    function getOracleTWAPCustom(uint256 _marketId, uint256 _windowSeconds) external view returns (uint256 twap) {
        AppStorage storage s = appStorage();
        return LibTWAP.calculateTWAP(s.priceHistory[_marketId], _windowSeconds, block.timestamp);
    }

    /// @notice Get the liquidation execution price (oracle only, no impact)
    /// @param _marketId The market ID
    /// @return price The oracle price for liquidation
    function getLiquidationPrice(uint256 _marketId) external view returns (uint256 price) {
        AppStorage storage s = appStorage();
        _enforcePriceNotStale(s, _marketId);
        return s.latestPrice[_marketId];
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    /// @dev Revert if the oracle price is stale for a market
    function _enforcePriceNotStale(AppStorage storage s, uint256 _marketId) internal view {
        uint256 maxStale = s.maxPriceStaleness;
        if (maxStale == 0) maxStale = 120; // default 2 minutes
        require(
            block.timestamp <= s.latestPriceTimestamp[_marketId] + maxStale,
            "PriceFeed: price is stale"
        );
    }
}
