import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { FundingRateFacetAbi } from '../abis/funding-rate-facet';
import { FUNDING_RATE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `FundingRateFacet.getCurrentFundingRate`
 */
export function useReadFundingRateFacetGetCurrentFundingRate(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getCurrentFundingRate',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `FundingRateFacet.getFundingRate24h`
 */
export function useReadFundingRateFacetGetFundingRate24h(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getFundingRate24h',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `FundingRateFacet.getFundingState`
 */
export function useReadFundingRateFacetGetFundingState(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getFundingState',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `FundingRateFacet.getPendingFunding`
 */
export function useReadFundingRateFacetGetPendingFunding(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getPendingFunding',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `FundingRateFacet.getPositionFunding`
 */
export function useReadFundingRateFacetGetPositionFunding(
  args: { _positionId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getPositionFunding',
    args: [args._positionId],
    ...config,
  });
}

/**
 * Write `FundingRateFacet.updateFundingRate`
 */
export function useWriteFundingRateFacetUpdateFundingRate() {
  const result = useWriteContract();

  const write = (args: { _marketId: bigint }) =>
    result.writeContract({
      address: FUNDING_RATE_FACET_ADDRESS,
      abi: FundingRateFacetAbi,
      functionName: 'updateFundingRate',
      args: [args._marketId],
    });

  return { ...result, write };
}

/**
 * Simulate `FundingRateFacet.updateFundingRate`
 */
export function useSimulateFundingRateFacetUpdateFundingRate(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'updateFundingRate',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Watch `FundingRateFacet.FundingRateUpdated` event
 */
export function useWatchFundingRateFacetFundingRateUpdated(config: {
  onLogs: (
    logs: Array<{
      args: { marketId: bigint; newRatePerSecond: bigint; fundingRate24h: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    eventName: 'FundingRateUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
