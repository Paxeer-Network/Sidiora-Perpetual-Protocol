// ── QuoterFacet Types ──────────────────────────────────────────────

export interface QuoterFacetQuoteClosePositionArgs {
  _positionId: bigint;
}

export type QuoterFacetQuoteClosePositionReturn = {
  exitPrice: bigint;
  unrealizedPnl: bigint;
  tradingFee: bigint;
  tradingFeeUsd: bigint;
  fundingOwed: bigint;
  netPnl: bigint;
  estimatedPayout: bigint;
};

export interface QuoterFacetQuoteMarketArgs {
  _marketId: bigint;
}

export type QuoterFacetQuoteMarketReturn = {
  indexPrice: bigint;
  markPrice: bigint;
  oracleTWAP: bigint;
  fundingRatePerSecond: bigint;
  fundingRate24h: bigint;
  longOI: bigint;
  shortOI: bigint;
  maxLeverage: bigint;
  maintenanceMarginBps: bigint;
  enabled: boolean;
  priceStale: boolean;
};

export interface QuoterFacetQuoteOpenPositionArgs {
  _marketId: bigint;
  _collateralToken: `0x${string}`;
  _collateralAmount: bigint;
  _leverage: bigint;
  _isLong: boolean;
}

export type QuoterFacetQuoteOpenPositionReturn = {
  entryPrice: bigint;
  sizeUsd: bigint;
  collateralUsd: bigint;
  leverage: bigint;
  tradingFee: bigint;
  tradingFeeUsd: bigint;
  priceImpact: bigint;
  liquidationPrice: bigint;
  estimatedFunding24h: bigint;
  maintenanceMarginBps: bigint;
};

export interface QuoterFacetQuotePartialCloseArgs {
  _positionId: bigint;
  _closeSizeUsd: bigint;
}

export interface QuoterFacetQuotePartialCloseReturn {
  exitPrice: bigint;
  closedPnl: bigint;
  fee: bigint;
  estimatedPayout: bigint;
}
