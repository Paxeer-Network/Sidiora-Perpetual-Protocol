# PositionFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getOpenInterest` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `longOI` | `uint256` |
| `shortOI` | `uint256` |

### `getPosition` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `user` | `address` |
| `marketId` | `uint256` |
| `isLong` | `bool` |
| `sizeUsd` | `uint256` |
| `collateralUsd` | `uint256` |
| `collateralToken` | `address` |
| `collateralAmount` | `uint256` |
| `entryPrice` | `uint256` |
| `timestamp` | `uint256` |
| `active` | `bool` |

### `getUserMarketPosition` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_user` | `address` |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

### `getUserPositionIds` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_user` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256[]` |

## Write Functions

### `addCollateral`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |
| `_amount` | `uint256` |

### `addSize`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |
| `_additionalCollateral` | `uint256` |
| `_leverage` | `uint256` |

### `closePosition`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |

### `openPosition`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_collateralToken` | `address` |
| `_collateralAmount` | `uint256` |
| `_leverage` | `uint256` |
| `_isLong` | `bool` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `positionId` | `uint256` |

### `partialClose`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |
| `_closeSizeUsd` | `uint256` |

## Events

### `PositionClosed`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `positionId` | `uint256` | Yes |
| `user` | `address` | Yes |
| `marketId` | `uint256` | Yes |
| `closedSizeUsd` | `uint256` | No |
| `exitPrice` | `uint256` | No |
| `realizedPnl` | `int256` | No |
| `isFullClose` | `bool` | No |

### `PositionModified`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `positionId` | `uint256` | Yes |
| `newSizeUsd` | `uint256` | No |
| `newCollateralUsd` | `uint256` | No |
| `newCollateralAmount` | `uint256` | No |

### `PositionOpened`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `positionId` | `uint256` | Yes |
| `user` | `address` | Yes |
| `marketId` | `uint256` | Yes |
| `isLong` | `bool` | No |
| `sizeUsd` | `uint256` | No |
| `leverage` | `uint256` | No |
| `entryPrice` | `uint256` | No |
| `collateralToken` | `address` | No |
| `collateralAmount` | `uint256` | No |
