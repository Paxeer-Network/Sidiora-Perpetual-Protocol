import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { VaultFactoryFacetAbi } from '../abis/vault-factory-facet';
import { VAULT_FACTORY_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `VaultFactoryFacet.getUserVaultImplementation`
 */
export function useReadVaultFactoryFacetGetUserVaultImplementation(config?: { chainId?: number }) {
  return useReadContract({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'getUserVaultImplementation',
    ...config,
  });
}

/**
 * Read `VaultFactoryFacet.getVault`
 */
export function useReadVaultFactoryFacetGetVault(
  args: { _user: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'getVault',
    args: [args._user],
    ...config,
  });
}

/**
 * Read `VaultFactoryFacet.predictVaultAddress`
 */
export function useReadVaultFactoryFacetPredictVaultAddress(
  args: { _user: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'predictVaultAddress',
    args: [args._user],
    ...config,
  });
}

/**
 * Read `VaultFactoryFacet.totalVaults`
 */
export function useReadVaultFactoryFacetTotalVaults(config?: { chainId?: number }) {
  return useReadContract({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'totalVaults',
    ...config,
  });
}

/**
 * Write `VaultFactoryFacet.createVault`
 */
export function useWriteVaultFactoryFacetCreateVault() {
  const result = useWriteContract();

  const write = () =>
    result.writeContract({
      address: VAULT_FACTORY_FACET_ADDRESS,
      abi: VaultFactoryFacetAbi,
      functionName: 'createVault',
    });

  return { ...result, write };
}

/**
 * Simulate `VaultFactoryFacet.createVault`
 */
export function useSimulateVaultFactoryFacetCreateVault(config?: { chainId?: number }) {
  return useSimulateContract({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'createVault',
    ...config,
  });
}

/**
 * Write `VaultFactoryFacet.setImplementation`
 */
export function useWriteVaultFactoryFacetSetImplementation() {
  const result = useWriteContract();

  const write = (args: { _implementation: `0x${string}` }) =>
    result.writeContract({
      address: VAULT_FACTORY_FACET_ADDRESS,
      abi: VaultFactoryFacetAbi,
      functionName: 'setImplementation',
      args: [args._implementation],
    });

  return { ...result, write };
}

/**
 * Simulate `VaultFactoryFacet.setImplementation`
 */
export function useSimulateVaultFactoryFacetSetImplementation(
  args: { _implementation: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    functionName: 'setImplementation',
    args: [args._implementation],
    ...config,
  });
}

/**
 * Watch `VaultFactoryFacet.VaultCreated` event
 */
export function useWatchVaultFactoryFacetVaultCreated(config: {
  onLogs: (
    logs: Array<{
      args: { user: `0x${string}`; vault: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    eventName: 'VaultCreated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `VaultFactoryFacet.VaultImplementationUpdated` event
 */
export function useWatchVaultFactoryFacetVaultImplementationUpdated(config: {
  onLogs: (
    logs: Array<{
      args: { oldImpl: `0x${string}`; newImpl: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: VAULT_FACTORY_FACET_ADDRESS,
    abi: VaultFactoryFacetAbi,
    eventName: 'VaultImplementationUpdated',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
