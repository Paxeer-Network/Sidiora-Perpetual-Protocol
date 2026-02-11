# VirtualAMMFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getMarkPrice` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `markPrice` | `uint256` |

### `getPool` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `baseReserve` | `uint256` |
| `quoteReserve` | `uint256` |
| `lastSyncTimestamp` | `uint256` |
| `dampingFactor` | `uint256` |

### `simulateImpact` `view`

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
| `priceImpact` | `uint256` |

## Write Functions

### `initializePool`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_initialPrice` | `uint256` |
| `_virtualLiquidity` | `uint256` |
| `_dampingFactor` | `uint256` |

### `syncToOracle`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

## Events

### `PoolInitialized`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
| `baseReserve` | `uint256` | No |
| `quoteReserve` | `uint256` | No |

### `PoolReservesUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
| `newBase` | `uint256` | No |
| `newQuote` | `uint256` | No |

### `PoolSynced`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
| `newBase` | `uint256` | No |
| `newQuote` | `uint256` | No |
| `oraclePrice` | `uint256` | No |
