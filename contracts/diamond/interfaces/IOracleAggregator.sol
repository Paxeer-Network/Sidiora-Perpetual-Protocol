// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title IOracleAggregator
/// @notice Interface for the Paxeer VOM (Validator Oracle Module) precompile at 0x903.
///         Provides validator-consensus prices updated every block (sub-second).
/// @dev Reads from x/paxoracle Cosmos SDK module state via precompile.
interface IOracleAggregator {
    /// @notice Get the validator consensus price for a market.
    /// @param marketId The market identifier (bytes32, e.g., keccak256("BTC/USD")).
    /// @return price Median price from validator attestations (18 decimals).
    /// @return quorum Number of validators that attested.
    /// @return timestamp Block number of the oldest attestation in the quorum.
    function getValidatorPrice(bytes32 marketId)
        external
        view
        returns (int256 price, uint256 quorum, uint256 timestamp);

    /// @notice Submit a validator price attestation directly via EVM tx.
    /// @dev Caller must be an active validator.
    /// @param marketId The market identifier.
    /// @param price The attested price (18 decimals).
    /// @param confidence The confidence level (0, 1e18].
    /// @return success True if the submission was stored.
    function submitPrice(bytes32 marketId, int256 price, uint256 confidence)
        external
        returns (bool success);
}
