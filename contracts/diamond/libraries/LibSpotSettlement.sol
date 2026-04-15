// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../storage/AppStorage.sol";

/// @title LibSpotSettlement - Virtual balance arithmetic and epoch helpers
/// @dev Internal library used by spot facets. All state reads/writes through AppStorage.
library LibSpotSettlement {
    // ============================================================
    //                    VIRTUAL BALANCE OPS
    // ============================================================

    /// @notice Credit virtual balance for a user/token pair
    /// @param _user User address
    /// @param _token Token address
    /// @param _amount Normalized 18-decimal signed amount (positive = credit)
    function creditVirtualBalance(address _user, address _token, int256 _amount) internal {
        AppStorage storage s = appStorage();
        s.spotVirtualBalances[_user][_token] += _amount;
    }

    /// @notice Debit virtual balance for a user/token pair
    /// @param _user User address
    /// @param _token Token address
    /// @param _amount Normalized 18-decimal signed amount (positive = debit)
    function debitVirtualBalance(address _user, address _token, int256 _amount) internal {
        AppStorage storage s = appStorage();
        s.spotVirtualBalances[_user][_token] -= _amount;
    }

    /// @notice Record a trade's effect on virtual balances (buyer gets base, pays quote; seller opposite)
    /// @param _buyer Buyer address
    /// @param _seller Seller address
    /// @param _baseToken Base token address
    /// @param _quoteToken Quote token address
    /// @param _baseAmount Base amount (normalized 18 dec)
    /// @param _quoteAmount Quote amount (normalized 18 dec)
    function recordTrade(
        address _buyer,
        address _seller,
        address _baseToken,
        address _quoteToken,
        int256 _baseAmount,
        int256 _quoteAmount
    ) internal {
        AppStorage storage s = appStorage();

        // Buyer: +base, -quote
        s.spotVirtualBalances[_buyer][_baseToken] += _baseAmount;
        s.spotVirtualBalances[_buyer][_quoteToken] -= _quoteAmount;

        // Seller: -base, +quote
        s.spotVirtualBalances[_seller][_baseToken] -= _baseAmount;
        s.spotVirtualBalances[_seller][_quoteToken] += _quoteAmount;

        // Track epoch net deltas for lazy netting
        s.spotEpochNetDelta[_buyer][_baseToken] += _baseAmount;
        s.spotEpochNetDelta[_buyer][_quoteToken] -= _quoteAmount;
        s.spotEpochNetDelta[_seller][_baseToken] -= _baseAmount;
        s.spotEpochNetDelta[_seller][_quoteToken] += _quoteAmount;

        // Mark both users as dirty for epoch settlement
        _markDirty(s, _buyer);
        _markDirty(s, _seller);
    }

    // ============================================================
    //                    EPOCH HELPERS
    // ============================================================

    /// @notice Check if the current epoch has ended
    function isEpochReady() internal view returns (bool) {
        AppStorage storage s = appStorage();
        return block.number >= s.spotCurrentEpochStart + s.spotEpochLength;
    }

    /// @notice Get blocks remaining until epoch end
    function blocksUntilEpoch() internal view returns (uint256) {
        AppStorage storage s = appStorage();
        uint256 epochEnd = s.spotCurrentEpochStart + s.spotEpochLength;
        if (block.number >= epochEnd) return 0;
        return epochEnd - block.number;
    }

    // ============================================================
    //                   NORMALIZATION
    // ============================================================

    /// @notice Normalize raw token amount to 18-decimal int256
    function normalizeToInt(uint8 _decimals, uint256 _amount) internal pure returns (int256) {
        if (_decimals < 18) {
            return int256(_amount * (10 ** (18 - _decimals)));
        } else if (_decimals > 18) {
            return int256(_amount / (10 ** (_decimals - 18)));
        }
        return int256(_amount);
    }

    /// @notice Denormalize 18-decimal amount back to raw token decimals
    function denormalize(uint8 _decimals, uint256 _amount18) internal pure returns (uint256) {
        if (_decimals < 18) {
            return _amount18 / (10 ** (18 - _decimals));
        } else if (_decimals > 18) {
            return _amount18 * (10 ** (_decimals - 18));
        }
        return _amount18;
    }

    // ============================================================
    //                   INTERNAL
    // ============================================================

    /// @dev Mark a user as having pending epoch deltas
    function _markDirty(AppStorage storage s, address _user) internal {
        if (!s.spotIsEpochDirty[_user]) {
            s.spotIsEpochDirty[_user] = true;
            s.spotEpochDirtyUsers.push(_user);
        }
    }
}
