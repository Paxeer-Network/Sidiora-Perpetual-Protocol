// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title IUserVault - Per-user collateral vault interface
interface IUserVault {
    /// @notice Initialize the vault (called once by VaultFactory via clone)
    /// @param _owner The user who owns this vault
    /// @param _diamond The diamond contract address (authorized caller)
    function initialize(address _owner, address _diamond) external;

    /// @notice Deposit stablecoins into the vault
    /// @param _token The ERC20 token address
    /// @param _amount The amount to deposit
    function deposit(address _token, uint256 _amount) external;

    /// @notice Withdraw idle (unlocked) stablecoins from the vault
    /// @param _token The ERC20 token address
    /// @param _amount The amount to withdraw
    function withdraw(address _token, uint256 _amount) external;

    /// @notice Lock collateral for a trade — transfers from vault to central vault
    /// @dev Only callable by the diamond contract
    /// @param _token The ERC20 token address
    /// @param _amount The amount to lock
    /// @param _centralVault The central vault address to transfer to
    function lockCollateral(address _token, uint256 _amount, address _centralVault) external;

    /// @notice Receive collateral back from central vault after trade close
    /// @dev Only callable by the diamond contract
    /// @param _token The ERC20 token address
    /// @param _amount The amount received
    function receiveCollateral(address _token, uint256 _amount) external;

    /// @notice Emergency withdraw all idle funds for a given token
    /// @dev Always available to the vault owner, even if protocol is paused
    /// @param _token The ERC20 token address
    function emergencyWithdraw(address _token) external;

    /// @notice Get available (unlocked) balance for a token
    /// @param _token The ERC20 token address
    /// @return The available balance
    function getBalance(address _token) external view returns (uint256);

    /// @notice Get total locked balance across all positions
    /// @param _token The ERC20 token address
    /// @return The locked balance
    function getLockedBalance(address _token) external view returns (uint256);

    /// @notice Get the vault owner address
    /// @return The owner address
    function vaultOwner() external view returns (address);

    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);
    event CollateralLocked(address indexed token, uint256 amount);
    event CollateralReleased(address indexed token, uint256 amount);
    event EmergencyWithdrawn(address indexed token, uint256 amount);
}
