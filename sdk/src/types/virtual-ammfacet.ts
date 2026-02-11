// ── VirtualAMMFacet Types ──────────────────────────────────────────────

export interface VirtualAMMFacetGetMarkPriceArgs {
  _marketId: bigint;
}

export type VirtualAMMFacetGetMarkPriceReturn = bigint;

export interface VirtualAMMFacetGetPoolArgs {
  _marketId: bigint;
}

export interface VirtualAMMFacetGetPoolReturn {
  baseReserve: bigint;
  quoteReserve: bigint;
  lastSyncTimestamp: bigint;
  dampingFactor: bigint;
}

export interface VirtualAMMFacetSimulateImpactArgs {
  _marketId: bigint;
  _sizeUsd: bigint;
  _isLong: boolean;
}

export interface VirtualAMMFacetSimulateImpactReturn {
  executionPrice: bigint;
  priceImpact: bigint;
}

export interface VirtualAMMFacetInitializePoolArgs {
  _marketId: bigint;
  _initialPrice: bigint;
  _virtualLiquidity: bigint;
  _dampingFactor: bigint;
}

export interface VirtualAMMFacetSyncToOracleArgs {
  _marketId: bigint;
}

export interface VirtualAMMFacetPoolInitializedEvent {
  marketId: bigint; /* indexed */
  baseReserve: bigint;
  quoteReserve: bigint;
}

export interface VirtualAMMFacetPoolReservesUpdatedEvent {
  marketId: bigint; /* indexed */
  newBase: bigint;
  newQuote: bigint;
}

export interface VirtualAMMFacetPoolSyncedEvent {
  marketId: bigint; /* indexed */
  newBase: bigint;
  newQuote: bigint;
  oraclePrice: bigint;
}
