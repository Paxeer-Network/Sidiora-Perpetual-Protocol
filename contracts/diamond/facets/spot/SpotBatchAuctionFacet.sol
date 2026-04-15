// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, SpotMarket, BatchQueue, appStorage} from "../../storage/AppStorage.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibBatchClearing} from "../../libraries/LibBatchClearing.sol";
import {LibSpotSettlement} from "../../libraries/LibSpotSettlement.sol";
import {LibPoFQ} from "../../libraries/LibPoFQ.sol";
import {LibOROB} from "../../libraries/LibOROB.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title SpotBatchAuctionFacet - Sealed-bid batch auction clearing for spot markets
/// @dev When a market is in BATCH mode, orders queue in spotBatchQueues.
///      This facet clears the batch using LibBatchClearing (uniform clearing price).
///      Permissionless — anyone can call clearSpotBatch, but typically keepers do.
contract SpotBatchAuctionFacet is ISpotEvents {
    uint8 constant MODE_BATCH = 1;

    // ============================================================
    //                    BATCH CLEARING
    // ============================================================

    /// @notice Clear the batch queue for a spot market
    /// @dev Computes uniform clearing price, executes all crossed fills,
    ///      updates virtual balances, scores fills, clears queue, emits event.
    /// @param _marketId The spot market identifier
    function clearSpotBatch(bytes32 _marketId) external {
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        SpotMarket storage market = s.spotMarkets[_marketId];

        require(market.active, "SpotBatchAuction: market not active");
        require(market.mode == MODE_BATCH, "SpotBatchAuction: not in batch mode");
        require(!s.globalPaused, "SpotBatchAuction: protocol paused");

        // Prevent clearing the same block twice
        require(s.spotBatchBlock[_marketId] < block.number, "SpotBatchAuction: already cleared this block");

        BatchQueue storage queue = s.spotBatchQueues[_marketId];
        uint256 numBuys = queue.buyOffsets.length;
        uint256 numSells = queue.sellOffsets.length;

        if (numBuys == 0 || numSells == 0) {
            // Nothing to clear — just update the block marker and reset
            s.spotBatchBlock[_marketId] = block.number;
            _clearQueue(queue);
            LibReentrancyGuard.nonReentrantAfter();
            return;
        }

        // Get oracle price
        int256 oraclePrice = int256(s.latestPrice[uint256(_marketId)]);
        require(oraclePrice > 0, "SpotBatchAuction: no oracle price");

        // Sort buy offsets descending (most aggressive first)
        _sortBuysDescending(queue);
        // Sort sell offsets ascending (cheapest first)
        _sortSellsAscending(queue);

        // Copy arrays to memory for LibBatchClearing (it mutates sizes)
        int16[] memory buyOffsets = new int16[](numBuys);
        uint128[] memory buySizes = new uint128[](numBuys);
        int16[] memory sellOffsets = new int16[](numSells);
        uint128[] memory sellSizes = new uint128[](numSells);

        for (uint256 i; i < numBuys;) {
            buyOffsets[i] = queue.buyOffsets[i];
            buySizes[i] = queue.buySizes[i];
            unchecked { ++i; }
        }
        for (uint256 i; i < numSells;) {
            sellOffsets[i] = queue.sellOffsets[i];
            sellSizes[i] = queue.sellSizes[i];
            unchecked { ++i; }
        }

        // Save original sizes for fill tracking (before clearing mutates them)
        uint128[] memory origBuySizes = new uint128[](numBuys);
        uint128[] memory origSellSizes = new uint128[](numSells);
        for (uint256 i; i < numBuys;) {
            origBuySizes[i] = buySizes[i];
            unchecked { ++i; }
        }
        for (uint256 i; i < numSells;) {
            origSellSizes[i] = sellSizes[i];
            unchecked { ++i; }
        }

        // Compute clearing price
        LibBatchClearing.ClearingResult memory result =
            LibBatchClearing.computeClearing(oraclePrice, buyOffsets, buySizes, sellOffsets, sellSizes);

        if (result.matchedVolume == 0) {
            // No crossing — just clear the queue
            s.spotBatchBlock[_marketId] = block.number;
            _clearQueue(queue);
            LibReentrancyGuard.nonReentrantAfter();
            return;
        }

        // Execute fills at uniform clearing price
        // buySizes/sellSizes have been mutated by computeClearing — remaining unfilled amounts
        // Fill amount = original - remaining
        uint256 numBuysFilled;
        uint256 numSellsFilled;
        uint8 baseDecimals = s.spotTokenDecimals[market.baseToken];

        // Score the clearing price vs oracle
        uint256 batchScore = LibPoFQ.scoreFill(result.clearingPrice, oraclePrice);

        // Process buy fills
        for (uint256 i; i < numBuys;) {
            uint128 filled = origBuySizes[i] - buySizes[i];
            if (filled > 0) {
                address buyer = queue.buyTraders[i];
                int256 baseAmount = LibSpotSettlement.normalizeToInt(baseDecimals, uint256(filled));
                int256 quoteAmount = baseAmount * result.clearingPrice / 1e18;

                // Credit buyer base, debit buyer quote
                LibSpotSettlement.creditVirtualBalance(buyer, market.baseToken, baseAmount);
                LibSpotSettlement.debitVirtualBalance(buyer, market.quoteToken, quoteAmount);

                // Track epoch deltas
                _trackEpochDelta(s, buyer, market.baseToken, baseAmount);
                _trackEpochDelta(s, buyer, market.quoteToken, -quoteAmount);

                // Update PoFQ for buyer
                _updatePoFQ(s, buyer, batchScore, uint256(filled));

                numBuysFilled++;
            }
            unchecked { ++i; }
        }

        // Process sell fills
        for (uint256 i; i < numSells;) {
            uint128 filled = origSellSizes[i] - sellSizes[i];
            if (filled > 0) {
                address seller = queue.sellTraders[i];
                int256 baseAmount = LibSpotSettlement.normalizeToInt(baseDecimals, uint256(filled));
                int256 quoteAmount = baseAmount * result.clearingPrice / 1e18;

                // Debit seller base, credit seller quote
                LibSpotSettlement.debitVirtualBalance(seller, market.baseToken, baseAmount);
                LibSpotSettlement.creditVirtualBalance(seller, market.quoteToken, quoteAmount);

                // Track epoch deltas
                _trackEpochDelta(s, seller, market.baseToken, -baseAmount);
                _trackEpochDelta(s, seller, market.quoteToken, quoteAmount);

                // Update PoFQ for seller
                _updatePoFQ(s, seller, batchScore, uint256(filled));

                numSellsFilled++;
            }
            unchecked { ++i; }
        }

        // Update rolling volume
        s.spotVolumeRolling[_marketId] += result.matchedVolume;

        // Record batch block and clear queue
        s.spotBatchBlock[_marketId] = block.number;
        _clearQueue(queue);

        emit BatchCleared(
            _marketId,
            result.clearingOffsetBps,
            result.clearingPrice,
            result.matchedVolume,
            numBuysFilled,
            numSellsFilled
        );

        LibReentrancyGuard.nonReentrantAfter();
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the current batch queue size for a market
    /// @param _marketId The spot market identifier
    /// @return numBuys Number of buy orders in queue
    /// @return numSells Number of sell orders in queue
    function getBatchQueueSize(bytes32 _marketId)
        external
        view
        returns (uint256 numBuys, uint256 numSells)
    {
        AppStorage storage s = appStorage();
        BatchQueue storage queue = s.spotBatchQueues[_marketId];
        return (queue.buyOffsets.length, queue.sellOffsets.length);
    }

    /// @notice Get the last block in which a batch was cleared for this market
    /// @param _marketId The spot market identifier
    /// @return blockNumber The last cleared block number
    function getLastBatchBlock(bytes32 _marketId) external view returns (uint256) {
        return appStorage().spotBatchBlock[_marketId];
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    /// @dev Track epoch net delta for a user/token pair + mark dirty
    function _trackEpochDelta(AppStorage storage s, address _user, address _token, int256 _delta) internal {
        s.spotEpochNetDelta[_user][_token] += _delta;
        if (!s.spotIsEpochDirty[_user]) {
            s.spotIsEpochDirty[_user] = true;
            s.spotEpochDirtyUsers.push(_user);
        }
    }

    /// @dev Update rolling PoFQ score for a trader
    function _updatePoFQ(AppStorage storage s, address _trader, uint256 _score, uint256 _volume) internal {
        (uint256 updatedScore, uint256 updatedWeight) = LibPoFQ.updateRollingScore(
            s.spotPoFQScores[_trader],
            s.spotPoFQWeights[_trader],
            _score,
            _volume,
            s.spotPoFQDecayBps
        );
        s.spotPoFQScores[_trader] = updatedScore;
        s.spotPoFQWeights[_trader] = updatedWeight;
    }

    /// @dev Clear the batch queue arrays
    function _clearQueue(BatchQueue storage queue) internal {
        delete queue.buyOffsets;
        delete queue.buySizes;
        delete queue.buyTraders;
        delete queue.sellOffsets;
        delete queue.sellSizes;
        delete queue.sellTraders;
    }

    /// @dev Sort buy orders by offset descending (insertion sort — batch queues are small)
    function _sortBuysDescending(BatchQueue storage queue) internal {
        uint256 len = queue.buyOffsets.length;
        for (uint256 i = 1; i < len;) {
            int16 keyOffset = queue.buyOffsets[i];
            uint128 keySize = queue.buySizes[i];
            address keyTrader = queue.buyTraders[i];
            uint256 j = i;
            while (j > 0 && queue.buyOffsets[j - 1] < keyOffset) {
                queue.buyOffsets[j] = queue.buyOffsets[j - 1];
                queue.buySizes[j] = queue.buySizes[j - 1];
                queue.buyTraders[j] = queue.buyTraders[j - 1];
                j--;
            }
            queue.buyOffsets[j] = keyOffset;
            queue.buySizes[j] = keySize;
            queue.buyTraders[j] = keyTrader;
            unchecked { ++i; }
        }
    }

    /// @dev Sort sell orders by offset ascending (insertion sort — batch queues are small)
    function _sortSellsAscending(BatchQueue storage queue) internal {
        uint256 len = queue.sellOffsets.length;
        for (uint256 i = 1; i < len;) {
            int16 keyOffset = queue.sellOffsets[i];
            uint128 keySize = queue.sellSizes[i];
            address keyTrader = queue.sellTraders[i];
            uint256 j = i;
            while (j > 0 && queue.sellOffsets[j - 1] > keyOffset) {
                queue.sellOffsets[j] = queue.sellOffsets[j - 1];
                queue.sellSizes[j] = queue.sellSizes[j - 1];
                queue.sellTraders[j] = queue.sellTraders[j - 1];
                j--;
            }
            queue.sellOffsets[j] = keyOffset;
            queue.sellSizes[j] = keySize;
            queue.sellTraders[j] = keyTrader;
            unchecked { ++i; }
        }
    }
}
