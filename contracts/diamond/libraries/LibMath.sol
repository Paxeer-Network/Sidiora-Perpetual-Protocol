// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title LibMath - Fixed-point arithmetic and safe math helpers
/// @dev All prices and values use 18-decimal fixed-point (1e18 = 1.0).
///      No external dependencies.
library LibMath {
    uint256 constant PRECISION = 1e18;
    uint256 constant BPS_PRECISION = 10000;
    int256 constant SIGNED_PRECISION = 1e18;

    /// @notice Multiply two 18-decimal fixed-point numbers
    /// @param a First operand (18 dec)
    /// @param b Second operand (18 dec)
    /// @return result (18 dec)
    function mulFp(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / PRECISION;
    }

    /// @notice Divide two 18-decimal fixed-point numbers
    /// @param a Numerator (18 dec)
    /// @param b Denominator (18 dec)
    /// @return result (18 dec)
    function divFp(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "LibMath: division by zero");
        return (a * PRECISION) / b;
    }

    /// @notice Multiply then divide with full precision (no intermediate overflow for reasonable values)
    /// @param a First multiplier
    /// @param b Second multiplier
    /// @param denominator Divisor
    /// @return result
    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        require(denominator > 0, "LibMath: mulDiv division by zero");
        // Use assembly for full 512-bit intermediate to prevent overflow
        uint256 prod0;
        uint256 prod1;
        assembly {
            let mm := mulmod(a, b, not(0))
            prod0 := mul(a, b)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }

        // If no overflow, simple division
        if (prod1 == 0) {
            return prod0 / denominator;
        }

        require(denominator > prod1, "LibMath: mulDiv overflow");

        uint256 remainder;
        assembly {
            remainder := mulmod(a, b, denominator)
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }

        uint256 twos = denominator & (~denominator + 1);
        assembly {
            denominator := div(denominator, twos)
            prod0 := div(prod0, twos)
            twos := add(div(sub(0, twos), twos), 1)
        }
        prod0 |= prod1 * twos;

        uint256 inverse = (3 * denominator) ^ 2;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;

        result = prod0 * inverse;
    }

    /// @notice Signed multiply for fixed-point
    function mulFpSigned(int256 a, int256 b) internal pure returns (int256) {
        return (a * b) / SIGNED_PRECISION;
    }

    /// @notice Signed divide for fixed-point
    function divFpSigned(int256 a, int256 b) internal pure returns (int256) {
        require(b != 0, "LibMath: signed division by zero");
        return (a * SIGNED_PRECISION) / b;
    }

    /// @notice Convert basis points to 18-decimal fraction
    /// @param bps Basis points (e.g., 50 = 0.5%)
    /// @return 18-decimal fraction (e.g., 50 → 0.005e18)
    function bpsToFp(uint256 bps) internal pure returns (uint256) {
        return (bps * PRECISION) / BPS_PRECISION;
    }

    /// @notice Safe absolute value for int256
    function abs(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    /// @notice Min of two uint256
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /// @notice Max of two uint256
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /// @notice Safe cast from uint256 to int256
    function toInt256(uint256 value) internal pure returns (int256) {
        require(value <= uint256(type(int256).max), "LibMath: toInt256 overflow");
        return int256(value);
    }

    /// @notice Safe cast from int256 to uint256
    function toUint256(int256 value) internal pure returns (uint256) {
        require(value >= 0, "LibMath: toUint256 negative");
        return uint256(value);
    }
}
