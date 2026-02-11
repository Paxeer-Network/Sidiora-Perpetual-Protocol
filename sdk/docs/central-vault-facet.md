# CentralVaultFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getUtilization` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `utilizationBps` | `uint256` |

### `getVaultBalance` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

## Write Functions

### `defundVault`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |
| `_to` | `address` |

### `fundVault`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |

## Events

### `VaultDefunded`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |
| `to` | `address` | Yes |

### `VaultFunded`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |
| `funder` | `address` | Yes |
