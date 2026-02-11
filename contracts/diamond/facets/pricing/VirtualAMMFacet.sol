// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, VirtualPool, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibMath} from "../../libraries/LibMath.sol";

/// @title VirtualAMMFacet - Per-market virtual AMM for mark price
/// @dev Virtual reserves simulate an AMM without actual liquidity.
///      Mark price = quoteReserve / baseReserve.
///      Re-centers toward oracle price every sync cycle (dampened convergence).
contract VirtualAMMFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event PoolInitialized(uint256 indexed marketId, uint256 baseReserve, uint256 quoteReserve);
    event PoolSynced(uint256 indexed marketId, uint256 newBase, uint256 newQuote, uint256 oraclePrice);
    event PoolReservesUpdated(uint256 indexed marketId, uint256 newBase, uint256 newQuote);

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Initialize the virtual pool for a market
    /// @dev Sets initial reserves based on a target price and virtual liquidity depth.
    /// @param _marketId The market ID
    /// @param _initialPrice The initial mark price (18 dec)
    /// @param _virtualLiquidity The virtual liquidity depth (higher = less price impact)
    /// @param _dampingFactor Convergence speed toward oracle in bps (e.g., 5000 = 50% per sync)
    function initializePool(
        uint256 _marketId,
        uint256 _initialPrice,
        uint256 _virtualLiquidity,
        uint256 _dampingFactor
    ) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_initialPrice > 0, "VirtualAMM: zero price");
        require(_virtualLiquidity > 0, "VirtualAMM: zero liquidity");
        require(_dampingFactor > 0 && _dampingFactor <= 10000, "VirtualAMM: invalid damping");

        AppStorage storage s = appStorage();
        require(bytes(s.markets[_marketId].symbol).length > 0, "VirtualAMM: market does not exist");

        VirtualPool storage pool = s.virtualPools[_marketId];
        require(pool.baseReserve == 0, "VirtualAMM: already initialized");

        // Set reserves such that quoteReserve / baseReserve = initialPrice
        // Use virtualLiquidity as the base reserve magnitude
        pool.baseReserve = _virtualLiquidity;
        pool.quoteReserve = LibMath.mulFp(_virtualLiquidity, _initialPrice);
        pool.lastSyncTimestamp = block.timestamp;
        pool.dampingFactor = _dampingFactor;

        emit PoolInitialized(_marketId, pool.baseReserve, pool.quoteReserve);
    }

    /// @notice Sync the vAMM toward the oracle price (called after each oracle update)
    /// @dev Keepers or oracle poster calls this after batchUpdatePrices.
    ///      Pulls reserves toward oracle price by dampingFactor percentage.
    /// @param _marketId The market to sync
    function syncToOracle(uint256 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.KEEPER_ROLE);
        AppStorage storage s = appStorage();

        VirtualPool storage pool = s.virtualPools[_marketId];
        require(pool.baseReserve > 0, "VirtualAMM: pool not initialized");

        uint256 oraclePrice = s.latestPrice[_marketId];
        require(oraclePrice > 0, "VirtualAMM: no oracle price");

        // Target reserves: keep same base, adjust quote so that quote/base = oraclePrice
        uint256 targetQuote = LibMath.mulFp(pool.baseReserve, oraclePrice);

        // Damped convergence: move dampingFactor% of the way toward target
        uint256 damping = pool.dampingFactor; // bps
        uint256 currentQuote = pool.quoteReserve;

        uint256 newQuote;
        if (targetQuote > currentQuote) {
            uint256 delta = targetQuote - currentQuote;
            newQuote = currentQuote + (delta * damping) / 10000;
        } else {
            uint256 delta = currentQuote - targetQuote;
            newQuote = currentQuote - (delta * damping) / 10000;
        }

        pool.quoteReserve = newQuote;
        pool.lastSyncTimestamp = block.timestamp;

        emit PoolSynced(_marketId, pool.baseReserve, newQuote, oraclePrice);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the current mark price from the vAMM
    /// @param _marketId The market ID
    /// @return markPrice The mark price (18 dec)
    function getMarkPrice(uint256 _marketId) external view returns (uint256 markPrice) {
        return _getMarkPrice(_marketId);
    }

    /// @notice Simulate the price impact of a trade on the vAMM
    /// @dev Does NOT modify state. Returns the execution price after impact.
    /// @param _marketId The market ID
    /// @param _sizeUsd The trade size in USD (18 dec)
    /// @param _isLong True for long (buy), false for short (sell)
    /// @return executionPrice The price after impact (18 dec)
    /// @return priceImpact The absolute price impact (18 dec)
    function simulateImpact(
        uint256 _marketId,
        uint256 _sizeUsd,
        bool _isLong
    ) external view returns (uint256 executionPrice, uint256 priceImpact) {
        AppStorage storage s = appStorage();
        VirtualPool storage pool = s.virtualPools[_marketId];
        require(pool.baseReserve > 0, "VirtualAMM: pool not initialized");

        uint256 currentPrice = _getMarkPrice(_marketId);
        (executionPrice,) = _simulateSwap(pool.baseReserve, pool.quoteReserve, _sizeUsd, _isLong);

        if (executionPrice > currentPrice) {
            priceImpact = executionPrice - currentPrice;
        } else {
            priceImpact = currentPrice - executionPrice;
        }
    }

    /// @notice Get the virtual pool state for a market
    function getPool(uint256 _marketId) external view returns (
        uint256 baseReserve,
        uint256 quoteReserve,
        uint256 lastSyncTimestamp,
        uint256 dampingFactor
    ) {
        VirtualPool storage pool = appStorage().virtualPools[_marketId];
        return (pool.baseReserve, pool.quoteReserve, pool.lastSyncTimestamp, pool.dampingFactor);
    }

    // ============================================================
    //                   INTERNAL FUNCTIONS
    // ============================================================

    /// @dev Get mark price from virtual reserves
    function _getMarkPrice(uint256 _marketId) internal view returns (uint256) {
        VirtualPool storage pool = appStorage().virtualPools[_marketId];
        if (pool.baseReserve == 0) return 0;
        return LibMath.divFp(pool.quoteReserve, pool.baseReserve);
    }

    /// @dev Simulate a constant-product swap to get execution price
    /// @return execPrice The average execution price
    /// @return newQuote The new quote reserve after swap
    function _simulateSwap(
        uint256 _baseReserve,
        uint256 _quoteReserve,
        uint256 _sizeUsd,
        bool _isLong
    ) internal pure returns (uint256 execPrice, uint256 newQuote) {
        // Constant product: k = base * quote
        // For a long (buy base): add quote, remove base
        // For a short (sell base): remove quote, add base
        uint256 k = LibMath.mulFp(_baseReserve, _quoteReserve);

        if (_isLong) {
            // Buying base: trader adds _sizeUsd to quote reserve
            newQuote = _quoteReserve + _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            uint256 baseDelta = _baseReserve - newBase;
            if (baseDelta == 0) return (LibMath.divFp(_quoteReserve, _baseReserve), newQuote);
            execPrice = LibMath.divFp(_sizeUsd, baseDelta);
        } else {
            // Selling base: trader removes _sizeUsd from quote reserve
            require(_sizeUsd < _quoteReserve, "VirtualAMM: trade too large");
            newQuote = _quoteReserve - _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            uint256 baseDelta = newBase - _baseReserve;
            if (baseDelta == 0) return (LibMath.divFp(_quoteReserve, _baseReserve), newQuote);
            execPrice = LibMath.divFp(_sizeUsd, baseDelta);
        }
    }
}
