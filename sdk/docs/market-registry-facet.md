# MarketRegistryFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getActiveMarketIds` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256[]` |

### `getFees` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `takerFeeBps` | `uint256` |
| `makerFeeBps` | `uint256` |
| `liquidationFeeBps` | `uint256` |
| `insuranceFeeBps` | `uint256` |

### `getMarket` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `name` | `string` |
| `symbol` | `string` |
| `maxLeverage` | `uint256` |
| `maintenanceMarginBps` | `uint256` |
| `maxOpenInterest` | `uint256` |
| `enabled` | `bool` |

### `isMarketActive` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

### `totalMarkets` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

## Write Functions

### `createMarket`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_name` | `string` |
| `_symbol` | `string` |
| `_maxLeverage` | `uint256` |
| `_maintenanceMarginBps` | `uint256` |
| `_maxOpenInterest` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `marketId` | `uint256` |

### `disableMarket`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

### `enableMarket`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

### `setFees`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_takerFeeBps` | `uint256` |
| `_makerFeeBps` | `uint256` |
| `_liquidationFeeBps` | `uint256` |
| `_insuranceFeeBps` | `uint256` |

### `updateMarket`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_maxLeverage` | `uint256` |
| `_maintenanceMarginBps` | `uint256` |
| `_maxOpenInterest` | `uint256` |

## Events

### `FeesUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `takerFeeBps` | `uint256` | No |
| `makerFeeBps` | `uint256` | No |
| `liquidationFeeBps` | `uint256` | No |
| `insuranceFeeBps` | `uint256` | No |

### `MarketCreated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
| `name` | `string` | No |
| `symbol` | `string` | No |
| `maxLeverage` | `uint256` | No |

### `MarketDisabled`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |

### `MarketEnabled`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |

### `MarketUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
