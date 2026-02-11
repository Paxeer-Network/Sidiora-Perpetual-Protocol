# FundingRateFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `getCurrentFundingRate` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `ratePerSecond` | `int256` |

### `getFundingRate24h` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `rate24h` | `int256` |

### `getFundingState` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `cumulativeLong` | `int256` |
| `cumulativeShort` | `int256` |
| `lastUpdate` | `uint256` |
| `ratePerSecond` | `int256` |

### `getPendingFunding` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `pendingLong` | `int256` |
| `pendingShort` | `int256` |

### `getPositionFunding` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `fundingPayment` | `int256` |

## Write Functions

### `updateFundingRate`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

## Events

### `FundingRateUpdated`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `marketId` | `uint256` | Yes |
| `newRatePerSecond` | `int256` | No |
| `fundingRate24h` | `int256` | No |
