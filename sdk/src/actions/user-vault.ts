import { readContract, writeContract, simulateContract, getPublicClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import { UserVaultAbi } from '../abis/user-vault';
import { USER_VAULT_ADDRESS } from '../constants/addresses';

/**
 * Read `UserVault.diamond`
 */
export async function readUserVaultDiamond(config: Config, chainId?: number) {
  return readContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'diamond',
    chainId,
  });
}

/**
 * Read `UserVault.getBalance`
 */
export async function readUserVaultGetBalance(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'getBalance',
    args: [args._token],
    chainId,
  });
}

/**
 * Read `UserVault.getLockedBalance`
 */
export async function readUserVaultGetLockedBalance(
  config: Config,
  args: { _token: `0x${string}` },
  chainId?: number,
) {
  return readContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'getLockedBalance',
    args: [args._token],
    chainId,
  });
}

/**
 * Read `UserVault.isInitialized`
 */
export async function readUserVaultIsInitialized(config: Config, chainId?: number) {
  return readContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'isInitialized',
    chainId,
  });
}

/**
 * Read `UserVault.vaultOwner`
 */
export async function readUserVaultVaultOwner(config: Config, chainId?: number) {
  return readContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'vaultOwner',
    chainId,
  });
}

/**
 * Write `UserVault.deposit`
 */
export async function writeUserVaultDeposit(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return writeContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'deposit',
    args: [args._token, args._amount],
  });
}

/**
 * Simulate `UserVault.deposit`
 */
export async function simulateUserVaultDeposit(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return simulateContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'deposit',
    args: [args._token, args._amount],
  });
}

/**
 * Write `UserVault.emergencyWithdraw`
 */
export async function writeUserVaultEmergencyWithdraw(
  config: Config,
  args: { _token: `0x${string}` },
) {
  return writeContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'emergencyWithdraw',
    args: [args._token],
  });
}

/**
 * Simulate `UserVault.emergencyWithdraw`
 */
export async function simulateUserVaultEmergencyWithdraw(
  config: Config,
  args: { _token: `0x${string}` },
) {
  return simulateContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'emergencyWithdraw',
    args: [args._token],
  });
}

/**
 * Write `UserVault.initialize`
 */
export async function writeUserVaultInitialize(
  config: Config,
  args: { owner_: `0x${string}`; diamond_: `0x${string}` },
) {
  return writeContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'initialize',
    args: [args.owner_, args.diamond_],
  });
}

/**
 * Simulate `UserVault.initialize`
 */
export async function simulateUserVaultInitialize(
  config: Config,
  args: { owner_: `0x${string}`; diamond_: `0x${string}` },
) {
  return simulateContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'initialize',
    args: [args.owner_, args.diamond_],
  });
}

/**
 * Write `UserVault.lockCollateral`
 */
export async function writeUserVaultLockCollateral(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint; _centralVault: `0x${string}` },
) {
  return writeContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'lockCollateral',
    args: [args._token, args._amount, args._centralVault],
  });
}

/**
 * Simulate `UserVault.lockCollateral`
 */
export async function simulateUserVaultLockCollateral(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint; _centralVault: `0x${string}` },
) {
  return simulateContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'lockCollateral',
    args: [args._token, args._amount, args._centralVault],
  });
}

/**
 * Write `UserVault.receiveCollateral`
 */
export async function writeUserVaultReceiveCollateral(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return writeContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'receiveCollateral',
    args: [args._token, args._amount],
  });
}

/**
 * Simulate `UserVault.receiveCollateral`
 */
export async function simulateUserVaultReceiveCollateral(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return simulateContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'receiveCollateral',
    args: [args._token, args._amount],
  });
}

/**
 * Write `UserVault.withdraw`
 */
export async function writeUserVaultWithdraw(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return writeContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'withdraw',
    args: [args._token, args._amount],
  });
}

/**
 * Simulate `UserVault.withdraw`
 */
export async function simulateUserVaultWithdraw(
  config: Config,
  args: { _token: `0x${string}`; _amount: bigint },
) {
  return simulateContract(config, {
    address: USER_VAULT_ADDRESS,
    abi: UserVaultAbi,
    functionName: 'withdraw',
    args: [args._token, args._amount],
  });
}
