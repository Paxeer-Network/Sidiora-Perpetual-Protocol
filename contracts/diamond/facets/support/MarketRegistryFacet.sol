// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, Market, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";

/// @title MarketRegistryFacet - Market CRUD and parameter management
/// @dev Stores enabled perp markets and their parameters (max leverage, margin, fees, etc.).
contract MarketRegistryFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event MarketCreated(uint256 indexed marketId, string name, string symbol, uint256 maxLeverage);
    event MarketUpdated(uint256 indexed marketId);
    event MarketEnabled(uint256 indexed marketId);
    event MarketDisabled(uint256 indexed marketId);

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Create a new perpetual market
    /// @param _name Market name (e.g., "Bitcoin")
    /// @param _symbol Market symbol (e.g., "BTC")
    /// @param _maxLeverage Maximum leverage in 18 decimals (e.g., 1000e18 = 1000x)
    /// @param _maintenanceMarginBps Maintenance margin in basis points (e.g., 50 = 0.5%)
    /// @param _maxOpenInterest Maximum total OI for this market (USD, 18 dec)
    /// @return marketId The ID of the newly created market
    function createMarket(
        string calldata _name,
        string calldata _symbol,
        uint256 _maxLeverage,
        uint256 _maintenanceMarginBps,
        uint256 _maxOpenInterest
    ) external returns (uint256 marketId) {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(bytes(_name).length > 0, "MarketRegistry: empty name");
        require(bytes(_symbol).length > 0, "MarketRegistry: empty symbol");
        require(_maxLeverage > 0 && _maxLeverage <= 1000e18, "MarketRegistry: invalid leverage");
        require(_maintenanceMarginBps > 0 && _maintenanceMarginBps < 10000, "MarketRegistry: invalid margin");
        require(_maxOpenInterest > 0, "MarketRegistry: zero max OI");

        AppStorage storage s = appStorage();
        marketId = s.nextMarketId++;

        s.markets[marketId] = Market({
            name: _name,
            symbol: _symbol,
            maxLeverage: _maxLeverage,
            maintenanceMarginBps: _maintenanceMarginBps,
            maxOpenInterest: _maxOpenInterest,
            enabled: true
        });

        s.activeMarketIds.push(marketId);

        emit MarketCreated(marketId, _name, _symbol, _maxLeverage);
    }

    /// @notice Update market parameters
    /// @param _marketId The market ID to update
    /// @param _maxLeverage New max leverage (18 dec)
    /// @param _maintenanceMarginBps New maintenance margin (bps)
    /// @param _maxOpenInterest New max OI (USD, 18 dec)
    function updateMarket(
        uint256 _marketId,
        uint256 _maxLeverage,
        uint256 _maintenanceMarginBps,
        uint256 _maxOpenInterest
    ) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(bytes(s.markets[_marketId].symbol).length > 0, "MarketRegistry: market does not exist");
        require(_maxLeverage > 0 && _maxLeverage <= 1000e18, "MarketRegistry: invalid leverage");
        require(_maintenanceMarginBps > 0 && _maintenanceMarginBps < 10000, "MarketRegistry: invalid margin");

        s.markets[_marketId].maxLeverage = _maxLeverage;
        s.markets[_marketId].maintenanceMarginBps = _maintenanceMarginBps;
        s.markets[_marketId].maxOpenInterest = _maxOpenInterest;

        emit MarketUpdated(_marketId);
    }

    /// @notice Enable a market for trading
    /// @param _marketId The market ID
    function enableMarket(uint256 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(bytes(s.markets[_marketId].symbol).length > 0, "MarketRegistry: market does not exist");
        require(!s.markets[_marketId].enabled, "MarketRegistry: already enabled");
        s.markets[_marketId].enabled = true;
        emit MarketEnabled(_marketId);
    }

    /// @notice Disable a market (no new positions, existing can close)
    /// @param _marketId The market ID
    function disableMarket(uint256 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(bytes(s.markets[_marketId].symbol).length > 0, "MarketRegistry: market does not exist");
        require(s.markets[_marketId].enabled, "MarketRegistry: already disabled");
        s.markets[_marketId].enabled = false;
        emit MarketDisabled(_marketId);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get full market details
    function getMarket(uint256 _marketId) external view returns (
        string memory name,
        string memory symbol,
        uint256 maxLeverage,
        uint256 maintenanceMarginBps,
        uint256 maxOpenInterest,
        bool enabled
    ) {
        AppStorage storage s = appStorage();
        Market storage m = s.markets[_marketId];
        return (m.name, m.symbol, m.maxLeverage, m.maintenanceMarginBps, m.maxOpenInterest, m.enabled);
    }

    /// @notice Check if a market exists and is enabled
    function isMarketActive(uint256 _marketId) external view returns (bool) {
        AppStorage storage s = appStorage();
        return s.markets[_marketId].enabled && bytes(s.markets[_marketId].symbol).length > 0;
    }

    /// @notice Get all active market IDs
    function getActiveMarketIds() external view returns (uint256[] memory) {
        return appStorage().activeMarketIds;
    }

    /// @notice Get total number of markets ever created
    function totalMarkets() external view returns (uint256) {
        return appStorage().nextMarketId;
    }

    // ============================================================
    //                    FEE CONFIGURATION
    // ============================================================

    event FeesUpdated(uint256 takerFeeBps, uint256 makerFeeBps, uint256 liquidationFeeBps, uint256 insuranceFeeBps);

    /// @notice Set protocol fee rates
    /// @param _takerFeeBps Taker fee in basis points (e.g., 10 = 0.1%)
    /// @param _makerFeeBps Maker fee in basis points
    /// @param _liquidationFeeBps Liquidation penalty in basis points
    /// @param _insuranceFeeBps Insurance fund cut of fees in basis points
    function setFees(
        uint256 _takerFeeBps,
        uint256 _makerFeeBps,
        uint256 _liquidationFeeBps,
        uint256 _insuranceFeeBps
    ) external {
        LibAccessControl.enforceRole(LibAccessControl.MARKET_ADMIN_ROLE);
        require(_takerFeeBps <= 1000, "MarketRegistry: taker fee too high");
        require(_makerFeeBps <= 1000, "MarketRegistry: maker fee too high");
        require(_liquidationFeeBps <= 5000, "MarketRegistry: liq fee too high");
        require(_insuranceFeeBps <= 10000, "MarketRegistry: insurance fee too high");

        AppStorage storage s = appStorage();
        s.takerFeeBps = _takerFeeBps;
        s.makerFeeBps = _makerFeeBps;
        s.liquidationFeeBps = _liquidationFeeBps;
        s.insuranceFeeBps = _insuranceFeeBps;

        emit FeesUpdated(_takerFeeBps, _makerFeeBps, _liquidationFeeBps, _insuranceFeeBps);
    }

    /// @notice Get current fee configuration
    function getFees() external view returns (
        uint256 takerFeeBps,
        uint256 makerFeeBps,
        uint256 liquidationFeeBps,
        uint256 insuranceFeeBps
    ) {
        AppStorage storage s = appStorage();
        return (s.takerFeeBps, s.makerFeeBps, s.liquidationFeeBps, s.insuranceFeeBps);
    }
}
