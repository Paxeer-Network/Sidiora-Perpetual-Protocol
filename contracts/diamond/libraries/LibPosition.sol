// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {Position} from "../storage/AppStorage.sol";
import {LibMath} from "./LibMath.sol";

/// @title LibPosition - Position math: PnL, margin ratio, liquidation price
/// @dev All calculations use 18-decimal fixed-point. No external dependencies.
library LibPosition {
    /// @notice Calculate unrealized PnL for a position
    /// @param _position The position data
    /// @param _currentPrice The current market price (18 dec)
    /// @return pnl Signed PnL in USD (18 dec). Positive = profit, negative = loss.
    function calculatePnl(Position storage _position, uint256 _currentPrice) internal view returns (int256 pnl) {
        if (_position.sizeUsd == 0 || _position.entryPrice == 0) return 0;

        int256 priceDelta;
        if (_position.isLong) {
            priceDelta = int256(_currentPrice) - int256(_position.entryPrice);
        } else {
            priceDelta = int256(_position.entryPrice) - int256(_currentPrice);
        }

        // PnL = sizeUsd * priceDelta / entryPrice
        pnl = LibMath.mulFpSigned(
            int256(_position.sizeUsd),
            LibMath.divFpSigned(priceDelta, int256(_position.entryPrice))
        );
    }

    /// @notice Calculate the margin ratio of a position
    /// @dev marginRatio = (collateral + unrealizedPnl) / sizeUsd
    /// @param _position The position data
    /// @param _currentPrice The current market price (18 dec)
    /// @return marginBps The margin ratio in basis points (e.g., 100 = 1%)
    function calculateMarginRatio(
        Position storage _position,
        uint256 _currentPrice
    ) internal view returns (uint256 marginBps) {
        if (_position.sizeUsd == 0) return type(uint256).max;

        int256 pnl = calculatePnl(_position, _currentPrice);
        int256 equity = int256(_position.collateralUsd) + pnl;

        if (equity <= 0) return 0;

        // marginBps = (equity / sizeUsd) * 10000
        marginBps = (uint256(equity) * 10000) / _position.sizeUsd;
    }

    /// @notice Calculate the liquidation price for a position
    /// @param _entryPrice Entry price (18 dec)
    /// @param _collateralUsd Collateral in USD (18 dec)
    /// @param _sizeUsd Position size in USD (18 dec)
    /// @param _maintenanceMarginBps Maintenance margin in bps
    /// @param _isLong True if long position
    /// @return liqPrice The liquidation price (18 dec)
    function calculateLiquidationPrice(
        uint256 _entryPrice,
        uint256 _collateralUsd,
        uint256 _sizeUsd,
        uint256 _maintenanceMarginBps,
        bool _isLong
    ) internal pure returns (uint256 liqPrice) {
        if (_sizeUsd == 0) return 0;

        // Maintenance margin in USD
        uint256 maintenanceMarginUsd = (_sizeUsd * _maintenanceMarginBps) / 10000;

        // Distance to liquidation (in price terms)
        // collateral - maintenanceMargin = sizeUsd * |priceDelta| / entryPrice
        // |priceDelta| = (collateral - maintenanceMargin) * entryPrice / sizeUsd
        if (_collateralUsd <= maintenanceMarginUsd) {
            // Already below maintenance margin — return entry price
            return _entryPrice;
        }
        uint256 priceRoom = LibMath.mulDiv(
            _collateralUsd - maintenanceMarginUsd,
            _entryPrice,
            _sizeUsd
        );

        if (_isLong) {
            liqPrice = _entryPrice > priceRoom ? _entryPrice - priceRoom : 0;
        } else {
            liqPrice = _entryPrice + priceRoom;
        }
    }

    /// @notice Validate that leverage is within bounds
    /// @param _sizeUsd Notional size (18 dec)
    /// @param _collateralUsd Collateral (18 dec)
    /// @param _maxLeverage Maximum allowed leverage (18 dec, e.g., 1000e18)
    /// @return leverage The actual leverage (18 dec)
    function validateLeverage(
        uint256 _sizeUsd,
        uint256 _collateralUsd,
        uint256 _maxLeverage
    ) internal pure returns (uint256 leverage) {
        require(_collateralUsd > 0, "LibPosition: zero collateral");
        require(_sizeUsd > 0, "LibPosition: zero size");
        leverage = LibMath.divFp(_sizeUsd, _collateralUsd);
        require(leverage <= _maxLeverage, "LibPosition: leverage exceeds maximum");
    }

    /// @notice Calculate the new weighted average entry price when adding to a position
    /// @param _existingSize Current position size (18 dec)
    /// @param _existingEntryPrice Current entry price (18 dec)
    /// @param _addedSize Additional size (18 dec)
    /// @param _addedPrice Price of the new addition (18 dec)
    /// @return newEntryPrice Weighted average entry price (18 dec)
    function calculateAverageEntryPrice(
        uint256 _existingSize,
        uint256 _existingEntryPrice,
        uint256 _addedSize,
        uint256 _addedPrice
    ) internal pure returns (uint256 newEntryPrice) {
        uint256 totalSize = _existingSize + _addedSize;
        if (totalSize == 0) return 0;
        newEntryPrice = (
            LibMath.mulFp(_existingSize, _existingEntryPrice) +
            LibMath.mulFp(_addedSize, _addedPrice)
        ) / totalSize * 1e18;
    }
}
