// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {LibOROB} from "./LibOROB.sol";

/// @title LibBatchClearing - Sealed-bid batch auction clearing
/// @dev Replaces IBatchClearing precompile (0x902). Pure math, no external calls.
///      Algorithm: standard supply-demand intersection.
///      1. Buy orders sorted by offset descending (most aggressive first)
///      2. Sell orders sorted by offset ascending (cheapest first)
///      3. Walk both curves simultaneously, accumulating volume
///      4. Clearing price = where cumulative buy volume >= cumulative sell volume
///      5. All fills execute at the uniform clearing price
library LibBatchClearing {
    struct ClearingResult {
        int16   clearingOffsetBps;
        int256  clearingPrice;
        uint256 matchedVolume;
    }

    /// @notice Compute the uniform clearing price for a batch auction
    /// @param oraclePrice Current oracle price (18 decimals)
    /// @param buyOffsets Buy order offsets (MUST be sorted descending — most aggressive first)
    /// @param buySizes Buy order sizes (base asset units, aligned with buyOffsets)
    /// @param sellOffsets Sell order offsets (MUST be sorted ascending — cheapest first)
    /// @param sellSizes Sell order sizes (base asset units, aligned with sellOffsets)
    /// @return result The clearing offset, absolute clearing price, and total matched volume
    function computeClearing(
        int256 oraclePrice,
        int16[] memory buyOffsets,
        uint128[] memory buySizes,
        int16[] memory sellOffsets,
        uint128[] memory sellSizes
    ) internal pure returns (ClearingResult memory result) {
        require(oraclePrice > 0, "LibBatchClearing: oracle price must be positive");
        require(buyOffsets.length == buySizes.length, "LibBatchClearing: buy array mismatch");
        require(sellOffsets.length == sellSizes.length, "LibBatchClearing: sell array mismatch");

        uint256 numBuys = buyOffsets.length;
        uint256 numSells = sellOffsets.length;

        if (numBuys == 0 || numSells == 0) {
            return result; // No clearing possible
        }

        // Walk supply-demand curves to find intersection
        uint256 cumBuy;
        uint256 cumSell;
        uint256 buyIdx;
        uint256 sellIdx;

        // The clearing price is the highest sell offset (cheapest sell) where cumBuy >= cumSell
        // We iterate: accumulate buy volume at descending offsets, sell volume at ascending offsets
        // Find the offset where buy demand crosses sell supply

        // Build cumulative buy curve (descending offsets → accumulate left to right)
        // Build cumulative sell curve (ascending offsets → accumulate left to right)
        // The clearing offset is the sell offset at which cumulative sell first <= cumulative buy

        // Walk both sides: at each step, pick the more aggressive offset
        int16 lastClearingOffset;
        bool found;

        while (buyIdx < numBuys && sellIdx < numSells) {
            // Check if buy is willing to pay at least the sell's ask
            if (buyOffsets[buyIdx] >= sellOffsets[sellIdx]) {
                // Price cross exists — accumulate volume at sell offset
                uint128 buyRemain = buySizes[buyIdx];
                uint128 sellRemain = sellSizes[sellIdx];

                if (buyRemain <= sellRemain) {
                    // Buy fully filled
                    cumBuy += buyRemain;
                    cumSell += buyRemain;
                    buySizes[buyIdx] = 0;
                    sellSizes[sellIdx] = sellRemain - buyRemain;
                    lastClearingOffset = sellOffsets[sellIdx];
                    found = true;
                    buyIdx++;
                    if (sellSizes[sellIdx] == 0) sellIdx++;
                } else {
                    // Sell fully filled
                    cumBuy += sellRemain;
                    cumSell += sellRemain;
                    buySizes[buyIdx] = buyRemain - sellRemain;
                    sellSizes[sellIdx] = 0;
                    lastClearingOffset = sellOffsets[sellIdx];
                    found = true;
                    sellIdx++;
                }
            } else {
                // No more price crosses — done
                break;
            }
        }

        if (!found || cumBuy == 0) {
            return result; // No crossing
        }

        result.clearingOffsetBps = lastClearingOffset;
        result.clearingPrice = LibOROB.resolveOffset(oraclePrice, lastClearingOffset);
        result.matchedVolume = cumBuy; // cumBuy == cumSell at clearing
    }
}
