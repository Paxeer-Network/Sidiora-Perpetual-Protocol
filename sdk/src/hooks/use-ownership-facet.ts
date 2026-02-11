import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { OwnershipFacetAbi } from '../abis/ownership-facet';
import { OWNERSHIP_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `OwnershipFacet.owner`
 */
export function useReadOwnershipFacetOwner(config?: { chainId?: number }) {
  return useReadContract({
    address: OWNERSHIP_FACET_ADDRESS,
    abi: OwnershipFacetAbi,
    functionName: 'owner',
    ...config,
  });
}

/**
 * Write `OwnershipFacet.transferOwnership`
 */
export function useWriteOwnershipFacetTransferOwnership() {
  const result = useWriteContract();

  const write = (args: { _newOwner: `0x${string}` }) =>
    result.writeContract({
      address: OWNERSHIP_FACET_ADDRESS,
      abi: OwnershipFacetAbi,
      functionName: 'transferOwnership',
      args: [args._newOwner],
    });

  return { ...result, write };
}

/**
 * Simulate `OwnershipFacet.transferOwnership`
 */
export function useSimulateOwnershipFacetTransferOwnership(
  args: { _newOwner: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: OWNERSHIP_FACET_ADDRESS,
    abi: OwnershipFacetAbi,
    functionName: 'transferOwnership',
    args: [args._newOwner],
    ...config,
  });
}

/**
 * Watch `OwnershipFacet.OwnershipTransferred` event
 */
export function useWatchOwnershipFacetOwnershipTransferred(config: {
  onLogs: (
    logs: Array<{
      args: { previousOwner: `0x${string}`; newOwner: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: OWNERSHIP_FACET_ADDRESS,
    abi: OwnershipFacetAbi,
    eventName: 'OwnershipTransferred',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
