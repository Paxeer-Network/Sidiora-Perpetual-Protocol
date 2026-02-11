// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {IERC173} from "../../interfaces/IERC173.sol";

/// @title OwnershipFacet - ERC-173 Diamond Ownership
/// @dev Network owner (Paxeer) controls the diamond. No multi-sig or timelock needed.
contract OwnershipFacet is IERC173 {
    /// @notice Get the address of the diamond owner
    /// @return owner_ The owner address
    function owner() external view override returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }

    /// @notice Transfer ownership of the diamond to a new address
    /// @param _newOwner The address of the new owner
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }
}
