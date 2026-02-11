# OrderBookFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getOrder` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_orderId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `user` | `address` |
| `marketId` | `uint256` |
| `isLong` | `bool` |
| `orderType` | `uint8` |
| `triggerPrice` | `uint256` |
| `limitPrice` | `uint256` |
| `sizeUsd` | `uint256` |
| `leverage` | `uint256` |
| `collateralToken` | `address` |
| `collateralAmount` | `uint256` |
| `active` | `bool` |

### `getUserOrderIds` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_user` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256[]` |

## Write Functions

### `cancelOrder`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_orderId` | `uint256` |

### `executeOrder`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_orderId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `positionId` | `uint256` |

### `placeLimitOrder`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_isLong` | `bool` |
| `_triggerPrice` | `uint256` |
| `_sizeUsd` | `uint256` |
| `_leverage` | `uint256` |
| `_collateralToken` | `address` |
| `_collateralAmount` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `orderId` | `uint256` |

### `placeStopLimitOrder`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_isLong` | `bool` |
| `_triggerPrice` | `uint256` |
| `_limitPrice` | `uint256` |
| `_sizeUsd` | `uint256` |
| `_leverage` | `uint256` |
| `_collateralToken` | `address` |
| `_collateralAmount` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `orderId` | `uint256` |

## Events

### `OrderCancelled`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `orderId` | `uint256` | Yes |
| `user` | `address` | Yes |

### `OrderExecuted`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `orderId` | `uint256` | Yes |
| `positionId` | `uint256` | Yes |
| `executionPrice` | `uint256` | No |

### `OrderPlaced`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `orderId` | `uint256` | Yes |
| `user` | `address` | Yes |
| `marketId` | `uint256` | Yes |
| `orderType` | `uint8` | No |
| `isLong` | `bool` | No |
| `triggerPrice` | `uint256` | No |
| `sizeUsd` | `uint256` | No |

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
