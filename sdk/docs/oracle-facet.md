# OracleFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getMaxPriceStaleness` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

### `getPrice` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `price` | `uint256` |
| `timestamp` | `uint256` |

### `getPriceHistoryLength` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

### `getPricePoint` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_index` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `price` | `uint256` |
| `timestamp` | `uint256` |

### `isAuthorizedPoster` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_poster` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

### `isPriceStale` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

## Write Functions

### `addPricePoster`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_poster` | `address` |

### `batchUpdatePrices`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketIds` | `uint256[]` |
| `_prices` | `uint256[]` |

### `removePricePoster`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_poster` | `address` |

### `setMaxPriceStaleness`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_maxStaleness` | `uint256` |

## Events

### `MaxPriceStalenessUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `oldValue` | `uint256` | No |
| `newValue` | `uint256` | No |

### `PricePosterAdded`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `poster` | `address` | Yes |

### `PricePosterRemoved`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `poster` | `address` | Yes |

### `PricesUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketIds` | `uint256[]` | No |
| `prices` | `uint256[]` | No |
| `timestamp` | `uint256` | No |

### `RoleGranted`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `role` | `bytes32` | Yes |
| `account` | `address` | Yes |
| `sender` | `address` | Yes |

### `RoleRevoked`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `role` | `bytes32` | Yes |
| `account` | `address` | Yes |
| `sender` | `address` | Yes |
