// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title PoFQFacet - Proof-of-Fill-Quality reputation reads and admin
/// @dev Exposes trader and vault PoFQ scores. Scores are updated internally
///      by SpotOrderBookFacet, SpotBatchAuctionFacet, and PLVRegistryFacet.
///      Admin can configure decay rate and minimum spread for anti-gaming.
contract PoFQFacet is ISpotEvents {
    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @notice Get PoFQ score for a trader
    /// @param _trader Trader address
    /// @return score Current rolling PoFQ score (18 decimals, 0 = worst, 1e18 = perfect)
    /// @return weight Accumulated volume weight (higher = more data points)
    function getTraderPoFQ(address _trader) external view returns (uint256 score, uint256 weight) {
        AppStorage storage s = appStorage();
        return (s.spotPoFQScores[_trader], s.spotPoFQWeights[_trader]);
    }

    /// @notice Get PoFQ score for a PLV vault
    /// @param _vault Vault address
    /// @return score Current rolling PoFQ score (18 decimals)
    /// @return weight Accumulated volume weight
    function getVaultPoFQ(address _vault) external view returns (uint256 score, uint256 weight) {
        AppStorage storage s = appStorage();
        return (s.plvPoFQScores[_vault], s.plvPoFQWeights[_vault]);
    }

    /// @notice Get the current PoFQ decay rate
    /// @return decayBps Decay rate in basis points (e.g., 100 = 1% per update)
    function getPoFQDecayRate() external view returns (uint16) {
        return appStorage().spotPoFQDecayBps;
    }

    /// @notice Get the current minimum spread in bps
    /// @return minSpreadBps Minimum absolute offset required for orders (anti-wash)
    function getMinSpreadBps() external view returns (uint16) {
        return appStorage().spotMinSpreadBps;
    }

    /// @notice Get fee tier info for a trader
    /// @param _trader Trader address
    /// @return tier Current fee tier (0=standard, 1=P75, 2=P90, 3=P99)
    /// @return volume30d Rolling 30-day volume (USD 18 dec)
    /// @return rebateBps Rebate basis points for the trader's current tier
    function getTraderFeeTier(address _trader)
        external
        view
        returns (uint8 tier, uint256 volume30d, uint256 rebateBps)
    {
        AppStorage storage s = appStorage();
        tier = s.spotFeeTier[_trader];
        volume30d = s.spotTraderVolume30d[_trader];
        rebateBps = s.spotFeeTierRebateBps[tier];
    }

    /// @notice Get fee tier thresholds and rebates
    /// @return thresholds Array of 4 volume thresholds (USD 18 dec)
    /// @return rebates Array of 4 rebate bps values
    function getFeeTierConfig()
        external
        view
        returns (uint256[4] memory thresholds, uint256[4] memory rebates)
    {
        AppStorage storage s = appStorage();
        return (s.spotFeeTierThresholds, s.spotFeeTierRebateBps);
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Set the PoFQ score decay rate
    /// @param _decayBps Decay rate in basis points (e.g., 100 = 1% per update)
    function setPoFQDecayRate(uint16 _decayBps) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_decayBps <= 5000, "PoFQ: decay too high"); // max 50% per update
        appStorage().spotPoFQDecayBps = _decayBps;
    }

    /// @notice Set the minimum spread in bps (anti-wash trading)
    /// @param _minSpreadBps Minimum absolute offset required for limit orders
    function setMinSpreadBps(uint16 _minSpreadBps) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_minSpreadBps <= 1000, "PoFQ: min spread too high"); // max 10%
        appStorage().spotMinSpreadBps = _minSpreadBps;
    }

    /// @notice Set fee tier thresholds (updated periodically by keeper/indexer)
    /// @param _thresholds Array of 4 volume thresholds [standard, P75, P90, P99] (USD 18 dec)
    function setFeeTierThresholds(uint256[4] calldata _thresholds) external {
        require(
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.SPOT_ADMIN_ROLE, msg.sender),
            "PoFQ: not authorized"
        );
        appStorage().spotFeeTierThresholds = _thresholds;
    }

    /// @notice Set fee tier rebate bps
    /// @param _rebates Array of 4 rebate values in bps [standard, P75, P90, P99]
    function setFeeTierRebates(uint256[4] calldata _rebates) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        appStorage().spotFeeTierRebateBps = _rebates;
    }

    /// @notice Update a trader's fee tier based on their volume
    /// @dev Typically called by keeper after computing volume percentiles off-chain
    /// @param _trader Trader address
    /// @param _tier New fee tier (0-3)
    function updateTraderFeeTier(address _trader, uint8 _tier) external {
        require(
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.SPOT_ADMIN_ROLE, msg.sender),
            "PoFQ: not authorized"
        );
        require(_tier <= 3, "PoFQ: invalid tier");
        appStorage().spotFeeTier[_trader] = _tier;
    }

    /// @notice Batch update fee tiers for multiple traders
    /// @param _traders Array of trader addresses
    /// @param _tiers Array of corresponding fee tiers
    function batchUpdateFeeTiers(address[] calldata _traders, uint8[] calldata _tiers) external {
        require(
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.SPOT_ADMIN_ROLE, msg.sender),
            "PoFQ: not authorized"
        );
        require(_traders.length == _tiers.length, "PoFQ: length mismatch");

        AppStorage storage s = appStorage();
        for (uint256 i; i < _traders.length;) {
            require(_tiers[i] <= 3, "PoFQ: invalid tier");
            s.spotFeeTier[_traders[i]] = _tiers[i];
            unchecked { ++i; }
        }
    }
}
