// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";

/// @title PausableFacet - Global and per-market emergency pause
/// @dev Provides pause/unpause for the entire protocol and individual markets.
contract PausableFacet {
    // ============================================================
    //                          EVENTS
    // ============================================================

    event GlobalPaused(address indexed by);
    event GlobalUnpaused(address indexed by);
    event MarketPaused(uint256 indexed marketId, address indexed by);
    event MarketUnpaused(uint256 indexed marketId, address indexed by);

    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    /// @notice Check if the protocol is globally paused
    /// @return True if globally paused
    function isGlobalPaused() external view returns (bool) {
        return appStorage().globalPaused;
    }

    /// @notice Check if a specific market is paused
    /// @param _marketId The market identifier
    /// @return True if the market is paused
    function isMarketPaused(uint256 _marketId) external view returns (bool) {
        AppStorage storage s = appStorage();
        return s.globalPaused || s.marketPaused[_marketId];
    }

    // ============================================================
    //                    PAUSE FUNCTIONS
    // ============================================================

    /// @notice Pause the entire protocol — halts all trading
    /// @dev Only callable by accounts with PAUSER_ROLE
    function pauseGlobal() external {
        LibAccessControl.enforceRole(LibAccessControl.PAUSER_ROLE);
        AppStorage storage s = appStorage();
        require(!s.globalPaused, "PausableFacet: already paused");
        s.globalPaused = true;
        emit GlobalPaused(msg.sender);
    }

    /// @notice Unpause the entire protocol
    /// @dev Only callable by accounts with PAUSER_ROLE
    function unpauseGlobal() external {
        LibAccessControl.enforceRole(LibAccessControl.PAUSER_ROLE);
        AppStorage storage s = appStorage();
        require(s.globalPaused, "PausableFacet: not paused");
        s.globalPaused = false;
        emit GlobalUnpaused(msg.sender);
    }

    /// @notice Pause a specific market — halts trading for that market only
    /// @dev Only callable by accounts with PAUSER_ROLE
    /// @param _marketId The market to pause
    function pauseMarket(uint256 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.PAUSER_ROLE);
        AppStorage storage s = appStorage();
        require(!s.marketPaused[_marketId], "PausableFacet: market already paused");
        s.marketPaused[_marketId] = true;
        emit MarketPaused(_marketId, msg.sender);
    }

    /// @notice Unpause a specific market
    /// @dev Only callable by accounts with PAUSER_ROLE
    /// @param _marketId The market to unpause
    function unpauseMarket(uint256 _marketId) external {
        LibAccessControl.enforceRole(LibAccessControl.PAUSER_ROLE);
        AppStorage storage s = appStorage();
        require(s.marketPaused[_marketId], "PausableFacet: market not paused");
        s.marketPaused[_marketId] = false;
        emit MarketUnpaused(_marketId, msg.sender);
    }
}
