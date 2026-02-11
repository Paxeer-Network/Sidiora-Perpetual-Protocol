// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {IUserVault} from "../diamond/interfaces/IUserVault.sol";
import {IERC20} from "../diamond/interfaces/IERC20.sol";
import {LibSafeERC20} from "../diamond/libraries/LibSafeERC20.sol";

/// @title UserVault - Per-user collateral vault (EIP-1167 clone template)
/// @dev Each user gets their own clone of this contract. Holds stablecoins.
///      Only the owner can deposit/withdraw idle funds.
///      Only the diamond can lock/release collateral for trades.
contract UserVault is IUserVault {
    // ============================================================
    //                         STATE
    // ============================================================

    address private _owner;
    address private _diamond;
    bool private _initialized;

    // token → locked amount (in active positions)
    mapping(address => uint256) private _lockedBalances;

    // ============================================================
    //                       MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        require(msg.sender == _owner, "UserVault: caller is not owner");
        _;
    }

    modifier onlyDiamond() {
        require(msg.sender == _diamond, "UserVault: caller is not diamond");
        _;
    }

    modifier onlyInitialized() {
        require(_initialized, "UserVault: not initialized");
        _;
    }

    // ============================================================
    //                     INITIALIZATION
    // ============================================================

    /// @inheritdoc IUserVault
    function initialize(address owner_, address diamond_) external override {
        require(!_initialized, "UserVault: already initialized");
        require(owner_ != address(0), "UserVault: owner is zero");
        require(diamond_ != address(0), "UserVault: diamond is zero");
        _owner = owner_;
        _diamond = diamond_;
        _initialized = true;
    }

    // ============================================================
    //                    OWNER FUNCTIONS
    // ============================================================

    /// @inheritdoc IUserVault
    function deposit(address _token, uint256 _amount) external override onlyOwner onlyInitialized {
        require(_amount > 0, "UserVault: zero amount");
        LibSafeERC20.safeTransferFrom(_token, msg.sender, address(this), _amount);
        emit Deposited(_token, _amount);
    }

    /// @inheritdoc IUserVault
    function withdraw(address _token, uint256 _amount) external override onlyOwner onlyInitialized {
        require(_amount > 0, "UserVault: zero amount");
        uint256 available = _availableBalance(_token);
        require(_amount <= available, "UserVault: insufficient available balance");
        LibSafeERC20.safeTransfer(_token, msg.sender, _amount);
        emit Withdrawn(_token, _amount);
    }

    /// @inheritdoc IUserVault
    function emergencyWithdraw(address _token) external override onlyOwner onlyInitialized {
        uint256 available = _availableBalance(_token);
        require(available > 0, "UserVault: no available balance");
        LibSafeERC20.safeTransfer(_token, msg.sender, available);
        emit EmergencyWithdrawn(_token, available);
    }

    // ============================================================
    //                   DIAMOND FUNCTIONS
    // ============================================================

    /// @inheritdoc IUserVault
    function lockCollateral(
        address _token,
        uint256 _amount,
        address _centralVault
    ) external override onlyDiamond onlyInitialized {
        require(_amount > 0, "UserVault: zero lock amount");
        uint256 available = _availableBalance(_token);
        require(_amount <= available, "UserVault: insufficient balance to lock");
        _lockedBalances[_token] += _amount;
        LibSafeERC20.safeTransfer(_token, _centralVault, _amount);
        emit CollateralLocked(_token, _amount);
    }

    /// @inheritdoc IUserVault
    function receiveCollateral(
        address _token,
        uint256 _amount
    ) external override onlyDiamond onlyInitialized {
        // Funds are transferred TO this vault by the diamond before calling this.
        // This function updates the locked balance accounting.
        if (_lockedBalances[_token] >= _amount) {
            _lockedBalances[_token] -= _amount;
        } else {
            // If receiving more than locked (profit case), reset locked to 0
            _lockedBalances[_token] = 0;
        }
        emit CollateralReleased(_token, _amount);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @inheritdoc IUserVault
    function getBalance(address _token) external view override returns (uint256) {
        return _availableBalance(_token);
    }

    /// @inheritdoc IUserVault
    function getLockedBalance(address _token) external view override returns (uint256) {
        return _lockedBalances[_token];
    }

    /// @inheritdoc IUserVault
    function vaultOwner() external view override returns (address) {
        return _owner;
    }

    /// @notice Get the diamond address authorized to lock/release collateral
    function diamond() external view returns (address) {
        return _diamond;
    }

    /// @notice Check if this vault has been initialized
    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    // ============================================================
    //                    INTERNAL HELPERS
    // ============================================================

    /// @dev Available balance = total token balance held - locked amount
    function _availableBalance(address _token) internal view returns (uint256) {
        uint256 totalBalance = IERC20(_token).balanceOf(address(this));
        uint256 locked = _lockedBalances[_token];
        if (totalBalance <= locked) return 0;
        return totalBalance - locked;
    }
}
