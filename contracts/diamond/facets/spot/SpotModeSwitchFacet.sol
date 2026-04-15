// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, SpotMarket, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title SpotModeSwitchFacet - Autonomous continuous↔batch mode switching
/// @dev Called by keeper every block. Evaluates oracle confidence and volume
///      to determine if a market should switch between CONTINUOUS and BATCH modes.
///      Not a governance toggle — purely data-driven with hysteresis to prevent oscillation.
contract SpotModeSwitchFacet is ISpotEvents {
    uint8 constant MODE_CONTINUOUS = 0;
    uint8 constant MODE_BATCH = 1;
    uint256 constant MIN_BATCH_DURATION = 50; // minimum blocks in batch mode (hysteresis)

    // ============================================================
    //                    KEEPER FUNCTIONS
    // ============================================================

    /// @notice Evaluate and potentially switch a market's trading mode
    /// @dev Called by keeper every block. Switches to BATCH if:
    ///      - Oracle is stale (timestamp gap > maxPriceStaleness)
    ///      - OR volume in recent window exceeds the volume threshold (3σ spike)
    ///      Switches back to CONTINUOUS if conditions normalize AND hysteresis expired.
    /// @param _marketId The spot market identifier
    function evaluateMarketMode(bytes32 _marketId) external {
        AppStorage storage s = appStorage();

        // Allow keeper or spot admin
        require(
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.SPOT_ADMIN_ROLE, msg.sender),
            "SpotModeSwitch: not authorized"
        );

        SpotMarket storage market = s.spotMarkets[_marketId];
        require(market.active, "SpotModeSwitch: market not active");

        uint8 currentMode = market.mode;
        bool shouldBatch = _shouldSwitchToBatch(s, _marketId);

        if (currentMode == MODE_CONTINUOUS && shouldBatch) {
            // Switch to BATCH
            market.mode = MODE_BATCH;
            market.batchModeUntilBlock = block.number + MIN_BATCH_DURATION;
            emit MarketModeChanged(_marketId, MODE_CONTINUOUS, MODE_BATCH, market.batchModeUntilBlock);
        } else if (currentMode == MODE_BATCH && !shouldBatch) {
            // Only switch back if hysteresis period has expired
            if (block.number > market.batchModeUntilBlock) {
                market.mode = MODE_CONTINUOUS;
                emit MarketModeChanged(_marketId, MODE_BATCH, MODE_CONTINUOUS, 0);
            }
        }
    }

    /// @notice Evaluate mode for multiple markets in one call
    /// @param _marketIds Array of spot market identifiers
    function evaluateMarketModeBatch(bytes32[] calldata _marketIds) external {
        AppStorage storage s = appStorage();

        require(
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.SPOT_ADMIN_ROLE, msg.sender),
            "SpotModeSwitch: not authorized"
        );

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

            unchecked { ++i; }
        }
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Set mode switching parameters
    /// @param _volThreshold Volume threshold for batch trigger (absolute value, USD 18 dec)
    /// @param _confidenceThreshold Oracle staleness threshold in seconds (e.g., 30 = stale after 30s)
    function setModeSwitchParams(uint256 _volThreshold, uint256 _confidenceThreshold) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);

        AppStorage storage s = appStorage();
        s.spotBatchModeVolThreshold = _volThreshold;
        s.spotBatchModeConfidenceThreshold = _confidenceThreshold;
    }

    /// @notice Reset rolling volume counter for a market (admin utility)
    /// @param _marketId The spot market identifier
    function resetRollingVolume(bytes32 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        s.spotVolumeRolling[_marketId] = 0;
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get current mode switch parameters
    /// @return volThreshold Volume threshold for batch trigger
    /// @return confidenceThreshold Oracle staleness threshold in seconds
    function getModeSwitchParams()
        external
        view
        returns (uint256 volThreshold, uint256 confidenceThreshold)
    {
        AppStorage storage s = appStorage();
        return (s.spotBatchModeVolThreshold, s.spotBatchModeConfidenceThreshold);
    }

    /// @notice Get the current rolling volume for a market
    /// @param _marketId The spot market identifier
    /// @return volume Current rolling volume
    function getRollingVolume(bytes32 _marketId) external view returns (uint256) {
        return appStorage().spotVolumeRolling[_marketId];
    }

    /// @notice Check whether a market would switch to batch mode now
    /// @param _marketId The spot market identifier
    /// @return shouldBatch True if conditions warrant batch mode
    function wouldSwitchToBatch(bytes32 _marketId) external view returns (bool) {
        AppStorage storage s = appStorage();
        return _shouldSwitchToBatch(s, _marketId);
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    /// @dev Evaluate whether conditions warrant switching to BATCH mode
    ///      Triggers:
    ///      1. Oracle staleness: price timestamp > confidenceThreshold seconds old
    ///      2. Volume spike: rolling volume > volThreshold
    function _shouldSwitchToBatch(AppStorage storage s, bytes32 _marketId)
        internal
        view
        returns (bool)
    {
        // Check oracle staleness (proxy for confidence)
        uint256 confidenceThreshold = s.spotBatchModeConfidenceThreshold;
        if (confidenceThreshold > 0) {
            uint256 lastUpdate = s.latestPriceTimestamp[uint256(_marketId)];
            if (lastUpdate > 0 && block.timestamp - lastUpdate > confidenceThreshold) {
                return true; // Oracle is stale → batch mode
            }
        }

        // Check volume spike
        uint256 volThreshold = s.spotBatchModeVolThreshold;
        if (volThreshold > 0) {
            uint256 currentVolume = s.spotVolumeRolling[_marketId];
            if (currentVolume > volThreshold) {
                return true; // Volume spike → batch mode
            }
        }

        return false;
    }
}
