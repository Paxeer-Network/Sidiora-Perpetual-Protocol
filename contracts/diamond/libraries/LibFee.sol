// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {AppStorage, appStorage} from "../storage/AppStorage.sol";
import {LibMath} from "./LibMath.sol";

/// @title LibFee - Trading fee calculations
/// @dev Computes trading fees, liquidation penalties, and insurance contributions.
library LibFee {
    /// @notice Calculate the trading fee for a given notional size
    /// @param _sizeUsd Notional size in USD (18 dec)
    /// @param _isMaker True if maker (limit order), false if taker (market order)
    /// @return fee The fee amount in USD (18 dec)
    function calculateTradingFee(uint256 _sizeUsd, bool _isMaker) internal view returns (uint256 fee) {
        AppStorage storage s = appStorage();
        uint256 feeBps = _isMaker ? s.makerFeeBps : s.takerFeeBps;
        fee = (_sizeUsd * feeBps) / 10000;
    }

    /// @notice Calculate the liquidation penalty
    /// @param _collateralUsd Remaining collateral in USD (18 dec)
    /// @return penalty Total liquidation penalty (18 dec)
    /// @return keeperReward Portion going to the liquidation keeper (18 dec)
    /// @return insurancePortion Portion going to the insurance fund (18 dec)
    function calculateLiquidationPenalty(uint256 _collateralUsd) internal view returns (
        uint256 penalty,
        uint256 keeperReward,
        uint256 insurancePortion
    ) {
        AppStorage storage s = appStorage();
        penalty = (_collateralUsd * s.liquidationFeeBps) / 10000;
        // Split: 60% to keeper, 40% to insurance (configurable later)
        keeperReward = (penalty * 6000) / 10000;
        insurancePortion = penalty - keeperReward;
    }

    /// @notice Calculate insurance fund contribution from a trading fee
    /// @param _fee The trading fee amount (18 dec)
    /// @return contribution The insurance fund portion (18 dec)
    function calculateInsuranceContribution(uint256 _fee) internal view returns (uint256 contribution) {
        AppStorage storage s = appStorage();
        contribution = (_fee * s.insuranceFeeBps) / 10000;
    }
}
