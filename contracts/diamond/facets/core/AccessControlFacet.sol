// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";

/// @title AccessControlFacet - Role-based access management
/// @dev Network owner (Paxeer) assigns all admin roles. No multi-sig/timelock.
contract AccessControlFacet {
    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    /// @notice Check if an account has a specific role
    /// @param _role The role identifier
    /// @param _account The account to check
    /// @return True if the account has the role
    function hasRole(bytes32 _role, address _account) external view returns (bool) {
        return LibAccessControl.hasRole(_role, _account);
    }

    /// @notice Get the admin role that controls a given role
    /// @param _role The role to query
    /// @return The admin role bytes32 identifier
    function getRoleAdmin(bytes32 _role) external view returns (bytes32) {
        return LibAccessControl.getRoleAdmin(_role);
    }

    // ============================================================
    //                     ROLE CONSTANTS (VIEW)
    // ============================================================

    function DIAMOND_OWNER_ROLE() external pure returns (bytes32) {
        return LibAccessControl.DIAMOND_OWNER_ROLE;
    }

    function MARKET_ADMIN_ROLE() external pure returns (bytes32) {
        return LibAccessControl.MARKET_ADMIN_ROLE;
    }

    function ORACLE_POSTER_ROLE() external pure returns (bytes32) {
        return LibAccessControl.ORACLE_POSTER_ROLE;
    }

    function KEEPER_ROLE() external pure returns (bytes32) {
        return LibAccessControl.KEEPER_ROLE;
    }

    function INSURANCE_ADMIN_ROLE() external pure returns (bytes32) {
        return LibAccessControl.INSURANCE_ADMIN_ROLE;
    }

    function PAUSER_ROLE() external pure returns (bytes32) {
        return LibAccessControl.PAUSER_ROLE;
    }

    function PROTOCOL_FUNDER_ROLE() external pure returns (bytes32) {
        return LibAccessControl.PROTOCOL_FUNDER_ROLE;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Grant a role to an account
    /// @dev Only callable by the diamond owner or the role's admin
    /// @param _role The role to grant
    /// @param _account The account to receive the role
    function grantRole(bytes32 _role, address _account) external {
        _enforceCanManageRole(_role);
        LibAccessControl.grantRole(_role, _account);
    }

    /// @notice Revoke a role from an account
    /// @dev Only callable by the diamond owner or the role's admin
    /// @param _role The role to revoke
    /// @param _account The account to lose the role
    function revokeRole(bytes32 _role, address _account) external {
        _enforceCanManageRole(_role);
        LibAccessControl.revokeRole(_role, _account);
    }

    /// @notice Renounce a role (caller removes their own role)
    /// @param _role The role to renounce
    function renounceRole(bytes32 _role) external {
        LibAccessControl.revokeRole(_role, msg.sender);
    }

    /// @notice Set the admin role for a given role
    /// @dev Only callable by the diamond owner
    /// @param _role The role to configure
    /// @param _adminRole The new admin role
    function setRoleAdmin(bytes32 _role, bytes32 _adminRole) external {
        LibDiamond.enforceIsContractOwner();
        LibAccessControl.setRoleAdmin(_role, _adminRole);
    }

    // ============================================================
    //                    INTERNAL HELPERS
    // ============================================================

    /// @dev Diamond owner can always manage roles. Otherwise, must have the role's admin role.
    function _enforceCanManageRole(bytes32 _role) internal view {
        if (msg.sender == LibDiamond.contractOwner()) {
            return; // owner can manage all roles
        }
        LibAccessControl.enforceRoleAdmin(_role);
    }
}
