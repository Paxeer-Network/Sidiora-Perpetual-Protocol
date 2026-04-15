// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";
import {ITradingAccount} from "../../interfaces/ITradingAccount.sol";
import {IERC20} from "../../interfaces/IERC20.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title SpotSettlementFacet - Spot collateral, virtual balances, and epoch settlement
/// @dev Handles deposit/withdraw from TradingAccount into diamond-owned spot vault,
///      virtual balance tracking, lazy-netting epoch settlement, and fast-settle lane.
contract SpotSettlementFacet is ISpotEvents {
    // ============================================================
    //                    USER FUNCTIONS
    // ============================================================

    /// @notice Deposit tokens from user's TradingAccount into the spot vault
    /// @param _token Token address (must be in spot whitelist)
    /// @param _amount Raw token amount (token decimals)
    function depositSpotCollateral(address _token, uint256 _amount) external {
        require(_amount > 0, "SpotSettlement: zero amount");
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        require(s.spotAcceptedTokens[_token], "SpotSettlement: token not whitelisted");

        // Get user's TradingAccount vault
        address vault = s.userVaults[msg.sender];
        require(vault != address(0), "SpotSettlement: no vault");

        // Lock collateral from TradingAccount → diamond
        ITradingAccount(vault).lockCollateral(_token, _amount, address(this));

        // Update spot vault balance (real token accounting)
        s.spotVaultBalances[_token] += _amount;

        // Normalize to 18 decimals for virtual balance
        uint8 decimals = s.spotTokenDecimals[_token];
        int256 normalized = _normalizeToInt(decimals, _amount);

        // Credit virtual balance and deposited collateral
        s.spotVirtualBalances[msg.sender][_token] += normalized;
        s.spotDepositedCollateral[msg.sender][_token] += _amount;

        emit SpotCollateralDeposited(msg.sender, _token, _amount);

        LibReentrancyGuard.nonReentrantAfter();
    }

    /// @notice Withdraw tokens from the spot vault back to user's TradingAccount
    /// @param _token Token address
    /// @param _amount Raw token amount (token decimals)
    function withdrawSpotCollateral(address _token, uint256 _amount) external {
        require(_amount > 0, "SpotSettlement: zero amount");
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();

        // Check withdrawable amount
        uint256 withdrawable = _getWithdrawable(s, msg.sender, _token);
        require(_amount <= withdrawable, "SpotSettlement: exceeds withdrawable");

        // Get user's TradingAccount vault
        address vault = s.userVaults[msg.sender];
        require(vault != address(0), "SpotSettlement: no vault");

        // Debit virtual balance
        uint8 decimals = s.spotTokenDecimals[_token];
        int256 normalized = _normalizeToInt(decimals, _amount);
        s.spotVirtualBalances[msg.sender][_token] -= normalized;
        s.spotDepositedCollateral[msg.sender][_token] -= _amount;
        s.spotVaultBalances[_token] -= _amount;

        // Transfer from diamond → TradingAccount
        LibSafeERC20.safeTransfer(_token, vault, _amount);

        emit SpotCollateralWithdrawn(msg.sender, _token, _amount);

        LibReentrancyGuard.nonReentrantAfter();
    }

    /// @notice Fast-settle: immediately transfer tokens for a premium fee
    /// @param _token Token address to fast-settle
    function fastSettleSpot(address _token) external {
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        address vault = s.userVaults[msg.sender];
        require(vault != address(0), "SpotSettlement: no vault");

        int256 delta = s.spotEpochNetDelta[msg.sender][_token];
        require(delta != 0, "SpotSettlement: no pending delta");

        uint256 feeBps = s.spotFastSettleFeeBps;
        if (feeBps == 0) feeBps = 1; // default 1 bps

        if (delta > 0) {
            // User is owed tokens — transfer from diamond to vault
            uint256 amount = uint256(delta);
            uint256 fee = amount * feeBps / 10_000;
            uint256 net = amount - fee;

            s.spotVaultBalances[_token] -= net;
            LibSafeERC20.safeTransfer(_token, vault, net);

            emit FastSettled(msg.sender, _token, net, fee);
        } else {
            // User owes tokens — lock from TradingAccount to diamond
            uint256 amount = uint256(-delta);
            uint256 fee = amount * feeBps / 10_000;
            uint256 total = amount + fee;

            ITradingAccount(vault).lockCollateral(_token, total, address(this));
            s.spotVaultBalances[_token] += total;

            emit FastSettled(msg.sender, _token, amount, fee);
        }

        // Clear this user's delta for this token
        s.spotEpochNetDelta[msg.sender][_token] = 0;

        // Remove from dirty list if no more deltas (simplified — mark clean)
        // Full cleanup happens in settleSpotEpoch
        s.spotIsEpochDirty[msg.sender] = false;

        LibReentrancyGuard.nonReentrantAfter();
    }

    // ============================================================
    //                    EPOCH SETTLEMENT
    // ============================================================

    /// @notice Settle the current epoch — process all dirty users' net deltas
    /// @dev Permissionless — anyone (keepers) can call this
    function settleSpotEpoch() external {
        AppStorage storage s = appStorage();
        require(
            block.number >= s.spotCurrentEpochStart + s.spotEpochLength,
            "SpotSettlement: epoch not finished"
        );

        uint256 count = s.spotEpochDirtyUsers.length;
        _settleUsers(s, 0, count);

        // Advance epoch
        s.spotCurrentEpochStart = block.number;
        s.spotEpochCounter++;

        emit EpochSettled(s.spotEpochCounter, count, block.number);
    }

    /// @notice Paginated epoch settlement for gas-bounded execution
    /// @param _maxUsers Maximum number of dirty users to process
    function settleSpotEpochPaginated(uint256 _maxUsers) external {
        AppStorage storage s = appStorage();
        require(
            block.number >= s.spotCurrentEpochStart + s.spotEpochLength,
            "SpotSettlement: epoch not finished"
        );

        uint256 count = s.spotEpochDirtyUsers.length;
        uint256 toProcess = _maxUsers < count ? _maxUsers : count;
        _settleUsers(s, 0, toProcess);

        if (toProcess >= count) {
            // All users processed — advance epoch
            s.spotCurrentEpochStart = block.number;
            s.spotEpochCounter++;
            emit EpochSettled(s.spotEpochCounter, toProcess, block.number);
        }
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /// @notice Add a token to the spot whitelist
    /// @param _token Token address
    /// @param _decimals Token decimals (read from contract or supplied)
    function addSpotToken(address _token, uint8 _decimals) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_token != address(0), "SpotSettlement: zero address");
        AppStorage storage s = appStorage();
        require(!s.spotAcceptedTokens[_token], "SpotSettlement: already whitelisted");

        s.spotAcceptedTokens[_token] = true;
        s.spotTokenDecimals[_token] = _decimals;
        s.spotTokenList.push(_token);
    }

    /// @notice Remove a token from the spot whitelist
    /// @param _token Token address
    function removeSpotToken(address _token) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        AppStorage storage s = appStorage();
        require(s.spotAcceptedTokens[_token], "SpotSettlement: not whitelisted");

        s.spotAcceptedTokens[_token] = false;

        // Swap-and-pop from spotTokenList
        uint256 len = s.spotTokenList.length;
        for (uint256 i; i < len; i++) {
            if (s.spotTokenList[i] == _token) {
                s.spotTokenList[i] = s.spotTokenList[len - 1];
                s.spotTokenList.pop();
                break;
            }
        }
    }

    /// @notice Set epoch length (blocks per epoch)
    /// @param _epochLength Epoch length in blocks
    function setEpochLength(uint256 _epochLength) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_epochLength > 0, "SpotSettlement: zero epoch length");
        appStorage().spotEpochLength = _epochLength;
    }

    /// @notice Set fast-settle fee
    /// @param _feeBps Fee in basis points (e.g., 1 = 0.01%)
    function setFastSettleFeeBps(uint256 _feeBps) external {
        LibAccessControl.enforceRole(LibAccessControl.SPOT_ADMIN_ROLE);
        require(_feeBps <= 100, "SpotSettlement: fee too high"); // max 1%
        appStorage().spotFastSettleFeeBps = _feeBps;
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get the virtual balance for a user/token pair (normalized 18 dec, signed)
    function getSpotVirtualBalance(address _user, address _token) external view returns (int256) {
        return appStorage().spotVirtualBalances[_user][_token];
    }

    /// @notice Get the maximum withdrawable amount for a user/token (raw token decimals)
    function getSpotWithdrawable(address _user, address _token) external view returns (uint256) {
        return _getWithdrawable(appStorage(), _user, _token);
    }

    /// @notice Get blocks until the current epoch ends
    function blocksUntilSpotEpoch() external view returns (uint256) {
        AppStorage storage s = appStorage();
        uint256 epochEnd = s.spotCurrentEpochStart + s.spotEpochLength;
        if (block.number >= epochEnd) return 0;
        return epochEnd - block.number;
    }

    /// @notice Get the list of whitelisted spot tokens
    function getSpotTokenList() external view returns (address[] memory) {
        return appStorage().spotTokenList;
    }

    /// @notice Check if a token is whitelisted for spot trading
    function isSpotToken(address _token) external view returns (bool) {
        return appStorage().spotAcceptedTokens[_token];
    }

    /// @notice Get the deposited collateral for a user/token (raw token decimals)
    function getSpotDepositedCollateral(address _user, address _token) external view returns (uint256) {
        return appStorage().spotDepositedCollateral[_user][_token];
    }

    /// @notice Get current epoch info
    function getEpochInfo() external view returns (
        uint256 epochCounter,
        uint256 epochStart,
        uint256 epochLength,
        uint256 dirtyUserCount
    ) {
        AppStorage storage s = appStorage();
        return (
            s.spotEpochCounter,
            s.spotCurrentEpochStart,
            s.spotEpochLength,
            s.spotEpochDirtyUsers.length
        );
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    /// @dev Compute max withdrawable: min(deposited, max(0, denormalized(virtualBalance)))
    function _getWithdrawable(AppStorage storage s, address _user, address _token)
        internal
        view
        returns (uint256)
    {
        uint256 deposited = s.spotDepositedCollateral[_user][_token];
        int256 virtualBal = s.spotVirtualBalances[_user][_token];
        if (virtualBal <= 0) return 0;

        uint8 decimals = s.spotTokenDecimals[_token];
        uint256 denormalized = _denormalize(decimals, uint256(virtualBal));
        return deposited < denormalized ? deposited : denormalized;
    }

    /// @dev Normalize raw token amount to 18-decimal int256
    function _normalizeToInt(uint8 _decimals, uint256 _amount) internal pure returns (int256) {
        if (_decimals < 18) {
            return int256(_amount * (10 ** (18 - _decimals)));
        } else if (_decimals > 18) {
            return int256(_amount / (10 ** (_decimals - 18)));
        }
        return int256(_amount);
    }

    /// @dev Denormalize 18-decimal amount back to token decimals
    function _denormalize(uint8 _decimals, uint256 _amount18) internal pure returns (uint256) {
        if (_decimals < 18) {
            return _amount18 / (10 ** (18 - _decimals));
        } else if (_decimals > 18) {
            return _amount18 * (10 ** (_decimals - 18));
        }
        return _amount18;
    }

    /// @dev Settle a range of dirty users
    function _settleUsers(AppStorage storage s, uint256 _start, uint256 _end) internal {
        for (uint256 i = _start; i < _end;) {
            address user = s.spotEpochDirtyUsers[i];
            if (s.spotIsEpochDirty[user]) {
                _settleUser(s, user);
                s.spotIsEpochDirty[user] = false;
            }
            unchecked { ++i; }
        }

        // Clean up dirty users array (processed users)
        if (_end >= s.spotEpochDirtyUsers.length) {
            delete s.spotEpochDirtyUsers;
        }
    }

    /// @dev Settle one user across all spot tokens
    function _settleUser(AppStorage storage s, address _user) internal {
        address vault = s.userVaults[_user];
        if (vault == address(0)) return;

        uint256 tokenCount = s.spotTokenList.length;
        for (uint256 t; t < tokenCount;) {
            address token = s.spotTokenList[t];
            int256 delta = s.spotEpochNetDelta[_user][token];

            if (delta > 0) {
                // User is owed tokens — transfer from diamond to TradingAccount
                uint256 amount = uint256(delta);
                if (amount <= s.spotVaultBalances[token]) {
                    s.spotVaultBalances[token] -= amount;
                    LibSafeERC20.safeTransfer(token, vault, amount);
                }
            } else if (delta < 0) {
                // User owes tokens — lock from TradingAccount to diamond
                uint256 amount = uint256(-delta);
                ITradingAccount(vault).lockCollateral(token, amount, address(this));
                s.spotVaultBalances[token] += amount;
            }

            // Reset delta
            s.spotEpochNetDelta[_user][token] = 0;

            unchecked { ++t; }
        }
    }
}
