# AccessControlFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `DIAMOND_OWNER_ROLE` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `INSURANCE_ADMIN_ROLE` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `KEEPER_ROLE` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `MARKET_ADMIN_ROLE` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `ORACLE_POSTER_ROLE` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `PAUSER_ROLE` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `PROTOCOL_FUNDER_ROLE` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `getRoleAdmin` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_role` | `bytes32` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bytes32` |

### `hasRole` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_role` | `bytes32` |
| `_account` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `bool` |

## Write Functions

### `grantRole`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_role` | `bytes32` |
| `_account` | `address` |

### `renounceRole`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_role` | `bytes32` |

### `revokeRole`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_role` | `bytes32` |
| `_account` | `address` |

### `setRoleAdmin`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_role` | `bytes32` |
| `_adminRole` | `bytes32` |

## Events

### `RoleAdminChanged`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `role` | `bytes32` | Yes |
| `previousAdminRole` | `bytes32` | Yes |
| `newAdminRole` | `bytes32` | Yes |

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
