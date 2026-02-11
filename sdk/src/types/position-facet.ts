// ── PositionFacet Types ──────────────────────────────────────────────

export interface PositionFacetGetOpenInterestArgs {
  _marketId: bigint;
}

export interface PositionFacetGetOpenInterestReturn {
  longOI: bigint;
  shortOI: bigint;
}

export interface PositionFacetGetPositionArgs {
  _positionId: bigint;
}

export interface PositionFacetGetPositionReturn {
  user: `0x${string}`;
  marketId: bigint;
  isLong: boolean;
  sizeUsd: bigint;
  collateralUsd: bigint;
  collateralToken: `0x${string}`;
  collateralAmount: bigint;
  entryPrice: bigint;
  timestamp: bigint;
  active: boolean;
}

export interface PositionFacetGetUserMarketPositionArgs {
  _user: `0x${string}`;
  _marketId: bigint;
}

export type PositionFacetGetUserMarketPositionReturn = bigint;

export interface PositionFacetGetUserPositionIdsArgs {
  _user: `0x${string}`;
}

export type PositionFacetGetUserPositionIdsReturn = readonly bigint[];

export interface PositionFacetAddCollateralArgs {
  _positionId: bigint;
  _amount: bigint;
}

export interface PositionFacetAddSizeArgs {
  _positionId: bigint;
  _additionalCollateral: bigint;
  _leverage: bigint;
}

export interface PositionFacetClosePositionArgs {
  _positionId: bigint;
}

export interface PositionFacetOpenPositionArgs {
  _marketId: bigint;
  _collateralToken: `0x${string}`;
  _collateralAmount: bigint;
  _leverage: bigint;
  _isLong: boolean;
}

export type PositionFacetOpenPositionReturn = bigint;

export interface PositionFacetPartialCloseArgs {
  _positionId: bigint;
  _closeSizeUsd: bigint;
}

export interface PositionFacetPositionClosedEvent {
  positionId: bigint; /* indexed */
  user: `0x${string}`; /* indexed */
  marketId: bigint; /* indexed */
  closedSizeUsd: bigint;
  exitPrice: bigint;
  realizedPnl: bigint;
  isFullClose: boolean;
}

export interface PositionFacetPositionModifiedEvent {
  positionId: bigint; /* indexed */
  newSizeUsd: bigint;
  newCollateralUsd: bigint;
  newCollateralAmount: bigint;
}

export interface PositionFacetPositionOpenedEvent {
  positionId: bigint; /* indexed */
  user: `0x${string}`; /* indexed */
  marketId: bigint; /* indexed */
  isLong: boolean;
  sizeUsd: bigint;
  leverage: bigint;
  entryPrice: bigint;
  collateralToken: `0x${string}`;
  collateralAmount: bigint;
}
