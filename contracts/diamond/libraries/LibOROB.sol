// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title LibOROB - Oracle-Relative Order Book offset resolution
/// @dev Replaces IOROBResolver precompile (0x901). Pure math, no external calls.
///      Orders store int16 offsetBps (2 bytes) instead of uint256 price (32 bytes).
///      Prices are resolved against the current oracle price at match time.
library LibOROB {
    int256 internal constant BPS_BASE = 10_000;

    /// @notice Resolve a basis-point offset to an absolute price
    /// @param oraclePrice Current oracle price (18 decimals, signed)
    /// @param offsetBps Signed basis-point offset from oracle (-10000 to +10000)
    ///                  Negative = below oracle (buy side), Positive = above oracle (sell side)
    /// @return absolutePrice The resolved absolute price (18 decimals)
    function resolveOffset(int256 oraclePrice, int16 offsetBps)
        internal
        pure
        returns (int256 absolutePrice)
    {
        require(oraclePrice > 0, "LibOROB: oracle price must be positive");
        absolutePrice = oraclePrice * (BPS_BASE + int256(offsetBps)) / BPS_BASE;
        require(absolutePrice > 0, "LibOROB: resolved price must be positive");
    }

    /// @notice Batch-resolve multiple offsets in one call
    /// @param oraclePrice Current oracle price (18 decimals)
    /// @param offsets Array of signed basis-point offsets
    /// @return prices Array of resolved absolute prices (18 decimals)
    function resolveOffsetBatch(int256 oraclePrice, int16[] memory offsets)
        internal
        pure
        returns (int256[] memory prices)
    {
        require(oraclePrice > 0, "LibOROB: oracle price must be positive");
        uint256 len = offsets.length;
        prices = new int256[](len);
        for (uint256 i; i < len;) {
            int256 p = oraclePrice * (BPS_BASE + int256(offsets[i])) / BPS_BASE;
            require(p > 0, "LibOROB: resolved price must be positive");
            prices[i] = p;
            unchecked { ++i; }
        }
    }

    /// @notice Convert an absolute price back to the nearest bps offset
    /// @param oraclePrice Current oracle price (18 decimals)
    /// @param absolutePrice The absolute price to convert (18 decimals)
    /// @return offsetBps The nearest basis-point offset
    function toOffset(int256 oraclePrice, int256 absolutePrice)
        internal
        pure
        returns (int16 offsetBps)
    {
        require(oraclePrice > 0, "LibOROB: oracle price must be positive");
        int256 offset = ((absolutePrice - oraclePrice) * BPS_BASE) / oraclePrice;
        require(offset > -10000 && offset <= 10000, "LibOROB: offset overflow");
        offsetBps = int16(offset);
    }
}
