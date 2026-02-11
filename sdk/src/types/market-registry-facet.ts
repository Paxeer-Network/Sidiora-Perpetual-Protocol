// ── MarketRegistryFacet Types ──────────────────────────────────────────────

export type MarketRegistryFacetGetActiveMarketIdsReturn = readonly bigint[];

export interface MarketRegistryFacetGetFeesReturn {
  takerFeeBps: bigint;
  makerFeeBps: bigint;
  liquidationFeeBps: bigint;
  insuranceFeeBps: bigint;
}

export interface MarketRegistryFacetGetMarketArgs {
  _marketId: bigint;
}

export interface MarketRegistryFacetGetMarketReturn {
  name: string;
  symbol: string;
  maxLeverage: bigint;
  maintenanceMarginBps: bigint;
  maxOpenInterest: bigint;
  enabled: boolean;
}

export interface MarketRegistryFacetIsMarketActiveArgs {
  _marketId: bigint;
}

export type MarketRegistryFacetIsMarketActiveReturn = boolean;

export type MarketRegistryFacetTotalMarketsReturn = bigint;

export interface MarketRegistryFacetCreateMarketArgs {
  _name: string;
  _symbol: string;
  _maxLeverage: bigint;
  _maintenanceMarginBps: bigint;
  _maxOpenInterest: bigint;
}

export type MarketRegistryFacetCreateMarketReturn = bigint;

export interface MarketRegistryFacetDisableMarketArgs {
  _marketId: bigint;
}

export interface MarketRegistryFacetEnableMarketArgs {
  _marketId: bigint;
}

export interface MarketRegistryFacetSetFeesArgs {
  _takerFeeBps: bigint;
  _makerFeeBps: bigint;
  _liquidationFeeBps: bigint;
  _insuranceFeeBps: bigint;
}

export interface MarketRegistryFacetUpdateMarketArgs {
  _marketId: bigint;
  _maxLeverage: bigint;
  _maintenanceMarginBps: bigint;
  _maxOpenInterest: bigint;
}

export interface MarketRegistryFacetFeesUpdatedEvent {
  takerFeeBps: bigint;
  makerFeeBps: bigint;
  liquidationFeeBps: bigint;
  insuranceFeeBps: bigint;
}

export interface MarketRegistryFacetMarketCreatedEvent {
  marketId: bigint; /* indexed */
  name: string;
  symbol: string;
  maxLeverage: bigint;
}

export interface MarketRegistryFacetMarketDisabledEvent {
  marketId: bigint; /* indexed */
}

export interface MarketRegistryFacetMarketEnabledEvent {
  marketId: bigint; /* indexed */
}

export interface MarketRegistryFacetMarketUpdatedEvent {
  marketId: bigint; /* indexed */
}
