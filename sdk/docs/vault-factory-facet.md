# VaultFactoryFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getUserVaultImplementation` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `address` |

### `getVault` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_user` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `address` |

### `predictVaultAddress` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_user` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `address` |

### `totalVaults` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

## Write Functions

### `createVault`

**Returns:**

| Name | Type |
| ---- | ---- |
| `vault` | `address` |

### `setImplementation`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_implementation` | `address` |

## Events

### `VaultCreated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `user` | `address` | Yes |
| `vault` | `address` | Yes |

### `VaultImplementationUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `oldImpl` | `address` | Yes |
| `newImpl` | `address` | Yes |
