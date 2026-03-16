// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {ITradingAccount} from "../diamond/interfaces/ITradingAccount.sol";
import {IERC20} from "../diamond/interfaces/IERC20.sol";
import {LibSafeERC20} from "../diamond/libraries/LibSafeERC20.sol";

/// @title TradingAccount - Per-user on-chain trading account (EIP-1167 clone template)
/// @dev Replaces UserVault. Each user gets their own clone.
///      Tracks per-position margins, on-chain ledger, delegation, and margin modes.
///      Backward-compatible with IUserVault via lockCollateral/receiveCollateral wrappers.
contract TradingAccount is ITradingAccount {
    // ============================================================
    //                         STATE
    // ============================================================

    // --- Identity ---
    address private _owner;
    address private _diamond;
    bool private _initialized;
    uint8 private _marginMode; // 0 = ISOLATED, 1 = CROSS

    // --- Balance Layer ---
    mapping(address => uint256) private _totalLocked; // token → aggregate locked
    mapping(uint256 => PositionMargin) private _positionMargins; // positionId → margin
    uint256[] private _activePositionIds;
    mapping(uint256 => uint256) private _positionIdxInActive; // positionId → index in _activePositionIds (1-indexed, 0=not present)
    mapping(address => uint256) private _crossMarginPool; // token → cross-margin shared pool

    // --- Delegation Layer ---
    mapping(address => DelegatePerms) private _delegates;
    address[] private _delegateList;
    mapping(address => uint256) private _delegateIdx; // 1-indexed

    // --- Ledger Layer ---
    uint256 private _nextEntryId;
    mapping(uint256 => LedgerEntry) private _ledger;
    uint256[] private _allEntryIds;
    mapping(uint256 => uint256[]) private _positionEntryIds; // positionId → entryIds

    // ============================================================
    //                       CONSTANTS
    // ============================================================

    uint8 constant ACTION_TRADE = 0;
    uint8 constant ACTION_WITHDRAW = 1;
    uint8 constant ACTION_MODIFY_MARGIN = 2;

    // ============================================================
    //                       MODIFIERS
    // ============================================================

    modifier onlyOwnerOrDelegate(uint8 _action) {
        require(
            msg.sender == _owner || _isDelegateAuthorized(msg.sender, _action),
            "TradingAccount: unauthorized"
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "TradingAccount: not owner");
        _;
    }

    modifier onlyDiamond() {
        require(msg.sender == _diamond, "TradingAccount: not diamond");
        _;
    }

    modifier onlyInit() {
        require(_initialized, "TradingAccount: not initialized");
        _;
    }

    // ============================================================
    //                     INITIALIZATION
    // ============================================================

    /// @inheritdoc ITradingAccount
    function initialize(address owner_, address diamond_) external override {
        require(!_initialized, "TradingAccount: already initialized");
        require(owner_ != address(0), "TradingAccount: owner zero");
        require(diamond_ != address(0), "TradingAccount: diamond zero");
        _owner = owner_;
        _diamond = diamond_;
        _marginMode = 0; // ISOLATED by default
        _initialized = true;
    }

    // ============================================================
    //                    OWNER FUNCTIONS
    // ============================================================

    /// @inheritdoc ITradingAccount
    function deposit(address _token, uint256 _amount) external override onlyOwnerOrDelegate(ACTION_MODIFY_MARGIN) onlyInit {
        require(_amount > 0, "TradingAccount: zero amount");
        LibSafeERC20.safeTransferFrom(_token, msg.sender, address(this), _amount);
        _recordLedger(uint8(LedgerEntryType.DEPOSIT), _token, _amount, 0, false);
        emit Deposited(_token, _amount);
    }

    /// @inheritdoc ITradingAccount
    function withdraw(address _token, uint256 _amount) external override onlyOwnerOrDelegate(ACTION_WITHDRAW) onlyInit {
        require(_amount > 0, "TradingAccount: zero amount");
        uint256 available = _availableBalance(_token);
        require(_amount <= available, "TradingAccount: insufficient balance");
        LibSafeERC20.safeTransfer(_token, msg.sender == _owner ? _owner : _owner, _amount);
        _recordLedger(uint8(LedgerEntryType.WITHDRAW), _token, _amount, 0, true);
        emit Withdrawn(_token, _amount);
    }

    /// @inheritdoc ITradingAccount
    function emergencyWithdraw(address _token) external override onlyOwner onlyInit {
        uint256 available = _availableBalance(_token);
        require(available > 0, "TradingAccount: no balance");
        LibSafeERC20.safeTransfer(_token, _owner, available);
        _recordLedger(uint8(LedgerEntryType.WITHDRAW), _token, available, 0, true);
        emit EmergencyWithdrawn(_token, available);
    }

    /// @inheritdoc ITradingAccount
    function setMarginMode(uint8 _mode) external override onlyOwner onlyInit {
        require(_mode <= 1, "TradingAccount: invalid mode");
        require(_activePositionIds.length == 0, "TradingAccount: close all positions first");
        uint8 old = _marginMode;
        _marginMode = _mode;
        emit MarginModeChanged(old, _mode);
    }

    /// @inheritdoc ITradingAccount
    function transferMargin(
        uint256 _fromPositionId,
        uint256 _toPositionId,
        uint256 _amount
    ) external override onlyOwnerOrDelegate(ACTION_MODIFY_MARGIN) onlyInit {
        require(_marginMode == 0, "TradingAccount: only in isolated mode");
        require(_amount > 0, "TradingAccount: zero amount");

        PositionMargin storage from = _positionMargins[_fromPositionId];
        PositionMargin storage to = _positionMargins[_toPositionId];
        require(from.lockedAmount > 0, "TradingAccount: source has no margin");
        require(to.lockedAmount > 0, "TradingAccount: dest has no margin");
        require(from.token == to.token, "TradingAccount: token mismatch");
        require(_amount <= from.lockedAmount, "TradingAccount: insufficient source margin");

        from.lockedAmount -= _amount;
        to.lockedAmount += _amount;

        emit MarginTransferred(_fromPositionId, _toPositionId, _amount);
    }

    /// @inheritdoc ITradingAccount
    function topUpPosition(
        uint256 _positionId,
        uint256 _amount
    ) external override onlyOwnerOrDelegate(ACTION_MODIFY_MARGIN) onlyInit {
        require(_amount > 0, "TradingAccount: zero amount");
        PositionMargin storage pm = _positionMargins[_positionId];
        require(pm.lockedAmount > 0 || pm.token != address(0), "TradingAccount: position not tracked");

        uint256 available = _availableBalance(pm.token);
        require(_amount <= available, "TradingAccount: insufficient idle balance");

        pm.lockedAmount += _amount;
        _totalLocked[pm.token] += _amount;

        _recordLedger(uint8(LedgerEntryType.LOCK), pm.token, _amount, _positionId, true);
        emit MarginLocked(_positionId, pm.token, _amount);
    }

    // ============================================================
    //                    DELEGATION
    // ============================================================

    /// @inheritdoc ITradingAccount
    function addDelegate(
        address _delegate,
        bool _canTrade,
        bool _canWithdraw,
        bool _canModifyMargin,
        uint256 _expiry
    ) external override onlyOwner onlyInit {
        require(_delegate != address(0), "TradingAccount: zero delegate");
        require(_delegate != _owner, "TradingAccount: cannot delegate self");
        require(_expiry == 0 || _expiry > block.timestamp, "TradingAccount: expired");

        if (_delegateIdx[_delegate] == 0) {
            _delegateList.push(_delegate);
            _delegateIdx[_delegate] = _delegateList.length; // 1-indexed
        }

        _delegates[_delegate] = DelegatePerms({
            canTrade: _canTrade,
            canWithdraw: _canWithdraw,
            canModifyMargin: _canModifyMargin,
            expiry: _expiry
        });

        emit DelegateAdded(_delegate, _canTrade, _canWithdraw, _canModifyMargin, _expiry);
    }

    /// @inheritdoc ITradingAccount
    function removeDelegate(address _delegate) external override onlyOwner onlyInit {
        require(_delegateIdx[_delegate] != 0, "TradingAccount: not a delegate");

        // Swap-and-pop from delegateList
        uint256 idx = _delegateIdx[_delegate] - 1;
        uint256 lastIdx = _delegateList.length - 1;
        if (idx != lastIdx) {
            address last = _delegateList[lastIdx];
            _delegateList[idx] = last;
            _delegateIdx[last] = idx + 1;
        }
        _delegateList.pop();
        delete _delegateIdx[_delegate];
        delete _delegates[_delegate];

        emit DelegateRemoved(_delegate);
    }

    /// @inheritdoc ITradingAccount
    function isDelegateAuthorized(address _delegate, uint8 _action) external view override returns (bool) {
        return _isDelegateAuthorized(_delegate, _action);
    }

    // ============================================================
    //                  DIAMOND FUNCTIONS
    // ============================================================

    /// @inheritdoc ITradingAccount
    function lockForPosition(
        address _token,
        uint256 _amount,
        uint256 _positionId,
        uint256 _marketId,
        bool _isLong,
        address _centralVault
    ) external override onlyDiamond onlyInit {
        require(_amount > 0, "TradingAccount: zero lock");
        uint256 available = _availableBalance(_token);
        require(_amount <= available, "TradingAccount: insufficient balance");

        // Track per-position margin
        PositionMargin storage pm = _positionMargins[_positionId];
        if (pm.token == address(0)) {
            // New position
            pm.token = _token;
            pm.marketId = _marketId;
            pm.isLong = _isLong;
            _addActivePosition(_positionId);
        }
        pm.lockedAmount += _amount;
        _totalLocked[_token] += _amount;

        // Transfer to central vault
        LibSafeERC20.safeTransfer(_token, _centralVault, _amount);

        _recordLedger(uint8(LedgerEntryType.LOCK), _token, _amount, _positionId, true);
        emit MarginLocked(_positionId, _token, _amount);
    }

    /// @inheritdoc ITradingAccount
    function unlockFromPosition(
        address _token,
        uint256 _amount,
        uint256 _positionId
    ) external override onlyDiamond onlyInit {
        PositionMargin storage pm = _positionMargins[_positionId];

        if (pm.lockedAmount >= _amount) {
            pm.lockedAmount -= _amount;
        } else {
            pm.lockedAmount = 0;
        }

        if (_totalLocked[_token] >= _amount) {
            _totalLocked[_token] -= _amount;
        } else {
            _totalLocked[_token] = 0;
        }

        // If position margin is zero, remove from active list
        if (pm.lockedAmount == 0) {
            _removeActivePosition(_positionId);
        }

        _recordLedger(uint8(LedgerEntryType.UNLOCK), _token, _amount, _positionId, false);
        emit MarginReleased(_positionId, _token, _amount);
    }

    /// @inheritdoc ITradingAccount
    function recordFee(address _token, uint256 _amount, uint256 _positionId) external override onlyDiamond onlyInit {
        if (_amount > 0) {
            _recordLedger(uint8(LedgerEntryType.FEE_PAID), _token, _amount, _positionId, true);
        }
    }

    /// @inheritdoc ITradingAccount
    function recordFunding(
        address _token,
        uint256 _amount,
        uint256 _positionId,
        bool _isPayment
    ) external override onlyDiamond onlyInit {
        if (_amount > 0) {
            uint8 entryType = _isPayment
                ? uint8(LedgerEntryType.FUNDING_PAID)
                : uint8(LedgerEntryType.FUNDING_RECEIVED);
            _recordLedger(entryType, _token, _amount, _positionId, _isPayment);
        }
    }

    /// @inheritdoc ITradingAccount
    function recordPnl(
        address _token,
        uint256 _amount,
        uint256 _positionId,
        bool _isProfit
    ) external override onlyDiamond onlyInit {
        if (_amount > 0) {
            _recordLedger(uint8(LedgerEntryType.PNL_REALIZED), _token, _amount, _positionId, !_isProfit);
        }
    }

    /// @inheritdoc ITradingAccount
    function liquidatePosition(uint256 _positionId) external override onlyDiamond onlyInit {
        PositionMargin storage pm = _positionMargins[_positionId];
        uint256 lost = pm.lockedAmount;
        address token = pm.token;

        if (_totalLocked[token] >= lost) {
            _totalLocked[token] -= lost;
        } else {
            _totalLocked[token] = 0;
        }
        pm.lockedAmount = 0;
        _removeActivePosition(_positionId);

        if (lost > 0) {
            _recordLedger(uint8(LedgerEntryType.LIQUIDATION), token, lost, _positionId, true);
        }
    }

    // ============================================================
    //              BACKWARD COMPATIBILITY
    // ============================================================

    /// @dev Legacy lockCollateral — routes to lockForPosition with positionId=0
    function lockCollateral(
        address _token,
        uint256 _amount,
        address _centralVault
    ) external override onlyDiamond onlyInit {
        require(_amount > 0, "TradingAccount: zero lock");
        uint256 available = _availableBalance(_token);
        require(_amount <= available, "TradingAccount: insufficient balance");

        _totalLocked[_token] += _amount;
        LibSafeERC20.safeTransfer(_token, _centralVault, _amount);
    }

    /// @dev Legacy receiveCollateral — routes to unlockFromPosition with positionId=0
    function receiveCollateral(
        address _token,
        uint256 _amount
    ) external override onlyDiamond onlyInit {
        if (_totalLocked[_token] >= _amount) {
            _totalLocked[_token] -= _amount;
        } else {
            _totalLocked[_token] = 0;
        }
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    /// @inheritdoc ITradingAccount
    function getAvailableBalance(address _token) external view override returns (uint256) {
        return _availableBalance(_token);
    }

    /// @inheritdoc ITradingAccount
    function getBalance(address _token) external view override returns (uint256) {
        return _availableBalance(_token);
    }

    /// @inheritdoc ITradingAccount
    function getLockedBalance(address _token) external view override returns (uint256) {
        return _totalLocked[_token];
    }

    /// @inheritdoc ITradingAccount
    function getPositionMargin(uint256 _positionId) external view override returns (PositionMargin memory) {
        return _positionMargins[_positionId];
    }

    /// @inheritdoc ITradingAccount
    function getActivePositionIds() external view override returns (uint256[] memory) {
        return _activePositionIds;
    }

    /// @inheritdoc ITradingAccount
    function getAccountSummary(address _token) external view override returns (AccountSummary memory) {
        return AccountSummary({
            idle: _availableBalance(_token),
            totalLocked: _totalLocked[_token],
            positionCount: _activePositionIds.length
        });
    }

    /// @inheritdoc ITradingAccount
    function getMarginMode() external view override returns (uint8) {
        return _marginMode;
    }

    /// @inheritdoc ITradingAccount
    function getLedger(uint256 _offset, uint256 _limit) external view override returns (LedgerEntry[] memory) {
        uint256 total = _allEntryIds.length;
        if (_offset >= total) return new LedgerEntry[](0);

        uint256 end = _offset + _limit;
        if (end > total) end = total;
        uint256 count = end - _offset;

        LedgerEntry[] memory entries = new LedgerEntry[](count);
        for (uint256 i; i < count; i++) {
            entries[i] = _ledger[_allEntryIds[_offset + i]];
        }
        return entries;
    }

    /// @inheritdoc ITradingAccount
    function getLedgerByPosition(uint256 _positionId) external view override returns (LedgerEntry[] memory) {
        uint256[] storage ids = _positionEntryIds[_positionId];
        LedgerEntry[] memory entries = new LedgerEntry[](ids.length);
        for (uint256 i; i < ids.length; i++) {
            entries[i] = _ledger[ids[i]];
        }
        return entries;
    }

    /// @inheritdoc ITradingAccount
    function getLedgerLength() external view override returns (uint256) {
        return _allEntryIds.length;
    }

    /// @inheritdoc ITradingAccount
    function getDelegates() external view override returns (address[] memory) {
        return _delegateList;
    }

    /// @inheritdoc ITradingAccount
    function getDelegatePerms(address _delegate) external view override returns (DelegatePerms memory) {
        return _delegates[_delegate];
    }

    /// @inheritdoc ITradingAccount
    function vaultOwner() external view override returns (address) {
        return _owner;
    }

    /// @notice Get the diamond address
    function diamond() external view returns (address) {
        return _diamond;
    }

    /// @notice Check if initialized
    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    // ============================================================
    //                  INTERNAL HELPERS
    // ============================================================

    function _availableBalance(address _token) internal view returns (uint256) {
        uint256 total = IERC20(_token).balanceOf(address(this));
        uint256 locked = _totalLocked[_token];
        if (total <= locked) return 0;
        return total - locked;
    }

    function _isDelegateAuthorized(address _delegate, uint8 _action) internal view returns (bool) {
        DelegatePerms storage perms = _delegates[_delegate];
        if (perms.expiry != 0 && perms.expiry < block.timestamp) return false;

        if (_action == ACTION_TRADE) return perms.canTrade;
        if (_action == ACTION_WITHDRAW) return perms.canWithdraw;
        if (_action == ACTION_MODIFY_MARGIN) return perms.canModifyMargin;
        return false;
    }

    function _addActivePosition(uint256 _positionId) internal {
        if (_positionIdxInActive[_positionId] == 0) {
            _activePositionIds.push(_positionId);
            _positionIdxInActive[_positionId] = _activePositionIds.length; // 1-indexed
        }
    }

    function _removeActivePosition(uint256 _positionId) internal {
        uint256 idx1 = _positionIdxInActive[_positionId];
        if (idx1 == 0) return; // not in list

        uint256 idx = idx1 - 1;
        uint256 lastIdx = _activePositionIds.length - 1;

        if (idx != lastIdx) {
            uint256 lastId = _activePositionIds[lastIdx];
            _activePositionIds[idx] = lastId;
            _positionIdxInActive[lastId] = idx + 1;
        }
        _activePositionIds.pop();
        delete _positionIdxInActive[_positionId];
    }

    function _recordLedger(
        uint8 _entryType,
        address _token,
        uint256 _amount,
        uint256 _positionId,
        bool _isDebit
    ) internal {
        uint256 entryId = ++_nextEntryId;
        _ledger[entryId] = LedgerEntry({
            entryType: _entryType,
            token: _token,
            amount: _amount,
            positionId: _positionId,
            timestamp: block.timestamp,
            isDebit: _isDebit
        });
        _allEntryIds.push(entryId);
        if (_positionId != 0) {
            _positionEntryIds[_positionId].push(entryId);
        }
        emit LedgerEntryRecorded(entryId, _entryType, _positionId, _amount);
    }
}
