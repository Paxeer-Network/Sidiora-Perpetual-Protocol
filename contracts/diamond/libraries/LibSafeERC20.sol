// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {IERC20} from "../interfaces/IERC20.sol";

/// @title LibSafeERC20 - Safe ERC20 transfer wrappers
/// @dev Handles tokens that don't return a bool on transfer (e.g., USDT).
///      No external dependencies.
library LibSafeERC20 {
    /// @notice Safely transfer tokens from the caller to a recipient
    function safeTransfer(address _token, address _to, uint256 _amount) internal {
        require(_token != address(0), "LibSafeERC20: transfer from zero address token");
        require(_to != address(0), "LibSafeERC20: transfer to zero address");
        if (_amount == 0) return;
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, _to, _amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "LibSafeERC20: transfer failed"
        );
    }

    /// @notice Safely transfer tokens from a sender to a recipient (requires approval)
    function safeTransferFrom(address _token, address _from, address _to, uint256 _amount) internal {
        require(_token != address(0), "LibSafeERC20: transferFrom zero address token");
        require(_from != address(0), "LibSafeERC20: transferFrom zero sender");
        require(_to != address(0), "LibSafeERC20: transferFrom zero recipient");
        if (_amount == 0) return;
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, _from, _to, _amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "LibSafeERC20: transferFrom failed"
        );
    }

    /// @notice Safely approve a spender to spend tokens
    /// @dev Resets approval to 0 first to handle USDT-style approve race condition
    function safeApprove(address _token, address _spender, uint256 _amount) internal {
        require(_token != address(0), "LibSafeERC20: approve zero address token");
        require(_spender != address(0), "LibSafeERC20: approve zero spender");
        // Reset to 0 first (for tokens like USDT that require this)
        if (_amount > 0) {
            (bool resetSuccess, bytes memory resetData) = _token.call(
                abi.encodeWithSelector(IERC20.approve.selector, _spender, 0)
            );
            require(
                resetSuccess && (resetData.length == 0 || abi.decode(resetData, (bool))),
                "LibSafeERC20: approve reset failed"
            );
        }
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(IERC20.approve.selector, _spender, _amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "LibSafeERC20: approve failed"
        );
    }
}
