# UserVault

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0x4195155D92451a47bF76987315DaEE499f1D7352` |

## Read Functions

### `diamond` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `address` |

### `getBalance` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

### `getLockedBalance` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

### `isInitialized` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

### `vaultOwner` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `address` |

## Write Functions

### `deposit`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |

### `emergencyWithdraw`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

### `initialize`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `owner_` | `address` |
| `diamond_` | `address` |

### `lockCollateral`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |
| `_centralVault` | `address` |

### `receiveCollateral`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |

### `withdraw`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |

## Events

### `CollateralLocked`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |

### `CollateralReleased`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |

### `Deposited`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |

### `EmergencyWithdrawn`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |

### `Withdrawn`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |
