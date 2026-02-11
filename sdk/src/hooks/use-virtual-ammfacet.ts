import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { VirtualAMMFacetAbi } from '../abis/virtual-ammfacet';
import { VIRTUAL_AMMFACET_ADDRESS } from '../constants/addresses';

/**
 * Read `VirtualAMMFacet.getMarkPrice`
 */
export function useReadVirtualAMMFacetGetMarkPrice(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'getMarkPrice',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `VirtualAMMFacet.getPool`
 */
export function useReadVirtualAMMFacetGetPool(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'getPool',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `VirtualAMMFacet.simulateImpact`
 */
export function useReadVirtualAMMFacetSimulateImpact(
  args: { _marketId: bigint; _sizeUsd: bigint; _isLong: boolean },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'simulateImpact',
    args: [args._marketId, args._sizeUsd, args._isLong],
    ...config,
  });
}

/**
 * Write `VirtualAMMFacet.initializePool`
 */
export function useWriteVirtualAMMFacetInitializePool() {
  const result = useWriteContract();

  const write = (args: {
    _marketId: bigint;
    _initialPrice: bigint;
    _virtualLiquidity: bigint;
    _dampingFactor: bigint;
  }) =>
    result.writeContract({
      address: VIRTUAL_AMMFACET_ADDRESS,
      abi: VirtualAMMFacetAbi,
      functionName: 'initializePool',
      args: [args._marketId, args._initialPrice, args._virtualLiquidity, args._dampingFactor],
    });

  return { ...result, write };
}

/**
 * Simulate `VirtualAMMFacet.initializePool`
 */
export function useSimulateVirtualAMMFacetInitializePool(
  args: {
    _marketId: bigint;
    _initialPrice: bigint;
    _virtualLiquidity: bigint;
    _dampingFactor: bigint;
  },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'initializePool',
    args: [args._marketId, args._initialPrice, args._virtualLiquidity, args._dampingFactor],
    ...config,
  });
}

/**
 * Write `VirtualAMMFacet.syncToOracle`
 */
export function useWriteVirtualAMMFacetSyncToOracle() {
  const result = useWriteContract();

  const write = (args: { _marketId: bigint }) =>
    result.writeContract({
      address: VIRTUAL_AMMFACET_ADDRESS,
      abi: VirtualAMMFacetAbi,
      functionName: 'syncToOracle',
      args: [args._marketId],
    });

  return { ...result, write };
}

/**
 * Simulate `VirtualAMMFacet.syncToOracle`
 */
export function useSimulateVirtualAMMFacetSyncToOracle(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'syncToOracle',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Watch `VirtualAMMFacet.PoolInitialized` event
 */
export function useWatchVirtualAMMFacetPoolInitialized(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint; baseReserve: bigint; quoteReserve: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    eventName: 'PoolInitialized',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `VirtualAMMFacet.PoolReservesUpdated` event
 */
export function useWatchVirtualAMMFacetPoolReservesUpdated(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint; newBase: bigint; newQuote: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    eventName: 'PoolReservesUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `VirtualAMMFacet.PoolSynced` event
 */
export function useWatchVirtualAMMFacetPoolSynced(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint; newBase: bigint; newQuote: bigint; oraclePrice: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    eventName: 'PoolSynced',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
