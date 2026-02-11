import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { DiamondLoupeFacetAbi } from '../abis/diamond-loupe-facet';
import { DIAMOND_LOUPE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `DiamondLoupeFacet.facetAddress`
 */
export async function readDiamondLoupeFacetFacetAddress(
  config: Config,
  args: { _functionSelector: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facetAddress',
    args: [args._functionSelector],
    chainId,
  });
}

/**
 * Read `DiamondLoupeFacet.facetAddresses`
 */
export async function readDiamondLoupeFacetFacetAddresses(config: Config, chainId?: number) {
  return readContract(config, {
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facetAddresses',
    chainId,
  });
}

/**
 * Read `DiamondLoupeFacet.facetFunctionSelectors`
 */
export async function readDiamondLoupeFacetFacetFunctionSelectors(
  config: Config,
  args: { _facet: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facetFunctionSelectors',
    args: [args._facet],
    chainId,
  });
}

/**
 * Read `DiamondLoupeFacet.facets`
 */
export async function readDiamondLoupeFacetFacets(config: Config, chainId?: number) {
  return readContract(config, {
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facets',
    chainId,
  });
}

/**
 * Read `DiamondLoupeFacet.supportsInterface`
 */
export async function readDiamondLoupeFacetSupportsInterface(
  config: Config,
  args: { _interfaceId: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'supportsInterface',
    args: [args._interfaceId],
    chainId,
  });
}
