# LiquidationFacet

## Deployed Addresses

| Network | Address |
| ------- | ------- |
| hyperpaxeer | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |

## Read Functions

### `checkLiquidatable` `view`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |

**Returns:**

| Name | Type |
| ---- | ---- |
| `liquidatable` | `bool` |
| `marginBps` | `uint256` |

## Write Functions

### `autoDeleverage`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |
| `_deleverageSize` | `uint256` |

### `liquidate`

**Parameters:**

| Name | Type |
| ---- | ---- |
| `_positionId` | `uint256` |

## Events

### `ADLExecuted`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `positionId` | `uint256` | Yes |
| `deleveragedSizeUsd` | `uint256` | No |

### `Liquidation`

| Name | Type | Indexed |
| ---- | ---- | ------- |
| `positionId` | `uint256` | Yes |
| `user` | `address` | Yes |
| `marketId` | `uint256` | Yes |
| `liquidationPrice` | `uint256` | No |
| `penalty` | `uint256` | No |
| `keeper` | `address` | No |
