import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { OracleFacetAbi } from '../abis/oracle-facet';
import { ORACLE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `OracleFacet.getMaxPriceStaleness`
 */
export async function readOracleFacetGetMaxPriceStaleness(config: Config, chainId?: number) {
  return readContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getMaxPriceStaleness',
    chainId,
  });
}

/**
 * Read `OracleFacet.getPrice`
 */
export async function readOracleFacetGetPrice(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getPrice',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `OracleFacet.getPriceHistoryLength`
 */
export async function readOracleFacetGetPriceHistoryLength(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getPriceHistoryLength',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `OracleFacet.getPricePoint`
 */
export async function readOracleFacetGetPricePoint(
  config: Config,
  args: { _marketId: bigint; _index: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'getPricePoint',
    args: [args._marketId, args._index],
    chainId,
  });
}

/**
 * Read `OracleFacet.isAuthorizedPoster`
 */
export async function readOracleFacetIsAuthorizedPoster(
  config: Config,
  args: { _poster: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'isAuthorizedPoster',
    args: [args._poster],
    chainId,
  });
}

/**
 * Read `OracleFacet.isPriceStale`
 */
export async function readOracleFacetIsPriceStale(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'isPriceStale',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Write `OracleFacet.addPricePoster`
 */
export async function writeOracleFacetAddPricePoster(
  config: Config,
  args: { _poster: `0x${string}` },
) {
  return writeContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'addPricePoster',
    args: [args._poster],
  });
}

/**
 * Simulate `OracleFacet.addPricePoster`
 */
export async function simulateOracleFacetAddPricePoster(
  config: Config,
  args: { _poster: `0x${string}` },
) {
  return simulateContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'addPricePoster',
    args: [args._poster],
  });
}

/**
 * Write `OracleFacet.batchUpdatePrices`
 */
export async function writeOracleFacetBatchUpdatePrices(
  config: Config,
  args: { _marketIds: readonly bigint[]; _prices: readonly bigint[] },
) {
  return writeContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'batchUpdatePrices',
    args: [args._marketIds, args._prices],
  });
}

/**
 * Simulate `OracleFacet.batchUpdatePrices`
 */
export async function simulateOracleFacetBatchUpdatePrices(
  config: Config,
  args: { _marketIds: readonly bigint[]; _prices: readonly bigint[] },
) {
  return simulateContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'batchUpdatePrices',
    args: [args._marketIds, args._prices],
  });
}

/**
 * Write `OracleFacet.removePricePoster`
 */
export async function writeOracleFacetRemovePricePoster(
  config: Config,
  args: { _poster: `0x${string}` },
) {
  return writeContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'removePricePoster',
    args: [args._poster],
  });
}

/**
 * Simulate `OracleFacet.removePricePoster`
 */
export async function simulateOracleFacetRemovePricePoster(
  config: Config,
  args: { _poster: `0x${string}` },
) {
  return simulateContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'removePricePoster',
    args: [args._poster],
  });
}

/**
 * Write `OracleFacet.setMaxPriceStaleness`
 */
export async function writeOracleFacetSetMaxPriceStaleness(
  config: Config,
  args: { _maxStaleness: bigint },
) {
  return writeContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'setMaxPriceStaleness',
    args: [args._maxStaleness],
  });
}

/**
 * Simulate `OracleFacet.setMaxPriceStaleness`
 */
export async function simulateOracleFacetSetMaxPriceStaleness(
  config: Config,
  args: { _maxStaleness: bigint },
) {
  return simulateContract(config, {
    address: ORACLE_FACET_ADDRESS,
    abi: OracleFacetAbi,
    functionName: 'setMaxPriceStaleness',
    args: [args._maxStaleness],
  });
}
