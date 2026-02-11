// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

/// @title CentralVaultFacet - Protocol-funded central liquidity pool
/// @dev Counterparty to all trades. Protocol-funded only (no external LPs).
///      Network owner deposits/withdraws protocol capital.
contract CentralVaultFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event VaultFunded(address indexed token, uint256 amount, address indexed funder);
    event VaultDefunded(address indexed token, uint256 amount, address indexed to);

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Deposit protocol capital into the central vault
    /// @dev Only callable by accounts with PROTOCOL_FUNDER_ROLE
    /// @param _token The stablecoin address
    /// @param _amount The amount to deposit
    function fundVault(address _token, uint256 _amount) external {
        LibAccessControl.enforceRole(LibAccessControl.PROTOCOL_FUNDER_ROLE);
        require(_amount > 0, "CentralVault: zero amount");
        AppStorage storage s = appStorage();
        require(s.acceptedCollateral[_token], "CentralVault: token not accepted");

        LibReentrancyGuard.nonReentrantBefore();

        LibSafeERC20.safeTransferFrom(_token, msg.sender, address(this), _amount);
        s.vaultBalances[_token] += _amount;

        LibReentrancyGuard.nonReentrantAfter();

        emit VaultFunded(_token, _amount, msg.sender);
    }

    /// @notice Withdraw protocol capital from the central vault
    /// @dev Only callable by accounts with PROTOCOL_FUNDER_ROLE
    /// @param _token The stablecoin address
    /// @param _amount The amount to withdraw
    /// @param _to The recipient address
    function defundVault(address _token, uint256 _amount, address _to) external {
        LibAccessControl.enforceRole(LibAccessControl.PROTOCOL_FUNDER_ROLE);
        require(_amount > 0, "CentralVault: zero amount");
        require(_to != address(0), "CentralVault: zero recipient");
        AppStorage storage s = appStorage();

        LibReentrancyGuard.nonReentrantBefore();

        require(s.vaultBalances[_token] >= _amount, "CentralVault: insufficient balance");
        s.vaultBalances[_token] -= _amount;
        LibSafeERC20.safeTransfer(_token, _to, _amount);

        LibReentrancyGuard.nonReentrantAfter();

        emit VaultDefunded(_token, _amount, _to);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the vault balance for a specific token
    /// @param _token The token address
    /// @return The balance
    function getVaultBalance(address _token) external view returns (uint256) {
        return appStorage().vaultBalances[_token];
    }

    /// @notice Get the utilization ratio of the vault for a token
    /// @dev Utilization = total locked in positions / total vault balance
    /// @param _token The token address
    /// @return utilizationBps Utilization in basis points (0-10000)
    function getUtilization(address _token) external view returns (uint256 utilizationBps) {
        AppStorage storage s = appStorage();
        uint256 balance = s.vaultBalances[_token];
        if (balance == 0) return 0;
        uint256 actualBalance = IERC20(_token).balanceOf(address(this));
        uint256 locked = balance > actualBalance ? balance - actualBalance : 0;
        utilizationBps = (locked * 10000) / balance;
    }
}
