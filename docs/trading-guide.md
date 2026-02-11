<p align="center">
  <img src="https://img.shields.io/badge/Leverage-Up_to_1000x-E74C3C?style=for-the-badge" alt="Leverage" />
  <img src="https://img.shields.io/badge/Position_Mode-Net_(one_direction)-blue?style=for-the-badge" alt="Net Mode" />
  <img src="https://img.shields.io/badge/Funding-Per--second_accrual-2ECC71?style=for-the-badge" alt="Funding" />
  <img src="https://img.shields.io/badge/Collateral-Multi--stablecoin-F39C12?style=for-the-badge" alt="Collateral" />
</p>

# Trading Guide

<a href="./README.md"><img src="https://img.shields.io/badge/Back_to-Index-grey?style=flat-square" alt="Back" /></a>

This document walks through the complete trading experience on Sidiora -- from depositing collateral to closing a position. Everything described here reflects the actual on-chain contract behavior.

---

## Table of contents

- [Before you trade](#before-you-trade)
- [Opening a position](#opening-a-position)
- [Managing an open position](#managing-an-open-position)
- [Closing a position](#closing-a-position)
- [Limit and stop-limit orders](#limit-and-stop-limit-orders)
- [Liquidations](#liquidations)
- [Funding rates](#funding-rates)
- [Fee structure](#fee-structure)
- [Risk considerations](#risk-considerations)

---

## Before you trade

### 1. Create a vault

Every user needs a personal on-chain vault before they can trade. This is a one-time operation.

```solidity
// Through the Diamond proxy
VaultFactoryFacet.createVault()
// Returns: your vault address (deterministic via CREATE2)
```

Your vault address is predictable before creation:

```solidity
VaultFactoryFacet.predictVaultAddress(yourAddress)
```

### 2. Deposit collateral

Once your vault exists, deposit stablecoins into it. The protocol currently accepts four collateral tokens:

| Token | Description |
|-------|-------------|
| USID | Paxeer native stablecoin |
| USDC | USD Coin |
| USDT | Tether |
| USDL | USD Libre |

```solidity
// First, approve your vault to spend your tokens
IERC20(token).approve(vaultAddress, amount);

// Then deposit
UserVault(vaultAddress).deposit(token, amount);
```

Your funds sit in your own contract. They are not in the central vault. They are not at risk until you open a trade.

### 3. Check your balance

```solidity
UserVault(vaultAddress).getBalance(token)       // available (idle) funds
UserVault(vaultAddress).getLockedBalance(token)  // locked in active positions
```

---

## Opening a position

The protocol enforces **net mode**: one direction per market per user. If you go long on BTC, you cannot simultaneously short BTC. You would need to close the long first.

### Market order (instant execution)

```solidity
PositionFacet.openPosition(
    _marketId,          // 0 = BTC, 1 = ETH, 2 = SOL, 3 = AVAX, 4 = LINK
    _collateralToken,   // address of the stablecoin
    _collateralAmount,  // raw token amount (with decimals)
    _leverage,          // 18-decimal fixed-point (e.g., 10e18 for 10x)
    _isLong             // true = long, false = short
)
// Returns: positionId
```

### What happens internally

When you call `openPosition`, the following sequence executes in a single transaction:

1. **Validation** -- checks that the market is active, the protocol is not paused, the leverage is within the market's limit, and the collateral token is whitelisted.
2. **Collateral lock** -- the Diamond calls your UserVault's `lockCollateral()`, which transfers tokens from your vault to the CentralVault.
3. **Price calculation** -- the execution price is computed from the oracle index price plus vAMM price impact. Larger orders get more impact.
4. **Fee deduction** -- trading fees are deducted from your collateral.
5. **Position storage** -- the position is written to `AppStorage.positions[]` with your entry price, size, collateral, and timestamp.
6. **Open interest update** -- the market's long or short OI is incremented.
7. **vAMM update** -- virtual reserves shift to reflect the new position.
8. **Event emission** -- `PositionOpened` is emitted from the Diamond address.

### Available markets

| Market ID | Symbol | Asset |
|:---------:|:------:|-------|
| 0 | BTC | Bitcoin |
| 1 | ETH | Ethereum |
| 2 | SOL | Solana |
| 3 | AVAX | Avalanche |
| 4 | LINK | Chainlink |

### Simulating before you trade

Use the QuoterFacet to preview a trade without spending gas on a write transaction:

```solidity
QuoterFacet.quoteOpenPosition(
    _marketId,
    _collateralToken,
    _collateralAmount,
    _leverage,
    _isLong
)
// Returns: expected entry price, fees, estimated liquidation price, price impact
```

---

## Managing an open position

### Add collateral

Deposit more collateral into an existing position to improve your margin ratio and push your liquidation price further away.

```solidity
PositionFacet.addCollateral(_positionId, _amount)
```

The additional collateral moves from your UserVault to the CentralVault. Your position's `collateralUsd` and `collateralAmount` are updated. This does not change your position size or leverage.

### Increase position size

Add size to an existing position. This requires additional collateral.

```solidity
PositionFacet.addSize(_positionId, _additionalCollateral, _leverage)
```

The new size is added at the current execution price. Your entry price becomes a weighted average of the old and new entries.

### Query your positions

```solidity
// Get all your position IDs
PositionFacet.getUserPositionIds(yourAddress)

// Get full position data
PositionFacet.getPosition(positionId)
// Returns: user, marketId, isLong, sizeUsd, collateralUsd,
//          collateralToken, collateralAmount, entryPrice, timestamp, active

// Check your position in a specific market
PositionFacet.getUserMarketPosition(yourAddress, marketId)
// Returns: positionId (0 if no position)
```

---

## Closing a position

### Full close

```solidity
PositionFacet.closePosition(_positionId)
```

This closes the entire position. PnL is calculated, funding is settled, and collateral (plus or minus PnL) returns to your UserVault. The position is marked inactive.

### Partial close

```solidity
PositionFacet.partialClose(_positionId, _closeSizeUsd)
```

Close a portion of your position. The `_closeSizeUsd` parameter specifies how much notional value to close (in 18-decimal USD). PnL is realized proportionally.

### PnL calculation

For a long position:

```
unrealizedPnl = positionSize * (currentPrice - entryPrice) / entryPrice
```

For a short position:

```
unrealizedPnl = positionSize * (entryPrice - currentPrice) / entryPrice
```

Funding payments are also settled at close time, adding to or subtracting from the final PnL.

### Simulate before closing

```solidity
QuoterFacet.quoteClosePosition(_positionId)
QuoterFacet.quotePartialClose(_positionId, _closeSizeUsd)
```

---

## Limit and stop-limit orders

Orders are stored on-chain but executed by off-chain keeper bots when trigger conditions are met.

### Place a limit order

```solidity
OrderBookFacet.placeLimitOrder(
    _marketId,
    _isLong,
    _triggerPrice,       // price at which the order activates
    _sizeUsd,            // notional size (18 decimals)
    _leverage,           // leverage (18 decimals)
    _collateralToken,
    _collateralAmount
)
// Returns: orderId
```

Collateral is **not** locked when an order is placed. It remains idle in your UserVault until the order executes.

### Place a stop-limit order

```solidity
OrderBookFacet.placeStopLimitOrder(
    _marketId,
    _isLong,
    _triggerPrice,       // price that activates the order
    _limitPrice,         // maximum/minimum execution price
    _sizeUsd,
    _leverage,
    _collateralToken,
    _collateralAmount
)
// Returns: orderId
```

The stop-limit order activates when the oracle price crosses `_triggerPrice`, but will only execute at `_limitPrice` or better.

### Cancel an order

```solidity
OrderBookFacet.cancelOrder(_orderId)
```

Only the order owner can cancel.

### How execution works

1. The keeper monitors `OracleFacet.getPrice(marketId)`.
2. When the oracle price crosses an order's trigger price, the keeper calls `executeOrder(orderId)`.
3. The contract validates the trigger condition on-chain.
4. Collateral is locked from your UserVault.
5. The position opens at the current execution price.
6. Events `OrderExecuted` and `PositionOpened` are emitted.

### Query your orders

```solidity
OrderBookFacet.getUserOrderIds(yourAddress)
OrderBookFacet.getOrder(orderId)
// Returns: user, marketId, isLong, orderType, triggerPrice,
//          limitPrice, sizeUsd, leverage, collateralToken,
//          collateralAmount, active
```

Order types: `0 = LIMIT`, `1 = STOP_LIMIT`.

---

## Liquidations

A position is liquidatable when its margin ratio falls below the market's maintenance margin (set per-market in basis points).

### Who can liquidate

Anyone. There is no permissioned liquidator. Keeper bots typically handle this, but any address can call `liquidate()` and earn the liquidation fee.

### The process

```solidity
// Check if a position can be liquidated
LiquidationFacet.checkLiquidatable(_positionId)

// Execute the liquidation
LiquidationFacet.liquidate(_positionId)
```

When a position is liquidated:

1. The position is closed at the current oracle price (no vAMM impact -- this is a fair liquidation).
2. Remaining collateral is distributed:
   - **Liquidator reward**: `remainingCollateral * liquidationFeeBps / 10000`
   - **Insurance fund**: `remainingCollateral * insuranceFeeBps / 10000`
   - **Remainder** (if any): returned to the trader's UserVault
3. Open interest and vAMM reserves are updated.
4. A `Liquidation` event is emitted.

### Auto-deleveraging (ADL)

When the insurance fund is depleted below its ADL threshold, the protocol can force-reduce profitable positions to cover losses.

```solidity
LiquidationFacet.autoDeleverage(_positionId)
```

ADL is a last resort. It only triggers when `InsuranceFundFacet.shouldTriggerADL()` returns true.

---

## Funding rates

Funding rates align the mark price with the index price over time. If longs dominate (mark > index), longs pay shorts. If shorts dominate (mark < index), shorts pay longs.

### How it accrues

Funding accrues **per second**. There is no discrete 8-hour or 1-hour funding event. The rate accumulates continuously.

```
fundingRatePerSecond = (markTWAP - indexTWAP) / indexTWAP / 86400
```

### When it settles

Funding settles automatically whenever a position is touched:

- Opening a position
- Closing a position (full or partial)
- Adding collateral
- Adding size
- Being liquidated

There is no separate "settle funding" transaction. The protocol calculates pending funding and applies it in the same transaction as the position operation.

### Query funding

```solidity
FundingRateFacet.getCurrentFundingRate(marketId)    // current rate per second
FundingRateFacet.getFundingRate24h(marketId)         // annualized 24h rate
FundingRateFacet.getPositionFunding(positionId)      // pending funding for your position
FundingRateFacet.getFundingState(marketId)            // full state (cumulative, last update, rate)
```

---

## Fee structure

Fees are configured globally via `MarketRegistryFacet.setFees()` and expressed in basis points (1 bps = 0.01%).

| Fee type | Charged when | Paid to |
|----------|-------------|---------|
| Taker fee | Opening or closing a market order | Protocol (CentralVault) |
| Maker fee | Limit order execution | Protocol (CentralVault) |
| Liquidation fee | Position is liquidated | Liquidator |
| Insurance fee | Position is liquidated | Insurance fund |

Query the current fee rates:

```solidity
MarketRegistryFacet.getFees()
// Returns: (takerFeeBps, makerFeeBps, liquidationFeeBps, insuranceFeeBps)
```

---

## Risk considerations

High leverage magnifies both gains and losses. At 1000x leverage, a 0.1% adverse price move wipes out the entire position.

| Risk | What happens | Mitigation |
|------|-------------|------------|
| **Rapid liquidation** | At 1000x, the liquidation price is extremely close to entry | Use lower leverage. Add collateral to widen the margin. |
| **Oracle delay** | Prices update every ~60 seconds | Off-chain keepers use real-time feeds for liquidation detection. On-chain staleness check halts trading if the oracle goes silent for >120 seconds. |
| **Price impact** | Large orders move the vAMM mark price against you | Use `QuoterFacet.quoteOpenPosition()` to preview impact before trading. Split large orders. |
| **Funding drain** | Holding a position on the wrong side of funding costs money over time | Monitor `FundingRateFacet.getPositionFunding()` regularly. |
| **Stablecoin depeg** | If your collateral token loses its peg, the position's collateral value drops | The protocol values collateral at oracle price, not a hardcoded $1. |
| **ADL risk** | If the insurance fund empties, profitable positions may be force-reduced | This is rare and only applies to the most profitable positions first. |

### Emergency withdrawals

If the protocol is ever globally paused, you can still withdraw your idle (unlocked) funds:

```solidity
UserVault(vaultAddress).emergencyWithdraw(token)
```

This withdraws all available balance. Collateral locked in active positions remains locked until the position is resolved.

---

<p align="center">
  <a href="./contracts.md"><img src="https://img.shields.io/badge/%E2%86%90_Contracts-grey?style=for-the-badge" alt="Previous" /></a>
  &nbsp;
  <a href="./oracle.md"><img src="https://img.shields.io/badge/Oracle_System_%E2%86%92-F39C12?style=for-the-badge" alt="Next" /></a>
</p>
