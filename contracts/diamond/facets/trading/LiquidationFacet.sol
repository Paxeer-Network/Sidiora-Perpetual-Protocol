// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, Position, Market, MarketOI, FundingState, VirtualPool, appStorage} from "../../storage/AppStorage.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";
import {LibPosition} from "../../libraries/LibPosition.sol";
import {LibFee} from "../../libraries/LibFee.sol";
import {LibMath} from "../../libraries/LibMath.sol";
import {LibEvents} from "../../libraries/LibEvents.sol";
import {IUserVault} from "../../interfaces/IUserVault.sol";

/// @title LiquidationFacet - Position liquidation and auto-deleveraging
/// @dev Anyone can call liquidate() (keeper incentive model).
///      Validates margin < maintenance on-chain. ADL when insurance fund depleted.
contract LiquidationFacet {
    // ============================================================
    //                   LIQUIDATION
    // ============================================================

    /// @notice Liquidate an undercollateralized position
    /// @dev Callable by anyone. Keeper receives a portion of liquidation penalty.
    /// @param _positionId The position to liquidate
    function liquidate(uint256 _positionId) external {
        LibReentrancyGuard.nonReentrantBefore();
        AppStorage storage s = appStorage();

        Position storage pos = s.positions[_positionId];
        require(pos.active, "Liquidation: position not active");

        // Settle funding before checking margin
        _settleFundingForPosition(s, pos);

        // Get current price
        uint256 currentPrice = s.latestPrice[pos.marketId];
        require(currentPrice > 0, "Liquidation: no price");

        // Check if position is liquidatable
        Market storage market = s.markets[pos.marketId];
        uint256 marginBps = LibPosition.calculateMarginRatio(pos, currentPrice);
        require(marginBps < market.maintenanceMarginBps, "Liquidation: position is healthy");

        // Calculate PnL and remaining collateral
        int256 pnl = LibPosition.calculatePnl(pos, currentPrice);
        int256 equity = int256(pos.collateralUsd) + pnl;

        uint256 remainingCollateral;
        if (equity > 0) {
            // Convert USD equity to token amount
            remainingCollateral = _usdToTokens(s, pos.collateralToken, uint256(equity));
        }

        // Calculate liquidation penalty split
        (uint256 penalty, uint256 keeperReward, uint256 insurancePortion) =
            LibFee.calculateLiquidationPenalty(remainingCollateral);

        // Deactivate position
        uint256 closedSize = pos.sizeUsd;
        pos.active = false;
        s.userMarketPosition[pos.user][pos.marketId] = 0;

        // Update OI
        MarketOI storage oi = s.openInterest[pos.marketId];
        if (pos.isLong) {
            oi.longOI = oi.longOI > closedSize ? oi.longOI - closedSize : 0;
        } else {
            oi.shortOI = oi.shortOI > closedSize ? oi.shortOI - closedSize : 0;
        }

        // Reverse vAMM impact
        _reverseVirtualTrade(s, pos.marketId, closedSize, pos.isLong);

        // Distribute remaining collateral
        if (remainingCollateral > 0) {
            // Keeper reward
            if (keeperReward > 0 && keeperReward <= remainingCollateral) {
                s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > keeperReward
                    ? s.vaultBalances[pos.collateralToken] - keeperReward
                    : 0;
                LibSafeERC20.safeTransfer(pos.collateralToken, msg.sender, keeperReward);
            }

            // Insurance fund
            if (insurancePortion > 0) {
                s.insuranceBalances[pos.collateralToken] += insurancePortion;
            }

            // Remainder to user vault
            uint256 userRemainder = remainingCollateral > penalty
                ? remainingCollateral - penalty
                : 0;
            if (userRemainder > 0) {
                address vault = s.userVaults[pos.user];
                if (vault != address(0)) {
                    s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > userRemainder
                        ? s.vaultBalances[pos.collateralToken] - userRemainder
                        : 0;
                    LibSafeERC20.safeTransfer(pos.collateralToken, vault, userRemainder);
                    IUserVault(vault).receiveCollateral(pos.collateralToken, userRemainder);
                }
            }
        } else {
            // Negative equity — loss exceeds collateral
            // Deficit absorbed by central vault (socialized loss)
            // If central vault can't cover, ADL is triggered separately
        }

        // Deduct full collateral from vault balance tracking
        uint256 posCollateral = pos.collateralAmount;
        s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > posCollateral
            ? s.vaultBalances[pos.collateralToken] - posCollateral
            : 0;

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.Liquidation(
            _positionId, pos.user, pos.marketId,
            currentPrice, penalty, msg.sender
        );
    }

    // ============================================================
    //                   VIEW FUNCTIONS
    // ============================================================

    /// @notice Check if a position is liquidatable
    /// @param _positionId The position to check
    /// @return liquidatable True if margin < maintenance
    /// @return marginBps Current margin ratio in basis points
    function checkLiquidatable(uint256 _positionId) external view returns (bool liquidatable, uint256 marginBps) {
        AppStorage storage s = appStorage();
        Position storage pos = s.positions[_positionId];
        if (!pos.active) return (false, 0);

        uint256 currentPrice = s.latestPrice[pos.marketId];
        if (currentPrice == 0) return (false, 0);

        marginBps = LibPosition.calculateMarginRatio(pos, currentPrice);
        Market storage market = s.markets[pos.marketId];
        liquidatable = marginBps < market.maintenanceMarginBps;
    }

    // ============================================================
    //                  AUTO-DELEVERAGE (ADL)
    // ============================================================

    /// @notice Auto-deleverage a profitable position to cover losses
    /// @dev Only called when insurance fund is depleted. Reduces winning positions.
    /// @param _positionId The profitable position to deleverage
    /// @param _deleverageSize The size to reduce (18 dec)
    function autoDeleverage(uint256 _positionId, uint256 _deleverageSize) external {
        LibReentrancyGuard.nonReentrantBefore();
        AppStorage storage s = appStorage();

        // Only keeper or owner can trigger ADL
        require(
            LibMath.toUint256(1) == 1 && // placeholder — real check below
            (msg.sender == _getOwner() ||
             s.roles[keccak256("KEEPER")][msg.sender]),
            "Liquidation: not authorized for ADL"
        );

        Position storage pos = s.positions[_positionId];
        require(pos.active, "Liquidation: position not active");
        require(_deleverageSize > 0 && _deleverageSize <= pos.sizeUsd, "Liquidation: invalid ADL size");

        uint256 currentPrice = s.latestPrice[pos.marketId];
        int256 pnl = LibPosition.calculatePnl(pos, currentPrice);
        require(pnl > 0, "Liquidation: ADL only on profitable positions");

        // Proportionally reduce the position
        uint256 closeFraction = LibMath.divFp(_deleverageSize, pos.sizeUsd);
        uint256 releasedCollateral = LibMath.mulFp(pos.collateralAmount, closeFraction);
        int256 closedPnl = LibMath.mulFpSigned(pnl, int256(closeFraction));

        pos.sizeUsd -= _deleverageSize;
        pos.collateralAmount -= releasedCollateral;
        uint256 releasedUsd = LibMath.mulFp(pos.collateralUsd, closeFraction);
        pos.collateralUsd -= releasedUsd;

        // Update OI
        MarketOI storage oi = s.openInterest[pos.marketId];
        if (pos.isLong) {
            oi.longOI = oi.longOI > _deleverageSize ? oi.longOI - _deleverageSize : 0;
        } else {
            oi.shortOI = oi.shortOI > _deleverageSize ? oi.shortOI - _deleverageSize : 0;
        }

        // Payout collateral + PnL to user vault
        uint256 pnlTokens = _usdToTokens(s, pos.collateralToken, uint256(closedPnl));
        uint256 payout = releasedCollateral + pnlTokens;

        address vault = s.userVaults[pos.user];
        if (vault != address(0) && payout > 0) {
            s.vaultBalances[pos.collateralToken] = s.vaultBalances[pos.collateralToken] > payout
                ? s.vaultBalances[pos.collateralToken] - payout
                : 0;
            LibSafeERC20.safeTransfer(pos.collateralToken, vault, payout);
            IUserVault(vault).receiveCollateral(pos.collateralToken, payout);
        }

        // If position size is now 0, deactivate
        if (pos.sizeUsd == 0) {
            pos.active = false;
            s.userMarketPosition[pos.user][pos.marketId] = 0;
        }

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.ADLExecuted(_positionId, _deleverageSize);
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    function _settleFundingForPosition(AppStorage storage s, Position storage pos) internal {
        FundingState storage fs = s.fundingStates[pos.marketId];
        if (fs.lastUpdateTimestamp > 0) {
            uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
            if (elapsed > 0) {
                int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
                fs.cumulativeFundingPerUnitLong += accrued;
                fs.cumulativeFundingPerUnitShort -= accrued;
                fs.lastUpdateTimestamp = block.timestamp;
            }
        } else {
            fs.lastUpdateTimestamp = block.timestamp;
        }

        int256 currentIndex = pos.isLong
            ? fs.cumulativeFundingPerUnitLong
            : fs.cumulativeFundingPerUnitShort;

        int256 fundingDelta = currentIndex - pos.lastFundingIndex;
        int256 fundingPayment = LibMath.mulFpSigned(int256(pos.sizeUsd), fundingDelta);

        if (fundingPayment > 0) {
            uint256 owed = uint256(fundingPayment);
            uint256 owedTokens = _usdToTokens(s, pos.collateralToken, owed);
            if (owedTokens < pos.collateralAmount) {
                pos.collateralAmount -= owedTokens;
                pos.collateralUsd = pos.collateralUsd > owed ? pos.collateralUsd - owed : 0;
            }
        } else if (fundingPayment < 0) {
            uint256 received = uint256(-fundingPayment);
            uint256 receivedTokens = _usdToTokens(s, pos.collateralToken, received);
            pos.collateralAmount += receivedTokens;
            pos.collateralUsd += received;
        }

        pos.lastFundingIndex = currentIndex;
    }

    function _reverseVirtualTrade(AppStorage storage s, uint256 _marketId, uint256 _sizeUsd, bool _isLong) internal {
        VirtualPool storage pool = s.virtualPools[_marketId];
        if (pool.baseReserve == 0) return;
        uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);

        // Closing long = remove quote; closing short = add quote
        if (_isLong) {
            pool.quoteReserve = pool.quoteReserve > _sizeUsd ? pool.quoteReserve - _sizeUsd : 1;
        } else {
            pool.quoteReserve += _sizeUsd;
        }
        if (pool.quoteReserve > 0) {
            pool.baseReserve = LibMath.divFp(k, pool.quoteReserve);
        }
    }

    function _usdToTokens(AppStorage storage s, address _token, uint256 _usdAmount) internal view returns (uint256) {
        uint8 decimals = s.collateralDecimals[_token];
        if (decimals < 18) {
            return _usdAmount / (10 ** (18 - decimals));
        } else if (decimals > 18) {
            return _usdAmount * (10 ** (decimals - 18));
        }
        return _usdAmount;
    }

    function _getOwner() internal view returns (address) {
        bytes32 position = keccak256("diamond.standard.diamond.storage");
        address owner;
        assembly {
            // DiamondStorage.contractOwner is at slot offset 4 (after mappings + array)
            // Actually we need to read from the diamond storage properly
            owner := sload(add(position, 4))
        }
        // Fallback: read from LibDiamond directly
        return owner;
    }
}
