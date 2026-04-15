// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../storage/AppStorage.sol";

/// @title LibBorrowingFee - Per-second borrowing fee accrual for open positions
/// @dev Borrowing fee = time-cost of keeping leveraged exposure open.
///      Charged proportionally to position size, accrued every second.
///      Settled (deducted from collateral) on any position interaction or at close.
library LibBorrowingFee {
    /// @notice Initialize borrowing fee tracking for a new position
    /// @param _positionId The new position's ID
    function initBorrowing(uint256 _positionId) internal {
        AppStorage storage s = appStorage();
        s.lastBorrowingUpdate[_positionId] = block.timestamp;
        s.accruedBorrowingFee[_positionId] = 0;
    }

    /// @notice Accrue pending borrowing fee for a position (does NOT deduct from collateral)
    /// @param _positionId The position ID
    /// @param _sizeUsd Current position size in USD (18 dec)
    /// @return accruedUsd Total accrued borrowing fee in USD (18 dec)
    function accrueBorrowingFee(uint256 _positionId, uint256 _sizeUsd) internal returns (uint256 accruedUsd) {
        AppStorage storage s = appStorage();
        uint256 rate = s.borrowingFeeRatePerSecond;
        if (rate == 0) return s.accruedBorrowingFee[_positionId];

        uint256 lastUpdate = s.lastBorrowingUpdate[_positionId];
        if (lastUpdate == 0) {
            s.lastBorrowingUpdate[_positionId] = block.timestamp;
            return 0;
        }

        uint256 elapsed = block.timestamp - lastUpdate;
        if (elapsed > 0) {
            // fee = sizeUsd * rate * elapsed / 1e18
            uint256 newFee = (_sizeUsd * rate / 1e18) * elapsed;
            s.accruedBorrowingFee[_positionId] += newFee;
            s.lastBorrowingUpdate[_positionId] = block.timestamp;
        }

        accruedUsd = s.accruedBorrowingFee[_positionId];
    }

    /// @notice Get the total accrued borrowing fee (view-only, no state mutation)
    /// @param _positionId The position ID
    /// @param _sizeUsd Current position size in USD (18 dec)
    /// @return accruedUsd Total accrued borrowing fee in USD (18 dec)
    function getPendingBorrowingFee(uint256 _positionId, uint256 _sizeUsd) internal view returns (uint256 accruedUsd) {
        AppStorage storage s = appStorage();
        uint256 rate = s.borrowingFeeRatePerSecond;
        accruedUsd = s.accruedBorrowingFee[_positionId];
        if (rate == 0) return accruedUsd;

        uint256 lastUpdate = s.lastBorrowingUpdate[_positionId];
        if (lastUpdate == 0) return 0;

        uint256 elapsed = block.timestamp - lastUpdate;
        if (elapsed > 0) {
            accruedUsd += (_sizeUsd * rate / 1e18) * elapsed;
        }
    }

    /// @notice Reset accrued fee after settlement (called after deducting from collateral/payout)
    /// @param _positionId The position ID
    function resetAccrued(uint256 _positionId) internal {
        AppStorage storage s = appStorage();
        s.accruedBorrowingFee[_positionId] = 0;
        s.lastBorrowingUpdate[_positionId] = block.timestamp;
    }

    /// @notice Clear borrowing tracking for a closed position
    /// @param _positionId The position ID
    function clearBorrowing(uint256 _positionId) internal {
        AppStorage storage s = appStorage();
        s.accruedBorrowingFee[_positionId] = 0;
        s.lastBorrowingUpdate[_positionId] = 0;
    }
}
