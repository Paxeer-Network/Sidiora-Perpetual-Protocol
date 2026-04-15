// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, SpotMarket, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title SpotMarketRegistryFacet - Spot market CRUD and parameter management
/// @dev Creates and manages spot trading pairs. Uses bytes32 marketId = keccak256("BASE/QUOTE").
///      Separate namespace from perps uint256 market IDs.
contract SpotMarketRegistryFacet is ISpotEvents {
    // ============================================================
    //                    CONSTANTS
    // ============================================================

    uint8 constant MODE_CONTINUOUS = 0;
    uint8 constant MODE_BATCH = 1;

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Create a new spot market
    /// @param _baseToken Address of the base token (e.g., wETH)
    /// @param _quoteToken Address of the quote token (e.g., USDC)
    /// @param _mode Initial trading mode (0 = CONTINUOUS, 1 = BATCH)
    /// @param _minOrderSize Minimum order size in base asset units (token decimals)
    /// @param _maxOffsetBps Maximum absolute OROB offset from oracle (e.g., 500 = ±5%)
    /// @param _takerFeeBps Taker fee in basis points (e.g., 5 = 0.05%)
    /// @param _makerRebateBps Maker rebate in basis points (negative = rebate, e.g., -2 = 0.02%)
    /// @return marketId The bytes32 market identifier
    function createSpotMarket(
        address _baseToken,
        address _quoteToken,
        uint8 _mode,
        uint128 _minOrderSize,
        int16 _maxOffsetBps,
        uint16 _takerFeeBps,
        int16 _makerRebateBps
    ) external returns (bytes32 marketId) {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_baseToken != address(0), "SpotRegistry: zero base token");
        require(_quoteToken != address(0), "SpotRegistry: zero quote token");
        require(_baseToken != _quoteToken, "SpotRegistry: identical tokens");
        require(_mode <= MODE_BATCH, "SpotRegistry: invalid mode");
        require(_maxOffsetBps > 0 && _maxOffsetBps <= 10000, "SpotRegistry: invalid max offset");
        require(_takerFeeBps <= 1000, "SpotRegistry: taker fee too high");

        // Derive deterministic market ID
        marketId = keccak256(abi.encodePacked(_baseToken, "/", _quoteToken));

        AppStorage storage s = appStorage();
        require(!s.spotMarkets[marketId].active, "SpotRegistry: market already exists");

        // Require both tokens to be in the spot whitelist
        require(s.spotAcceptedTokens[_baseToken], "SpotRegistry: base token not whitelisted");
        require(s.spotAcceptedTokens[_quoteToken], "SpotRegistry: quote token not whitelisted");

        s.spotMarkets[marketId] = SpotMarket({
            marketId: marketId,
            baseToken: _baseToken,
            quoteToken: _quoteToken,
            mode: _mode,
            active: true,
            minOrderSize: _minOrderSize,
            maxOffsetBps: _maxOffsetBps,
            takerFeeBps: _takerFeeBps,
            makerRebateBps: _makerRebateBps,
            batchModeUntilBlock: 0
        });

        s.activeSpotMarketIds.push(marketId);
        s.nextSpotMarketId++;

        emit SpotMarketCreated(marketId, _baseToken, _quoteToken, _mode);
    }

    /// @notice Update spot market trading mode
    /// @param _marketId The market identifier
    /// @param _newMode New trading mode (0 = CONTINUOUS, 1 = BATCH)
    function setSpotMarketMode(bytes32 _marketId, uint8 _newMode) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_newMode <= MODE_BATCH, "SpotRegistry: invalid mode");

        AppStorage storage s = appStorage();
        SpotMarket storage market = s.spotMarkets[_marketId];
        require(market.active, "SpotRegistry: market not active");

        uint8 oldMode = market.mode;
        require(oldMode != _newMode, "SpotRegistry: mode unchanged");

        market.mode = _newMode;

        // If switching to batch, set hysteresis
        if (_newMode == MODE_BATCH) {
            market.batchModeUntilBlock = block.number + 100; // min 100 blocks in batch
        }

        emit MarketModeChanged(_marketId, oldMode, _newMode, market.batchModeUntilBlock);
    }

    /// @notice Update spot market parameters
    /// @param _marketId The market identifier
    /// @param _minOrderSize New minimum order size
    /// @param _maxOffsetBps New maximum offset
    /// @param _takerFeeBps New taker fee
    /// @param _makerRebateBps New maker rebate
    function setSpotMarketParams(
        bytes32 _marketId,
        uint128 _minOrderSize,
        int16 _maxOffsetBps,
        uint16 _takerFeeBps,
        int16 _makerRebateBps
    ) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_maxOffsetBps > 0 && _maxOffsetBps <= 10000, "SpotRegistry: invalid max offset");
        require(_takerFeeBps <= 1000, "SpotRegistry: taker fee too high");

        AppStorage storage s = appStorage();
        SpotMarket storage market = s.spotMarkets[_marketId];
        require(market.active, "SpotRegistry: market not active");

        market.minOrderSize = _minOrderSize;
        market.maxOffsetBps = _maxOffsetBps;
        market.takerFeeBps = _takerFeeBps;
        market.makerRebateBps = _makerRebateBps;
    }

    /// @notice Enable a previously disabled spot market
    /// @param _marketId The market identifier
    function enableSpotMarket(bytes32 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(s.spotMarkets[_marketId].baseToken != address(0), "SpotRegistry: market does not exist");
        require(!s.spotMarkets[_marketId].active, "SpotRegistry: already active");
        s.spotMarkets[_marketId].active = true;
    }

    /// @notice Disable a spot market (no new orders, existing can cancel)
    /// @param _marketId The market identifier
    function disableSpotMarket(bytes32 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(s.spotMarkets[_marketId].baseToken != address(0), "SpotRegistry: market does not exist");
        require(s.spotMarkets[_marketId].active, "SpotRegistry: already disabled");
        s.spotMarkets[_marketId].active = false;
    }

    // ============================================================
    //                    ORACLE FUNCTIONS
    // ============================================================

    /// @notice Update oracle price for a spot market
    /// @dev Callable by ORACLE_POSTER_ROLE or KEEPER_ROLE. Stores in latestPrice[uint256(marketId)].
    /// @param _marketId The spot market identifier
    /// @param _price Price in 18 decimals (USD)
    function updateSpotPrice(bytes32 _marketId, uint256 _price) external {
        // Allow both oracle poster and keeper roles
        AppStorage storage s = appStorage();
        require(
            LibAccessControl.hasRole(LibAccessControl.ORACLE_POSTER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender),
            "SpotRegistry: not authorized"
        );
        require(_price > 0, "SpotRegistry: zero price");
        require(s.spotMarkets[_marketId].active, "SpotRegistry: market not active");

        uint256 key = uint256(_marketId);
        s.latestPrice[key] = _price;
        s.latestPriceTimestamp[key] = block.timestamp;
    }

    /// @notice Batch update oracle prices for multiple spot markets
    /// @param _marketIds Array of spot market identifiers
    /// @param _prices Array of prices (18 decimals, USD)
    function batchUpdateSpotPrices(bytes32[] calldata _marketIds, uint256[] calldata _prices) external {
        require(
            LibAccessControl.hasRole(LibAccessControl.ORACLE_POSTER_ROLE, msg.sender) ||
            LibAccessControl.hasRole(LibAccessControl.KEEPER_ROLE, msg.sender),
            "SpotRegistry: not authorized"
        );
        require(_marketIds.length == _prices.length, "SpotRegistry: length mismatch");

        AppStorage storage s = appStorage();
        for (uint256 i; i < _marketIds.length;) {
            require(_prices[i] > 0, "SpotRegistry: zero price");
            require(s.spotMarkets[_marketIds[i]].active, "SpotRegistry: market not active");
            uint256 key = uint256(_marketIds[i]);
            s.latestPrice[key] = _prices[i];
            s.latestPriceTimestamp[key] = block.timestamp;
            unchecked { ++i; }
        }
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get full spot market details
    function getSpotMarket(bytes32 _marketId) external view returns (
        address baseToken,
        address quoteToken,
        uint8 mode,
        bool active,
        uint128 minOrderSize,
        int16 maxOffsetBps,
        uint16 takerFeeBps,
        int16 makerRebateBps,
        uint256 batchModeUntilBlock
    ) {
        AppStorage storage s = appStorage();
        SpotMarket storage m = s.spotMarkets[_marketId];
        return (
            m.baseToken, m.quoteToken, m.mode, m.active,
            m.minOrderSize, m.maxOffsetBps, m.takerFeeBps,
            m.makerRebateBps, m.batchModeUntilBlock
        );
    }

    /// @notice Check if a spot market exists and is active
    function isSpotMarketActive(bytes32 _marketId) external view returns (bool) {
        AppStorage storage s = appStorage();
        return s.spotMarkets[_marketId].active;
    }

    /// @notice Get all active spot market IDs
    function getActiveSpotMarkets() external view returns (bytes32[] memory) {
        return appStorage().activeSpotMarketIds;
    }

    /// @notice Get total number of spot markets ever created
    function totalSpotMarkets() external view returns (uint256) {
        return appStorage().nextSpotMarketId;
    }
}
