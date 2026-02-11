// ── OracleFacet Types ──────────────────────────────────────────────

export type OracleFacetGetMaxPriceStalenessReturn = bigint;

export interface OracleFacetGetPriceArgs {
  _marketId: bigint;
}

export interface OracleFacetGetPriceReturn {
  price: bigint;
  timestamp: bigint;
}

export interface OracleFacetGetPriceHistoryLengthArgs {
  _marketId: bigint;
}

export type OracleFacetGetPriceHistoryLengthReturn = bigint;

export interface OracleFacetGetPricePointArgs {
  _marketId: bigint;
  _index: bigint;
}

export interface OracleFacetGetPricePointReturn {
  price: bigint;
  timestamp: bigint;
}

export interface OracleFacetIsAuthorizedPosterArgs {
  _poster: `0x${string}`;
}

export type OracleFacetIsAuthorizedPosterReturn = boolean;

export interface OracleFacetIsPriceStaleArgs {
  _marketId: bigint;
}

export type OracleFacetIsPriceStaleReturn = boolean;

export interface OracleFacetAddPricePosterArgs {
  _poster: `0x${string}`;
}

export interface OracleFacetBatchUpdatePricesArgs {
  _marketIds: readonly bigint[];
  _prices: readonly bigint[];
}

export interface OracleFacetRemovePricePosterArgs {
  _poster: `0x${string}`;
}

export interface OracleFacetSetMaxPriceStalenessArgs {
  _maxStaleness: bigint;
}

export interface OracleFacetMaxPriceStalenessUpdatedEvent {
  oldValue: bigint;
  newValue: bigint;
}

export interface OracleFacetPricePosterAddedEvent {
  poster: `0x${string}`; /* indexed */
}

export interface OracleFacetPricePosterRemovedEvent {
  poster: `0x${string}`; /* indexed */
}

export interface OracleFacetPricesUpdatedEvent {
  marketIds: readonly bigint[];
  prices: readonly bigint[];
  timestamp: bigint;
}

export interface OracleFacetRoleGrantedEvent {
  role: `0x${string}`; /* indexed */
  account: `0x${string}`; /* indexed */
  sender: `0x${string}`; /* indexed */
}

export interface OracleFacetRoleRevokedEvent {
  role: `0x${string}`; /* indexed */
  account: `0x${string}`; /* indexed */
  sender: `0x${string}`; /* indexed */
}
