// ── OrderBookFacet Types ──────────────────────────────────────────────

export interface OrderBookFacetGetOrderArgs {
  _orderId: bigint;
}

export interface OrderBookFacetGetOrderReturn {
  user: `0x${string}`;
  marketId: bigint;
  isLong: boolean;
  orderType: bigint;
  triggerPrice: bigint;
  limitPrice: bigint;
  sizeUsd: bigint;
  leverage: bigint;
  collateralToken: `0x${string}`;
  collateralAmount: bigint;
  active: boolean;
}

export interface OrderBookFacetGetUserOrderIdsArgs {
  _user: `0x${string}`;
}

export type OrderBookFacetGetUserOrderIdsReturn = readonly bigint[];

export interface OrderBookFacetCancelOrderArgs {
  _orderId: bigint;
}

export interface OrderBookFacetExecuteOrderArgs {
  _orderId: bigint;
}

export type OrderBookFacetExecuteOrderReturn = bigint;

export interface OrderBookFacetPlaceLimitOrderArgs {
  _marketId: bigint;
  _isLong: boolean;
  _triggerPrice: bigint;
  _sizeUsd: bigint;
  _leverage: bigint;
  _collateralToken: `0x${string}`;
  _collateralAmount: bigint;
}

export type OrderBookFacetPlaceLimitOrderReturn = bigint;

export interface OrderBookFacetPlaceStopLimitOrderArgs {
  _marketId: bigint;
  _isLong: boolean;
  _triggerPrice: bigint;
  _limitPrice: bigint;
  _sizeUsd: bigint;
  _leverage: bigint;
  _collateralToken: `0x${string}`;
  _collateralAmount: bigint;
}

export type OrderBookFacetPlaceStopLimitOrderReturn = bigint;

export interface OrderBookFacetOrderCancelledEvent {
  orderId: bigint; /* indexed */
  user: `0x${string}`; /* indexed */
}

export interface OrderBookFacetOrderExecutedEvent {
  orderId: bigint; /* indexed */
  positionId: bigint; /* indexed */
  executionPrice: bigint;
}

export interface OrderBookFacetOrderPlacedEvent {
  orderId: bigint; /* indexed */
  user: `0x${string}`; /* indexed */
  marketId: bigint; /* indexed */
  orderType: bigint;
  isLong: boolean;
  triggerPrice: bigint;
  sizeUsd: bigint;
}

export interface OrderBookFacetPositionOpenedEvent {
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
