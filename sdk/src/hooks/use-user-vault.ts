import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWatchContractEvent,
} from 'wagmi';
import { UserVaultAbi } from '../abis/user-vault';
import { USER_VAULT_ADDRESS } from '../constants/addresses';

/**
 * Read `UserVault.diamond`
 */
export function useReadUserVaultDiamond(config?: { chainId?: number }) {
  return useReadContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'diamond',
    ...config,
  });
}

/**
 * Read `UserVault.getBalance`
 */
export function useReadUserVaultGetBalance(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'getBalance',
    args: [args._token],
    ...config,
  });
}

/**
 * Read `UserVault.getLockedBalance`
 */
export function useReadUserVaultGetLockedBalance(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useReadContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'getLockedBalance',
    args: [args._token],
    ...config,
  });
}

/**
 * Read `UserVault.isInitialized`
 */
export function useReadUserVaultIsInitialized(config?: { chainId?: number }) {
  return useReadContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'isInitialized',
    ...config,
  });
}

/**
 * Read `UserVault.vaultOwner`
 */
export function useReadUserVaultVaultOwner(config?: { chainId?: number }) {
  return useReadContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'vaultOwner',
    ...config,
  });
}

/**
 * Write `UserVault.deposit`
 */
export function useWriteUserVaultDeposit() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}`; _amount: bigint }) =>
    result.writeContract({
      address: USER_VAULT_ADDRESS,
      abi: UserVaultAbi,
      functionName: 'deposit',
      args: [args._token, args._amount],
    });

  return { ...result, write };
}

/**
 * Simulate `UserVault.deposit`
 */
export function useSimulateUserVaultDeposit(
  args: { _token: `0x${string}`; _amount: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'deposit',
    args: [args._token, args._amount],
    ...config,
  });
}

/**
 * Write `UserVault.emergencyWithdraw`
 */
export function useWriteUserVaultEmergencyWithdraw() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}` }) =>
    result.writeContract({
      address: USER_VAULT_ADDRESS,
      abi: UserVaultAbi,
      functionName: 'emergencyWithdraw',
      args: [args._token],
    });

  return { ...result, write };
}

/**
 * Simulate `UserVault.emergencyWithdraw`
 */
export function useSimulateUserVaultEmergencyWithdraw(
  args: { _token: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'emergencyWithdraw',
    args: [args._token],
    ...config,
  });
}

/**
 * Write `UserVault.initialize`
 */
export function useWriteUserVaultInitialize() {
  const result = useWriteContract();

  const write = (args: { owner_: `0x${string}`; diamond_: `0x${string}` }) =>
    result.writeContract({
      address: USER_VAULT_ADDRESS,
      abi: UserVaultAbi,
      functionName: 'initialize',
      args: [args.owner_, args.diamond_],
    });

  return { ...result, write };
}

/**
 * Simulate `UserVault.initialize`
 */
export function useSimulateUserVaultInitialize(
  args: { owner_: `0x${string}`; diamond_: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'initialize',
    args: [args.owner_, args.diamond_],
    ...config,
  });
}

/**
 * Write `UserVault.lockCollateral`
 */
export function useWriteUserVaultLockCollateral() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}`; _amount: bigint; _centralVault: `0x${string}` }) =>
    result.writeContract({
      address: USER_VAULT_ADDRESS,
      abi: UserVaultAbi,
      functionName: 'lockCollateral',
      args: [args._token, args._amount, args._centralVault],
    });

  return { ...result, write };
}

/**
 * Simulate `UserVault.lockCollateral`
 */
export function useSimulateUserVaultLockCollateral(
  args: { _token: `0x${string}`; _amount: bigint; _centralVault: `0x${string}` },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'lockCollateral',
    args: [args._token, args._amount, args._centralVault],
    ...config,
  });
}

/**
 * Write `UserVault.receiveCollateral`
 */
export function useWriteUserVaultReceiveCollateral() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}`; _amount: bigint }) =>
    result.writeContract({
      address: USER_VAULT_ADDRESS,
      abi: UserVaultAbi,
      functionName: 'receiveCollateral',
      args: [args._token, args._amount],
    });

  return { ...result, write };
}

/**
 * Simulate `UserVault.receiveCollateral`
 */
export function useSimulateUserVaultReceiveCollateral(
  args: { _token: `0x${string}`; _amount: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'receiveCollateral',
    args: [args._token, args._amount],
    ...config,
  });
}

/**
 * Write `UserVault.withdraw`
 */
export function useWriteUserVaultWithdraw() {
  const result = useWriteContract();

  const write = (args: { _token: `0x${string}`; _amount: bigint }) =>
    result.writeContract({
      address: USER_VAULT_ADDRESS,
      abi: UserVaultAbi,
      functionName: 'withdraw',
      args: [args._token, args._amount],
    });

  return { ...result, write };
}

/**
 * Simulate `UserVault.withdraw`
 */
export function useSimulateUserVaultWithdraw(
  args: { _token: `0x${string}`; _amount: bigint },
  config?: { chainId?: number },
) {
  return useSimulateContract({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'withdraw',
    args: [args._token, args._amount],
    ...config,
  });
}

/**
 * Watch `UserVault.CollateralLocked` event
 */
export function useWatchUserVaultCollateralLocked(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    eventName: 'CollateralLocked',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `UserVault.CollateralReleased` event
 */
export function useWatchUserVaultCollateralReleased(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    eventName: 'CollateralReleased',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `UserVault.Deposited` event
 */
export function useWatchUserVaultDeposited(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    eventName: 'Deposited',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `UserVault.EmergencyWithdrawn` event
 */
export function useWatchUserVaultEmergencyWithdrawn(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    eventName: 'EmergencyWithdrawn',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}

/**
 * Watch `UserVault.Withdrawn` event
 */
export function useWatchUserVaultWithdrawn(config: {
  onLogs: (
    logs: Array<{
      args: { token: `0x${string}`; amount: bigint };
      blockNumber: bigint;
      transactionHash: `0x${string}`;
    }>,
  ) => void;
  chainId?: number;
  enabled?: boolean;
}) {
  return useWatchContractEvent({
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    eventName: 'Withdrawn',
    onLogs: config.onLogs as any,
    chainId: config.chainId,
    enabled: config.enabled,
  });
}
