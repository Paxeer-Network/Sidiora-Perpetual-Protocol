import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { VaultFactoryFacetAbi } from '../abis/vault-factory-facet';
import { VAULT_FACTORY_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `VaultFactoryFacet.getUserVaultImplementation`
 */
export async function readVaultFactoryFacetGetUserVaultImplementation(
  config: Config,
  chainId?: number,
) {
  return readContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'getUserVaultImplementation',
    chainId,
  });
}

/**
 * Read `VaultFactoryFacet.getVault`
 */
export async function readVaultFactoryFacetGetVault(
  config: Config,
  args: { _user: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'getVault',
    args: [args._user],
    chainId,
  });
}

/**
 * Read `VaultFactoryFacet.predictVaultAddress`
 */
export async function readVaultFactoryFacetPredictVaultAddress(
  config: Config,
  args: { _user: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'predictVaultAddress',
    args: [args._user],
    chainId,
  });
}

/**
 * Read `VaultFactoryFacet.totalVaults`
 */
export async function readVaultFactoryFacetTotalVaults(config: Config, chainId?: number) {
  return readContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'totalVaults',
    chainId,
  });
}

/**
 * Write `VaultFactoryFacet.createVault`
 */
export async function writeVaultFactoryFacetCreateVault(config: Config) {
  return writeContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'createVault',
  });
}

/**
 * Simulate `VaultFactoryFacet.createVault`
 */
export async function simulateVaultFactoryFacetCreateVault(config: Config) {
  return simulateContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'createVault',
  });
}

/**
 * Write `VaultFactoryFacet.setImplementation`
 */
export async function writeVaultFactoryFacetSetImplementation(
  config: Config,
  args: { _implementation: `0x${string}` },
) {
  return writeContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'setImplementation',
    args: [args._implementation],
  });
}

/**
 * Simulate `VaultFactoryFacet.setImplementation`
 */
export async function simulateVaultFactoryFacetSetImplementation(
  config: Config,
  args: { _implementation: `0x${string}` },
) {
  return simulateContract(config, {
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'setImplementation',
    args: [args._implementation],
  });
}
