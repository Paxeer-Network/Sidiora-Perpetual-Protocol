import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { PriceFeedFacetAbi } from '../abis/price-feed-facet';
import { PRICE_FEED_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `PriceFeedFacet.getExecutionPrice`
 */
export function useReadPriceFeedFacetGetExecutionPrice(
  args: { _marketId: bigint; _sizeUsd: bigint; _isLong: boolean },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getExecutionPrice',
    args: [args._marketId, args._sizeUsd, args._isLong],
    ...config,
  });
}

/**
 * Read `PriceFeedFacet.getIndexPrice`
 */
export function useReadPriceFeedFacetGetIndexPrice(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getIndexPrice',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `PriceFeedFacet.getLiquidationPrice`
 */
export function useReadPriceFeedFacetGetLiquidationPrice(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getLiquidationPrice',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `PriceFeedFacet.getMarkPrice`
 */
export function useReadPriceFeedFacetGetMarkPrice(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getMarkPrice',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `PriceFeedFacet.getOracleTWAP`
 */
export function useReadPriceFeedFacetGetOracleTWAP(
  args: { _marketId: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getOracleTWAP',
    args: [args._marketId],
    ...config,
  });
}

/**
 * Read `PriceFeedFacet.getOracleTWAPCustom`
 */
export function useReadPriceFeedFacetGetOracleTWAPCustom(
  args: { _marketId: bigint; _windowSeconds: bigint },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getOracleTWAPCustom',
    args: [args._marketId, args._windowSeconds],
    ...config,
  });
}
