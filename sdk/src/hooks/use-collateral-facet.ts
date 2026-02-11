import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { CollateralFacetAbi } from '../abis/collateral-facet';
import { COLLATERAL_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `CollateralFacet.getCollateralDecimals`
 */
export function useReadCollateralFacetGetCollateralDecimals(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'getCollateralDecimals',
    args: [args._token],
    ...config,
  });
}

/**
 * Read `CollateralFacet.getCollateralTokens`
 */
export function useReadCollateralFacetGetCollateralTokens(config?: { chainId?: number }) {
  return useReadContract({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'getCollateralTokens',
    ...config,
  });
}

/**
 * Read `CollateralFacet.getCollateralValue`
 */
export function useReadCollateralFacetGetCollateralValue(
  args: { _token: `0x${string}`; _amount: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'getCollateralValue',
    args: [args._token, args._amount],
    ...config,
  });
}

/**
 * Read `CollateralFacet.isAcceptedCollateral`
 */
export function useReadCollateralFacetIsAcceptedCollateral(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'isAcceptedCollateral',
    args: [args._token],
    ...config,
  });
}

/**
 * Write `CollateralFacet.addCollateral`
 */
export function useWriteCollateralFacetAddCollateral() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}` }) =>
    result.writeContract({
      address: COLLATERAL_FACET_ADDRESS,
      abi: CollateralFacetAbi,
      functionName: 'addCollateral',
      args: [args._token],
    });

  return { ...result, write };
}

/**
 * Simulate `CollateralFacet.addCollateral`
 */
export function useSimulateCollateralFacetAddCollateral(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'addCollateral',
    args: [args._token],
    ...config,
  });
}

/**
 * Write `CollateralFacet.removeCollateral`
 */
export function useWriteCollateralFacetRemoveCollateral() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}` }) =>
    result.writeContract({
      address: COLLATERAL_FACET_ADDRESS,
      abi: CollateralFacetAbi,
      functionName: 'removeCollateral',
      args: [args._token],
    });

  return { ...result, write };
}

/**
 * Simulate `CollateralFacet.removeCollateral`
 */
export function useSimulateCollateralFacetRemoveCollateral(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    functionName: 'removeCollateral',
    args: [args._token],
    ...config,
  });
}

/**
 * Watch `CollateralFacet.CollateralAdded` event
 */
export function useWatchCollateralFacetCollateralAdded(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; decimals: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    eventName: 'CollateralAdded',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `CollateralFacet.CollateralRemoved` event
 */
export function useWatchCollateralFacetCollateralRemoved(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: COLLATERAL_FACET_ADDRESS,
    abi: CollateralFacetAbi,
    eventName: 'CollateralRemoved',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
