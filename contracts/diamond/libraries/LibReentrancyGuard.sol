// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../storage/AppStorage.sol";

/// @title LibReentrancyGuard - Reentrancy protection via AppStorage mutex
/// @dev Uses a status flag in AppStorage. No external dependencies.
library LibReentrancyGuard {
    uint256 constant NOT_ENTERED = 1;
    uint256 constant ENTERED = 2;

    /// @notice Call before the protected function body
    function nonReentrantBefore() internal {
        AppStorage storage s = appStorage();
        require(s.reentrancyStatus != ENTERED, "LibReentrancyGuard: reentrant call");
        s.reentrancyStatus = ENTERED;
    }

    /// @notice Call after the protected function body
    function nonReentrantAfter() internal {
        AppStorage storage s = appStorage();
        s.reentrancyStatus = NOT_ENTERED;
    }
}
