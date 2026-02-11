# QuoterFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `quoteClosePosition` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `quote` | `tuple` |

### `quoteMarket` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `quote` | `tuple` |

### `quoteOpenPosition` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_marketId` | `uint256` |
| `_collateralToken` | `address` |
| `_collateralAmount` | `uint256` |
| `_leverage` | `uint256` |
| `_isLong` | `bool` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `quote` | `tuple` |

### `quotePartialClose` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |
| `_closeSizeUsd` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `exitPrice` | `uint256` |
| `closedPnl` | `int256` |
| `fee` | `uint256` |
| `estimatedPayout` | `uint256` |
