// ── LiquidationFacet Types ──────────────────────────────────────────────

export interface LiquidationFacetCheckLiquidatableArgs {
  _positionId: bigint;
}

export interface LiquidationFacetCheckLiquidatableReturn {
  liquidatable: boolean;
  marginBps: bigint;
}

export interface LiquidationFacetAutoDeleverageArgs {
  _positionId: bigint;
  _deleverageSize: bigint;
}

export interface LiquidationFacetLiquidateArgs {
  _positionId: bigint;
}

export interface LiquidationFacetADLExecutedEvent {
  positionId: bigint; /* indexed */
  deleveragedSizeUsd: bigint;
}

export interface LiquidationFacetLiquidationEvent {
  positionId: bigint; /* indexed */
  user: `0x${string}`; /* indexed */
  marketId: bigint; /* indexed */
  liquidationPrice: bigint;
  penalty: bigint;
  keeper: `0x${string}`;
}
