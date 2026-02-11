// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../storage/AppStorage.sol";

/// @title LibAccessControl - Role-based access control helpers
/// @dev Reads/writes roles from AppStorage. No external dependencies.
library LibAccessControl {
    // ============================================================
    //                        ROLE CONSTANTS
    // ============================================================

    bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 constant DIAMOND_OWNER_ROLE = keccak256("DIAMOND_OWNER");
    bytes32 constant MARKET_ADMIN_ROLE = keccak256("MARKET_ADMIN");
    bytes32 constant ORACLE_POSTER_ROLE = keccak256("ORACLE_POSTER");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER");
    bytes32 constant INSURANCE_ADMIN_ROLE = keccak256("INSURANCE_ADMIN");
    bytes32 constant PAUSER_ROLE = keccak256("PAUSER");
    bytes32 constant PROTOCOL_FUNDER_ROLE = keccak256("PROTOCOL_FUNDER");

    // ============================================================
    //                          EVENTS
    // ============================================================

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    // ============================================================
    //                        CHECKS
    // ============================================================

    /// @notice Check if an account has a specific role
    function hasRole(bytes32 _role, address _account) internal view returns (bool) {
        AppStorage storage s = appStorage();
        return s.roles[_role][_account];
    }

    /// @notice Revert if the caller does not have the specified role
    function enforceRole(bytes32 _role) internal view {
        require(hasRole(_role, msg.sender), "LibAccessControl: account is missing role");
    }

    /// @notice Get the admin role for a given role
    function getRoleAdmin(bytes32 _role) internal view returns (bytes32) {
        AppStorage storage s = appStorage();
        return s.roleAdmins[_role];
    }

    // ============================================================
    //                       MUTATIONS
    // ============================================================

    /// @notice Grant a role to an account
    function grantRole(bytes32 _role, address _account) internal {
        if (!hasRole(_role, _account)) {
            AppStorage storage s = appStorage();
            s.roles[_role][_account] = true;
            emit RoleGranted(_role, _account, msg.sender);
        }
    }

    /// @notice Revoke a role from an account
    function revokeRole(bytes32 _role, address _account) internal {
        if (hasRole(_role, _account)) {
            AppStorage storage s = appStorage();
            s.roles[_role][_account] = false;
            emit RoleRevoked(_role, _account, msg.sender);
        }
    }

    /// @notice Set the admin role for a given role
    function setRoleAdmin(bytes32 _role, bytes32 _adminRole) internal {
        AppStorage storage s = appStorage();
        bytes32 previousAdminRole = s.roleAdmins[_role];
        s.roleAdmins[_role] = _adminRole;
        emit RoleAdminChanged(_role, previousAdminRole, _adminRole);
    }

    /// @notice Enforce that caller has the admin role for the given role
    function enforceRoleAdmin(bytes32 _role) internal view {
        bytes32 adminRole = getRoleAdmin(_role);
        require(hasRole(adminRole, msg.sender), "LibAccessControl: must have admin role");
    }
}
