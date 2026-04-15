// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title ILiquidityVault
/// @notice Standard interface for Programmable Liquidity Vaults (PLVs).
///         Vaults implement this to participate in spot order routing.
///         The SpotOrderBookFacet queries vaults for quotes and notifies them of fills.
/// @dev Adapted from paxspot reference (ILiquidityVault.sol). Pragma updated to ^0.8.27.
interface ILiquidityVault {
    enum Side {
        BUY,
        SELL
    }

    /// @notice Get a quote from this vault for a given order
    /// @param side Buy or sell from the taker's perspective
    /// @param size Requested fill size in base asset units
    /// @param oraclePrice Current oracle price (18 decimals)
    /// @param volatility Current rolling volatility estimate (18 decimals, annualized)
    /// @return price Quoted price (18 decimals). 0 means vault declines to quote.
    /// @return maxFillSize Maximum size the vault can fill at the quoted price
    function quote(Side side, uint256 size, int256 oraclePrice, uint256 volatility)
        external
        view
        returns (int256 price, uint256 maxFillSize);

    /// @notice Notify the vault that a fill has occurred against it
    /// @param side Buy or sell from the taker's perspective
    /// @param size Fill size in base asset units
    /// @param price Fill price (18 decimals)
    /// @return success True if the vault accepted the fill
    function fill(Side side, uint256 size, int256 price) external returns (bool success);

    /// @notice Trigger a rebalance of the vault's inventory
    /// @dev Called by validator keepers or the SpotKeeperMulticallFacet after settlement epochs
    /// @param oraclePrice Current oracle price (18 decimals)
    /// @param inventorySkew Current inventory skew ratio (18 decimals, -1e18 to 1e18)
    function rebalance(int256 oraclePrice, int256 inventorySkew) external;

    /// @notice Get the vault's current inventory position
    /// @return baseBalance Base asset balance held by this vault
    /// @return quoteBalance Quote asset balance held by this vault
    function getInventory() external view returns (uint256 baseBalance, uint256 quoteBalance);
}
