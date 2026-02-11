import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { VirtualAMMFacetAbi } from '../abis/virtual-ammfacet';
import { VIRTUAL_AMMFACET_ADDRESS } from '../constants/addresses';

/**
 * Read `VirtualAMMFacet.getMarkPrice`
 */
export async function readVirtualAMMFacetGetMarkPrice(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'getMarkPrice',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `VirtualAMMFacet.getPool`
 */
export async function readVirtualAMMFacetGetPool(
  config: Config,
  args: { _marketId: bigint },
  chainId?: number,
) {
  return readContract(config, {
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'getPool',
    args: [args._marketId],
    chainId,
  });
}

/**
 * Read `VirtualAMMFacet.simulateImpact`
 */
export async function readVirtualAMMFacetSimulateImpact(
  config: Config,
  args: { _marketId: bigint; _sizeUsd: bigint; _isLong: boolean },
  chainId?: number,
) {
  return readContract(config, {
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'simulateImpact',
    args: [args._marketId, args._sizeUsd, args._isLong],
    chainId,
  });
}

/**
 * Write `VirtualAMMFacet.initializePool`
 */
export async function writeVirtualAMMFacetInitializePool(
  config: Config,
  args: {
    _marketId: bigint;
    _initialPrice: bigint;
    _virtualLiquidity: bigint;
    _dampingFactor: bigint;
  },
) {
  return writeContract(config, {
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'initializePool',
    args: [args._marketId, args._initialPrice, args._virtualLiquidity, args._dampingFactor],
  });
}

/**
 * Simulate `VirtualAMMFacet.initializePool`
 */
export async function simulateVirtualAMMFacetInitializePool(
  config: Config,
  args: {
    _marketId: bigint;
    _initialPrice: bigint;
    _virtualLiquidity: bigint;
    _dampingFactor: bigint;
  },
) {
  return simulateContract(config, {
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'initializePool',
    args: [args._marketId, args._initialPrice, args._virtualLiquidity, args._dampingFactor],
  });
}

/**
 * Write `VirtualAMMFacet.syncToOracle`
 */
export async function writeVirtualAMMFacetSyncToOracle(
  config: Config,
  args: { _marketId: bigint },
) {
  return writeContract(config, {
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'syncToOracle',
    args: [args._marketId],
  });
}

/**
 * Simulate `VirtualAMMFacet.syncToOracle`
 */
export async function simulateVirtualAMMFacetSyncToOracle(
  config: Config,
  args: { _marketId: bigint },
) {
  return simulateContract(config, {
    address: VIRTUAL_AMMFACET_ADDRESS,
    abi: VirtualAMMFacetAbi,
    functionName: 'syncToOracle',
    args: [args._marketId],
  });
}
