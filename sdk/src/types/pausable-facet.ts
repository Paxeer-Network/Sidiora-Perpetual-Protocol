// ── PausableFacet Types ──────────────────────────────────────────────

export type PausableFacetIsGlobalPausedReturn = boolean;

export interface PausableFacetIsMarketPausedArgs {
  _marketId: bigint;
}

export type PausableFacetIsMarketPausedReturn = boolean;

export interface PausableFacetPauseMarketArgs {
  _marketId: bigint;
}

export interface PausableFacetUnpauseMarketArgs {
  _marketId: bigint;
}

export interface PausableFacetGlobalPausedEvent {
  by: `0x${string}`; /* indexed */
}

export interface PausableFacetGlobalUnpausedEvent {
  by: `0x${string}`; /* indexed */
}

export interface PausableFacetMarketPausedEvent {
  marketId: bigint; /* indexed */
  by: `0x${string}`; /* indexed */
}

export interface PausableFacetMarketUnpausedEvent {
  marketId: bigint; /* indexed */
  by: `0x${string}`; /* indexed */
}
