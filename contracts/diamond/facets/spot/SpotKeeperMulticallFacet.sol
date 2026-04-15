// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, SpotMarket, BatchQueue, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibBatchClearing} from "../../libraries/LibBatchClearing.sol";
import {LibSpotSettlement} from "../../libraries/LibSpotSettlement.sol";
import {LibPoFQ} from "../../libraries/LibPoFQ.sol";
import {LibOROB} from "../../libraries/LibOROB.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";
import {ITradingAccount} from "../../interfaces/ITradingAccount.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title SpotKeeperMulticallFacet - Atomic spot keeper cycle in one transaction
/// @dev Called by validator every block. Single tx: mode evaluation → batch clearing → epoch settlement.
///      Mirrors KeeperMulticallFacet for perps. Validators call this directly.
///      Partial failures in batch clearing are caught — one revert doesn't block the cycle.
contract SpotKeeperMulticallFacet is ISpotEvents {
    uint8 constant MODE_CONTINUOUS = 0;
    uint8 constant MODE_BATCH = 1;
    uint256 constant MIN_BATCH_DURATION = 50;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event SpotKeeperCycleExecuted(
        uint256 timestamp,
        uint256 marketsEvaluated,
        uint256 batchesCleared,
        uint256 epochSettled
    );

    event SpotBatchClearFailed(bytes32 indexed marketId, string reason);

    // ============================================================
    //                    STRUCTS
    // ============================================================

    struct SpotCycleResult {
        uint256 marketsEvaluated;
        uint256 batchesCleared;
        uint256 epochSettled; // 0 or 1 (epoch is global)
    }

    // ============================================================
    //                  MAIN ENTRY POINT
    // ============================================================

    /// @notice Execute a full spot keeper cycle
    /// @dev Atomic — mode evaluation must succeed. Batch clearing soft-fails per market.
    ///      Epoch settlement runs if boundary reached.
    /// @param _marketIds Spot market identifiers to process
    function executeSpotCycle(bytes32[] calldata _marketIds) external {
        LibAccessControl.enforceRole(LibAccessControl.KEEPER_ROLE);
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        SpotCycleResult memory result;

        // ── Phase 1: Evaluate market modes ──
        result.marketsEvaluated = _evaluateModes(s, _marketIds);

        // ── Phase 2: Clear batches for BATCH-mode markets (soft fail per market) ──
        result.batchesCleared = _clearBatches(s, _marketIds);

        // ── Phase 3: Settle epoch if boundary reached ──
        if (LibSpotSettlement.isEpochReady()) {
            _settleEpoch(s);
            result.epochSettled = 1;
        }

        LibReentrancyGuard.nonReentrantAfter();

        emit SpotKeeperCycleExecuted(
            block.timestamp,
            result.marketsEvaluated,
            result.batchesCleared,
            result.epochSettled
        );
    }

    /// @notice Lightweight cycle: mode evaluation only (no batch clearing or settlement)
    /// @param _marketIds Spot market identifiers to evaluate
    function executeSpotPriceCycle(bytes32[] calldata _marketIds) external {
        LibAccessControl.enforceRole(LibAccessControl.KEEPER_ROLE);
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        _evaluateModes(s, _marketIds);

        LibReentrancyGuard.nonReentrantAfter();
    }

    // ============================================================
    //              PHASE 1: MODE EVALUATION
    // ============================================================

    function _evaluateModes(AppStorage storage s, bytes32[] calldata _marketIds)
        internal
        returns (uint256 count)
    {
        for (uint256 i; i < _marketIds.length;) {
            bytes32 marketId = _marketIds[i];
            SpotMarket storage market = s.spotMarkets[marketId];

            if (!market.active) {
                unchecked { ++i; }
                continue;
            }

            uint8 currentMode = market.mode;
            bool shouldBatch = _shouldSwitchToBatch(s, marketId);

            if (currentMode == MODE_CONTINUOUS && shouldBatch) {
                market.mode = MODE_BATCH;
                market.batchModeUntilBlock = block.number + MIN_BATCH_DURATION;
                emit MarketModeChanged(marketId, MODE_CONTINUOUS, MODE_BATCH, market.batchModeUntilBlock);
            } else if (currentMode == MODE_BATCH && !shouldBatch) {
                if (block.number > market.batchModeUntilBlock) {
                    market.mode = MODE_CONTINUOUS;
                    emit MarketModeChanged(marketId, MODE_BATCH, MODE_CONTINUOUS, 0);
                }
            }

            ++count;
            unchecked { ++i; }
        }
    }

    // ============================================================
    //              PHASE 2: BATCH CLEARING (SOFT FAIL)
    // ============================================================

    function _clearBatches(AppStorage storage s, bytes32[] calldata _marketIds)
        internal
        returns (uint256 cleared)
    {
        for (uint256 i; i < _marketIds.length;) {
            bytes32 marketId = _marketIds[i];
            SpotMarket storage market = s.spotMarkets[marketId];

            // Only clear BATCH mode markets that haven't been cleared this block
            if (market.active && market.mode == MODE_BATCH && s.spotBatchBlock[marketId] < block.number) {
                bool ok = _tryClearBatch(s, marketId, market);
                if (ok) ++cleared;
            }

            unchecked { ++i; }
        }
    }

    /// @dev Attempt to clear a batch. Returns false on failure instead of reverting.
    function _tryClearBatch(AppStorage storage s, bytes32 _marketId, SpotMarket storage market)
        internal
        returns (bool)
    {
        BatchQueue storage queue = s.spotBatchQueues[_marketId];
        uint256 numBuys = queue.buyOffsets.length;
        uint256 numSells = queue.sellOffsets.length;

        if (numBuys == 0 || numSells == 0) {
            s.spotBatchBlock[_marketId] = block.number;
            _clearQueue(queue);
            return true;
        }

        int256 oraclePrice = int256(s.latestPrice[uint256(_marketId)]);
        if (oraclePrice <= 0) {
            emit SpotBatchClearFailed(_marketId, "no oracle price");
            return false;
        }

        // Sort queues
        _sortBuysDescending(queue);
        _sortSellsAscending(queue);

        // Copy to memory
        int16[] memory buyOffsets = new int16[](numBuys);
        uint128[] memory buySizes = new uint128[](numBuys);
        int16[] memory sellOffsets = new int16[](numSells);
        uint128[] memory sellSizes = new uint128[](numSells);
        uint128[] memory origBuySizes = new uint128[](numBuys);
        uint128[] memory origSellSizes = new uint128[](numSells);

        for (uint256 j; j < numBuys;) {
            buyOffsets[j] = queue.buyOffsets[j];
            buySizes[j] = queue.buySizes[j];
            origBuySizes[j] = buySizes[j];
            unchecked { ++j; }
        }
        for (uint256 j; j < numSells;) {
            sellOffsets[j] = queue.sellOffsets[j];
            sellSizes[j] = queue.sellSizes[j];
            origSellSizes[j] = sellSizes[j];
            unchecked { ++j; }
        }

        // Compute clearing
        LibBatchClearing.ClearingResult memory result =
            LibBatchClearing.computeClearing(oraclePrice, buyOffsets, buySizes, sellOffsets, sellSizes);

        if (result.matchedVolume == 0) {
            s.spotBatchBlock[_marketId] = block.number;
            _clearQueue(queue);
            return true;
        }

        // Execute fills
        uint8 baseDecimals = s.spotTokenDecimals[market.baseToken];
        uint256 batchScore = LibPoFQ.scoreFill(result.clearingPrice, oraclePrice);
        uint256 numBuysFilled;
        uint256 numSellsFilled;

        for (uint256 j; j < numBuys;) {
            uint128 filled = origBuySizes[j] - buySizes[j];
            if (filled > 0) {
                address buyer = queue.buyTraders[j];
                int256 baseAmount = LibSpotSettlement.normalizeToInt(baseDecimals, uint256(filled));
                int256 quoteAmount = baseAmount * result.clearingPrice / 1e18;

                LibSpotSettlement.creditVirtualBalance(buyer, market.baseToken, baseAmount);
                LibSpotSettlement.debitVirtualBalance(buyer, market.quoteToken, quoteAmount);

                _trackEpochDelta(s, buyer, market.baseToken, baseAmount);
                _trackEpochDelta(s, buyer, market.quoteToken, -quoteAmount);
                _updatePoFQ(s, buyer, batchScore, uint256(filled));

                numBuysFilled++;
            }
            unchecked { ++j; }
        }

        for (uint256 j; j < numSells;) {
            uint128 filled = origSellSizes[j] - sellSizes[j];
            if (filled > 0) {
                address seller = queue.sellTraders[j];
                int256 baseAmount = LibSpotSettlement.normalizeToInt(baseDecimals, uint256(filled));
                int256 quoteAmount = baseAmount * result.clearingPrice / 1e18;

                LibSpotSettlement.debitVirtualBalance(seller, market.baseToken, baseAmount);
                LibSpotSettlement.creditVirtualBalance(seller, market.quoteToken, quoteAmount);

                _trackEpochDelta(s, seller, market.baseToken, -baseAmount);
                _trackEpochDelta(s, seller, market.quoteToken, quoteAmount);
                _updatePoFQ(s, seller, batchScore, uint256(filled));

                numSellsFilled++;
            }
            unchecked { ++j; }
        }

        s.spotVolumeRolling[_marketId] += result.matchedVolume;
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

        return true;
    }

    // ============================================================
    //              PHASE 3: EPOCH SETTLEMENT
    // ============================================================

    /// @dev Settle the current epoch — process all dirty users' net deltas
    function _settleEpoch(AppStorage storage s) internal {
        uint256 len = s.spotEpochDirtyUsers.length;
        uint256 tokenCount = s.spotTokenList.length;

        for (uint256 i; i < len;) {
            address user = s.spotEpochDirtyUsers[i];
            address vault = s.userVaults[user];

            for (uint256 t; t < tokenCount;) {
                address token = s.spotTokenList[t];
                int256 delta = s.spotEpochNetDelta[user][token];

                if (delta != 0) {
                    if (delta > 0 && vault != address(0)) {
                        // User is owed tokens — transfer from diamond
                        uint256 amount = uint256(delta);
                        uint8 decimals = s.spotTokenDecimals[token];
                        uint256 rawAmount = LibSpotSettlement.denormalize(decimals, amount);
                        if (rawAmount > 0 && s.spotVaultBalances[token] >= rawAmount) {
                            s.spotVaultBalances[token] -= rawAmount;
                            LibSafeERC20.safeTransfer(token, vault, rawAmount);
                        }
                    } else if (delta < 0 && vault != address(0)) {
                        // User owes tokens — lock from TradingAccount
                        uint256 amount = uint256(-delta);
                        uint8 decimals = s.spotTokenDecimals[token];
                        uint256 rawAmount = LibSpotSettlement.denormalize(decimals, amount);
                        if (rawAmount > 0) {
                            ITradingAccount(vault).lockCollateral(token, rawAmount, address(this));
                            s.spotVaultBalances[token] += rawAmount;
                        }
                    }
                    s.spotEpochNetDelta[user][token] = 0;
                }

                unchecked { ++t; }
            }

            s.spotIsEpochDirty[user] = false;
            unchecked { ++i; }
        }

        // Reset dirty users array
        delete s.spotEpochDirtyUsers;

        // Advance epoch
        s.spotEpochCounter++;
        s.spotCurrentEpochStart = block.number;

        emit EpochSettled(s.spotEpochCounter, len, block.number);
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    function _shouldSwitchToBatch(AppStorage storage s, bytes32 _marketId)
        internal
        view
        returns (bool)
    {
        uint256 confidenceThreshold = s.spotBatchModeConfidenceThreshold;
        if (confidenceThreshold > 0) {
            uint256 lastUpdate = s.latestPriceTimestamp[uint256(_marketId)];
            if (lastUpdate > 0 && block.timestamp - lastUpdate > confidenceThreshold) {
                return true;
            }
        }

        uint256 volThreshold = s.spotBatchModeVolThreshold;
        if (volThreshold > 0) {
            if (s.spotVolumeRolling[_marketId] > volThreshold) {
                return true;
            }
        }

        return false;
    }

    function _trackEpochDelta(AppStorage storage s, address _user, address _token, int256 _delta) internal {
        s.spotEpochNetDelta[_user][_token] += _delta;
        if (!s.spotIsEpochDirty[_user]) {
            s.spotIsEpochDirty[_user] = true;
            s.spotEpochDirtyUsers.push(_user);
        }
    }

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

    function _clearQueue(BatchQueue storage queue) internal {
        delete queue.buyOffsets;
        delete queue.buySizes;
        delete queue.buyTraders;
        delete queue.sellOffsets;
        delete queue.sellSizes;
        delete queue.sellTraders;
    }

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
