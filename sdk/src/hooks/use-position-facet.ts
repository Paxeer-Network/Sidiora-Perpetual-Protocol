import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { PositionFacetAbi } from '../abis/position-facet';
import { POSITION_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `PositionFacet.getOpenInterest`
 */
export function useReadPositionFacetGetOpenInterest(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getOpenInterest',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `PositionFacet.getPosition`
 */
export function useReadPositionFacetGetPosition(
  args: { _positionId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getPosition',
    args: [args._positionId],
    ...config,
  });
}

/**
 * Read `PositionFacet.getUserMarketPosition`
 */
export function useReadPositionFacetGetUserMarketPosition(
  args: { _user: `0x${string}`; _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getUserMarketPosition',
    args: [args._user, args._marketId],
    ...config,
  });
}

/**
 * Read `PositionFacet.getUserPositionIds`
 */
export function useReadPositionFacetGetUserPositionIds(
  args: { _user: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'getUserPositionIds',
    args: [args._user],
    ...config,
  });
}

/**
 * Write `PositionFacet.addCollateral`
 */
export function useWritePositionFacetAddCollateral() {
  const result = useWriteContract();

  const write = (args: { _positionId: bigint; _amount: bigint }) =>
    result.writeContract({
      address: POSITION_FACET_ADDRESS,
      abi: PositionFacetAbi,
      functionName: 'addCollateral',
      args: [args._positionId, args._amount],
    });

  return { ...result, write };
}

/**
 * Simulate `PositionFacet.addCollateral`
 */
export function useSimulatePositionFacetAddCollateral(
  args: { _positionId: bigint; _amount: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'addCollateral',
    args: [args._positionId, args._amount],
    ...config,
  });
}

/**
 * Write `PositionFacet.addSize`
 */
export function useWritePositionFacetAddSize() {
  const result = useWriteContract();

  const write = (args: { _positionId: bigint; _additionalCollateral: bigint; _leverage: bigint }) =>
    result.writeContract({
      address: POSITION_FACET_ADDRESS,
      abi: PositionFacetAbi,
      functionName: 'addSize',
      args: [args._positionId, args._additionalCollateral, args._leverage],
    });

  return { ...result, write };
}

/**
 * Simulate `PositionFacet.addSize`
 */
export function useSimulatePositionFacetAddSize(
  args: { _positionId: bigint; _additionalCollateral: bigint; _leverage: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'addSize',
    args: [args._positionId, args._additionalCollateral, args._leverage],
    ...config,
  });
}

/**
 * Write `PositionFacet.closePosition`
 */
export function useWritePositionFacetClosePosition() {
  const result = useWriteContract();

  const write = (args: { _positionId: bigint }) =>
    result.writeContract({
      address: POSITION_FACET_ADDRESS,
      abi: PositionFacetAbi,
      functionName: 'closePosition',
      args: [args._positionId],
    });

  return { ...result, write };
}

/**
 * Simulate `PositionFacet.closePosition`
 */
export function useSimulatePositionFacetClosePosition(
  args: { _positionId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'closePosition',
    args: [args._positionId],
    ...config,
  });
}

/**
 * Write `PositionFacet.openPosition`
 */
export function useWritePositionFacetOpenPosition() {
  const result = useWriteContract();

  const write = (args: {
    _marketId: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
    _leverage: bigint;
    _isLong: boolean;
  }) =>
    result.writeContract({
      address: POSITION_FACET_ADDRESS,
      abi: PositionFacetAbi,
      functionName: 'openPosition',
      args: [
        args._marketId,
        args._collateralToken,
        args._collateralAmount,
        args._leverage,
        args._isLong,
      ],
    });

  return { ...result, write };
}

/**
 * Simulate `PositionFacet.openPosition`
 */
export function useSimulatePositionFacetOpenPosition(
  args: {
    _marketId: bigint;
    _collateralToken: `0x${string}`;
    _collateralAmount: bigint;
    _leverage: bigint;
    _isLong: boolean;
  },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'openPosition',
    args: [
      args._marketId,
      args._collateralToken,
      args._collateralAmount,
      args._leverage,
      args._isLong,
    ],
    ...config,
  });
}

/**
 * Write `PositionFacet.partialClose`
 */
export function useWritePositionFacetPartialClose() {
  const result = useWriteContract();

  const write = (args: { _positionId: bigint; _closeSizeUsd: bigint }) =>
    result.writeContract({
      address: POSITION_FACET_ADDRESS,
      abi: PositionFacetAbi,
      functionName: 'partialClose',
      args: [args._positionId, args._closeSizeUsd],
    });

  return { ...result, write };
}

/**
 * Simulate `PositionFacet.partialClose`
 */
export function useSimulatePositionFacetPartialClose(
  args: { _positionId: bigint; _closeSizeUsd: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    functionName: 'partialClose',
    args: [args._positionId, args._closeSizeUsd],
    ...config,
  });
}

/**
 * Watch `PositionFacet.PositionClosed` event
 */
export function useWatchPositionFacetPositionClosed(config: {
  onLogs: (
    logs: Array<{
      args: {
        positionId: bigint;
        user: `0x${string}`;
        marketId: bigint;
        closedSizeUsd: bigint;
        exitPrice: bigint;
        realizedPnl: bigint;
        isFullClose: boolean;
      };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    eventName: 'PositionClosed',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `PositionFacet.PositionModified` event
 */
export function useWatchPositionFacetPositionModified(config: {
  onLogs: (
    logs: Array<{
      args: {
        positionId: bigint;
        newSizeUsd: bigint;
        newCollateralUsd: bigint;
        newCollateralAmount: bigint;
      };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    eventName: 'PositionModified',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `PositionFacet.PositionOpened` event
 */
export function useWatchPositionFacetPositionOpened(config: {
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
    address: POSITION_FACET_ADDRESS,
    abi: PositionFacetAbi,
    eventName: 'PositionOpened',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
