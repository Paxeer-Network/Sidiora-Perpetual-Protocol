import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { CentralVaultFacetAbi } from '../abis/central-vault-facet';
import { CENTRAL_VAULT_FACET_ADDRESS } from '../constants/addresses';

/**
 * Read `CentralVaultFacet.getUtilization`
 */
export function useReadCentralVaultFacetGetUtilization(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'getUtilization',
    args: [args._token],
    ...config,
  });
}

/**
 * Read `CentralVaultFacet.getVaultBalance`
 */
export function useReadCentralVaultFacetGetVaultBalance(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'getVaultBalance',
    args: [args._token],
    ...config,
  });
}

/**
 * Write `CentralVaultFacet.defundVault`
 */
export function useWriteCentralVaultFacetDefundVault() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` }) =>
    result.writeContract({
      address: CENTRAL_VAULT_FACET_ADDRESS,
      abi: CentralVaultFacetAbi,
      functionName: 'defundVault',
      args: [args._token, args._amount, args._to],
    });

  return { ...result, write };
}

/**
 * Simulate `CentralVaultFacet.defundVault`
 */
export function useSimulateCentralVaultFacetDefundVault(
  args: { _token: `0x${string}`; _amount: bigint; _to: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'defundVault',
    args: [args._token, args._amount, args._to],
    ...config,
  });
}

/**
 * Write `CentralVaultFacet.fundVault`
 */
export function useWriteCentralVaultFacetFundVault() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}`; _amount: bigint }) =>
    result.writeContract({
      address: CENTRAL_VAULT_FACET_ADDRESS,
      abi: CentralVaultFacetAbi,
      functionName: 'fundVault',
      args: [args._token, args._amount],
    });

  return { ...result, write };
}

/**
 * Simulate `CentralVaultFacet.fundVault`
 */
export function useSimulateCentralVaultFacetFundVault(
  args: { _token: `0x${string}`; _amount: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    functionName: 'fundVault',
    args: [args._token, args._amount],
    ...config,
  });
}

/**
 * Watch `CentralVaultFacet.VaultDefunded` event
 */
export function useWatchCentralVaultFacetVaultDefunded(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint; to: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    eventName: 'VaultDefunded',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `CentralVaultFacet.VaultFunded` event
 */
export function useWatchCentralVaultFacetVaultFunded(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint; funder: `0x${string}` };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: CENTRAL_VAULT_FACET_ADDRESS,
    abi: CentralVaultFacetAbi,
    eventName: 'VaultFunded',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
