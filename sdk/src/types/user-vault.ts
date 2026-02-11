// ── UserVault Types ──────────────────────────────────────────────

export type UserVaultDiamondReturn = `0x${string}`;

export interface UserVaultGetBalanceArgs {
  _token: `0x${string}`;
}

export type UserVaultGetBalanceReturn = bigint;

export interface UserVaultGetLockedBalanceArgs {
  _token: `0x${string}`;
}

export type UserVaultGetLockedBalanceReturn = bigint;

export type UserVaultIsInitializedReturn = boolean;

export type UserVaultVaultOwnerReturn = `0x${string}`;

export interface UserVaultDepositArgs {
  _token: `0x${string}`;
  _amount: bigint;
}

export interface UserVaultEmergencyWithdrawArgs {
  _token: `0x${string}`;
}

export interface UserVaultInitializeArgs {
  owner_: `0x${string}`;
  diamond_: `0x${string}`;
}

export interface UserVaultLockCollateralArgs {
  _token: `0x${string}`;
  _amount: bigint;
  _centralVault: `0x${string}`;
}

export interface UserVaultReceiveCollateralArgs {
  _token: `0x${string}`;
  _amount: bigint;
}

export interface UserVaultWithdrawArgs {
  _token: `0x${string}`;
  _amount: bigint;
}

export interface UserVaultCollateralLockedEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
}

export interface UserVaultCollateralReleasedEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
}

export interface UserVaultDepositedEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
}

export interface UserVaultEmergencyWithdrawnEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
}

export interface UserVaultWithdrawnEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
}
