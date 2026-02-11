import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { OracleFacetAbi } from '../abis/oracle-facet';
import { ORACLE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `OracleFacet.getMaxPriceStaleness`
 */
export function useReadOracleFacetGetMaxPriceStaleness(config?: { chainId?: number }) {
  return useReadContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getMaxPriceStaleness',
    ...config,
  });
}

/**
 * Read `OracleFacet.getPrice`
 */
export function useReadOracleFacetGetPrice(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getPrice',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `OracleFacet.getPriceHistoryLength`
 */
export function useReadOracleFacetGetPriceHistoryLength(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getPriceHistoryLength',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `OracleFacet.getPricePoint`
 */
export function useReadOracleFacetGetPricePoint(
  args: { _marketId: bigint; _index: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getPricePoint',
    args: [args._marketId, args._index],
    ...config,
  });
}

/**
 * Read `OracleFacet.isAuthorizedPoster`
 */
export function useReadOracleFacetIsAuthorizedPoster(
  args: { _poster: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'isAuthorizedPoster',
    args: [args._poster],
    ...config,
  });
}

/**
 * Read `OracleFacet.isPriceStale`
 */
export function useReadOracleFacetIsPriceStale(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'isPriceStale',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Write `OracleFacet.addPricePoster`
 */
export function useWriteOracleFacetAddPricePoster() {
  const result = useWriteContract();

  const write = (args: { _poster: `0x${string}` }) =>
    result.writeContract({
      address: ORACLE_FACET_ADDRESS,
      abi: OracleFacetAbi,
      functionName: 'addPricePoster',
      args: [args._poster],
    });

  return { ...result, write };
}

/**
 * Simulate `OracleFacet.addPricePoster`
 */
export function useSimulateOracleFacetAddPricePoster(
  args: { _poster: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'addPricePoster',
    args: [args._poster],
    ...config,
  });
}

/**
 * Write `OracleFacet.batchUpdatePrices`
 */
export function useWriteOracleFacetBatchUpdatePrices() {
  const result = useWriteContract();

  const write = (args: { _marketIds: readonly bigint[]; _prices: readonly bigint[] }) =>
    result.writeContract({
      address: ORACLE_FACET_ADDRESS,
      abi: OracleFacetAbi,
      functionName: 'batchUpdatePrices',
      args: [args._marketIds, args._prices],
    });

  return { ...result, write };
}

/**
 * Simulate `OracleFacet.batchUpdatePrices`
 */
export function useSimulateOracleFacetBatchUpdatePrices(
  args: { _marketIds: readonly bigint[]; _prices: readonly bigint[] },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'batchUpdatePrices',
    args: [args._marketIds, args._prices],
    ...config,
  });
}

/**
 * Write `OracleFacet.removePricePoster`
 */
export function useWriteOracleFacetRemovePricePoster() {
  const result = useWriteContract();

  const write = (args: { _poster: `0x${string}` }) =>
    result.writeContract({
      address: ORACLE_FACET_ADDRESS,
      abi: OracleFacetAbi,
      functionName: 'removePricePoster',
      args: [args._poster],
    });

  return { ...result, write };
}

/**
 * Simulate `OracleFacet.removePricePoster`
 */
export function useSimulateOracleFacetRemovePricePoster(
  args: { _poster: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'removePricePoster',
    args: [args._poster],
    ...config,
  });
}

/**
 * Write `OracleFacet.setMaxPriceStaleness`
 */
export function useWriteOracleFacetSetMaxPriceStaleness() {
  const result = useWriteContract();

  const write = (args: { _maxStaleness: bigint }) =>
    result.writeContract({
      address: ORACLE_FACET_ADDRESS,
      abi: OracleFacetAbi,
      functionName: 'setMaxPriceStaleness',
      args: [args._maxStaleness],
    });

  return { ...result, write };
}

/**
 * Simulate `OracleFacet.setMaxPriceStaleness`
 */
export function useSimulateOracleFacetSetMaxPriceStaleness(
  args: { _maxStaleness: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'setMaxPriceStaleness',
    args: [args._maxStaleness],
    ...config,
  });
}

/**
 * Watch `OracleFacet.MaxPriceStalenessUpdated` event
 */
export function useWatchOracleFacetMaxPriceStalenessUpdated(config: {
  onLogs: (
    logs: Array<{
      args: { oldValue: bigint; newValue: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    eventName: 'MaxPriceStalenessUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OracleFacet.PricePosterAdded` event
 */
export function useWatchOracleFacetPricePosterAdded(config: {
  onLogs: (
    logs: Array<{
      args: { poster: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    eventName: 'PricePosterAdded',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OracleFacet.PricePosterRemoved` event
 */
export function useWatchOracleFacetPricePosterRemoved(config: {
  onLogs: (
    logs: Array<{
      args: { poster: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    eventName: 'PricePosterRemoved',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OracleFacet.PricesUpdated` event
 */
export function useWatchOracleFacetPricesUpdated(config: {
  onLogs: (
    logs: Array<{
      args: { marketIds: readonly bigint[]; prices: readonly bigint[]; timestamp: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    eventName: 'PricesUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OracleFacet.RoleGranted` event
 */
export function useWatchOracleFacetRoleGranted(config: {
  onLogs: (
    logs: Array<{
      args: { role: `0x${string}`; account: `0x${string}`; sender: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    eventName: 'RoleGranted',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `OracleFacet.RoleRevoked` event
 */
export function useWatchOracleFacetRoleRevoked(config: {
  onLogs: (
    logs: Array<{
      args: { role: `0x${string}`; account: `0x${string}`; sender: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    eventName: 'RoleRevoked',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
