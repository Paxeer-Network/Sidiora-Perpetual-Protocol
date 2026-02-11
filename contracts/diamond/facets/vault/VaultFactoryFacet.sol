// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {IUserVault} from "../../interfaces/IUserVault.sol";

/// @title VaultFactoryFacet - Deploy per-user UserVault clones
/// @dev Uses EIP-1167 minimal proxy pattern with CREATE2 for deterministic addresses.
contract VaultFactoryFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event VaultCreated(address indexed user, address indexed vault);
    event VaultImplementationUpdated(address indexed oldImpl, address indexed newImpl);

    // ============================================================
    //                     USER FUNCTIONS
    // ============================================================

    /// @notice Create a personal UserVault for the caller
    /// @dev One vault per user. Uses EIP-1167 clone + CREATE2 for deterministic address.
    /// @return vault The address of the newly created vault
    function createVault() external returns (address vault) {
        AppStorage storage s = appStorage();
        require(s.userVaults[msg.sender] == address(0), "VaultFactory: vault already exists");
        require(s.userVaultImplementation != address(0), "VaultFactory: implementation not set");

        // Deploy EIP-1167 minimal proxy clone via CREATE2
        vault = _cloneDeterministic(s.userVaultImplementation, _salt(msg.sender));

        // Initialize the vault
        IUserVault(vault).initialize(msg.sender, address(this));

        // Register in storage
        s.userVaults[msg.sender] = vault;
        s.allVaults.push(vault);

        emit VaultCreated(msg.sender, vault);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the vault address for a user
    /// @param _user The user address
    /// @return The vault address (address(0) if none)
    function getVault(address _user) external view returns (address) {
        return appStorage().userVaults[_user];
    }

    /// @notice Predict the vault address for a user before creation
    /// @param _user The user address
    /// @return The predicted vault address
    function predictVaultAddress(address _user) external view returns (address) {
        AppStorage storage s = appStorage();
        return _predictDeterministicAddress(s.userVaultImplementation, _salt(_user));
    }

    /// @notice Get the current UserVault implementation address
    /// @return The implementation address
    function getUserVaultImplementation() external view returns (address) {
        return appStorage().userVaultImplementation;
    }

    /// @notice Get total number of vaults created
    /// @return The count
    function totalVaults() external view returns (uint256) {
        return appStorage().allVaults.length;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Set the UserVault implementation address
    /// @dev Only callable by diamond owner. Only affects NEW vaults.
    /// @param _implementation The new implementation address
    function setImplementation(address _implementation) external {
        LibDiamond.enforceIsContractOwner();
        require(_implementation != address(0), "VaultFactory: zero implementation");
        AppStorage storage s = appStorage();
        address oldImpl = s.userVaultImplementation;
        s.userVaultImplementation = _implementation;
        emit VaultImplementationUpdated(oldImpl, _implementation);
    }

    // ============================================================
    //              EIP-1167 MINIMAL PROXY (INTERNAL)
    // ============================================================

    /// @dev Deploys an EIP-1167 minimal proxy clone using CREATE2
    function _cloneDeterministic(address _implementation, bytes32 _saltValue) internal returns (address instance) {
        bytes20 targetBytes = bytes20(_implementation);
        assembly {
            // EIP-1167 minimal proxy bytecode
            // 3d602d80600a3d3981f3363d3d373d3d3d363d73{address}5af43d82803e903d91602b57fd5bf3
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), targetBytes)
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create2(0, ptr, 0x37, _saltValue)
        }
        require(instance != address(0), "VaultFactory: clone deployment failed");
    }

    /// @dev Predicts the address of a CREATE2-deployed EIP-1167 clone
    function _predictDeterministicAddress(address _implementation, bytes32 _saltValue) internal view returns (address predicted) {
        bytes20 targetBytes = bytes20(_implementation);
        bytes32 bytecodeHash;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), targetBytes)
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            bytecodeHash := keccak256(ptr, 0x37)
        }
        predicted = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            _saltValue,
            bytecodeHash
        )))));
    }

    /// @dev Generate a deterministic salt from a user address
    function _salt(address _user) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_user));
    }
}
