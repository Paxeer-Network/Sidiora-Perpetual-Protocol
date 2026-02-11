// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, PricePoint, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";

/// @title OracleFacet - Custom batch price posting for perp markets
/// @dev Authorized bot posts prices for all enabled markets every ~60 seconds.
///      Stores rolling price history for TWAP calculations.
///      Staleness check: price > maxPriceStaleness → trading halts for that market.
contract OracleFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event PricesUpdated(uint256[] marketIds, uint256[] prices, uint256 timestamp);
    event PricePosterAdded(address indexed poster);
    event PricePosterRemoved(address indexed poster);
    event MaxPriceStalenessUpdated(uint256 oldValue, uint256 newValue);

    // ============================================================
    //                   ORACLE POSTER FUNCTIONS
    // ============================================================

    /// @notice Batch update prices for multiple markets in a single transaction
    /// @dev Only callable by authorized price posters (ORACLE_POSTER_ROLE).
    ///      For 15-20 markets, fits comfortably in a single tx.
    /// @param _marketIds Array of market IDs
    /// @param _prices Array of prices (18 decimals, USD)
    function batchUpdatePrices(
        uint256[] calldata _marketIds,
        uint256[] calldata _prices
    ) external {
        LibAccessControl.enforceRole(LibAccessControl.ORACLE_POSTER_ROLE);
        require(_marketIds.length == _prices.length, "Oracle: length mismatch");
        require(_marketIds.length > 0, "Oracle: empty arrays");

        AppStorage storage s = appStorage();
        uint256 ts = block.timestamp;

        for (uint256 i; i < _marketIds.length; i++) {
            uint256 marketId = _marketIds[i];
            uint256 price = _prices[i];
            require(price > 0, "Oracle: zero price");
            require(bytes(s.markets[marketId].symbol).length > 0, "Oracle: market does not exist");

            // Update latest price
            s.latestPrice[marketId] = price;
            s.latestPriceTimestamp[marketId] = ts;

            // Append to price history (rolling window — older entries can be pruned off-chain)
            s.priceHistory[marketId].push(PricePoint({
                price: price,
                timestamp: ts
            }));
        }

        emit PricesUpdated(_marketIds, _prices, ts);
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Add an authorized price poster
    /// @param _poster The address to authorize
    function addPricePoster(address _poster) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_poster != address(0), "Oracle: zero address");
        AppStorage storage s = appStorage();
        require(!s.authorizedPricePosters[_poster], "Oracle: already authorized");
        s.authorizedPricePosters[_poster] = true;
        // Also grant the ORACLE_POSTER_ROLE
        LibAccessControl.grantRole(LibAccessControl.ORACLE_POSTER_ROLE, _poster);
        emit PricePosterAdded(_poster);
    }

    /// @notice Remove an authorized price poster
    /// @param _poster The address to deauthorize
    function removePricePoster(address _poster) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(s.authorizedPricePosters[_poster], "Oracle: not authorized");
        s.authorizedPricePosters[_poster] = false;
        LibAccessControl.revokeRole(LibAccessControl.ORACLE_POSTER_ROLE, _poster);
        emit PricePosterRemoved(_poster);
    }

    /// @notice Set the max price staleness threshold
    /// @param _maxStaleness Max age in seconds before trading halts (default: 120)
    function setMaxPriceStaleness(uint256 _maxStaleness) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_maxStaleness >= 60, "Oracle: staleness too low");
        AppStorage storage s = appStorage();
        uint256 old = s.maxPriceStaleness;
        s.maxPriceStaleness = _maxStaleness;
        emit MaxPriceStalenessUpdated(old, _maxStaleness);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the latest price for a market
    /// @param _marketId The market ID
    /// @return price The latest price (18 dec)
    /// @return timestamp When it was posted
    function getPrice(uint256 _marketId) external view returns (uint256 price, uint256 timestamp) {
        AppStorage storage s = appStorage();
        return (s.latestPrice[_marketId], s.latestPriceTimestamp[_marketId]);
    }

    /// @notice Check if a market's price is stale
    /// @param _marketId The market ID
    /// @return True if the price is too old for trading
    function isPriceStale(uint256 _marketId) external view returns (bool) {
        AppStorage storage s = appStorage();
        uint256 maxStale = s.maxPriceStaleness;
        if (maxStale == 0) maxStale = 120; // default 2 minutes
        return block.timestamp > s.latestPriceTimestamp[_marketId] + maxStale;
    }

    /// @notice Get the price history length for a market
    /// @param _marketId The market ID
    /// @return The number of price points stored
    function getPriceHistoryLength(uint256 _marketId) external view returns (uint256) {
        return appStorage().priceHistory[_marketId].length;
    }

    /// @notice Get a specific price point from history
    /// @param _marketId The market ID
    /// @param _index The index in the history array
    /// @return price The price (18 dec)
    /// @return timestamp When it was posted
    function getPricePoint(uint256 _marketId, uint256 _index) external view returns (uint256 price, uint256 timestamp) {
        AppStorage storage s = appStorage();
        require(_index < s.priceHistory[_marketId].length, "Oracle: index out of bounds");
        PricePoint storage pp = s.priceHistory[_marketId][_index];
        return (pp.price, pp.timestamp);
    }

    /// @notice Check if an address is an authorized price poster
    function isAuthorizedPoster(address _poster) external view returns (bool) {
        return appStorage().authorizedPricePosters[_poster];
    }

    /// @notice Get the max price staleness setting
    function getMaxPriceStaleness() external view returns (uint256) {
        uint256 val = appStorage().maxPriceStaleness;
        return val == 0 ? 120 : val;
    }
}
