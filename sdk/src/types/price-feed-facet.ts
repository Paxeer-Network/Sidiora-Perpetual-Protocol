// ── PriceFeedFacet Types ──────────────────────────────────────────────

export interface PriceFeedFacetGetExecutionPriceArgs {
  _marketId: bigint;
  _sizeUsd: bigint;
  _isLong: boolean;
}

export type PriceFeedFacetGetExecutionPriceReturn = bigint;

export interface PriceFeedFacetGetIndexPriceArgs {
  _marketId: bigint;
}

export type PriceFeedFacetGetIndexPriceReturn = bigint;

export interface PriceFeedFacetGetLiquidationPriceArgs {
  _marketId: bigint;
}

export type PriceFeedFacetGetLiquidationPriceReturn = bigint;

export interface PriceFeedFacetGetMarkPriceArgs {
  _marketId: bigint;
}

export type PriceFeedFacetGetMarkPriceReturn = bigint;

export interface PriceFeedFacetGetOracleTWAPArgs {
  _marketId: bigint;
}

export type PriceFeedFacetGetOracleTWAPReturn = bigint;

export interface PriceFeedFacetGetOracleTWAPCustomArgs {
  _marketId: bigint;
  _windowSeconds: bigint;
}

export type PriceFeedFacetGetOracleTWAPCustomReturn = bigint;
