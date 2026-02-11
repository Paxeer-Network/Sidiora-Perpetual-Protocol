# PausableFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `isGlobalPaused` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

### `isMarketPaused` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

## Write Functions

### `pauseGlobal`

### `pauseMarket`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

### `unpauseGlobal`

### `unpauseMarket`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

## Events

### `GlobalPaused`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `by` | `address` | Yes |

### `GlobalUnpaused`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `by` | `address` | Yes |

### `MarketPaused`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
| `by` | `address` | Yes |

### `MarketUnpaused`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
| `by` | `address` | Yes |
