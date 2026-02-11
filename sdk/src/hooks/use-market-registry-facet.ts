import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { MarketRegistryFacetAbi } from '../abis/market-registry-facet';
import { MARKET_REGISTRY_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `MarketRegistryFacet.getActiveMarketIds`
 */
export function useReadMarketRegistryFacetGetActiveMarketIds(config?: { chainId?: number }) {
  return useReadContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'getActiveMarketIds',
    ...config,
  });
}

/**
 * Read `MarketRegistryFacet.getFees`
 */
export function useReadMarketRegistryFacetGetFees(config?: { chainId?: number }) {
  return useReadContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'getFees',
    ...config,
  });
}

/**
 * Read `MarketRegistryFacet.getMarket`
 */
export function useReadMarketRegistryFacetGetMarket(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'getMarket',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `MarketRegistryFacet.isMarketActive`
 */
export function useReadMarketRegistryFacetIsMarketActive(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'isMarketActive',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `MarketRegistryFacet.totalMarkets`
 */
export function useReadMarketRegistryFacetTotalMarkets(config?: { chainId?: number }) {
  return useReadContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'totalMarkets',
    ...config,
  });
}

/**
 * Write `MarketRegistryFacet.createMarket`
 */
export function useWriteMarketRegistryFacetCreateMarket() {
  const result = useWriteContract();

  const write = (args: {
    _name: string;
    _symbol: string;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  }) =>
    result.writeContract({
      address: MARKET_REGISTRY_FACET_ADDRESS,
      abi: MarketRegistryFacetAbi,
      functionName: 'createMarket',
      args: [
        args._name,
        args._symbol,
        args._maxLeverage,
        args._maintenanceMarginBps,
        args._maxOpenInterest,
      ],
    });

  return { ...result, write };
}

/**
 * Simulate `MarketRegistryFacet.createMarket`
 */
export function useSimulateMarketRegistryFacetCreateMarket(
  args: {
    _name: string;
    _symbol: string;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'createMarket',
    args: [
      args._name,
      args._symbol,
      args._maxLeverage,
      args._maintenanceMarginBps,
      args._maxOpenInterest,
    ],
    ...config,
  });
}

/**
 * Write `MarketRegistryFacet.disableMarket`
 */
export function useWriteMarketRegistryFacetDisableMarket() {
  const result = useWriteContract();

  const write = (args: { _marketId: bigint }) =>
    result.writeContract({
      address: MARKET_REGISTRY_FACET_ADDRESS,
      abi: MarketRegistryFacetAbi,
      functionName: 'disableMarket',
      args: [args._marketId],
    });

  return { ...result, write };
}

/**
 * Simulate `MarketRegistryFacet.disableMarket`
 */
export function useSimulateMarketRegistryFacetDisableMarket(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'disableMarket',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Write `MarketRegistryFacet.enableMarket`
 */
export function useWriteMarketRegistryFacetEnableMarket() {
  const result = useWriteContract();

  const write = (args: { _marketId: bigint }) =>
    result.writeContract({
      address: MARKET_REGISTRY_FACET_ADDRESS,
      abi: MarketRegistryFacetAbi,
      functionName: 'enableMarket',
      args: [args._marketId],
    });

  return { ...result, write };
}

/**
 * Simulate `MarketRegistryFacet.enableMarket`
 */
export function useSimulateMarketRegistryFacetEnableMarket(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'enableMarket',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Write `MarketRegistryFacet.setFees`
 */
export function useWriteMarketRegistryFacetSetFees() {
  const result = useWriteContract();

  const write = (args: {
    _takerFeeBps: bigint;
    _makerFeeBps: bigint;
    _liquidationFeeBps: bigint;
    _insuranceFeeBps: bigint;
  }) =>
    result.writeContract({
      address: MARKET_REGISTRY_FACET_ADDRESS,
      abi: MarketRegistryFacetAbi,
      functionName: 'setFees',
      args: [args._takerFeeBps, args._makerFeeBps, args._liquidationFeeBps, args._insuranceFeeBps],
    });

  return { ...result, write };
}

/**
 * Simulate `MarketRegistryFacet.setFees`
 */
export function useSimulateMarketRegistryFacetSetFees(
  args: {
    _takerFeeBps: bigint;
    _makerFeeBps: bigint;
    _liquidationFeeBps: bigint;
    _insuranceFeeBps: bigint;
  },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'setFees',
    args: [args._takerFeeBps, args._makerFeeBps, args._liquidationFeeBps, args._insuranceFeeBps],
    ...config,
  });
}

/**
 * Write `MarketRegistryFacet.updateMarket`
 */
export function useWriteMarketRegistryFacetUpdateMarket() {
  const result = useWriteContract();

  const write = (args: {
    _marketId: bigint;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  }) =>
    result.writeContract({
      address: MARKET_REGISTRY_FACET_ADDRESS,
      abi: MarketRegistryFacetAbi,
      functionName: 'updateMarket',
      args: [args._marketId, args._maxLeverage, args._maintenanceMarginBps, args._maxOpenInterest],
    });

  return { ...result, write };
}

/**
 * Simulate `MarketRegistryFacet.updateMarket`
 */
export function useSimulateMarketRegistryFacetUpdateMarket(
  args: {
    _marketId: bigint;
    _maxLeverage: bigint;
    _maintenanceMarginBps: bigint;
    _maxOpenInterest: bigint;
  },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    functionName: 'updateMarket',
    args: [args._marketId, args._maxLeverage, args._maintenanceMarginBps, args._maxOpenInterest],
    ...config,
  });
}

/**
 * Watch `MarketRegistryFacet.FeesUpdated` event
 */
export function useWatchMarketRegistryFacetFeesUpdated(config: {
  onLogs: (
    logs: Array<{
      args: {
        takerFeeBps: bigint;
        makerFeeBps: bigint;
        liquidationFeeBps: bigint;
        insuranceFeeBps: bigint;
      };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    eventName: 'FeesUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `MarketRegistryFacet.MarketCreated` event
 */
export function useWatchMarketRegistryFacetMarketCreated(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint; name: string; symbol: string; maxLeverage: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    eventName: 'MarketCreated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `MarketRegistryFacet.MarketDisabled` event
 */
export function useWatchMarketRegistryFacetMarketDisabled(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    eventName: 'MarketDisabled',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `MarketRegistryFacet.MarketEnabled` event
 */
export function useWatchMarketRegistryFacetMarketEnabled(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    eventName: 'MarketEnabled',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `MarketRegistryFacet.MarketUpdated` event
 */
export function useWatchMarketRegistryFacetMarketUpdated(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: MARKET_REGISTRY_FACET_ADDRESS,
    abi: MarketRegistryFacetAbi,
    eventName: 'MarketUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
