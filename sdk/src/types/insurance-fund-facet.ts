// ── InsuranceFundFacet Types ──────────────────────────────────────────────

export type InsuranceFundFacetGetADLThresholdReturn = bigint;

export interface InsuranceFundFacetGetInsuranceBalanceArgs {
  _token: `0x${string}`;
}

export type InsuranceFundFacetGetInsuranceBalanceReturn = bigint;

export interface InsuranceFundFacetShouldTriggerADLArgs {
  _token: `0x${string}`;
}

export type InsuranceFundFacetShouldTriggerADLReturn = boolean;

export interface InsuranceFundFacetSetADLThresholdArgs {
  _threshold: bigint;
}

export interface InsuranceFundFacetWithdrawInsuranceArgs {
  _token: `0x${string}`;
  _amount: bigint;
  _to: `0x${string}`;
}

export interface InsuranceFundFacetADLThresholdUpdatedEvent {
  oldThreshold: bigint;
  newThreshold: bigint;
}

export interface InsuranceFundFacetInsuranceWithdrawnEvent {
  token: `0x${string}`; /* indexed */
  amount: bigint;
  to: `0x${string}`; /* indexed */
}
