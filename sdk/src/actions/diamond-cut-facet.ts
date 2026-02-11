import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { DiamondCutFacetAbi } from '../abis/diamond-cut-facet';
import { DIAMOND_CUT_FACET_ADDRESS } from '../constants/addresses';

/**
 * Write `DiamondCutFacet.diamondCut`
 */
export async function writeDiamondCutFacetDiamondCut(
  config: Config,
  args: {
    _diamondCut: readonly {
      facetAddress: `0x${string}`;
      action: number;
      functionSelectors: readonly `0x${string}`[];
    }[];
    _init: `0x${string}`;
    _calldata: `0x${string}`;
  },
) {
  return writeContract(config, {
    address: DIAMOND_CUT_FACET_ADDRESS,
    abi: DiamondCutFacetAbi,
    functionName: 'diamondCut',
    args: [args._diamondCut, args._init, args._calldata],
  });
}

/**
 * Simulate `DiamondCutFacet.diamondCut`
 */
export async function simulateDiamondCutFacetDiamondCut(
  config: Config,
  args: {
    _diamondCut: readonly {
      facetAddress: `0x${string}`;
      action: number;
      functionSelectors: readonly `0x${string}`[];
    }[];
    _init: `0x${string}`;
    _calldata: `0x${string}`;
  },
) {
  return simulateContract(config, {
    address: DIAMOND_CUT_FACET_ADDRESS,
    abi: DiamondCutFacetAbi,
    functionName: 'diamondCut',
    args: [args._diamondCut, args._init, args._calldata],
  });
}
