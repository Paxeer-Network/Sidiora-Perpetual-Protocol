// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

/// @title ITradingAccount - Per-user on-chain trading account interface
/// @dev Replaces IUserVault. Each user gets an EIP-1167 clone.
///      Tracks per-position margins, delegation, margin modes, and an on-chain ledger.
interface ITradingAccount {
    // ============================================================
    //                         ENUMS
    // ============================================================

    enum MarginMode { ISOLATED, CROSS }

    enum LedgerEntryType {
        DEPOSIT,
        WITHDRAW,
        LOCK,
        UNLOCK,
        FEE_PAID,
        FEE_REBATE,
        FUNDING_PAID,
        FUNDING_RECEIVED,
        PNL_REALIZED,
        LIQUIDATION
    }

    // ============================================================
    //                        STRUCTS
    // ============================================================

    struct PositionMargin {
        address token;
        uint256 lockedAmount;
        uint256 marketId;
        bool isLong;
    }

    struct DelegatePerms {
        bool canTrade;
        bool canWithdraw;
        bool canModifyMargin;
        uint256 expiry;
    }

    struct LedgerEntry {
        uint8 entryType;
        address token;
        uint256 amount;
        uint256 positionId;
        uint256 timestamp;
        bool isDebit;
    }

    struct AccountSummary {
        uint256 idle;
        uint256 totalLocked;
        uint256 positionCount;
    }

    // ============================================================
    //                        EVENTS
    // ============================================================

    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);
    event EmergencyWithdrawn(address indexed token, uint256 amount);
    event MarginLocked(uint256 indexed positionId, address indexed token, uint256 amount);
    event MarginReleased(uint256 indexed positionId, address indexed token, uint256 amount);
    event MarginModeChanged(uint8 oldMode, uint8 newMode);
    event MarginTransferred(uint256 indexed fromPositionId, uint256 indexed toPositionId, uint256 amount);
    event DelegateAdded(address indexed delegate, bool canTrade, bool canWithdraw, bool canModifyMargin, uint256 expiry);
    event DelegateRemoved(address indexed delegate);
    event LedgerEntryRecorded(uint256 indexed entryId, uint8 entryType, uint256 indexed positionId, uint256 amount);

    // ============================================================
    //                   INITIALIZATION
    // ============================================================

    function initialize(address _owner, address _diamond) external;

    // ============================================================
    //                  OWNER FUNCTIONS
    // ============================================================

    function deposit(address _token, uint256 _amount) external;
    function withdraw(address _token, uint256 _amount) external;
    function emergencyWithdraw(address _token) external;
    function setMarginMode(uint8 _mode) external;
    function transferMargin(uint256 _fromPositionId, uint256 _toPositionId, uint256 _amount) external;
    function topUpPosition(uint256 _positionId, uint256 _amount) external;

    // ============================================================
    //                 DELEGATION
    // ============================================================

    function addDelegate(address _delegate, bool _canTrade, bool _canWithdraw, bool _canModifyMargin, uint256 _expiry) external;
    function removeDelegate(address _delegate) external;
    function isDelegateAuthorized(address _delegate, uint8 _action) external view returns (bool);

    // ============================================================
    //                 DIAMOND FUNCTIONS
    // ============================================================

    function lockForPosition(address _token, uint256 _amount, uint256 _positionId, uint256 _marketId, bool _isLong, address _centralVault) external;
    function unlockFromPosition(address _token, uint256 _amount, uint256 _positionId) external;
    function recordFee(address _token, uint256 _amount, uint256 _positionId) external;
    function recordFunding(address _token, uint256 _amount, uint256 _positionId, bool _isPayment) external;
    function recordPnl(address _token, uint256 _amount, uint256 _positionId, bool _isProfit) external;
    function liquidatePosition(uint256 _positionId) external;

    // ============================================================
    //              BACKWARD COMPATIBILITY
    // ============================================================

    function lockCollateral(address _token, uint256 _amount, address _centralVault) external;
    function receiveCollateral(address _token, uint256 _amount) external;

    // ============================================================
    //                  VIEW FUNCTIONS
    // ============================================================

    function getAvailableBalance(address _token) external view returns (uint256);
    function getBalance(address _token) external view returns (uint256);
    function getLockedBalance(address _token) external view returns (uint256);
    function getPositionMargin(uint256 _positionId) external view returns (PositionMargin memory);
    function getActivePositionIds() external view returns (uint256[] memory);
    function getAccountSummary(address _token) external view returns (AccountSummary memory);
    function getMarginMode() external view returns (uint8);
    function getLedger(uint256 _offset, uint256 _limit) external view returns (LedgerEntry[] memory);
    function getLedgerByPosition(uint256 _positionId) external view returns (LedgerEntry[] memory);
    function getLedgerLength() external view returns (uint256);
    function getDelegates() external view returns (address[] memory);
    function getDelegatePerms(address _delegate) external view returns (DelegatePerms memory);
    function vaultOwner() external view returns (address);
}
