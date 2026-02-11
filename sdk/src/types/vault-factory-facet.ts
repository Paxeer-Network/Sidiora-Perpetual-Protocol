// ── VaultFactoryFacet Types ──────────────────────────────────────────────

export type VaultFactoryFacetGetUserVaultImplementationReturn = `0x${string}`;

export interface VaultFactoryFacetGetVaultArgs {
  _user: `0x${string}`;
}

export type VaultFactoryFacetGetVaultReturn = `0x${string}`;

export interface VaultFactoryFacetPredictVaultAddressArgs {
  _user: `0x${string}`;
}

export type VaultFactoryFacetPredictVaultAddressReturn = `0x${string}`;

export type VaultFactoryFacetTotalVaultsReturn = bigint;

export type VaultFactoryFacetCreateVaultReturn = `0x${string}`;

export interface VaultFactoryFacetSetImplementationArgs {
  _implementation: `0x${string}`;
}

export interface VaultFactoryFacetVaultCreatedEvent {
  user: `0x${string}`; /* indexed */
  vault: `0x${string}`; /* indexed */
}

export interface VaultFactoryFacetVaultImplementationUpdatedEvent {
  oldImpl: `0x${string}`; /* indexed */
  newImpl: `0x${string}`; /* indexed */
}
