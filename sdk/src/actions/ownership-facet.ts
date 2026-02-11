import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { OwnershipFacetAbi } from '../abis/ownership-facet';
import { OWNERSHIP_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `OwnershipFacet.owner`
 */
export async function readOwnershipFacetOwner(config: Config, chainId?: number) {
  return readContract(config, {
    address: OWNERSHIP_FACET_ADDRESS,
    abi: OwnershipFacetAbi,
    functionName: 'owner',
    chainId,
  });
}

/**
 * Write `OwnershipFacet.transferOwnership`
 */
export async function writeOwnershipFacetTransferOwnership(
  config: Config,
  args: { _newOwner: `0x${string}` },
) {
  return writeContract(config, {
    address: OWNERSHIP_FACET_ADDRESS,
    abi: OwnershipFacetAbi,
    functionName: 'transferOwnership',
    args: [args._newOwner],
  });
}

/**
 * Simulate `OwnershipFacet.transferOwnership`
 */
export async function simulateOwnershipFacetTransferOwnership(
  config: Config,
  args: { _newOwner: `0x${string}` },
) {
  return simulateContract(config, {
    address: OWNERSHIP_FACET_ADDRESS,
    abi: OwnershipFacetAbi,
    functionName: 'transferOwnership',
    args: [args._newOwner],
  });
}
