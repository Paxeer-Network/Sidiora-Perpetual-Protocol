// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title LibPoFQ - Proof-of-Fill-Quality scoring
/// @dev Replaces IPoFQScorer precompile (0x904). Pure math, no external calls.
///      Scores range from 0 (worst) to 1e18 (perfect oracle match).
///      Used for trader/vault reputation tracking and fee tier qualification.
library LibPoFQ {
    uint256 constant PRECISION = 1e18;
    uint256 constant MAX_DEVIATION_BPS = 10_000;
    uint256 constant BPS_BASE = 10_000;

    /// @notice Compute fill quality score for a single fill
    /// @param fillPrice Actual fill price (18 decimals, signed)
    /// @param oraclePrice Oracle price at fill time (18 decimals, signed)
    /// @return score Quality score (18 decimals, 0 = worst, 1e18 = perfect)
    function scoreFill(int256 fillPrice, int256 oraclePrice)
        internal
        pure
        returns (uint256 score)
    {
        if (oraclePrice <= 0) return 0;
        int256 deviation = fillPrice - oraclePrice;
        if (deviation < 0) deviation = -deviation;
        uint256 deviationBps = uint256(deviation * int256(BPS_BASE) / oraclePrice);
        if (deviationBps >= MAX_DEVIATION_BPS) return 0;
        score = PRECISION - (PRECISION * deviationBps / MAX_DEVIATION_BPS);
    }

    /// @notice Compute volume-weighted average fill quality for a batch
    /// @param fillPrices Array of fill prices (18 decimals, signed)
    /// @param oraclePrices Array of oracle prices at fill time (18 decimals, signed)
    /// @param sizes Array of fill sizes
    /// @return avgScore Volume-weighted average score (18 decimals)
    /// @return totalVolume Total volume scored
    function scoreBatch(
        int256[] memory fillPrices,
        int256[] memory oraclePrices,
        uint128[] memory sizes
    ) internal pure returns (uint256 avgScore, uint256 totalVolume) {
        uint256 len = fillPrices.length;
        require(len == oraclePrices.length && len == sizes.length, "LibPoFQ: array mismatch");

        uint256 weightedSum;
        for (uint256 i; i < len;) {
            uint256 s = scoreFill(fillPrices[i], oraclePrices[i]);
            uint256 sz = uint256(sizes[i]);
            weightedSum += s * sz;
            totalVolume += sz;
            unchecked { ++i; }
        }

        if (totalVolume == 0) return (0, 0);
        avgScore = weightedSum / totalVolume;
    }

    /// @notice Update a rolling score with new batch data and exponential decay
    /// @param currentScore Current rolling score (18 decimals)
    /// @param currentWeight Current accumulated weight (volume)
    /// @param newScore New batch score (18 decimals)
    /// @param newWeight New batch volume
    /// @param decayBps Decay rate in bps (e.g., 100 = 1% decay per update)
    /// @return updatedScore New rolling score after decay + new data
    /// @return updatedWeight New accumulated weight
    function updateRollingScore(
        uint256 currentScore,
        uint256 currentWeight,
        uint256 newScore,
        uint256 newWeight,
        uint16 decayBps
    ) internal pure returns (uint256 updatedScore, uint256 updatedWeight) {
        uint256 decayed = currentScore * (BPS_BASE - uint256(decayBps)) / BPS_BASE;
        uint256 decayedWeight = currentWeight * (BPS_BASE - uint256(decayBps)) / BPS_BASE;
        updatedWeight = decayedWeight + newWeight;
        if (updatedWeight == 0) return (0, 0);
        updatedScore = (decayed * decayedWeight + newScore * newWeight) / updatedWeight;
    }
}
