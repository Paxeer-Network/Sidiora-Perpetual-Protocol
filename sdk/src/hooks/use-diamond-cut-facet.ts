import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { DiamondCutFacetAbi } from '../abis/diamond-cut-facet';
import { DIAMOND_CUT_FACET_ADDRESS } from '../constants/addresses';

/**
 * Write `DiamondCutFacet.diamondCut`
 */
export function useWriteDiamondCutFacetDiamondCut() {
  const result = useWriteContract();

  const write = (args: {
    _diamondCut: readonly {
      facetAddress: `0x${string}`;
      action: number;
      functionSelectors: readonly `0x${string}`[];
    }[];
    _init: `0x${string}`;
    _calldata: `0x${string}`;
  }) =>
    result.writeContract({
      address: DIAMOND_CUT_FACET_ADDRESS,
      abi: DiamondCutFacetAbi,
      functionName: 'diamondCut',
      args: [args._diamondCut, args._init, args._calldata],
    });

  return { ...result, write };
}

/**
 * Simulate `DiamondCutFacet.diamondCut`
 */
export function useSimulateDiamondCutFacetDiamondCut(
  args: {
    _diamondCut: readonly {
      facetAddress: `0x${string}`;
      action: number;
      functionSelectors: readonly `0x${string}`[];
    }[];
    _init: `0x${string}`;
    _calldata: `0x${string}`;
  },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: DIAMOND_CUT_FACET_ADDRESS,
    abi: DiamondCutFacetAbi,
    functionName: 'diamondCut',
    args: [args._diamondCut, args._init, args._calldata],
    ...config,
  });
}

/**
 * Watch `DiamondCutFacet.DiamondCut` event
 */
export function useWatchDiamondCutFacetDiamondCut(config: {
  onLogs: (
    logs: Array<{
      args: {
        _diamondCut: readonly {
          facetAddress: `0x${string}`;
          action: number;
          functionSelectors: readonly `0x${string}`[];
        }[];
        _init: `0x${string}`;
        _calldata: `0x${string}`;
      };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: DIAMOND_CUT_FACET_ADDRESS,
    abi: DiamondCutFacetAbi,
    eventName: 'DiamondCut',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
