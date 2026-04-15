// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {LibOROB} from "../diamond/libraries/LibOROB.sol";
import {LibBatchClearing} from "../diamond/libraries/LibBatchClearing.sol";
import {LibPoFQ} from "../diamond/libraries/LibPoFQ.sol";

/// @title SpotLibHarness - Exposes internal library functions for testing
contract SpotLibHarness {
    // ── LibOROB ──

    function resolveOffset(int256 oraclePrice, int16 offsetBps)
        external pure returns (int256)
    {
        return LibOROB.resolveOffset(oraclePrice, offsetBps);
    }

    function resolveOffsetBatch(int256 oraclePrice, int16[] calldata offsets)
        external pure returns (int256[] memory)
    {
        return LibOROB.resolveOffsetBatch(oraclePrice, offsets);
    }

    function toOffset(int256 oraclePrice, int256 absolutePrice)
        external pure returns (int16)
    {
        return LibOROB.toOffset(oraclePrice, absolutePrice);
    }

    // ── LibBatchClearing ──

    function computeClearing(
        int256 oraclePrice,
        int16[] calldata buyOffsets,
        uint128[] calldata buySizes,
        int16[] calldata sellOffsets,
        uint128[] calldata sellSizes
    ) external pure returns (int16 clearingOffsetBps, int256 clearingPrice, uint256 matchedVolume) {
        LibBatchClearing.ClearingResult memory r = LibBatchClearing.computeClearing(
            oraclePrice, buyOffsets, buySizes, sellOffsets, sellSizes
        );
        return (r.clearingOffsetBps, r.clearingPrice, r.matchedVolume);
    }

    // ── LibPoFQ ──

    function scoreFill(int256 fillPrice, int256 oraclePrice)
        external pure returns (uint256)
    {
        return LibPoFQ.scoreFill(fillPrice, oraclePrice);
    }

    function scoreBatch(
        int256[] calldata fillPrices,
        int256[] calldata oraclePrices,
        uint128[] calldata sizes
    ) external pure returns (uint256 avgScore, uint256 totalVolume) {
        return LibPoFQ.scoreBatch(fillPrices, oraclePrices, sizes);
    }

    function updateRollingScore(
        uint256 currentScore,
        uint256 currentWeight,
        uint256 newScore,
        uint256 newWeight,
        uint16 decayBps
    ) external pure returns (uint256 updatedScore, uint256 updatedWeight) {
        return LibPoFQ.updateRollingScore(currentScore, currentWeight, newScore, newWeight, decayBps);
    }
}
