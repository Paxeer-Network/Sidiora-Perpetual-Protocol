// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, PricePoint, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {IOracleAggregator} from "../../interfaces/IOracleAggregator.sol";
import {LibEvents} from "../../libraries/LibEvents.sol";

/// @title OracleFacet - Dual-mode oracle: VOM precompile (primary) + legacy push (fallback)
/// @dev When usePrecompileOracle=true, reads prices directly from the VOM precompile (0x903).
///      Prices are updated every block by validators — sub-second freshness.
///      When usePrecompileOracle=false, uses legacy batchUpdatePrices from authorized posters.
///      Price history is maintained in both modes for TWAP funding rate calculations.
contract OracleFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event PricesUpdated(uint256[] marketIds, uint256[] prices, uint256 timestamp);
    event PricePosterAdded(address indexed poster);
    event PricePosterRemoved(address indexed poster);
    event MaxPriceStalenessUpdated(uint256 oldValue, uint256 newValue);
    event PrecompileModeUpdated(bool enabled);

    // ============================================================
    //            VOM PRECOMPILE FUNCTIONS (PRIMARY MODE)
    // ============================================================

    /// @notice Refresh a market's price from the VOM precompile and store it
    /// @dev Reads the validator consensus price, validates quorum, updates storage.
    ///      Can be called by anyone (permissionless) since data comes from validators.
    ///      In precompile mode, this replaces the external oracle bot entirely.
    /// @param _marketId The market to refresh
    /// @return price The refreshed price (18 dec)
    function refreshPriceFromVOM(uint256 _marketId) external returns (uint256 price) {
        AppStorage storage s = appStorage();
        require(s.usePrecompileOracle, "Oracle: precompile mode not enabled");
        price = _pullVOMPrice(s, _marketId);
    }

    /// @notice Batch refresh prices for multiple markets from VOM precompile
    /// @param _marketIds Array of market IDs to refresh
    function batchRefreshFromVOM(uint256[] calldata _marketIds) external {
        AppStorage storage s = appStorage();
        require(s.usePrecompileOracle, "Oracle: precompile mode not enabled");
        require(_marketIds.length > 0, "Oracle: empty array");

        uint256[] memory prices = new uint256[](_marketIds.length);
        for (uint256 i; i < _marketIds.length; i++) {
            prices[i] = _pullVOMPrice(s, _marketIds[i]);
        }

        emit PricesUpdated(_marketIds, prices, block.timestamp);
    }

    // ============================================================
    //            LEGACY PUSH ORACLE (FALLBACK MODE)
    // ============================================================

    /// @notice Batch update prices for multiple markets in a single transaction
    /// @dev Only callable by authorized price posters (ORACLE_POSTER_ROLE).
    ///      Used when usePrecompileOracle=false (legacy mode).
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

        uint256 maxDevBps = s.maxPriceDeviationBps;

        for (uint256 i; i < _marketIds.length; i++) {
            uint256 marketId = _marketIds[i];
            uint256 price = _prices[i];
            require(price > 0, "Oracle: zero price");
            require(bytes(s.markets[marketId].symbol).length > 0, "Oracle: market does not exist");

            // Deviation check: reject if price moved too far from last known price
            uint256 lastPrice = s.latestPrice[marketId];
            if (lastPrice > 0 && maxDevBps > 0) {
                uint256 delta = price > lastPrice ? price - lastPrice : lastPrice - price;
                uint256 deviationBps = (delta * 10000) / lastPrice;
                require(deviationBps <= maxDevBps, "Oracle: price deviation exceeds max");
            }

            _storePrice(s, marketId, price, ts);
        }

        emit PricesUpdated(_marketIds, _prices, ts);
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Add an authorized price poster
    function addPricePoster(address _poster) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_poster != address(0), "Oracle: zero address");
        AppStorage storage s = appStorage();
        require(!s.authorizedPricePosters[_poster], "Oracle: already authorized");
        s.authorizedPricePosters[_poster] = true;
        LibAccessControl.grantRole(LibAccessControl.ORACLE_POSTER_ROLE, _poster);
        emit PricePosterAdded(_poster);
    }

    /// @notice Remove an authorized price poster
    function removePricePoster(address _poster) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(s.authorizedPricePosters[_poster], "Oracle: not authorized");
        s.authorizedPricePosters[_poster] = false;
        LibAccessControl.revokeRole(LibAccessControl.ORACLE_POSTER_ROLE, _poster);
        emit PricePosterRemoved(_poster);
    }

    /// @notice Set the max price staleness threshold
    function setMaxPriceStaleness(uint256 _maxStaleness) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_maxStaleness >= 60, "Oracle: staleness too low");
        AppStorage storage s = appStorage();
        uint256 old = s.maxPriceStaleness;
        s.maxPriceStaleness = _maxStaleness;
        emit MaxPriceStalenessUpdated(old, _maxStaleness);
    }

    /// @notice Enable or disable VOM precompile oracle mode
    /// @param _enabled True = read from VOM precompile, false = legacy push mode
    function setUsePrecompileOracle(bool _enabled) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        s.usePrecompileOracle = _enabled;
        emit PrecompileModeUpdated(_enabled);
    }

    /// @notice Set the VOM precompile address
    /// @param _precompile The precompile contract address (e.g., 0x903)
    function setOraclePrecompile(address _precompile) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_precompile != address(0), "Oracle: zero precompile");
        appStorage().oraclePrecompile = _precompile;
    }

    /// @notice Set the VOM market identifier for a market
    /// @param _marketId The protocol market ID
    /// @param _vomId The VOM bytes32 market identifier (e.g., keccak256("BTC/USD"))
    function setMarketVomId(uint256 _marketId, bytes32 _vomId) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_vomId != bytes32(0), "Oracle: zero VOM ID");
        appStorage().marketVomIds[_marketId] = _vomId;
    }

    /// @notice Set the minimum validator quorum for VOM prices
    /// @param _quorum Minimum number of validator attestations required
    function setMinOracleQuorum(uint256 _quorum) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_quorum > 0, "Oracle: zero quorum");
        appStorage().minOracleQuorum = _quorum;
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the latest price for a market (reads from VOM if precompile mode is on)
    /// @param _marketId The market ID
    /// @return price The latest price (18 dec)
    /// @return timestamp When it was last updated
    function getPrice(uint256 _marketId) external view returns (uint256 price, uint256 timestamp) {
        AppStorage storage s = appStorage();
        if (s.usePrecompileOracle) {
            return _readVOMPrice(s, _marketId);
        }
        return (s.latestPrice[_marketId], s.latestPriceTimestamp[_marketId]);
    }

    /// @notice Check if a market's price is stale
    /// @param _marketId The market ID
    /// @return True if the price is too old for trading
    function isPriceStale(uint256 _marketId) external view returns (bool) {
        AppStorage storage s = appStorage();
        if (s.usePrecompileOracle) {
            // VOM prices are always fresh (updated every block)
            // but check quorum
            bytes32 vomId = s.marketVomIds[_marketId];
            if (vomId == bytes32(0)) return true;
            try IOracleAggregator(s.oraclePrecompile).getValidatorPrice(vomId) returns (
                int256, uint256 quorum, uint256
            ) {
                return quorum < s.minOracleQuorum;
            } catch {
                return true;
            }
        }
        uint256 maxStale = s.maxPriceStaleness;
        if (maxStale == 0) maxStale = 120;
        return block.timestamp > s.latestPriceTimestamp[_marketId] + maxStale;
    }

    /// @notice Get the price history length for a market
    function getPriceHistoryLength(uint256 _marketId) external view returns (uint256) {
        return appStorage().priceHistory[_marketId].length;
    }

    /// @notice Get a specific price point from history
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

    /// @notice Get oracle mode info
    function getOracleMode() external view returns (bool usePrecompile, address precompile, uint256 minQuorum) {
        AppStorage storage s = appStorage();
        return (s.usePrecompileOracle, s.oraclePrecompile, s.minOracleQuorum);
    }

    /// @notice Get the VOM market ID for a protocol market
    function getMarketVomId(uint256 _marketId) external view returns (bytes32) {
        return appStorage().marketVomIds[_marketId];
    }

    // ============================================================
    //                   INTERNAL FUNCTIONS
    // ============================================================

    /// @dev Pull price from VOM precompile, validate, store in AppStorage
    function _pullVOMPrice(AppStorage storage s, uint256 _marketId) internal returns (uint256 price) {
        (price, ) = _readVOMPrice(s, _marketId);
        _storePrice(s, _marketId, price, block.timestamp);
        emit LibEvents.PriceUpdated(_marketId, price, block.timestamp);
    }

    /// @dev Read VOM price (view-only, no storage writes)
    function _readVOMPrice(AppStorage storage s, uint256 _marketId) internal view returns (uint256 price, uint256 timestamp) {
        bytes32 vomId = s.marketVomIds[_marketId];
        require(vomId != bytes32(0), "Oracle: VOM ID not set for market");

        address precompile = s.oraclePrecompile;
        require(precompile != address(0), "Oracle: precompile not configured");

        (int256 rawPrice, uint256 quorum, uint256 blockTs) = IOracleAggregator(precompile).getValidatorPrice(vomId);

        uint256 minQuorum = s.minOracleQuorum;
        if (minQuorum == 0) minQuorum = 1;
        require(quorum >= minQuorum, "Oracle: insufficient VOM quorum");
        require(rawPrice > 0, "Oracle: VOM returned zero/negative price");

        price = uint256(rawPrice);
        timestamp = blockTs;
    }

    /// @dev Store a price in AppStorage and append to history
    function _storePrice(AppStorage storage s, uint256 _marketId, uint256 _price, uint256 _timestamp) internal {
        s.latestPrice[_marketId] = _price;
        s.latestPriceTimestamp[_marketId] = _timestamp;
        s.priceHistory[_marketId].push(PricePoint({price: _price, timestamp: _timestamp}));
    }
}
