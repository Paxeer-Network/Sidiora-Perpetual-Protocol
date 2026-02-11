# CollateralFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getCollateralDecimals` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint8` |

### `getCollateralTokens` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `address[]` |

### `getCollateralValue` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `valueUsd` | `uint256` |

### `isAcceptedCollateral` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

## Write Functions

### `addCollateral`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

### `removeCollateral`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

## Events

### `CollateralAdded`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `decimals` | `uint8` | No |

### `CollateralRemoved`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
