import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { OrderBookFacetAbi } from '../abis/order-book-facet';
import { ORDER_BOOK_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `OrderBookFacet.getOrder`
 */
export async function readOrderBookFacetGetOrder(
  config: Config,
  args: { _orderId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'getOrder',
    args: [args._orderId],
    chainId,
  });
}

/**
 * Read `OrderBookFacet.getUserOrderIds`
 */
export async function readOrderBookFacetGetUserOrderIds(
  config: Config,
  args: { _user: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'getUserOrderIds',
    args: [args._user],
    chainId,
  });
}

/**
 * Write `OrderBookFacet.cancelOrder`
 */
export async function writeOrderBookFacetCancelOrder(config: Config, args: { _orderId: bigint }) {
  return writeContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'cancelOrder',
    args: [args._orderId],
  });
}

/**
 * Simulate `OrderBookFacet.cancelOrder`
 */
export async function simulateOrderBookFacetCancelOrder(
  config: Config,
  args: { _orderId: bigint },
) {
  return simulateContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'cancelOrder',
    args: [args._orderId],
  });
}

/**
 * Write `OrderBookFacet.executeOrder`
 */
export async function writeOrderBookFacetExecuteOrder(config: Config, args: { _orderId: bigint }) {
  return writeContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'executeOrder',
    args: [args._orderId],
  });
}

/**
 * Simulate `OrderBookFacet.executeOrder`
 */
export async function simulateOrderBookFacetExecuteOrder(
  config: Config,
  args: { _orderId: bigint },
) {
  return simulateContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'executeOrder',
    args: [args._orderId],
  });
}

/**
 * Write `OrderBookFacet.placeLimitOrder`
 */
export async function writeOrderBookFacetPlaceLimitOrder(
  config: Config,
  args: {
    _marketId: bigint;
    _isLong: boolean;
    _triggerPrice: bigint;
    _sizeUsd: bigint;
    _leverage: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
  },
) {
  return writeContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'placeLimitOrder',
    args: [
      args._marketId,
      args._isLong,
      args._triggerPrice,
      args._sizeUsd,
      args._leverage,
      args._collateralToken,
      args._collateralAmount,
    ],
  });
}

/**
 * Simulate `OrderBookFacet.placeLimitOrder`
 */
export async function simulateOrderBookFacetPlaceLimitOrder(
  config: Config,
  args: {
    _marketId: bigint;
    _isLong: boolean;
    _triggerPrice: bigint;
    _sizeUsd: bigint;
    _leverage: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
  },
) {
  return simulateContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'placeLimitOrder',
    args: [
      args._marketId,
      args._isLong,
      args._triggerPrice,
      args._sizeUsd,
      args._leverage,
      args._collateralToken,
      args._collateralAmount,
    ],
  });
}

/**
 * Write `OrderBookFacet.placeStopLimitOrder`
 */
export async function writeOrderBookFacetPlaceStopLimitOrder(
  config: Config,
  args: {
    _marketId: bigint;
    _isLong: boolean;
    _triggerPrice: bigint;
    _limitPrice: bigint;
    _sizeUsd: bigint;
    _leverage: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
  },
) {
  return writeContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'placeStopLimitOrder',
    args: [
      args._marketId,
      args._isLong,
      args._triggerPrice,
      args._limitPrice,
      args._sizeUsd,
      args._leverage,
      args._collateralToken,
      args._collateralAmount,
    ],
  });
}

/**
 * Simulate `OrderBookFacet.placeStopLimitOrder`
 */
export async function simulateOrderBookFacetPlaceStopLimitOrder(
  config: Config,
  args: {
    _marketId: bigint;
    _isLong: boolean;
    _triggerPrice: bigint;
    _limitPrice: bigint;
    _sizeUsd: bigint;
    _leverage: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
  },
) {
  return simulateContract(config, {
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'placeStopLimitOrder',
    args: [
      args._marketId,
      args._isLong,
      args._triggerPrice,
      args._limitPrice,
      args._sizeUsd,
      args._leverage,
      args._collateralToken,
      args._collateralAmount,
    ],
  });
}
