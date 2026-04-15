// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, SpotOrder, SpotMarket, appStorage} from "../storage/AppStorage.sol";
import {LibOROB} from "./LibOROB.sol";
import {LibSpotSettlement} from "./LibSpotSettlement.sol";
import {LibPoFQ} from "./LibPoFQ.sol";

/// @title LibSpotMatching - Continuous matching engine for OROB spot orders
/// @dev Walks the opposing book, resolves OROB offsets against oracle price,
///      fills where prices cross. Updates virtual balances via LibSpotSettlement.
library LibSpotMatching {
    uint8 constant SIDE_BUY = 0;
    uint8 constant SIDE_SELL = 1;

    /// @notice Result of a single fill
    struct FillResult {
        uint256 orderId;
        address trader;
        uint128 fillSize;
        int256  fillPrice;
        uint256 fillScore;
    }

    /// @notice Try to match an incoming order against the opposing book
    /// @param _order The incoming order (already stored in AppStorage)
    /// @param _market The spot market
    /// @return totalFilled Total base units filled
    /// @return fills Array of fill results for event emission
    function tryContinuousMatch(
        SpotOrder storage _order,
        SpotMarket storage _market
    ) internal returns (uint128 totalFilled, FillResult[] memory fills) {
        AppStorage storage s = appStorage();

        // Get oracle price for this market (use the marketId hash → find perps marketId mapping)
        // Spot markets use the same oracle price feed. Price stored by OracleFacet keyed by VOM marketId.
        // We read latestPrice using a mapping from bytes32 spot marketId → uint256 oracleMarketId.
        // For now, we look up by the market's base token paired with the oracle.
        // The price is resolved by the caller and passed via the oraclePrice in AppStorage.
        int256 oraclePrice = _getOraclePrice(s, _market.marketId);
        require(oraclePrice > 0, "LibSpotMatching: no oracle price");

        // Determine which book to match against
        bool incomingIsBuy = _order.side == SIDE_BUY;
        uint256[] storage opposingIds = incomingIsBuy
            ? s.spotSellOrderIds[_market.marketId]
            : s.spotBuyOrderIds[_market.marketId];

        // Pre-allocate fills array (worst case: match against all opposing orders)
        uint256 maxFills = opposingIds.length;
        fills = new FillResult[](maxFills);
        uint256 fillCount;

        uint128 remaining = _order.size - _order.filledSize;

        for (uint256 i; i < opposingIds.length && remaining > 0;) {
            SpotOrder storage resting = s.spotOrders[opposingIds[i]];

            if (!resting.active || resting.filledSize >= resting.size) {
                unchecked { ++i; }
                continue;
            }

            // Resolve both offsets to absolute prices
            int256 incomingPrice = LibOROB.resolveOffset(oraclePrice, _order.offsetBps);
            int256 restingPrice = LibOROB.resolveOffset(oraclePrice, resting.offsetBps);

            // Check price crossing
            bool crosses;
            if (incomingIsBuy) {
                // Buy crosses sell if buy price >= sell price
                crosses = incomingPrice >= restingPrice;
            } else {
                // Sell crosses buy if sell price <= buy price
                crosses = incomingPrice <= restingPrice;
            }

            if (!crosses) {
                unchecked { ++i; }
                continue;
            }

            // Determine fill size (minimum of remaining on both sides)
            uint128 restingRemaining = resting.size - resting.filledSize;
            uint128 fillSize = remaining < restingRemaining ? remaining : restingRemaining;

            // Execution price = resting order's price (price-time priority: resting sets the price)
            int256 execPrice = restingPrice;

            // Compute fill quality score
            uint256 score = LibPoFQ.scoreFill(execPrice, oraclePrice);

            // Update fill sizes
            _order.filledSize += fillSize;
            resting.filledSize += fillSize;
            remaining -= fillSize;

            // Deactivate resting order if fully filled
            if (resting.filledSize >= resting.size) {
                resting.active = false;
            }

            // Determine buyer and seller
            address buyer;
            address seller;
            if (incomingIsBuy) {
                buyer = _order.trader;
                seller = resting.trader;
            } else {
                buyer = resting.trader;
                seller = _order.trader;
            }

            // Compute quote amount: fillSize * execPrice / 1e18
            // Both fillSize (token decimals) and execPrice (18 dec) → result in mixed decimals
            // Normalize: base amount = fillSize normalized to 18 dec
            uint8 baseDecimals = s.spotTokenDecimals[_market.baseToken];

            int256 baseAmount = LibSpotSettlement.normalizeToInt(baseDecimals, uint256(fillSize));
            // quoteAmount = baseAmount * execPrice / 1e18 (both 18 dec → result 18 dec)
            int256 quoteAmount = baseAmount * execPrice / 1e18;

            // Record trade: updates virtual balances + epoch deltas
            LibSpotSettlement.recordTrade(
                buyer, seller,
                _market.baseToken, _market.quoteToken,
                baseAmount, quoteAmount
            );

            // Store fill result
            fills[fillCount] = FillResult({
                orderId: resting.id,
                trader: incomingIsBuy ? seller : buyer,
                fillSize: fillSize,
                fillPrice: execPrice,
                fillScore: score
            });
            fillCount++;

            unchecked { ++i; }
        }

        // Deactivate incoming order if fully filled
        if (_order.filledSize >= _order.size) {
            _order.active = false;
        }

        totalFilled = _order.filledSize;

        // Trim fills array to actual count
        assembly {
            mstore(fills, fillCount)
        }
    }

    /// @dev Get oracle price for a spot market
    ///      Spot markets share the oracle with perps. We use a simple mapping:
    ///      The spot marketId (bytes32) maps to a perps oracle feed.
    ///      For simplicity, we store the latest price keyed by spot market's
    ///      base token in latestPrice[uint256(marketId) % 2^256].
    ///      In practice, the OracleFacet stores prices by uint256 marketId.
    ///      We cast the bytes32 to uint256 and look up.
    function _getOraclePrice(AppStorage storage s, bytes32 _marketId)
        internal
        view
        returns (int256)
    {
        // Look up by casting bytes32 → uint256 as key
        uint256 key = uint256(_marketId);
        uint256 price = s.latestPrice[key];
        return int256(price);
    }
}
