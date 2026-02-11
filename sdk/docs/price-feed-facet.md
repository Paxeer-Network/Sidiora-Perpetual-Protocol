# PriceFeedFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getExecutionPrice` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_sizeUsd` | `uint256` |
| `_isLong` | `bool` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `executionPrice` | `uint256` |

### `getIndexPrice` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `price` | `uint256` |

### `getLiquidationPrice` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `price` | `uint256` |

### `getMarkPrice` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `price` | `uint256` |

### `getOracleTWAP` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `twap` | `uint256` |

### `getOracleTWAPCustom` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_windowSeconds` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `twap` | `uint256` |
