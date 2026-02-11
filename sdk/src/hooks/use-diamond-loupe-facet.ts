import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { DiamondLoupeFacetAbi } from '../abis/diamond-loupe-facet';
import { DIAMOND_LOUPE_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `DiamondLoupeFacet.facetAddress`
 */
export function useReadDiamondLoupeFacetFacetAddress(
  args: { _functionSelector: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facetAddress',
    args: [args._functionSelector],
    ...config,
  });
}

/**
 * Read `DiamondLoupeFacet.facetAddresses`
 */
export function useReadDiamondLoupeFacetFacetAddresses(config?: { chainId?: number }) {
  return useReadContract({
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facetAddresses',
    ...config,
  });
}

/**
 * Read `DiamondLoupeFacet.facetFunctionSelectors`
 */
export function useReadDiamondLoupeFacetFacetFunctionSelectors(
  args: { _facet: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facetFunctionSelectors',
    args: [args._facet],
    ...config,
  });
}

/**
 * Read `DiamondLoupeFacet.facets`
 */
export function useReadDiamondLoupeFacetFacets(config?: { chainId?: number }) {
  return useReadContract({
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'facets',
    ...config,
  });
}

/**
 * Read `DiamondLoupeFacet.supportsInterface`
 */
export function useReadDiamondLoupeFacetSupportsInterface(
  args: { _interfaceId: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: DIAMOND_LOUPE_FACET_ADDRESS,
    abi: DiamondLoupeFacetAbi,
    functionName: 'supportsInterface',
    args: [args._interfaceId],
    ...config,
  });
}
