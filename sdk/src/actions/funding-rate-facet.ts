import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { FundingRateFacetAbi } from '../abis/funding-rate-facet';
import { FUNDING_RATE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `FundingRateFacet.getCurrentFundingRate`
 */
export async function readFundingRateFacetGetCurrentFundingRate(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getCurrentFundingRate',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `FundingRateFacet.getFundingRate24h`
 */
export async function readFundingRateFacetGetFundingRate24h(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getFundingRate24h',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `FundingRateFacet.getFundingState`
 */
export async function readFundingRateFacetGetFundingState(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getFundingState',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `FundingRateFacet.getPendingFunding`
 */
export async function readFundingRateFacetGetPendingFunding(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getPendingFunding',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `FundingRateFacet.getPositionFunding`
 */
export async function readFundingRateFacetGetPositionFunding(
  config: Config,
  args: { _positionId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'getPositionFunding',
    args: [args._positionId],
    chainId,
  });
}

/**
 * Write `FundingRateFacet.updateFundingRate`
 */
export async function writeFundingRateFacetUpdateFundingRate(
  config: Config,
  args: { _marketId: bigint },
) {
  return writeContract(config, {
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'updateFundingRate',
    args: [args._marketId],
  });
}

/**
 * Simulate `FundingRateFacet.updateFundingRate`
 */
export async function simulateFundingRateFacetUpdateFundingRate(
  config: Config,
  args: { _marketId: bigint },
) {
  return simulateContract(config, {
    address: FUNDING_RATE_FACET_ADDRESS,
    abi: FundingRateFacetAbi,
    functionName: 'updateFundingRate',
    args: [args._marketId],
  });
}
