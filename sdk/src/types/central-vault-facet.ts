// ── CentralVaultFacet Types ──────────────────────────────────────────────

export interface CentralVaultFacetGetUtilizationArgs {
  _token: `0x${string}`;
}

export type CentralVaultFacetGetUtilizationReturn = bigint;

export interface CentralVaultFacetGetVaultBalanceArgs {
  _token: `0x${string}`;
}

export type CentralVaultFacetGetVaultBalanceReturn = bigint;

export interface CentralVaultFacetDefundVaultArgs {
  _token: `0x${string}`;
  _amount: bigint;
  _to: `0x${string}`;
}

export interface CentralVaultFacetFundVaultArgs {
  _token: `0x${string}`;
  _amount: bigint;
}

export interface CentralVaultFacetVaultDefundedEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
  to: `0x${string}`; /* indexed */
}

export interface CentralVaultFacetVaultFundedEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
  funder: `0x${string}`; /* indexed */
}
