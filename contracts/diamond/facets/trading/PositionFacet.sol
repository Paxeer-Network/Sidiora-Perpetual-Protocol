// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, Position, Market, MarketOI, VirtualPool, FundingState, appStorage} from "../../storage/AppStorage.sol";
import {LibAccessControl} from "../../libraries/LibAccessControl.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibSafeERC20} from "../../libraries/LibSafeERC20.sol";
import {LibPosition} from "../../libraries/LibPosition.sol";
import {LibFee} from "../../libraries/LibFee.sol";
import {LibMath} from "../../libraries/LibMath.sol";
import {LibEvents} from "../../libraries/LibEvents.sol";
import {IUserVault} from "../../interfaces/IUserVault.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

/// @title PositionFacet - Position lifecycle: open, modify, close
/// @dev Net mode: one direction per market per user. If long, cannot short same market.
///      Funding is settled per-second on every interaction via cumulative index.
contract PositionFacet {
    // ============================================================
    //                    OPEN POSITION
    // ============================================================

    /// @notice Open a new leveraged position
    /// @param _marketId The market to trade
    /// @param _collateralToken The stablecoin used as collateral
    /// @param _collateralAmount Raw token amount to use as collateral
    /// @param _leverage Desired leverage in 18 decimals (e.g., 10e18 = 10x)
    /// @param _isLong True for long, false for short
    /// @return positionId The ID of the new position
    function openPosition(
        uint256 _marketId,
        address _collateralToken,
        uint256 _collateralAmount,
        uint256 _leverage,
        bool _isLong
    ) external returns (uint256 positionId) {
        LibReentrancyGuard.nonReentrantBefore();
        AppStorage storage s = appStorage();

        // --- Checks ---
        require(!s.globalPaused, "Position: protocol paused");
        require(!s.marketPaused[_marketId], "Position: market paused");

        Market storage market = s.markets[_marketId];
        require(market.enabled, "Position: market not enabled");
        require(s.acceptedCollateral[_collateralToken], "Position: collateral not accepted");

        // Net mode: no existing position in opposite direction
        uint256 existingPosId = s.userMarketPosition[msg.sender][_marketId];
        if (existingPosId != 0) {
            Position storage existingPos = s.positions[existingPosId];
            require(!existingPos.active, "Position: close existing position first");
        }

        // Normalize collateral to USD (18 dec)
        uint256 collateralUsd = _normalizeToUsd(s, _collateralToken, _collateralAmount);
        require(collateralUsd > 0, "Position: zero collateral value");

        // Validate leverage
        uint256 sizeUsd = LibMath.mulFp(collateralUsd, _leverage);
        LibPosition.validateLeverage(sizeUsd, collateralUsd, market.maxLeverage);

        // Check OI cap
        MarketOI storage oi = s.openInterest[_marketId];
        uint256 totalOI = _isLong ? oi.longOI + sizeUsd : oi.shortOI + sizeUsd;
        require(totalOI <= market.maxOpenInterest, "Position: exceeds max open interest");

        // Check price is fresh
        _enforcePriceNotStale(s, _marketId);

        // --- Get execution price ---
        uint256 entryPrice = _getExecutionPrice(s, _marketId, sizeUsd, _isLong);
        require(entryPrice > 0, "Position: invalid execution price");

        // --- Effects ---
        // Get user vault
        address vault = s.userVaults[msg.sender];
        require(vault != address(0), "Position: create vault first");

        // Lock collateral: UserVault → Diamond (CentralVault)
        IUserVault(vault).lockCollateral(_collateralToken, _collateralAmount, address(this));
        s.vaultBalances[_collateralToken] += _collateralAmount;

        // Calculate and deduct trading fee
        uint256 fee = LibFee.calculateTradingFee(sizeUsd, false); // taker fee
        uint256 feeInTokens = _usdToTokens(s, _collateralToken, fee);
        uint256 netCollateralAmount = _collateralAmount;
        if (feeInTokens > 0 && feeInTokens < _collateralAmount) {
            netCollateralAmount = _collateralAmount - feeInTokens;
            // Insurance fund gets a cut of the fee
            uint256 insuranceCut = LibFee.calculateInsuranceContribution(feeInTokens);
            s.insuranceBalances[_collateralToken] += insuranceCut;
        }
        uint256 netCollateralUsd = _normalizeToUsd(s, _collateralToken, netCollateralAmount);

        // Create position
        positionId = ++s.nextPositionId;
        FundingState storage fs = s.fundingStates[_marketId];
        _accrueFunding(s, _marketId); // update cumulative funding before reading

        s.positions[positionId] = Position({
            user: msg.sender,
            marketId: _marketId,
            isLong: _isLong,
            sizeUsd: sizeUsd,
            collateralUsd: netCollateralUsd,
            collateralToken: _collateralToken,
            collateralAmount: netCollateralAmount,
            entryPrice: entryPrice,
            lastFundingIndex: _isLong ? fs.cumulativeFundingPerUnitLong : fs.cumulativeFundingPerUnitShort,
            timestamp: block.timestamp,
            active: true
        });

        // Update mappings
        s.userPositionIds[msg.sender].push(positionId);
        s.userMarketPosition[msg.sender][_marketId] = positionId;

        // Update open interest
        if (_isLong) {
            oi.longOI += sizeUsd;
        } else {
            oi.shortOI += sizeUsd;
        }

        // Update vAMM reserves (virtual trade impact)
        _applyVirtualTrade(s, _marketId, sizeUsd, _isLong, true);

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.PositionOpened(
            positionId, msg.sender, _marketId, _isLong,
            sizeUsd, _leverage, entryPrice, _collateralToken, _collateralAmount
        );
    }

    // ============================================================
    //                    ADD COLLATERAL
    // ============================================================

    /// @notice Add collateral to an existing position (reduce leverage)
    /// @param _positionId The position to modify
    /// @param _amount Additional collateral amount (in position's collateral token)
    function addCollateral(uint256 _positionId, uint256 _amount) external {
        LibReentrancyGuard.nonReentrantBefore();
        AppStorage storage s = appStorage();

        Position storage pos = s.positions[_positionId];
        require(pos.active, "Position: not active");
        require(pos.user == msg.sender, "Position: not owner");
        require(_amount > 0, "Position: zero amount");

        address vault = s.userVaults[msg.sender];
        IUserVault(vault).lockCollateral(pos.collateralToken, _amount, address(this));
        s.vaultBalances[pos.collateralToken] += _amount;

        pos.collateralAmount += _amount;
        pos.collateralUsd += _normalizeToUsd(s, pos.collateralToken, _amount);

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.PositionModified(_positionId, pos.sizeUsd, pos.collateralUsd, pos.collateralAmount);
    }

    // ============================================================
    //                     ADD SIZE
    // ============================================================

    /// @notice Add to position size (increase exposure in same direction)
    /// @param _positionId The position to modify
    /// @param _additionalCollateral Additional collateral amount
    /// @param _leverage Leverage for the additional size
    function addSize(uint256 _positionId, uint256 _additionalCollateral, uint256 _leverage) external {
        LibReentrancyGuard.nonReentrantBefore();
        AppStorage storage s = appStorage();

        Position storage pos = s.positions[_positionId];
        require(pos.active, "Position: not active");
        require(pos.user == msg.sender, "Position: not owner");
        require(!s.globalPaused && !s.marketPaused[pos.marketId], "Position: paused");
        _enforcePriceNotStale(s, pos.marketId);

        Market storage market = s.markets[pos.marketId];

        // Settle funding before modifying
        _settleFundingForPosition(s, pos);

        uint256 addedCollateralUsd = _normalizeToUsd(s, pos.collateralToken, _additionalCollateral);
        uint256 addedSize = LibMath.mulFp(addedCollateralUsd, _leverage);
        LibPosition.validateLeverage(addedSize, addedCollateralUsd, market.maxLeverage);

        // Lock additional collateral
        address vault = s.userVaults[msg.sender];
        IUserVault(vault).lockCollateral(pos.collateralToken, _additionalCollateral, address(this));
        s.vaultBalances[pos.collateralToken] += _additionalCollateral;

        // Fee on additional size
        uint256 fee = LibFee.calculateTradingFee(addedSize, false);
        uint256 feeInTokens = _usdToTokens(s, pos.collateralToken, fee);
        uint256 netAdditional = _additionalCollateral > feeInTokens ? _additionalCollateral - feeInTokens : 0;
        uint256 netAddedUsd = _normalizeToUsd(s, pos.collateralToken, netAdditional);

        // Update entry price (weighted average)
        uint256 currentPrice = s.latestPrice[pos.marketId];
        pos.entryPrice = LibPosition.calculateAverageEntryPrice(
            pos.sizeUsd, pos.entryPrice, addedSize, currentPrice
        );

        pos.sizeUsd += addedSize;
        pos.collateralAmount += netAdditional;
        pos.collateralUsd += netAddedUsd;

        // Check total OI
        MarketOI storage oi = s.openInterest[pos.marketId];
        if (pos.isLong) {
            oi.longOI += addedSize;
        } else {
            oi.shortOI += addedSize;
        }

        // Update vAMM
        _applyVirtualTrade(s, pos.marketId, addedSize, pos.isLong, true);

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.PositionModified(_positionId, pos.sizeUsd, pos.collateralUsd, pos.collateralAmount);
    }

    // ============================================================
    //                   PARTIAL CLOSE
    // ============================================================

    /// @notice Close a portion of a position
    /// @param _positionId The position to partially close
    /// @param _closeSizeUsd The notional size to close (18 dec)
    function partialClose(uint256 _positionId, uint256 _closeSizeUsd) external {
        LibReentrancyGuard.nonReentrantBefore();
        AppStorage storage s = appStorage();

        Position storage pos = s.positions[_positionId];
        require(pos.active, "Position: not active");
        require(pos.user == msg.sender, "Position: not owner");
        require(_closeSizeUsd > 0 && _closeSizeUsd < pos.sizeUsd, "Position: invalid close size");
        _enforcePriceNotStale(s, pos.marketId);

        // Settle funding
        _settleFundingForPosition(s, pos);

        uint256 exitPrice = s.latestPrice[pos.marketId];
        int256 totalPnl = LibPosition.calculatePnl(pos, exitPrice);

        // Proportional close
        uint256 closeFraction = LibMath.divFp(_closeSizeUsd, pos.sizeUsd);
        int256 closedPnl = LibMath.mulFpSigned(totalPnl, int256(closeFraction));
        uint256 releasedCollateral = LibMath.mulFp(pos.collateralAmount, closeFraction);
        uint256 releasedCollateralUsd = LibMath.mulFp(pos.collateralUsd, closeFraction);

        // Fee on closed size
        uint256 fee = LibFee.calculateTradingFee(_closeSizeUsd, false);
        uint256 feeInTokens = _usdToTokens(s, pos.collateralToken, fee);

        // Calculate payout
        uint256 payout = _calculatePayout(releasedCollateral, closedPnl, feeInTokens, pos.collateralToken, s);

        // Update position
        pos.sizeUsd -= _closeSizeUsd;
        pos.collateralAmount -= releasedCollateral;
        pos.collateralUsd -= releasedCollateralUsd;

        // Update OI
        MarketOI storage oi = s.openInterest[pos.marketId];
        if (pos.isLong) {
            oi.longOI = oi.longOI > _closeSizeUsd ? oi.longOI - _closeSizeUsd : 0;
        } else {
            oi.shortOI = oi.shortOI > _closeSizeUsd ? oi.shortOI - _closeSizeUsd : 0;
        }

        // Reverse vAMM impact
        _applyVirtualTrade(s, pos.marketId, _closeSizeUsd, pos.isLong, false);

        // Transfer payout to user vault
        if (payout > 0) {
            _payoutToVault(s, msg.sender, pos.collateralToken, payout);
        }

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.PositionClosed(
            _positionId, msg.sender, pos.marketId,
            _closeSizeUsd, exitPrice, closedPnl, false
        );
    }

    // ============================================================
    //                    FULL CLOSE
    // ============================================================

    /// @notice Close a position entirely
    /// @param _positionId The position to close
    function closePosition(uint256 _positionId) external {
        LibReentrancyGuard.nonReentrantBefore();
        AppStorage storage s = appStorage();

        Position storage pos = s.positions[_positionId];
        require(pos.active, "Position: not active");
        require(pos.user == msg.sender, "Position: not owner");
        _enforcePriceNotStale(s, pos.marketId);

        // Settle funding
        _settleFundingForPosition(s, pos);

        uint256 exitPrice = s.latestPrice[pos.marketId];
        int256 pnl = LibPosition.calculatePnl(pos, exitPrice);

        // Fee
        uint256 fee = LibFee.calculateTradingFee(pos.sizeUsd, false);
        uint256 feeInTokens = _usdToTokens(s, pos.collateralToken, fee);

        // Calculate payout
        uint256 payout = _calculatePayout(pos.collateralAmount, pnl, feeInTokens, pos.collateralToken, s);

        uint256 closedSize = pos.sizeUsd;

        // Update OI
        MarketOI storage oi = s.openInterest[pos.marketId];
        if (pos.isLong) {
            oi.longOI = oi.longOI > closedSize ? oi.longOI - closedSize : 0;
        } else {
            oi.shortOI = oi.shortOI > closedSize ? oi.shortOI - closedSize : 0;
        }

        // Reverse vAMM impact
        _applyVirtualTrade(s, pos.marketId, closedSize, pos.isLong, false);

        // Deactivate position
        pos.active = false;
        s.userMarketPosition[msg.sender][pos.marketId] = 0;

        // Transfer payout
        if (payout > 0) {
            _payoutToVault(s, msg.sender, pos.collateralToken, payout);
        }

        LibReentrancyGuard.nonReentrantAfter();

        emit LibEvents.PositionClosed(
            _positionId, msg.sender, pos.marketId,
            closedSize, exitPrice, pnl, true
        );
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get position details
    function getPosition(uint256 _positionId) external view returns (
        address user, uint256 marketId, bool isLong, uint256 sizeUsd,
        uint256 collateralUsd, address collateralToken, uint256 collateralAmount,
        uint256 entryPrice, uint256 timestamp, bool active
    ) {
        Position storage pos = appStorage().positions[_positionId];
        return (pos.user, pos.marketId, pos.isLong, pos.sizeUsd,
                pos.collateralUsd, pos.collateralToken, pos.collateralAmount,
                pos.entryPrice, pos.timestamp, pos.active);
    }

    /// @notice Get all position IDs for a user
    function getUserPositionIds(address _user) external view returns (uint256[] memory) {
        return appStorage().userPositionIds[_user];
    }

    /// @notice Get the active position ID for a user in a specific market
    function getUserMarketPosition(address _user, uint256 _marketId) external view returns (uint256) {
        return appStorage().userMarketPosition[_user][_marketId];
    }

    /// @notice Get open interest for a market
    function getOpenInterest(uint256 _marketId) external view returns (uint256 longOI, uint256 shortOI) {
        MarketOI storage oi = appStorage().openInterest[_marketId];
        return (oi.longOI, oi.shortOI);
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    function _normalizeToUsd(AppStorage storage s, address _token, uint256 _amount) internal view returns (uint256) {
        uint8 decimals = s.collateralDecimals[_token];
        if (decimals < 18) {
            return _amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            return _amount / (10 ** (decimals - 18));
        }
        return _amount;
    }

    function _usdToTokens(AppStorage storage s, address _token, uint256 _usdAmount) internal view returns (uint256) {
        uint8 decimals = s.collateralDecimals[_token];
        if (decimals < 18) {
            return _usdAmount / (10 ** (18 - decimals));
        } else if (decimals > 18) {
            return _usdAmount * (10 ** (decimals - 18));
        }
        return _usdAmount;
    }

    function _enforcePriceNotStale(AppStorage storage s, uint256 _marketId) internal view {
        uint256 maxStale = s.maxPriceStaleness;
        if (maxStale == 0) maxStale = 120;
        require(
            block.timestamp <= s.latestPriceTimestamp[_marketId] + maxStale,
            "Position: price is stale"
        );
    }

    function _getExecutionPrice(
        AppStorage storage s,
        uint256 _marketId,
        uint256 _sizeUsd,
        bool _isLong
    ) internal view returns (uint256) {
        uint256 oraclePrice = s.latestPrice[_marketId];
        VirtualPool storage pool = s.virtualPools[_marketId];

        if (pool.baseReserve == 0 || _sizeUsd == 0) return oraclePrice;

        uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);
        uint256 markPrice = LibMath.divFp(pool.quoteReserve, pool.baseReserve);

        uint256 newQuote;
        uint256 baseDelta;

        if (_isLong) {
            newQuote = pool.quoteReserve + _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            baseDelta = pool.baseReserve > newBase ? pool.baseReserve - newBase : 0;
        } else {
            if (_sizeUsd >= pool.quoteReserve) return oraclePrice;
            newQuote = pool.quoteReserve - _sizeUsd;
            uint256 newBase = LibMath.divFp(k, newQuote);
            baseDelta = newBase > pool.baseReserve ? newBase - pool.baseReserve : 0;
        }

        if (baseDelta == 0) return oraclePrice;

        uint256 vammPrice = LibMath.divFp(_sizeUsd, baseDelta);

        // Blend with oracle
        if (vammPrice >= markPrice) {
            uint256 spread = vammPrice - markPrice;
            return oraclePrice + spread;
        } else {
            uint256 spread = markPrice - vammPrice;
            return oraclePrice > spread ? oraclePrice - spread : 1;
        }
    }

    function _applyVirtualTrade(
        AppStorage storage s,
        uint256 _marketId,
        uint256 _sizeUsd,
        bool _isLong,
        bool _isOpen
    ) internal {
        VirtualPool storage pool = s.virtualPools[_marketId];
        if (pool.baseReserve == 0) return;

        uint256 k = LibMath.mulFp(pool.baseReserve, pool.quoteReserve);

        // Opening long = buy (add quote), closing long = sell (remove quote)
        // Opening short = sell (remove quote), closing short = buy (add quote)
        bool addQuote = (_isLong && _isOpen) || (!_isLong && !_isOpen);

        if (addQuote) {
            pool.quoteReserve += _sizeUsd;
        } else {
            pool.quoteReserve = pool.quoteReserve > _sizeUsd ? pool.quoteReserve - _sizeUsd : 1;
        }

        // Adjust base to maintain k
        if (pool.quoteReserve > 0) {
            pool.baseReserve = LibMath.divFp(k, pool.quoteReserve);
        }
    }

    function _accrueFunding(AppStorage storage s, uint256 _marketId) internal {
        FundingState storage fs = s.fundingStates[_marketId];
        if (fs.lastUpdateTimestamp == 0) {
            fs.lastUpdateTimestamp = block.timestamp;
            return;
        }
        uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
        if (elapsed == 0) return;

        int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
        fs.cumulativeFundingPerUnitLong += accrued;
        fs.cumulativeFundingPerUnitShort -= accrued; // opposite direction
        fs.lastUpdateTimestamp = block.timestamp;
    }

    function _settleFundingForPosition(AppStorage storage s, Position storage pos) internal {
        _accrueFunding(s, pos.marketId);
        FundingState storage fs = s.fundingStates[pos.marketId];

        int256 currentIndex = pos.isLong
            ? fs.cumulativeFundingPerUnitLong
            : fs.cumulativeFundingPerUnitShort;

        int256 fundingDelta = currentIndex - pos.lastFundingIndex;
        int256 fundingPayment = LibMath.mulFpSigned(int256(pos.sizeUsd), fundingDelta);

        // Apply to collateral
        if (fundingPayment > 0) {
            // Position owes funding
            uint256 owed = uint256(fundingPayment);
            uint256 owedTokens = _usdToTokens(s, pos.collateralToken, owed);
            if (owedTokens < pos.collateralAmount) {
                pos.collateralAmount -= owedTokens;
                pos.collateralUsd = pos.collateralUsd > owed ? pos.collateralUsd - owed : 0;
            }
        } else if (fundingPayment < 0) {
            // Position receives funding
            uint256 received = uint256(-fundingPayment);
            uint256 receivedTokens = _usdToTokens(s, pos.collateralToken, received);
            pos.collateralAmount += receivedTokens;
            pos.collateralUsd += received;
        }

        pos.lastFundingIndex = currentIndex;
    }

    function _calculatePayout(
        uint256 _collateralAmount,
        int256 _pnl,
        uint256 _feeInTokens,
        address _token,
        AppStorage storage s
    ) internal returns (uint256 payout) {
        uint256 pnlTokens;
        if (_pnl > 0) {
            pnlTokens = _usdToTokens(s, _token, uint256(_pnl));
            payout = _collateralAmount + pnlTokens;
        } else if (_pnl < 0) {
            pnlTokens = _usdToTokens(s, _token, uint256(-_pnl));
            payout = _collateralAmount > pnlTokens ? _collateralAmount - pnlTokens : 0;
        } else {
            payout = _collateralAmount;
        }

        // Deduct fee
        payout = payout > _feeInTokens ? payout - _feeInTokens : 0;

        // Insurance contribution from fee
        uint256 insuranceCut = LibFee.calculateInsuranceContribution(_feeInTokens);
        s.insuranceBalances[_token] += insuranceCut;
    }

    function _payoutToVault(
        AppStorage storage s,
        address _user,
        address _token,
        uint256 _amount
    ) internal {
        address vault = s.userVaults[_user];
        require(vault != address(0), "Position: no vault");

        // Deduct from central vault balance
        s.vaultBalances[_token] = s.vaultBalances[_token] > _amount
            ? s.vaultBalances[_token] - _amount
            : 0;

        // Transfer tokens to user vault
        LibSafeERC20.safeTransfer(_token, vault, _amount);

        // Notify vault to update locked balance accounting
        IUserVault(vault).receiveCollateral(_token, _amount);
    }
}
