// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibPoFQ} from "../../libraries/LibPoFQ.sol";
import {ILiquidityVault} from "../../interfaces/ILiquidityVault.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title PLVRegistryFacet - Programmable Liquidity Vault registration and querying
/// @dev Admin registers external PLV contracts that implement ILiquidityVault.
///      During spot matching, unfilled remainder is routed to PLVs sorted by PoFQ score.
///      PLVs compete on execution quality — higher scores get priority routing.
contract PLVRegistryFacet is ISpotEvents {
    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Register a PLV (must implement ILiquidityVault)
    /// @param _vault Address of the PLV contract
    function registerPLV(address _vault) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_vault != address(0), "PLVRegistry: zero address");

        AppStorage storage s = appStorage();
        require(!s.isPLVRegistered[_vault], "PLVRegistry: already registered");

        s.isPLVRegistered[_vault] = true;
        s.registeredPLVs.push(_vault);

        emit PLVRegistered(_vault);
    }

    /// @notice Deregister a PLV
    /// @param _vault Address of the PLV contract to remove
    function deregisterPLV(address _vault) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);

        AppStorage storage s = appStorage();
        require(s.isPLVRegistered[_vault], "PLVRegistry: not registered");

        s.isPLVRegistered[_vault] = false;

        // Swap-and-pop removal from array
        uint256 len = s.registeredPLVs.length;
        for (uint256 i; i < len;) {
            if (s.registeredPLVs[i] == _vault) {
                s.registeredPLVs[i] = s.registeredPLVs[len - 1];
                s.registeredPLVs.pop();
                break;
            }
            unchecked { ++i; }
        }

        // Reset scores
        s.plvPoFQScores[_vault] = 0;
        s.plvPoFQWeights[_vault] = 0;

        emit PLVDeregistered(_vault);
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @notice Get all registered PLV addresses
    /// @return vaults Array of registered PLV addresses
    function getRegisteredPLVs() external view returns (address[] memory) {
        return appStorage().registeredPLVs;
    }

    /// @notice Get the number of registered PLVs
    /// @return count Number of registered PLVs
    function getRegisteredPLVCount() external view returns (uint256) {
        return appStorage().registeredPLVs.length;
    }

    /// @notice Check if a vault is registered
    /// @param _vault Vault address to check
    /// @return registered True if registered
    function isPLVRegistered(address _vault) external view returns (bool) {
        return appStorage().isPLVRegistered[_vault];
    }

    /// @notice Get PoFQ score for a PLV
    /// @param _vault PLV address
    /// @return score Current rolling PoFQ score (18 decimals)
    /// @return weight Accumulated volume weight
    function getPLVScore(address _vault) external view returns (uint256 score, uint256 weight) {
        AppStorage storage s = appStorage();
        return (s.plvPoFQScores[_vault], s.plvPoFQWeights[_vault]);
    }

    /// @notice Query a registered PLV for a quote
    /// @dev Calls ILiquidityVault.quote() on the external vault contract.
    ///      Gas-limited to prevent griefing. Returns zeros if the call fails.
    /// @param _vault PLV address
    /// @param _side Buy (0) or Sell (1) from taker perspective
    /// @param _size Requested fill size in base asset units
    /// @param _oraclePrice Current oracle price (18 decimals, signed)
    /// @param _volatility Current rolling volatility (18 decimals)
    /// @return price Quoted price (18 decimals). 0 if vault declines or call fails.
    /// @return maxFillSize Maximum fillable size at quoted price
    function quotePLV(
        address _vault,
        uint8 _side,
        uint256 _size,
        int256 _oraclePrice,
        uint256 _volatility
    ) external view returns (int256 price, uint256 maxFillSize) {
        AppStorage storage s = appStorage();
        require(s.isPLVRegistered[_vault], "PLVRegistry: not registered");

        ILiquidityVault.Side side = _side == 0
            ? ILiquidityVault.Side.BUY
            : ILiquidityVault.Side.SELL;

        // Gas-limited external call to prevent griefing
        try ILiquidityVault(_vault).quote{gas: 200_000}(side, _size, _oraclePrice, _volatility) returns (
            int256 _price,
            uint256 _maxFillSize
        ) {
            return (_price, _maxFillSize);
        } catch {
            return (0, 0);
        }
    }

    /// @notice Get PLVs sorted by PoFQ score descending (highest score first)
    /// @dev Off-chain helper. Returns up to _limit vaults. Gas intensive for large registries.
    /// @param _limit Maximum number of vaults to return
    /// @return vaults Sorted vault addresses
    /// @return scores Corresponding PoFQ scores
    function getTopPLVs(uint256 _limit) external view returns (address[] memory vaults, uint256[] memory scores) {
        AppStorage storage s = appStorage();
        uint256 total = s.registeredPLVs.length;
        uint256 count = _limit < total ? _limit : total;

        vaults = new address[](count);
        scores = new uint256[](count);

        // Copy first `count` vaults
        for (uint256 i; i < count;) {
            vaults[i] = s.registeredPLVs[i];
            scores[i] = s.plvPoFQScores[vaults[i]];
            unchecked { ++i; }
        }

        // Simple insertion sort descending by score (registry expected to be small)
        for (uint256 i = 1; i < count;) {
            uint256 keyScore = scores[i];
            address keyVault = vaults[i];
            uint256 j = i;
            while (j > 0 && scores[j - 1] < keyScore) {
                scores[j] = scores[j - 1];
                vaults[j] = vaults[j - 1];
                j--;
            }
            scores[j] = keyScore;
            vaults[j] = keyVault;
            unchecked { ++i; }
        }
    }

    // ============================================================
    //                    KEEPER FUNCTION
    // ============================================================

    /// @notice Update PoFQ score for a PLV after a fill
    /// @dev Called internally by SpotOrderBookFacet or SpotBatchAuctionFacet after a PLV fill.
    ///      Also callable by keepers for manual score correction.
    /// @param _vault PLV address
    /// @param _score Fill quality score for this batch (18 decimals)
    /// @param _volume Fill volume for this batch
    function updatePLVScore(address _vault, uint256 _score, uint256 _volume) external {
        require(
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.SPOT_ADMIN_ROLE, msg.sender),
            "PLVRegistry: not authorized"
        );

        AppStorage storage s = appStorage();
        require(s.isPLVRegistered[_vault], "PLVRegistry: not registered");

        (uint256 updatedScore, uint256 updatedWeight) = LibPoFQ.updateRollingScore(
            s.plvPoFQScores[_vault],
            s.plvPoFQWeights[_vault],
            _score,
            _volume,
            s.spotPoFQDecayBps
        );
        s.plvPoFQScores[_vault] = updatedScore;
        s.plvPoFQWeights[_vault] = updatedWeight;

        emit PoFQUpdated(_vault, updatedScore, updatedWeight, true);
    }
}
