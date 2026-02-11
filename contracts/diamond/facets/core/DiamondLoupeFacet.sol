// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {IDiamondLoupe} from "../../interfaces/IDiamondLoupe.sol";
import {IERC165} from "../../interfaces/IERC165.sol";

/// @title DiamondLoupeFacet - EIP-2535 Diamond Introspection
/// @dev Provides functions to inspect which facets and function selectors
///      are registered in the diamond. Also implements ERC-165.
contract DiamondLoupeFacet is IDiamondLoupe, IERC165 {
    /// @notice Gets all facet addresses and their four byte function selectors
    /// @return facets_ Array of Facet structs
    function facets() external view override returns (Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 numFacets = ds.facetAddresses.length;
        facets_ = new Facet[](numFacets);
        for (uint256 i; i < numFacets; i++) {
            address facetAddress_ = ds.facetAddresses[i];
            facets_[i].facetAddress = facetAddress_;
            facets_[i].functionSelectors = ds.facetFunctionSelectors[facetAddress_].functionSelectors;
        }
    }

    /// @notice Gets all the function selectors provided by a facet
    /// @param _facet The facet address
    /// @return facetFunctionSelectors_ Array of function selectors
    function facetFunctionSelectors(address _facet)
        external
        view
        override
        returns (bytes4[] memory facetFunctionSelectors_)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetFunctionSelectors_ = ds.facetFunctionSelectors[_facet].functionSelectors;
    }

    /// @notice Get all the facet addresses used by a diamond
    /// @return facetAddresses_ Array of facet addresses
    function facetAddresses() external view override returns (address[] memory facetAddresses_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetAddresses_ = ds.facetAddresses;
    }

    /// @notice Gets the facet that supports the given selector
    /// @dev If facet is not found return address(0)
    /// @param _functionSelector The function selector
    /// @return facetAddress_ The facet address
    function facetAddress(bytes4 _functionSelector)
        external
        view
        override
        returns (address facetAddress_)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facetAddress_ = ds.selectorToFacetAndPosition[_functionSelector].facetAddress;
    }

    /// @notice Query if a contract implements an interface (ERC-165)
    /// @param _interfaceId The interface identifier
    /// @return `true` if the contract implements `_interfaceId`
    function supportsInterface(bytes4 _interfaceId) external view override returns (bool) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.supportedInterfaces[_interfaceId];
    }
}
