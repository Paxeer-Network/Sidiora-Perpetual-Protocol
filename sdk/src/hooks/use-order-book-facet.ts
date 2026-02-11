import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { OrderBookFacetAbi } from '../abis/order-book-facet';
import { ORDER_BOOK_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `OrderBookFacet.getOrder`
 */
export function useReadOrderBookFacetGetOrder(
  args: { _orderId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'getOrder',
    args: [args._orderId],
    ...config,
  });
}

/**
 * Read `OrderBookFacet.getUserOrderIds`
 */
export function useReadOrderBookFacetGetUserOrderIds(
  args: { _user: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'getUserOrderIds',
    args: [args._user],
    ...config,
  });
}

/**
 * Write `OrderBookFacet.cancelOrder`
 */
export function useWriteOrderBookFacetCancelOrder() {
  const result = useWriteContract();

  const write = (args: { _orderId: bigint }) =>
    result.writeContract({
      address: ORDER_BOOK_FACET_ADDRESS,
      abi: OrderBookFacetAbi,
      functionName: 'cancelOrder',
      args: [args._orderId],
    });

  return { ...result, write };
}

/**
 * Simulate `OrderBookFacet.cancelOrder`
 */
export function useSimulateOrderBookFacetCancelOrder(
  args: { _orderId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'cancelOrder',
    args: [args._orderId],
    ...config,
  });
}

/**
 * Write `OrderBookFacet.executeOrder`
 */
export function useWriteOrderBookFacetExecuteOrder() {
  const result = useWriteContract();

  const write = (args: { _orderId: bigint }) =>
    result.writeContract({
      address: ORDER_BOOK_FACET_ADDRESS,
      abi: OrderBookFacetAbi,
      functionName: 'executeOrder',
      args: [args._orderId],
    });

  return { ...result, write };
}

/**
 * Simulate `OrderBookFacet.executeOrder`
 */
export function useSimulateOrderBookFacetExecuteOrder(
  args: { _orderId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    functionName: 'executeOrder',
    args: [args._orderId],
    ...config,
  });
}

/**
 * Write `OrderBookFacet.placeLimitOrder`
 */
export function useWriteOrderBookFacetPlaceLimitOrder() {
  const result = useWriteContract();

  const write = (args: {
    _marketId: bigint;
    _isLong: boolean;
    _triggerPrice: bigint;
    _sizeUsd: bigint;
    _leverage: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
  }) =>
    result.writeContract({
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

  return { ...result, write };
}

/**
 * Simulate `OrderBookFacet.placeLimitOrder`
 */
export function useSimulateOrderBookFacetPlaceLimitOrder(
  args: {
    _marketId: bigint;
    _isLong: boolean;
    _triggerPrice: bigint;
    _sizeUsd: bigint;
    _leverage: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
  },
  config?: { chainId?: number },
) {
  return useSimulateContract({
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
    ...config,
  });
}

/**
 * Write `OrderBookFacet.placeStopLimitOrder`
 */
export function useWriteOrderBookFacetPlaceStopLimitOrder() {
  const result = useWriteContract();

  const write = (args: {
    _marketId: bigint;
    _isLong: boolean;
    _triggerPrice: bigint;
    _limitPrice: bigint;
    _sizeUsd: bigint;
    _leverage: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
  }) =>
    result.writeContract({
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

  return { ...result, write };
}

/**
 * Simulate `OrderBookFacet.placeStopLimitOrder`
 */
export function useSimulateOrderBookFacetPlaceStopLimitOrder(
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
  config?: { chainId?: number },
) {
  return useSimulateContract({
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
    ...config,
  });
}

/**
 * Watch `OrderBookFacet.OrderCancelled` event
 */
export function useWatchOrderBookFacetOrderCancelled(config: {
  onLogs: (
    logs: Array<{
      args: { orderId: bigint; user: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    eventName: 'OrderCancelled',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OrderBookFacet.OrderExecuted` event
 */
export function useWatchOrderBookFacetOrderExecuted(config: {
  onLogs: (
    logs: Array<{
      args: { orderId: bigint; positionId: bigint; executionPrice: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    eventName: 'OrderExecuted',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OrderBookFacet.OrderPlaced` event
 */
export function useWatchOrderBookFacetOrderPlaced(config: {
  onLogs: (
    logs: Array<{
      args: {
        orderId: bigint;
        user: `0x${string}`;
        marketId: bigint;
        orderType: bigint;
        isLong: boolean;
        triggerPrice: bigint;
        sizeUsd: bigint;
      };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    eventName: 'OrderPlaced',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OrderBookFacet.PositionOpened` event
 */
export function useWatchOrderBookFacetPositionOpened(config: {
  onLogs: (
    logs: Array<{
      args: {
        positionId: bigint;
        user: `0x${string}`;
        marketId: bigint;
        isLong: boolean;
        sizeUsd: bigint;
        leverage: bigint;
        entryPrice: bigint;
        collateralToken: `0x${string}`;
        collateralAmount: bigint;
      };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORDER_BOOK_FACET_ADDRESS,
    abi: OrderBookFacetAbi,
    eventName: 'PositionOpened',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
