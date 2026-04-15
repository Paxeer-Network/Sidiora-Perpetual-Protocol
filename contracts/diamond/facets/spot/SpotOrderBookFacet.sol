// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, SpotOrder, SpotMarket, appStorage} from "../../storage/AppStorage.sol";
import {LibReentrancyGuard} from "../../libraries/LibReentrancyGuard.sol";
import {LibSpotMatching} from "../../libraries/LibSpotMatching.sol";
import {LibOROB} from "../../libraries/LibOROB.sol";
import {LibPoFQ} from "../../libraries/LibPoFQ.sol";
import {LibSpotSettlement} from "../../libraries/LibSpotSettlement.sol";
import {ISpotEvents} from "../../interfaces/ISpotEvents.sol";

/// @title SpotOrderBookFacet - OROB spot order placement, cancellation, and matching
/// @dev Orders store int16 offsetBps instead of absolute prices. Prices resolved at match time.
///      In CONTINUOUS mode, orders attempt immediate matching on placement.
///      In BATCH mode, orders queue for batch clearing (handled by SpotBatchAuctionFacet).
contract SpotOrderBookFacet is ISpotEvents {
    uint8 constant SIDE_BUY = 0;
    uint8 constant SIDE_SELL = 1;
    uint8 constant MODE_CONTINUOUS = 0;
    uint8 constant MODE_BATCH = 1;
    uint8 constant ORDER_TYPE_MARKET = 0;
    uint8 constant ORDER_TYPE_LIMIT = 1;

    // ============================================================
    //                    USER FUNCTIONS
    // ============================================================

    /// @notice Place a spot order
    /// @param _marketId The spot market identifier (bytes32)
    /// @param _side 0 = BUY, 1 = SELL
    /// @param _orderType 0 = MARKET, 1 = LIMIT
    /// @param _offsetBps OROB offset from oracle price in basis points
    /// @param _size Base asset units (token decimals)
    /// @return orderId The ID of the placed order
    function placeSpotOrder(
        bytes32 _marketId,
        uint8 _side,
        uint8 _orderType,
        int16 _offsetBps,
        uint128 _size
    ) external returns (uint256 orderId) {
        LibReentrancyGuard.nonReentrantBefore();

        AppStorage storage s = appStorage();
        SpotMarket storage market = s.spotMarkets[_marketId];

        // --- Validation ---
        require(market.active, "SpotOrderBook: market not active");
        require(!s.globalPaused, "SpotOrderBook: protocol paused");
        require(_side <= SIDE_SELL, "SpotOrderBook: invalid side");
        require(_orderType <= ORDER_TYPE_LIMIT, "SpotOrderBook: invalid order type");
        require(_size >= market.minOrderSize, "SpotOrderBook: below min size");

        // Validate offset range
        int16 absOffset = _offsetBps < 0 ? -_offsetBps : _offsetBps;
        require(absOffset <= market.maxOffsetBps, "SpotOrderBook: offset exceeds max");

        // Anti-gaming: minimum spread enforcement
        require(absOffset >= int16(s.spotMinSpreadBps), "SpotOrderBook: below min spread");

        // Check virtual balance sufficiency
        _checkBalance(s, msg.sender, market, _side, _size, _offsetBps);

        // --- Store order ---
        orderId = s.nextSpotOrderId++;
        s.spotOrders[orderId] = SpotOrder({
            id: orderId,
            trader: msg.sender,
            marketId: _marketId,
            side: _side,
            orderType: _orderType,
            offsetBps: _offsetBps,
            size: _size,
            filledSize: 0,
            blockSubmitted: block.number,
            active: true
        });

        s.userSpotOrderIds[msg.sender].push(orderId);

        // --- Route based on market mode ---
        if (market.mode == MODE_CONTINUOUS) {
            // Add to book first, then try matching
            if (_side == SIDE_BUY) {
                s.spotBuyOrderIds[_marketId].push(orderId);
            } else {
                s.spotSellOrderIds[_marketId].push(orderId);
            }

            emit SpotOrderPlaced(orderId, msg.sender, _marketId, _side, _orderType, _offsetBps, _size);

            // Attempt continuous matching
            SpotOrder storage order = s.spotOrders[orderId];
            (uint128 filled, LibSpotMatching.FillResult[] memory fills) =
                LibSpotMatching.tryContinuousMatch(order, market);

            // Emit fill events
            for (uint256 i; i < fills.length;) {
                emit SpotOrderFilled(
                    fills[i].orderId,
                    fills[i].trader,
                    _marketId,
                    fills[i].fillSize,
                    fills[i].fillPrice,
                    fills[i].fillScore
                );
                unchecked { ++i; }
            }

            // Emit fill event for the incoming order if partially/fully filled
            if (filled > 0) {
                int256 oraclePrice = int256(s.latestPrice[uint256(_marketId)]);
                int256 execPrice = LibOROB.resolveOffset(oraclePrice, _offsetBps);
                uint256 score = LibPoFQ.scoreFill(execPrice, oraclePrice);
                emit SpotOrderFilled(orderId, msg.sender, _marketId, filled, execPrice, score);
            }
        } else {
            // BATCH mode: queue for batch clearing
            _addToBatchQueue(s, _marketId, _side, _offsetBps, _size, msg.sender);

            // Also add to the book IDs for tracking
            if (_side == SIDE_BUY) {
                s.spotBuyOrderIds[_marketId].push(orderId);
            } else {
                s.spotSellOrderIds[_marketId].push(orderId);
            }

            emit SpotOrderPlaced(orderId, msg.sender, _marketId, _side, _orderType, _offsetBps, _size);
        }

        LibReentrancyGuard.nonReentrantAfter();
    }

    /// @notice Cancel an active spot order
    /// @param _orderId The order ID to cancel
    function cancelSpotOrder(uint256 _orderId) external {
        AppStorage storage s = appStorage();
        SpotOrder storage order = s.spotOrders[_orderId];

        require(order.active, "SpotOrderBook: order not active");
        require(order.trader == msg.sender, "SpotOrderBook: not order owner");

        order.active = false;

        emit SpotOrderCancelled(_orderId, msg.sender);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /// @notice Get a spot order by ID
    function getSpotOrder(uint256 _orderId) external view returns (
        uint256 id,
        address trader,
        bytes32 marketId,
        uint8 side,
        uint8 orderType,
        int16 offsetBps,
        uint128 size,
        uint128 filledSize,
        uint256 blockSubmitted,
        bool active
    ) {
        AppStorage storage s = appStorage();
        SpotOrder storage o = s.spotOrders[_orderId];
        return (
            o.id, o.trader, o.marketId, o.side, o.orderType,
            o.offsetBps, o.size, o.filledSize, o.blockSubmitted, o.active
        );
    }

    /// @notice Get all spot order IDs for a user
    function getUserSpotOrders(address _user) external view returns (uint256[] memory) {
        return appStorage().userSpotOrderIds[_user];
    }

    /// @notice Get order book depth for a side of a market
    /// @param _marketId The market identifier
    /// @param _side 0 = BUY, 1 = SELL
    /// @param _levels Max number of price levels to return
    /// @return offsets Array of offsets at each level
    /// @return sizes Array of total size at each level
    function getSpotBookDepth(bytes32 _marketId, uint8 _side, uint256 _levels)
        external
        view
        returns (int16[] memory offsets, uint128[] memory sizes)
    {
        AppStorage storage s = appStorage();
        uint256[] storage orderIds = _side == SIDE_BUY
            ? s.spotBuyOrderIds[_marketId]
            : s.spotSellOrderIds[_marketId];

        // Count active orders
        uint256 activeCount;
        for (uint256 i; i < orderIds.length; i++) {
            SpotOrder storage o = s.spotOrders[orderIds[i]];
            if (o.active && o.filledSize < o.size) activeCount++;
        }

        uint256 count = _levels < activeCount ? _levels : activeCount;
        offsets = new int16[](count);
        sizes = new uint128[](count);

        uint256 idx;
        for (uint256 i; i < orderIds.length && idx < count; i++) {
            SpotOrder storage o = s.spotOrders[orderIds[i]];
            if (o.active && o.filledSize < o.size) {
                offsets[idx] = o.offsetBps;
                sizes[idx] = o.size - o.filledSize;
                idx++;
            }
        }
    }

    // ============================================================
    //                   INTERNAL HELPERS
    // ============================================================

    /// @dev Check that the user has sufficient virtual balance for the order
    function _checkBalance(
        AppStorage storage s,
        address _trader,
        SpotMarket storage _market,
        uint8 _side,
        uint128 _size,
        int16 _offsetBps
    ) internal view {
        if (_side == SIDE_BUY) {
            // Buyer needs quote token virtual balance
            // Estimate quote needed: size * (oracle + offset) / 1e18
            int256 oraclePrice = int256(s.latestPrice[uint256(_market.marketId)]);
            if (oraclePrice > 0) {
                int256 execPrice = LibOROB.resolveOffset(oraclePrice, _offsetBps);
                uint8 baseDecimals = s.spotTokenDecimals[_market.baseToken];
                int256 baseNorm = LibSpotSettlement.normalizeToInt(baseDecimals, uint256(_size));
                int256 quoteNeeded = baseNorm * execPrice / 1e18;
                int256 quoteBal = s.spotVirtualBalances[_trader][_market.quoteToken];
                require(quoteBal >= quoteNeeded, "SpotOrderBook: insufficient quote balance");
            }
        } else {
            // Seller needs base token virtual balance
            uint8 baseDecimals = s.spotTokenDecimals[_market.baseToken];
            int256 baseNorm = LibSpotSettlement.normalizeToInt(baseDecimals, uint256(_size));
            int256 baseBal = s.spotVirtualBalances[_trader][_market.baseToken];
            require(baseBal >= baseNorm, "SpotOrderBook: insufficient base balance");
        }
    }

    /// @dev Add order to the batch queue for the market
    function _addToBatchQueue(
        AppStorage storage s,
        bytes32 _marketId,
        uint8 _side,
        int16 _offsetBps,
        uint128 _size,
        address _trader
    ) internal {
        if (_side == SIDE_BUY) {
            s.spotBatchQueues[_marketId].buyOffsets.push(_offsetBps);
            s.spotBatchQueues[_marketId].buySizes.push(_size);
            s.spotBatchQueues[_marketId].buyTraders.push(_trader);
        } else {
            s.spotBatchQueues[_marketId].sellOffsets.push(_offsetBps);
            s.spotBatchQueues[_marketId].sellSizes.push(_size);
            s.spotBatchQueues[_marketId].sellTraders.push(_trader);
        }
    }
}
