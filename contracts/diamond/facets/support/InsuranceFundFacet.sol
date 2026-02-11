// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";

/// @title InsuranceFundFacet - Insurance fund management and ADL backstop
/// @dev Collects: portion of liquidation fees + trading fees.
///      Backstop for socialized losses via auto-deleveraging (ADL).
contract InsuranceFundFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event InsuranceWithdrawn(address indexed token, uint256 amount, address indexed to);
    event ADLThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the insurance fund balance for a specific token
    /// @param _token The token address
    /// @return The balance
    function getInsuranceBalance(address _token) external view returns (uint256) {
        return appStorage().insuranceBalances[_token];
    }

    /// @notice Get the ADL threshold
    /// @dev When insurance balance drops below this, ADL is triggered
    /// @return The threshold in USD (18 dec)
    function getADLThreshold() external view returns (uint256) {
        return appStorage().adlThreshold;
    }

    /// @notice Check if ADL should be triggered for a token
    /// @param _token The collateral token to check
    /// @return shouldADL True if insurance fund is below ADL threshold
    function shouldTriggerADL(address _token) external view returns (bool shouldADL) {
        AppStorage storage s = appStorage();
        uint8 decimals = s.collateralDecimals[_token];
        uint256 balance = s.insuranceBalances[_token];

        // Normalize to 18 dec for comparison with threshold
        uint256 balanceUsd;
        if (decimals < 18) {
            balanceUsd = balance * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            balanceUsd = balance / (10 ** (decimals - 18));
        } else {
            balanceUsd = balance;
        }

        shouldADL = balanceUsd < s.adlThreshold;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Withdraw from the insurance fund
    /// @dev Only callable by accounts with INSURANCE_ADMIN_ROLE
    /// @param _token The token to withdraw
    /// @param _amount The amount to withdraw
    /// @param _to The recipient
    function withdrawInsurance(address _token, uint256 _amount, address _to) external {
        LibAccessControl.enforceRole(LibAccessControl.INSURANCE_ADMIN_ROLE);
        require(_amount > 0, "InsuranceFund: zero amount");
        require(_to != address(0), "InsuranceFund: zero recipient");

        AppStorage storage s = appStorage();
        require(s.insuranceBalances[_token] >= _amount, "InsuranceFund: insufficient balance");

        s.insuranceBalances[_token] -= _amount;

        // Transfer from central vault balance
        s.vaultBalances[_token] = s.vaultBalances[_token] > _amount
            ? s.vaultBalances[_token] - _amount
            : 0;
        LibSafeERC20.safeTransfer(_token, _to, _amount);

        emit InsuranceWithdrawn(_token, _amount, _to);
    }

    /// @notice Set the ADL threshold
    /// @param _threshold New threshold in USD (18 dec)
    function setADLThreshold(uint256 _threshold) external {
        LibAccessControl.enforceRole(LibAccessControl.INSURANCE_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        uint256 old = s.adlThreshold;
        s.adlThreshold = _threshold;
        emit ADLThresholdUpdated(old, _threshold);
    }
}
