import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { LiquidationFacetAbi } from '../abis/liquidation-facet';
import { LIQUIDATION_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `LiquidationFacet.checkLiquidatable`
 */
export function useReadLiquidationFacetCheckLiquidatable(
  args: { _positionId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'checkLiquidatable',
    args: [args._positionId],
    ...config,
  });
}

/**
 * Write `LiquidationFacet.autoDeleverage`
 */
export function useWriteLiquidationFacetAutoDeleverage() {
  const result = useWriteContract();

  const write = (args: { _positionId: bigint; _deleverageSize: bigint }) =>
    result.writeContract({
      address: LIQUIDATION_FACET_ADDRESS,
      abi: LiquidationFacetAbi,
      functionName: 'autoDeleverage',
      args: [args._positionId, args._deleverageSize],
    });

  return { ...result, write };
}

/**
 * Simulate `LiquidationFacet.autoDeleverage`
 */
export function useSimulateLiquidationFacetAutoDeleverage(
  args: { _positionId: bigint; _deleverageSize: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'autoDeleverage',
    args: [args._positionId, args._deleverageSize],
    ...config,
  });
}

/**
 * Write `LiquidationFacet.liquidate`
 */
export function useWriteLiquidationFacetLiquidate() {
  const result = useWriteContract();

  const write = (args: { _positionId: bigint }) =>
    result.writeContract({
      address: LIQUIDATION_FACET_ADDRESS,
      abi: LiquidationFacetAbi,
      functionName: 'liquidate',
      args: [args._positionId],
    });

  return { ...result, write };
}

/**
 * Simulate `LiquidationFacet.liquidate`
 */
export function useSimulateLiquidationFacetLiquidate(
  args: { _positionId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    functionName: 'liquidate',
    args: [args._positionId],
    ...config,
  });
}

/**
 * Watch `LiquidationFacet.ADLExecuted` event
 */
export function useWatchLiquidationFacetADLExecuted(config: {
  onLogs: (
    logs: Array<{
      args: { positionId: bigint; deleveragedSizeUsd: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    eventName: 'ADLExecuted',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `LiquidationFacet.Liquidation` event
 */
export function useWatchLiquidationFacetLiquidation(config: {
  onLogs: (
    logs: Array<{
      args: {
        positionId: bigint;
        user: `0x${string}`;
        marketId: bigint;
        liquidationPrice: bigint;
        penalty: bigint;
        keeper: `0x${string}`;
      };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: LIQUIDATION_FACET_ADDRESS,
    abi: LiquidationFacetAbi,
    eventName: 'Liquidation',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
