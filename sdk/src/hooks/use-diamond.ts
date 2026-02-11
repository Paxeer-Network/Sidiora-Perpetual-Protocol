import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { DiamondAbi } from '../abis/diamond';
import { DIAMOND_ADDRESS } from '../constants/addresses';

/**
 * Watch `Diamond.DiamondCut` event
 */
export function useWatchDiamondDiamondCut(config: {
  onLogs: (
    logs: Array<{
      args: {
        _diamondCut: readonly {
          facetAddress: `0x${string}`;
          action: bigint;
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
    address: DIAMOND_ADDRESS,
    abi: DiamondAbi,
    eventName: 'DiamondCut',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `Diamond.OwnershipTransferred` event
 */
export function useWatchDiamondOwnershipTransferred(config: {
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
    address: DIAMOND_ADDRESS,
    abi: DiamondAbi,
    eventName: 'OwnershipTransferred',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
