import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { PriceFeedFacetAbi } from '../abis/price-feed-facet';
import { PRICE_FEED_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `PriceFeedFacet.getExecutionPrice`
 */
export async function readPriceFeedFacetGetExecutionPrice(
  config: Config,
  args: { _marketId: bigint; _sizeUsd: bigint; _isLong: boolean },
  chainId?: number,
) {
  return readContract(config, {
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getExecutionPrice',
    args: [args._marketId, args._sizeUsd, args._isLong],
    chainId,
  });
}

/**
 * Read `PriceFeedFacet.getIndexPrice`
 */
export async function readPriceFeedFacetGetIndexPrice(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getIndexPrice',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `PriceFeedFacet.getLiquidationPrice`
 */
export async function readPriceFeedFacetGetLiquidationPrice(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getLiquidationPrice',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `PriceFeedFacet.getMarkPrice`
 */
export async function readPriceFeedFacetGetMarkPrice(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getMarkPrice',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `PriceFeedFacet.getOracleTWAP`
 */
export async function readPriceFeedFacetGetOracleTWAP(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getOracleTWAP',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `PriceFeedFacet.getOracleTWAPCustom`
 */
export async function readPriceFeedFacetGetOracleTWAPCustom(
  config: Config,
  args: { _marketId: bigint; _windowSeconds: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: PRICE_FEED_FACET_ADDRESS,
    abi: PriceFeedFacetAbi,
    functionName: 'getOracleTWAPCustom',
    args: [args._marketId, args._windowSeconds],
    chainId,
  });
}
