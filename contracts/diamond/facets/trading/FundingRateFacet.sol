// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, FundingState, MarketOI, VirtualPool, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibMath} from "../../libraries/LibMath.sol";
import {LibTWAP} from "../../libraries/LibTWAP.sol";

/// @title FundingRateFacet - Per-second continuous funding rate
/// @dev Funding accrues every second based on (markTWAP - indexTWAP) / indexTWAP.
///      Settled automatically on every position interaction.
///      Keeper calls updateFundingRate() after each oracle sync to refresh the rate.
contract FundingRateFacet {
    uint256 constant TWAP_WINDOW = 900; // 15-minute TWAP for funding
    uint256 constant SECONDS_PER_DAY = 86400;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event FundingRateUpdated(uint256 indexed marketId, int256 newRatePerSecond, int256 fundingRate24h);

    // ============================================================
    //                   KEEPER FUNCTIONS
    // ============================================================

    /// @notice Update the funding rate for a market (called after oracle sync)
    /// @dev Recalculates the per-second funding rate from mark TWAP vs index TWAP.
    /// @param _marketId The market to update
    function updateFundingRate(uint256 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.KEEPER_ROLE);
        AppStorage storage s = appStorage();

        // First, accrue any pending funding at the OLD rate
        FundingState storage fs = s.fundingStates[_marketId];
        if (fs.lastUpdateTimestamp > 0) {
            uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
            if (elapsed > 0) {
                int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
                fs.cumulativeFundingPerUnitLong += accrued;
                fs.cumulativeFundingPerUnitShort -= accrued;
            }
        }
        fs.lastUpdateTimestamp = block.timestamp;

        // Calculate new funding rate
        // indexTWAP from oracle price history
        uint256 indexTWAP = LibTWAP.calculateTWAP(s.priceHistory[_marketId], TWAP_WINDOW, block.timestamp);
        if (indexTWAP == 0) return;

        // markTWAP from vAMM — use current mark price as proxy
        // (In production, would maintain a separate mark price history)
        VirtualPool storage pool = s.virtualPools[_marketId];
        uint256 markPrice;
        if (pool.baseReserve > 0) {
            markPrice = LibMath.divFp(pool.quoteReserve, pool.baseReserve);
        } else {
            markPrice = indexTWAP; // No vAMM = zero funding
        }

        // fundingRate24h = (markPrice - indexTWAP) / indexTWAP
        // fundingRatePerSecond = fundingRate24h / 86400
        int256 priceDelta = int256(markPrice) - int256(indexTWAP);
        int256 fundingRate24h = LibMath.divFpSigned(priceDelta, int256(indexTWAP));
        int256 ratePerSecond = fundingRate24h / int256(SECONDS_PER_DAY);

        // Apply OI imbalance dampening
        // If one side has much more OI, the minority side gets paid more
        MarketOI storage oi = s.openInterest[_marketId];
        if (oi.longOI > 0 || oi.shortOI > 0) {
            // Scale rate by imbalance ratio to accelerate convergence
            uint256 totalOI = oi.longOI + oi.shortOI;
            if (totalOI > 0) {
                int256 imbalance;
                if (oi.longOI > oi.shortOI) {
                    imbalance = int256((oi.longOI - oi.shortOI) * 1e18 / totalOI);
                } else {
                    imbalance = -int256((oi.shortOI - oi.longOI) * 1e18 / totalOI);
                }
                // Amplify funding rate by imbalance (1 + |imbalance|)
                int256 amplifier = int256(1e18) + (imbalance >= 0 ? imbalance : -imbalance);
                ratePerSecond = LibMath.mulFpSigned(ratePerSecond, amplifier);
            }
        }

        fs.currentFundingRatePerSecond = ratePerSecond;

        emit FundingRateUpdated(_marketId, ratePerSecond, fundingRate24h);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the current funding rate per second for a market
    /// @param _marketId The market ID
    /// @return ratePerSecond The funding rate per second (signed, 18 dec)
    function getCurrentFundingRate(uint256 _marketId) external view returns (int256 ratePerSecond) {
        return appStorage().fundingStates[_marketId].currentFundingRatePerSecond;
    }

    /// @notice Get the annualized funding rate (for display)
    /// @param _marketId The market ID
    /// @return rate24h The 24-hour funding rate (signed, 18 dec)
    function getFundingRate24h(uint256 _marketId) external view returns (int256 rate24h) {
        int256 perSecond = appStorage().fundingStates[_marketId].currentFundingRatePerSecond;
        rate24h = perSecond * int256(SECONDS_PER_DAY);
    }

    /// @notice Get the total accrued funding for a market
    /// @param _marketId The market ID
    /// @return cumulativeLong Cumulative funding per unit for longs
    /// @return cumulativeShort Cumulative funding per unit for shorts
    /// @return lastUpdate Last update timestamp
    function getFundingState(uint256 _marketId) external view returns (
        int256 cumulativeLong,
        int256 cumulativeShort,
        uint256 lastUpdate,
        int256 ratePerSecond
    ) {
        FundingState storage fs = appStorage().fundingStates[_marketId];
        return (
            fs.cumulativeFundingPerUnitLong,
            fs.cumulativeFundingPerUnitShort,
            fs.lastUpdateTimestamp,
            fs.currentFundingRatePerSecond
        );
    }

    /// @notice Calculate the pending (unaccrued) funding for a market
    /// @param _marketId The market ID
    /// @return pendingLong Pending funding per unit for longs (since last update)
    /// @return pendingShort Pending funding per unit for shorts
    function getPendingFunding(uint256 _marketId) external view returns (int256 pendingLong, int256 pendingShort) {
        FundingState storage fs = appStorage().fundingStates[_marketId];
        uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
        if (elapsed == 0) return (0, 0);

        int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
        pendingLong = accrued;
        pendingShort = -accrued;
    }

    /// @notice Get the funding owed/received by a specific position
    /// @param _positionId The position ID
    /// @return fundingPayment Positive = position owes, negative = position receives
    function getPositionFunding(uint256 _positionId) external view returns (int256 fundingPayment) {
        AppStorage storage s = appStorage();
        if (!s.positions[_positionId].active) return 0;

        uint256 marketId = s.positions[_positionId].marketId;
        FundingState storage fs = s.fundingStates[marketId];

        // Calculate current cumulative (including pending)
        uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
        int256 pendingAccrual = fs.currentFundingRatePerSecond * int256(elapsed);

        int256 currentCumulative;
        if (s.positions[_positionId].isLong) {
            currentCumulative = fs.cumulativeFundingPerUnitLong + pendingAccrual;
        } else {
            currentCumulative = fs.cumulativeFundingPerUnitShort - pendingAccrual;
        }

        int256 fundingDelta = currentCumulative - s.positions[_positionId].lastFundingIndex;
        fundingPayment = LibMath.mulFpSigned(int256(s.positions[_positionId].sizeUsd), fundingDelta);
    }
}
