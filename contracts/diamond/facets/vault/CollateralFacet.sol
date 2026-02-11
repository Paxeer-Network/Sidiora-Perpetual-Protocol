// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

/// @title CollateralFacet - Multi-stablecoin whitelist and valuation
/// @dev Manages which stablecoins are accepted as collateral.
///      USD-equivalent valuation will use oracle prices (not hardcoded $1)
///      to handle depeg scenarios.
contract CollateralFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event CollateralAdded(address indexed token, uint8 decimals);
    event CollateralRemoved(address indexed token);

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Add a stablecoin to the accepted collateral whitelist
    /// @dev Only callable by accounts with MARKET_ADMIN_ROLE
    /// @param _token The ERC20 stablecoin address
    function addCollateral(address _token) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_token != address(0), "CollateralFacet: zero address");
        AppStorage storage s = appStorage();
        require(!s.acceptedCollateral[_token], "CollateralFacet: already accepted");

        uint8 decimals = IERC20(_token).decimals();
        s.acceptedCollateral[_token] = true;
        s.collateralDecimals[_token] = decimals;
        s.collateralTokens.push(_token);

        emit CollateralAdded(_token, decimals);
    }

    /// @notice Remove a stablecoin from the accepted collateral whitelist
    /// @dev Only callable by accounts with MARKET_ADMIN_ROLE.
    ///      Does NOT affect existing positions using this collateral.
    /// @param _token The ERC20 stablecoin address
    function removeCollateral(address _token) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(s.acceptedCollateral[_token], "CollateralFacet: not accepted");

        s.acceptedCollateral[_token] = false;

        // Remove from array (swap with last, pop)
        uint256 len = s.collateralTokens.length;
        for (uint256 i; i < len; i++) {
            if (s.collateralTokens[i] == _token) {
                s.collateralTokens[i] = s.collateralTokens[len - 1];
                s.collateralTokens.pop();
                break;
            }
        }

        emit CollateralRemoved(_token);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Check if a token is accepted as collateral
    /// @param _token The token address
    /// @return True if accepted
    function isAcceptedCollateral(address _token) external view returns (bool) {
        return appStorage().acceptedCollateral[_token];
    }

    /// @notice Get the USD value of a collateral amount
    /// @dev For now, assumes 1:1 USD peg. Will integrate oracle pricing for depeg protection.
    /// @param _token The collateral token
    /// @param _amount The raw token amount
    /// @return valueUsd The USD value in 18 decimals
    function getCollateralValue(address _token, uint256 _amount) external view returns (uint256 valueUsd) {
        AppStorage storage s = appStorage();
        require(s.acceptedCollateral[_token], "CollateralFacet: not accepted");
        uint8 decimals = s.collateralDecimals[_token];
        // Normalize to 18 decimals (e.g., USDC has 6 decimals → multiply by 1e12)
        if (decimals < 18) {
            valueUsd = _amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            valueUsd = _amount / (10 ** (decimals - 18));
        } else {
            valueUsd = _amount;
        }
        // TODO: Multiply by oracle price for depeg protection
        // valueUsd = (valueUsd * oraclePrice) / 1e18;
    }

    /// @notice Get the list of all accepted collateral tokens
    /// @return Array of token addresses
    function getCollateralTokens() external view returns (address[] memory) {
        return appStorage().collateralTokens;
    }

    /// @notice Get the decimals for a collateral token
    /// @param _token The token address
    /// @return The decimals
    function getCollateralDecimals(address _token) external view returns (uint8) {
        return appStorage().collateralDecimals[_token];
    }
}
