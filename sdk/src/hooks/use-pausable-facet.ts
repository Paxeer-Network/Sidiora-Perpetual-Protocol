import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { PausableFacetAbi } from '../abis/pausable-facet';
import { PAUSABLE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `PausableFacet.isGlobalPaused`
 */
export function useReadPausableFacetIsGlobalPaused(config?: { chainId?: number }) {
  return useReadContract({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'isGlobalPaused',
    ...config,
  });
}

/**
 * Read `PausableFacet.isMarketPaused`
 */
export function useReadPausableFacetIsMarketPaused(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'isMarketPaused',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Write `PausableFacet.pauseGlobal`
 */
export function useWritePausableFacetPauseGlobal() {
  const result = useWriteContract();

  const write = () =>
    result.writeContract({
      address: PAUSABLE_FACET_ADDRESS,
      abi: PausableFacetAbi,
      functionName: 'pauseGlobal',
    });

  return { ...result, write };
}

/**
 * Simulate `PausableFacet.pauseGlobal`
 */
export function useSimulatePausableFacetPauseGlobal(config?: { chainId?: number }) {
  return useSimulateContract({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'pauseGlobal',
    ...config,
  });
}

/**
 * Write `PausableFacet.pauseMarket`
 */
export function useWritePausableFacetPauseMarket() {
  const result = useWriteContract();

  const write = (args: { _marketId: bigint }) =>
    result.writeContract({
      address: PAUSABLE_FACET_ADDRESS,
      abi: PausableFacetAbi,
      functionName: 'pauseMarket',
      args: [args._marketId],
    });

  return { ...result, write };
}

/**
 * Simulate `PausableFacet.pauseMarket`
 */
export function useSimulatePausableFacetPauseMarket(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'pauseMarket',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Write `PausableFacet.unpauseGlobal`
 */
export function useWritePausableFacetUnpauseGlobal() {
  const result = useWriteContract();

  const write = () =>
    result.writeContract({
      address: PAUSABLE_FACET_ADDRESS,
      abi: PausableFacetAbi,
      functionName: 'unpauseGlobal',
    });

  return { ...result, write };
}

/**
 * Simulate `PausableFacet.unpauseGlobal`
 */
export function useSimulatePausableFacetUnpauseGlobal(config?: { chainId?: number }) {
  return useSimulateContract({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'unpauseGlobal',
    ...config,
  });
}

/**
 * Write `PausableFacet.unpauseMarket`
 */
export function useWritePausableFacetUnpauseMarket() {
  const result = useWriteContract();

  const write = (args: { _marketId: bigint }) =>
    result.writeContract({
      address: PAUSABLE_FACET_ADDRESS,
      abi: PausableFacetAbi,
      functionName: 'unpauseMarket',
      args: [args._marketId],
    });

  return { ...result, write };
}

/**
 * Simulate `PausableFacet.unpauseMarket`
 */
export function useSimulatePausableFacetUnpauseMarket(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'unpauseMarket',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Watch `PausableFacet.GlobalPaused` event
 */
export function useWatchPausableFacetGlobalPaused(config: {
  onLogs: (
    logs: Array<{
      args: { by: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    eventName: 'GlobalPaused',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `PausableFacet.GlobalUnpaused` event
 */
export function useWatchPausableFacetGlobalUnpaused(config: {
  onLogs: (
    logs: Array<{
      args: { by: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    eventName: 'GlobalUnpaused',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `PausableFacet.MarketPaused` event
 */
export function useWatchPausableFacetMarketPaused(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint; by: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    eventName: 'MarketPaused',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `PausableFacet.MarketUnpaused` event
 */
export function useWatchPausableFacetMarketUnpaused(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint; by: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    eventName: 'MarketUnpaused',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
