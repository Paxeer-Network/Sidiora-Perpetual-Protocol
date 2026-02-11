# InsuranceFundFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getADLThreshold` `view`

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

### `getInsuranceBalance` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `arg0` | `uint256` |

### `shouldTriggerADL` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `shouldADL` | `bool` |

## Write Functions

### `setADLThreshold`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_threshold` | `uint256` |

### `withdrawInsurance`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_token` | `address` |
| `_amount` | `uint256` |
| `_to` | `address` |

## Events

### `ADLThresholdUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `oldThreshold` | `uint256` | No |
| `newThreshold` | `uint256` | No |

### `InsuranceWithdrawn`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `token` | `address` | Yes |
| `amount` | `uint256` | No |
| `to` | `address` | Yes |
