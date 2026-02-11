// ── CollateralFacet Types ──────────────────────────────────────────────

export interface CollateralFacetGetCollateralDecimalsArgs {
  _token: `0x${string}`;
}

export type CollateralFacetGetCollateralDecimalsReturn = bigint;

export type CollateralFacetGetCollateralTokensReturn = readonly `0x${string}`[];

export interface CollateralFacetGetCollateralValueArgs {
  _token: `0x${string}`;
  _amount: bigint;
}

export type CollateralFacetGetCollateralValueReturn = bigint;

export interface CollateralFacetIsAcceptedCollateralArgs {
  _token: `0x${string}`;
}

export type CollateralFacetIsAcceptedCollateralReturn = boolean;

export interface CollateralFacetAddCollateralArgs {
  _token: `0x${string}`;
}

export interface CollateralFacetRemoveCollateralArgs {
  _token: `0x${string}`;
}

export interface CollateralFacetCollateralAddedEvent {
  token: `0x${string}`; /* indexed */
  decimals: bigint;
}

export interface CollateralFacetCollateralRemovedEvent {
  token: `0x${string}`; /* indexed */
}
