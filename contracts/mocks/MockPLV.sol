// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import {ILiquidityVault} from "../diamond/interfaces/ILiquidityVault.sol";

/// @title MockPLV - Mock Programmable Liquidity Vault for testing
/// @dev Implements ILiquidityVault with configurable quote responses
contract MockPLV is ILiquidityVault {
    int256 public quotePrice;
    uint256 public quoteMaxFillSize;
    bool public shouldRevert;

    uint256 public lastFillSize;
    int256 public lastFillPrice;

    uint256 public baseBalance;
    uint256 public quoteBalance;

    constructor(int256 _quotePrice, uint256 _maxFillSize) {
        quotePrice = _quotePrice;
        quoteMaxFillSize = _maxFillSize;
        baseBalance = 100e18;
        quoteBalance = 300000e18;
    }

    function setQuote(int256 _price, uint256 _maxFillSize) external {
        quotePrice = _price;
        quoteMaxFillSize = _maxFillSize;
    }

    function setShouldRevert(bool _revert) external {
        shouldRevert = _revert;
    }

    function setInventory(uint256 _base, uint256 _quote) external {
        baseBalance = _base;
        quoteBalance = _quote;
    }

    function quote(
        Side,
        uint256,
        int256,
        uint256
    ) external view override returns (int256 price, uint256 maxFillSize) {
        require(!shouldRevert, "MockPLV: forced revert");
        return (quotePrice, quoteMaxFillSize);
    }

    function fill(Side, uint256 size, int256 price) external override returns (bool) {
        lastFillSize = size;
        lastFillPrice = price;
        return true;
    }

    function rebalance(int256, int256) external override {}

    function getInventory() external view override returns (uint256, uint256) {
        return (baseBalance, quoteBalance);
    }
}
