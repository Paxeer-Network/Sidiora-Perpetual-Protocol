import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { PausableFacetAbi } from '../abis/pausable-facet';
import { PAUSABLE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `PausableFacet.isGlobalPaused`
 */
export async function readPausableFacetIsGlobalPaused(config: Config, chainId?: number) {
  return readContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'isGlobalPaused',
    chainId,
  });
}

/**
 * Read `PausableFacet.isMarketPaused`
 */
export async function readPausableFacetIsMarketPaused(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'isMarketPaused',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Write `PausableFacet.pauseGlobal`
 */
export async function writePausableFacetPauseGlobal(config: Config) {
  return writeContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'pauseGlobal',
  });
}

/**
 * Simulate `PausableFacet.pauseGlobal`
 */
export async function simulatePausableFacetPauseGlobal(config: Config) {
  return simulateContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'pauseGlobal',
  });
}

/**
 * Write `PausableFacet.pauseMarket`
 */
export async function writePausableFacetPauseMarket(config: Config, args: { _marketId: bigint }) {
  return writeContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'pauseMarket',
    args: [args._marketId],
  });
}

/**
 * Simulate `PausableFacet.pauseMarket`
 */
export async function simulatePausableFacetPauseMarket(
  config: Config,
  args: { _marketId: bigint },
) {
  return simulateContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'pauseMarket',
    args: [args._marketId],
  });
}

/**
 * Write `PausableFacet.unpauseGlobal`
 */
export async function writePausableFacetUnpauseGlobal(config: Config) {
  return writeContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'unpauseGlobal',
  });
}

/**
 * Simulate `PausableFacet.unpauseGlobal`
 */
export async function simulatePausableFacetUnpauseGlobal(config: Config) {
  return simulateContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'unpauseGlobal',
  });
}

/**
 * Write `PausableFacet.unpauseMarket`
 */
export async function writePausableFacetUnpauseMarket(config: Config, args: { _marketId: bigint }) {
  return writeContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'unpauseMarket',
    args: [args._marketId],
  });
}

/**
 * Simulate `PausableFacet.unpauseMarket`
 */
export async function simulatePausableFacetUnpauseMarket(
  config: Config,
  args: { _marketId: bigint },
) {
  return simulateContract(config, {
    address: PAUSABLE_FACET_ADDRESS,
    abi: PausableFacetAbi,
    functionName: 'unpauseMarket',
    args: [args._marketId],
  });
}
