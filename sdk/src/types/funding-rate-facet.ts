// ── FundingRateFacet Types ──────────────────────────────────────────────

export interface FundingRateFacetGetCurrentFundingRateArgs {
  _marketId: bigint;
}

export type FundingRateFacetGetCurrentFundingRateReturn = bigint;

export interface FundingRateFacetGetFundingRate24hArgs {
  _marketId: bigint;
}

export type FundingRateFacetGetFundingRate24hReturn = bigint;

export interface FundingRateFacetGetFundingStateArgs {
  _marketId: bigint;
}

export interface FundingRateFacetGetFundingStateReturn {
  cumulativeLong: bigint;
  cumulativeShort: bigint;
  lastUpdate: bigint;
  ratePerSecond: bigint;
}

export interface FundingRateFacetGetPendingFundingArgs {
  _marketId: bigint;
}

export interface FundingRateFacetGetPendingFundingReturn {
  pendingLong: bigint;
  pendingShort: bigint;
}

export interface FundingRateFacetGetPositionFundingArgs {
  _positionId: bigint;
}

export type FundingRateFacetGetPositionFundingReturn = bigint;

export interface FundingRateFacetUpdateFundingRateArgs {
  _marketId: bigint;
}

export interface FundingRateFacetFundingRateUpdatedEvent {
  marketId: bigint; /* indexed */
  newRatePerSecond: bigint;
  fundingRate24h: bigint;
}
