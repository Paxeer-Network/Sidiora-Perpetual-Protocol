// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {PricePoint} from "../storage/AppStorage.sol";

/// @title LibTWAP - Time-Weighted Average Price calculation
/// @dev Pure math for computing TWAP over a configurable time window
///      from an array of PricePoint observations. No external dependencies.
library LibTWAP {
    /// @notice Calculate TWAP from a price history array over a time window
    /// @param _priceHistory Array of PricePoint (price, timestamp), assumed chronologically ordered
    /// @param _windowSeconds The TWAP window duration in seconds (e.g., 900 = 15 min)
    /// @param _currentTimestamp The current block timestamp
    /// @return twap The time-weighted average price (18 decimals)
    function calculateTWAP(
        PricePoint[] storage _priceHistory,
        uint256 _windowSeconds,
        uint256 _currentTimestamp
    ) internal view returns (uint256 twap) {
        uint256 len = _priceHistory.length;
        if (len == 0) return 0;
        if (len == 1) return _priceHistory[0].price;

        uint256 windowStart = _currentTimestamp > _windowSeconds
            ? _currentTimestamp - _windowSeconds
            : 0;

        uint256 weightedSum;
        uint256 totalWeight;

        // Walk backwards through history, accumulating time-weighted prices
        for (uint256 i = len; i > 0; i--) {
            PricePoint storage point = _priceHistory[i - 1];

            // Skip points older than window
            if (point.timestamp < windowStart) {
                // This point started before the window. Use it as the "floor" price
                // for the remaining window time.
                uint256 nextTimestamp;
                if (i < len) {
                    nextTimestamp = _priceHistory[i].timestamp;
                } else {
                    nextTimestamp = _currentTimestamp;
                }
                uint256 relevantDuration = nextTimestamp > windowStart
                    ? nextTimestamp - windowStart
                    : 0;
                if (relevantDuration > 0) {
                    weightedSum += point.price * relevantDuration;
                    totalWeight += relevantDuration;
                }
                break;
            }

            // Calculate duration this price was active
            uint256 endTime;
            if (i < len) {
                endTime = _priceHistory[i].timestamp;
            } else {
                endTime = _currentTimestamp;
            }
            uint256 startTime = point.timestamp > windowStart ? point.timestamp : windowStart;
            uint256 duration = endTime > startTime ? endTime - startTime : 0;

            if (duration > 0) {
                weightedSum += point.price * duration;
                totalWeight += duration;
            }
        }

        if (totalWeight == 0) {
            // Fallback: return latest price
            return _priceHistory[len - 1].price;
        }

        twap = weightedSum / totalWeight;
    }

    /// @notice Get the latest price from history
    /// @param _priceHistory The price history array
    /// @return price The latest price (18 dec), or 0 if empty
    function latestPrice(PricePoint[] storage _priceHistory) internal view returns (uint256 price) {
        uint256 len = _priceHistory.length;
        if (len == 0) return 0;
        return _priceHistory[len - 1].price;
    }
}
