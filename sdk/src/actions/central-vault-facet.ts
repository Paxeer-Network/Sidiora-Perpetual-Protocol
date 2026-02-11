import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { CentralVaultFacetAbi } from '../abis/central-vault-facet';
import { CENTRAL_VAULT_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `CentralVaultFacet.getUtilization`
 */
export async function readCentralVaultFacetGetUtilization(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'getUtilization',
    args: [args._token],
    chainId,
  });
}

/**
 * Read `CentralVaultFacet.getVaultBalance`
 */
export async function readCentralVaultFacetGetVaultBalance(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'getVaultBalance',
    args: [args._token],
    chainId,
  });
}

/**
 * Write `CentralVaultFacet.defundVault`
 */
export async function writeCentralVaultFacetDefundVault(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` },
) {
  return writeContract(config, {
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'defundVault',
    args: [args._token, args._amount, args._to],
  });
}

/**
 * Simulate `CentralVaultFacet.defundVault`
 */
export async function simulateCentralVaultFacetDefundVault(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` },
) {
  return simulateContract(config, {
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'defundVault',
    args: [args._token, args._amount, args._to],
  });
}

/**
 * Write `CentralVaultFacet.fundVault`
 */
export async function writeCentralVaultFacetFundVault(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return writeContract(config, {
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'fundVault',
    args: [args._token, args._amount],
  });
}

/**
 * Simulate `CentralVaultFacet.fundVault`
 */
export async function simulateCentralVaultFacetFundVault(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return simulateContract(config, {
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'fundVault',
    args: [args._token, args._amount],
  });
}
