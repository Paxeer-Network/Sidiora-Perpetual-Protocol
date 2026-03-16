# Sidiora Perpetual Protocol — Frontend Integration Guide

> **Target audience:** Frontend developers integrating the on-chain perpetual trading protocol with the off-chain data layer.
>
> **Last updated:** 2026-02-11

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Network & Addresses](#2-network--addresses)
3. [SDK Installation](#3-sdk-installation)
4. [Account Creation Flow](#4-account-creation-flow-uservault)
5. [Collateral: Deposit & Withdraw](#5-collateral-deposit--withdraw)
6. [Market Data (Off-Chain)](#6-market-data-off-chain)
7. [Trading: Market Orders (Open Position)](#7-trading-market-orders-open-position)
8. [Trading: Limit & Stop-Limit Orders](#8-trading-limit--stop-limit-orders)
9. [Position Management](#9-position-management)
10. [Quoting & Price Impact](#10-quoting--price-impact)
11. [Funding Rates](#11-funding-rates)
12. [Liquidation](#12-liquidation)
13. [GraphQL Subgraph Reference](#13-graphql-subgraph-reference)
14. [Error Handling](#14-error-handling)
15. [Decimal Conventions](#15-decimal-conventions)
16. [Appendix: Full User Flow Sequence](#appendix-full-user-flow-sequence)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│                                                                  │
│  wagmi/viem ◄──── SDK (@paxeer-network/sidiora-perpetuals) ───► │
│       │                     │                                    │
│       │  on-chain reads     │  off-chain reads                   │
│       ▼                     ▼                                    │
│  Diamond Proxy         GraphQL Subgraph                          │
│  (all facets)          (indexer)                                  │
└──────┬─────────────────────┬─────────────────────────────────────┘
       │                     │
       ▼                     ▼
  Paxeer Network        us-east-1.perpetual-protocol
  (chainId 125)         .sidiora.exchange/graphql
```

**Key concepts:**

- **Diamond Proxy (EIP-2535):** Single contract address, 19 facets. All on-chain calls go to this address.
- **UserVault (EIP-1167):** Each user gets a personal vault clone. Holds collateral. Created once per wallet.
- **Off-chain services:** Oracle (Pyth prices → on-chain), Keeper (order execution, liquidation, vAMM sync), Indexer (event → PostgreSQL → GraphQL).
- **Data strategy:** Use the **subgraph for reads** (positions, orders, trades, prices, stats). Use **on-chain writes** via the Diamond for all mutations. Use **on-chain reads** (`QuoterFacet`) for real-time quotes and price impact.

---

## 2. Network & Addresses

| Item | Value |
|---|---|
| **Chain** | Paxeer Network |
| **Chain ID** | `125` |
| **RPC** | `https://public-rpc.paxeer.app/rpc` |
| **Diamond Proxy** | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| **UserVault Implementation** | `0x4195155D92451a47bF76987315DaEE499f1D7352` |
| **Subgraph URL** | `https://us-east-1.perpetual-protocol.sidiora.exchange/graphql` |

All facet calls go to the **Diamond Proxy address**. The SDK constants already have this set:

```ts
import { DIAMOND_ADDRESS } from '@paxeer-network/sidiora-perpetuals';
// → 0xeA65FE02665852c615774A3041DFE6f00fb77537
```

---

## 3. SDK Installation

```bash
npm install @paxeer-network/sidiora-perpetuals
```

The SDK provides:

| Export | Description |
|---|---|
| `abis/*` | TypeScript ABI objects for every facet + UserVault |
| `actions/*` | Wagmi `readContract` / `writeContract` wrappers per facet |
| `hooks/*` | React hooks (`useRead*`, `useWrite*`) per facet |
| `types/*` | TypeScript interfaces for args and return types |
| `constants/addresses` | All deployed contract addresses |

### Wagmi Config

```ts
import { createConfig, http } from 'wagmi';

const paxeerNetwork = {
  id: 125,
  name: 'Paxeer Network',
  nativeCurrency: { name: 'PAX', symbol: 'PAX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://public-rpc.paxeer.app/rpc'] },
  },
};

export const config = createConfig({
  chains: [paxeerNetwork],
  transports: { [paxeerNetwork.id]: http() },
});
```

---

## 4. Account Creation Flow (UserVault)

Every user **must have a UserVault before trading**. This is the on-chain "perpetual account." It's a one-time operation.

### 4.1 Check if Vault Exists

```ts
import { readVaultFactoryFacetGetVault } from '@paxeer-network/sidiora-perpetuals';

const vaultAddress = await readVaultFactoryFacetGetVault(config, {
  _user: userAddress,
});

const hasVault = vaultAddress !== '0x0000000000000000000000000000000000000000';
```

### 4.2 Create Vault (if none exists)

```ts
import { writeVaultFactoryFacetCreateVault } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writeVaultFactoryFacetCreateVault(config);
// Wait for confirmation, then re-read vaultAddress
```

**What happens on-chain:**
1. Diamond deploys an EIP-1167 minimal proxy clone via CREATE2 (deterministic address)
2. Clone is initialized with `owner = msg.sender`, `diamond = Diamond address`
3. `VaultCreated(user, vault)` event emitted
4. Vault address stored in `AppStorage.userVaults[user]`

### 4.3 Predict Vault Address (before creation)

Useful for pre-computing the address to display in UI before the user creates:

```ts
import { readVaultFactoryFacetPredictVaultAddress } from '@paxeer-network/sidiora-perpetuals';

const predictedVault = await readVaultFactoryFacetPredictVaultAddress(config, {
  _user: userAddress,
});
```

### 4.4 UI Flow

```
┌──────────────────────────────────────────────────┐
│ User connects wallet                             │
│          │                                       │
│          ▼                                       │
│ Call getVault(user) — has vault?                  │
│          │                                       │
│    ┌─────┴─────┐                                 │
│    │ YES       │ NO                              │
│    ▼           ▼                                 │
│ Show trading   Show "Create Account" button      │
│ interface      │                                 │
│                ▼                                 │
│           User clicks → createVault() tx         │
│                │                                 │
│                ▼                                 │
│           Wait for confirmation                  │
│                │                                 │
│                ▼                                 │
│           Show deposit prompt                    │
│                │                                 │
│                ▼                                 │
│           Trading interface ready                │
└──────────────────────────────────────────────────┘
```

---

## 5. Collateral: Deposit & Withdraw

Users deposit stablecoins into their UserVault. Collateral is locked by the Diamond when positions are opened.

### 5.1 Get Accepted Collateral Tokens

```graphql
query {
  collateralTokens {
    tokenAddress
    decimals
    isActive
  }
}
```

Or on-chain:
```ts
import { readCollateralFacetGetCollateralTokens } from '@paxeer-network/sidiora-perpetuals';
const tokens = await readCollateralFacetGetCollateralTokens(config);
```

### 5.2 Deposit Flow

**Step 1: Approve the UserVault to spend tokens**

The user must approve their **own vault address** (not the Diamond) to spend their stablecoins:

```ts
// Standard ERC-20 approve — vault address is the spender
const approveTx = await writeContract(config, {
  address: collateralTokenAddress,
  abi: erc20Abi,
  functionName: 'approve',
  args: [userVaultAddress, amount],
});
```

**Step 2: Deposit into vault**

```ts
// Call deposit on the user's vault clone (NOT the Diamond)
const depositTx = await writeContract(config, {
  address: userVaultAddress,  // ← user's vault clone address
  abi: UserVaultAbi,
  functionName: 'deposit',
  args: [collateralTokenAddress, amount],
});
```

> **Important:** `deposit()` is called on the **user's vault clone**, not on the Diamond.

### 5.3 Check Balances

```ts
// Available (idle) balance in vault
const available = await readContract(config, {
  address: userVaultAddress,
  abi: UserVaultAbi,
  functionName: 'getBalance',
  args: [collateralTokenAddress],
});

// Locked (in active positions)
const locked = await readContract(config, {
  address: userVaultAddress,
  abi: UserVaultAbi,
  functionName: 'getLockedBalance',
  args: [collateralTokenAddress],
});
```

### 5.4 Withdraw

Can only withdraw **available** (unlocked) balance:

```ts
const withdrawTx = await writeContract(config, {
  address: userVaultAddress,
  abi: UserVaultAbi,
  functionName: 'withdraw',
  args: [collateralTokenAddress, amount],
});
```

### 5.5 Emergency Withdraw

Withdraws all available balance at once:

```ts
const emergencyTx = await writeContract(config, {
  address: userVaultAddress,
  abi: UserVaultAbi,
  functionName: 'emergencyWithdraw',
  args: [collateralTokenAddress],
});
```

---

## 6. Market Data (Off-Chain)

Use the GraphQL subgraph for all read-heavy display data. It's indexed from on-chain events and updated in real-time.

**Endpoint:** `https://us-east-1.perpetual-protocol.sidiora.exchange/graphql`

### 6.1 All Markets

```graphql
query {
  markets {
    marketId
    name
    symbol
    maxLeverage
    enabled
    latestPrice {
      price
      onchainTimestamp
    }
    poolState {
      baseReserve
      quoteReserve
      oraclePrice
    }
    fundingRate {
      rate24h
      ratePerSecond
    }
  }
}
```

### 6.2 Latest Prices (all markets)

```graphql
query {
  latestPrices {
    marketId
    price
    onchainTimestamp
    updatedAt
  }
}
```

### 6.3 Price History (for charts)

```graphql
query PriceHistory($marketId: Int!, $limit: Int) {
  priceHistory(marketId: $marketId, limit: $limit) {
    price
    onchainTimestamp
    blockTimestamp
  }
}
```

### 6.4 Market Stats

```graphql
query {
  marketStats(marketId: 0) {
    totalPositions
    openPositions
    totalTrades
    totalLiquidations
    totalVolume
    latestPrice
    latestFundingRate
  }
}
```

### 6.5 Real-Time On-Chain Market Quote

For the **most up-to-date** mark price, funding rate, and OI — use the on-chain `QuoterFacet`:

```ts
import { readQuoterFacetQuoteMarket } from '@paxeer-network/sidiora-perpetuals';

const quote = await readQuoterFacetQuoteMarket(config, { _marketId: 0n });
// Returns:
// {
//   indexPrice,     ← oracle price
//   markPrice,      ← vAMM mark price
//   oracleTWAP,     ← 15-min TWAP (used for funding)
//   fundingRatePerSecond,
//   fundingRate24h,
//   longOI, shortOI,
//   maxLeverage,
//   maintenanceMarginBps,
//   enabled,
//   priceStale      ← true if oracle price > 120s old
// }
```

**Recommendation:** Poll `quoteMarket()` every 3–5 seconds for the trading panel. Use the subgraph for historical data, leaderboards, and stats pages.

---

## 7. Trading: Market Orders (Open Position)

Market orders execute immediately at the current mark price.

### 7.1 Pre-Trade Quote

**Always show the user a quote before they confirm.** Use `quoteOpenPosition()`:

```ts
import { readQuoterFacetQuoteOpenPosition } from '@paxeer-network/sidiora-perpetuals';

const quote = await readQuoterFacetQuoteOpenPosition(config, {
  _marketId: 0n,                    // BTC
  _collateralToken: usdcAddress,
  _collateralAmount: parseUnits('100', 6),  // 100 USDC
  _leverage: parseEther('10'),       // 10x
  _isLong: true,
});
// Returns:
// {
//   entryPrice,           ← execution price with slippage
//   sizeUsd,              ← notional position size
//   collateralUsd,        ← net collateral after fee
//   leverage,
//   tradingFee,           ← fee in collateral tokens
//   tradingFeeUsd,        ← fee in USD
//   priceImpact,          ← price impact in USD (18 dec)
//   liquidationPrice,     ← estimated liq price
//   estimatedFunding24h,  ← 24h funding estimate (signed)
//   maintenanceMarginBps  ← maintenance margin requirement
// }
```

**Display to user:** entry price, trading fee, price impact, leverage, liquidation price, estimated 24h funding.

### 7.2 Execute Trade

```ts
import { writePositionFacetOpenPosition } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writePositionFacetOpenPosition(config, {
  _marketId: 0n,
  _collateralToken: usdcAddress,
  _collateralAmount: parseUnits('100', 6),
  _leverage: parseEther('10'),
  _isLong: true,
});
```

**What happens on-chain:**
1. Checks: market enabled, collateral accepted, no existing position in same market, price not stale
2. Calculates execution price via vAMM (oracle + price impact)
3. Locks collateral: `UserVault.lockCollateral()` → transfers tokens to CentralVault
4. Deducts trading fee, contributes portion to insurance fund
5. Creates `Position` struct in storage
6. Updates open interest and vAMM reserves
7. Emits `PositionOpened` event

### 7.3 Constraints

| Rule | Detail |
|---|---|
| **One position per market** | Net mode: user cannot have long + short in same market. Close existing first. |
| **Vault required** | `openPosition` reverts if user has no vault |
| **Price freshness** | Reverts if oracle price older than `maxPriceStaleness` (120s) |
| **Max leverage** | Per-market: BTC/ETH = 1000x, SOL/AVAX = 500x, LINK = 200x |
| **Max OI** | Per-market cap on total long/short open interest |

---

## 8. Trading: Limit & Stop-Limit Orders

Orders are stored on-chain and executed by the keeper when trigger conditions are met.

### 8.1 Place Limit Order

```ts
import { writeOrderBookFacetPlaceLimitOrder } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writeOrderBookFacetPlaceLimitOrder(config, {
  _marketId: 0n,
  _isLong: true,
  _triggerPrice: parseEther('60000'),        // Trigger at $60,000
  _sizeUsd: parseEther('10000'),             // $10,000 notional
  _leverage: parseEther('10'),               // 10x
  _collateralToken: usdcAddress,
  _collateralAmount: parseUnits('1000', 6),  // 1000 USDC
});
```

**Trigger logic:**
- **Long limit:** executes when `currentPrice ≤ triggerPrice` (buy the dip)
- **Short limit:** executes when `currentPrice ≥ triggerPrice` (sell the rip)

### 8.2 Place Stop-Limit Order

```ts
import { writeOrderBookFacetPlaceStopLimitOrder } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writeOrderBookFacetPlaceStopLimitOrder(config, {
  _marketId: 0n,
  _isLong: true,
  _triggerPrice: parseEther('70000'),        // Trigger at $70k
  _limitPrice: parseEther('70500'),          // Max execution price $70.5k
  _sizeUsd: parseEther('10000'),
  _leverage: parseEther('10'),
  _collateralToken: usdcAddress,
  _collateralAmount: parseUnits('1000', 6),
});
```

**Trigger logic:**
- **Long stop-limit:** triggers at `triggerPrice`, executes only if `executionPrice ≤ limitPrice`
- **Short stop-limit:** triggers at `triggerPrice`, executes only if `executionPrice ≥ limitPrice`

### 8.3 Cancel Order

```ts
import { writeOrderBookFacetCancelOrder } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writeOrderBookFacetCancelOrder(config, {
  _orderId: orderId,
});
```

Only the order creator can cancel.

### 8.4 Order Lifecycle

```
User places order → OrderPlaced event
         │
         ▼
Order stored on-chain (active = true)
         │
         ▼
Keeper monitors prices every ~30s
         │
    ┌────┴────┐
    │ Trigger  │ No trigger
    │ met      │ → wait
    ▼         
Keeper calls executeOrder()
         │
    ┌────┴────┐
    │ Success  │ Revert (e.g. limit price exceeded)
    ▼          │
Position       │ → Order stays active, keeper retries
opened         
    │
    ▼
OrderExecuted event + PositionOpened event
```

### 8.5 Query User Orders

```graphql
query UserOrders($user: String!) {
  orders(userAddress: $user, status: "active") {
    orderId
    marketId
    orderType        # 0 = LIMIT, 1 = STOP_LIMIT
    isLong
    triggerPrice
    sizeUsd
    status           # "active", "executed", "cancelled"
    executionPrice
    positionId
    placedAt
  }
}
```

---

## 9. Position Management

### 9.1 View Positions

**Subgraph (recommended for lists):**

```graphql
query UserPositions($user: String!) {
  positions(userAddress: $user, status: "open") {
    positionId
    marketId
    isLong
    sizeUsd
    leverage
    entryPrice
    collateralToken
    collateralAmount
    collateralUsd
    openedAt
    market { symbol latestPrice { price } }
  }
}
```

**On-chain (for real-time single position):**

```ts
import { readPositionFacetGetPosition } from '@paxeer-network/sidiora-perpetuals';

const pos = await readPositionFacetGetPosition(config, {
  _positionId: positionId,
});
// Returns: [user, marketId, isLong, sizeUsd, collateralUsd, collateralToken, collateralAmount, entryPrice, timestamp, active]
```

### 9.2 Close Position (Full)

```ts
// 1. Quote first
const closeQuote = await readQuoterFacetQuoteClosePosition(config, {
  _positionId: positionId,
});
// Returns: { exitPrice, unrealizedPnl, tradingFee, tradingFeeUsd, fundingOwed, netPnl, estimatedPayout }

// 2. Show confirmation dialog with PnL, fee, payout

// 3. Execute
import { writePositionFacetClosePosition } from '@paxeer-network/sidiora-perpetuals';
const txHash = await writePositionFacetClosePosition(config, {
  _positionId: positionId,
});
```

**On-chain flow:** Settles funding → calculates PnL at current price → deducts fee → sends payout to UserVault → deactivates position.

### 9.3 Partial Close

```ts
// 1. Quote
const partialQuote = await readQuoterFacetQuotePartialClose(config, {
  _positionId: positionId,
  _closeSizeUsd: parseEther('5000'), // Close $5k of a $10k position
});
// Returns: [exitPrice, closedPnl, fee, estimatedPayout]

// 2. Execute
import { writePositionFacetPartialClose } from '@paxeer-network/sidiora-perpetuals';
const txHash = await writePositionFacetPartialClose(config, {
  _positionId: positionId,
  _closeSizeUsd: parseEther('5000'),
});
```

### 9.4 Add Collateral (Reduce Leverage)

```ts
import { writePositionFacetAddCollateral } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writePositionFacetAddCollateral(config, {
  _positionId: positionId,
  _amount: parseUnits('500', 6), // Add 500 USDC
});
```

### 9.5 Add Size (Increase Position)

```ts
import { writePositionFacetAddSize } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writePositionFacetAddSize(config, {
  _positionId: positionId,
  _additionalCollateral: parseUnits('500', 6),
  _leverage: parseEther('10'),
});
```

Entry price is recalculated as a weighted average of old and new entry prices.

### 9.6 Calculating Unrealized PnL (Frontend)

For real-time PnL display without RPC calls:

```ts
function calculateUnrealizedPnl(
  isLong: boolean,
  sizeUsd: bigint,      // 18 dec
  entryPrice: bigint,   // 18 dec
  currentPrice: bigint, // 18 dec
): bigint {
  const priceDelta = currentPrice - entryPrice;
  // PnL = sizeUsd × (currentPrice - entryPrice) / entryPrice
  // For short: negate
  const pnl = (sizeUsd * priceDelta) / entryPrice;
  return isLong ? pnl : -pnl;
}
```

---

## 10. Quoting & Price Impact

The `QuoterFacet` is your **primary tool for trade simulation**. All functions are `view` (free, no gas).

| Function | Use Case |
|---|---|
| `quoteOpenPosition()` | Pre-trade confirmation dialog |
| `quoteClosePosition()` | Close position confirmation |
| `quotePartialClose()` | Partial close confirmation |
| `quoteMarket()` | Trading panel (mark price, funding, OI) |

### Price Impact Model

The protocol uses a **Virtual AMM** for price impact. Larger trades incur more slippage:

```
Mark Price = quoteReserve / baseReserve
```

Opening a long adds to `quoteReserve` → mark price increases.
Opening a short removes from `quoteReserve` → mark price decreases.

The vAMM converges back toward the oracle price every ~30 seconds (50% damping factor per sync cycle).

---

## 11. Funding Rates

Funding is settled **per-second** and paid between longs and shorts. It is settled on every position interaction (open, close, add collateral, etc.).

### 11.1 Display Funding Rate

```graphql
query {
  fundingRates(marketId: 0, limit: 1) {
    rate24h          # Annualized 24h rate (18 dec, signed)
    ratePerSecond    # Per-second rate (18 dec, signed)
    blockTimestamp
  }
}
```

Or from `quoteMarket()`:

```ts
const { fundingRate24h } = await readQuoterFacetQuoteMarket(config, { _marketId: 0n });
// Positive = longs pay shorts; Negative = shorts pay longs
```

### 11.2 Estimated Funding for a Position

From `quoteOpenPosition().estimatedFunding24h` or calculate manually:

```ts
const estimated24hFunding = (sizeUsd * fundingRate24h) / 10n ** 18n;
// Negative means receiving funding
```

---

## 12. Liquidation

Positions are liquidatable when margin ratio drops below the maintenance margin. Anyone can call `liquidate()` — it's permissionless (keeper is incentivized with 60% of penalty).

### 12.1 Check Liquidation Risk (Frontend)

```ts
import { readLiquidationFacetCheckLiquidatable } from '@paxeer-network/sidiora-perpetuals';

const [liquidatable, marginBps] = await readLiquidationFacetCheckLiquidatable(config, {
  _positionId: positionId,
});

// marginBps < maintenanceMarginBps → liquidatable
// Display margin ratio: marginBps / 100 = percentage
```

### 12.2 Liquidation Price (from Quote)

The `quoteOpenPosition()` response includes `liquidationPrice`. For existing positions, calculate:

```ts
function estimateLiquidationPrice(
  entryPrice: bigint,
  collateralUsd: bigint,
  sizeUsd: bigint,
  maintenanceMarginBps: bigint,
  isLong: boolean,
): bigint {
  // margin = collateral / size (in bps)
  // At liquidation: margin = maintenanceMarginBps / 10000
  // liqPrice = entryPrice × (1 - (collateral/size - maintenanceMargin/10000)) for longs
  const maintenanceRatio = (maintenanceMarginBps * 10n ** 18n) / 10000n;
  const collateralRatio = (collateralUsd * 10n ** 18n) / sizeUsd;
  const buffer = collateralRatio - maintenanceRatio;

  if (isLong) {
    return entryPrice - (entryPrice * buffer) / 10n ** 18n;
  } else {
    return entryPrice + (entryPrice * buffer) / 10n ** 18n;
  }
}
```

---

## 13. GraphQL Subgraph Reference

**Endpoint:** `https://us-east-1.perpetual-protocol.sidiora.exchange/graphql`

### Available Queries

| Query | Description |
|---|---|
| `markets` | All markets with latest price, pool state, funding |
| `market(marketId)` | Single market |
| `positions(userAddress, marketId, status)` | Positions (filter: "open", "closed", "liquidated") |
| `position(positionId)` | Single position |
| `orders(userAddress, marketId, status)` | Orders (filter: "active", "executed", "cancelled") |
| `trades(userAddress, marketId, positionId)` | Trade history |
| `liquidations(userAddress, marketId)` | Liquidation events |
| `latestPrices` | All market prices |
| `priceHistory(marketId, limit)` | Historical prices (for charts) |
| `fundingRates(marketId, limit)` | Funding rate history |
| `userVault(userAddress)` | Vault address and creation info |
| `vaultEvents(userAddress, eventType)` | Deposit/withdraw/lock/release events |
| `collateralTokens` | Accepted collateral list |
| `poolStates` / `poolState(marketId)` | vAMM pool state |
| `feeConfig` | Current fee configuration |
| `userStats(userAddress)` | Per-user aggregate stats |
| `marketStats(marketId)` | Per-market aggregate stats |
| `globalStats` | Protocol-wide aggregates |
| `indexerStatus` | Indexer sync status |

### User Dashboard Query

```graphql
query Dashboard($user: String!) {
  userVault(userAddress: $user) {
    vaultAddress
  }
  positions(userAddress: $user, status: "open") {
    positionId
    marketId
    isLong
    sizeUsd
    entryPrice
    collateralUsd
    leverage
    market { symbol latestPrice { price } }
  }
  orders(userAddress: $user, status: "active") {
    orderId
    marketId
    orderType
    isLong
    triggerPrice
    sizeUsd
  }
  userStats(userAddress: $user) {
    totalPositions
    openPositions
    totalRealizedPnl
    totalTrades
    activeOrders
  }
}
```

### Trade History Query

```graphql
query TradeHistory($user: String!, $limit: Int) {
  trades(userAddress: $user, limit: $limit) {
    tradeType      # "open", "close", "partial_close", "liquidation", "add_size"
    marketId
    isLong
    sizeUsd
    price
    realizedPnl
    feeUsd
    blockTimestamp
    txHash
  }
}
```

---

## 14. Error Handling

### Common Revert Reasons

| Revert Message | Cause | Frontend Action |
|---|---|---|
| `"VaultFactory: vault already exists"` | User already has vault | Skip creation, proceed to deposit |
| `"Position: create vault first"` | No vault | Prompt vault creation |
| `"Position: protocol paused"` | Protocol paused | Show maintenance banner |
| `"Position: market paused"` | Specific market paused | Disable trading for that market |
| `"Position: market not enabled"` | Market disabled | Hide or gray out market |
| `"Position: collateral not accepted"` | Bad collateral token | Show accepted tokens |
| `"Position: close existing position first"` | Net mode violation | Show "close position first" message |
| `"Position: price is stale"` | Oracle price too old | Show "Price unavailable" |
| `"Position: exceeds max open interest"` | OI cap hit | Show "Market at capacity" |
| `"UserVault: insufficient available balance"` | Not enough collateral | Show "Insufficient balance" + deposit prompt |
| `"UserVault: insufficient balance to lock"` | Not enough idle balance | Prompt deposit |
| `"OrderBook: order not active"` | Order already filled/cancelled | Refresh order list |
| `"OrderBook: not owner"` | Trying to cancel someone else's order | Bug in frontend |
| `"Liquidation: position is healthy"` | Position not liquidatable | Refresh margin data |

### Simulate Before Write

Always use `simulateContract` before `writeContract` to catch reverts before sending a tx:

```ts
import { simulatePositionFacetOpenPosition } from '@paxeer-network/sidiora-perpetuals';

try {
  await simulatePositionFacetOpenPosition(config, args);
  // Safe to proceed
  await writePositionFacetOpenPosition(config, args);
} catch (err) {
  // Parse revert reason and show user-friendly message
}
```

---

## 15. Decimal Conventions

| Value | Decimals | Example |
|---|---|---|
| Prices (oracle, entry, exit, trigger) | 18 | `67000e18` = $67,000 |
| Position size (sizeUsd) | 18 | `10000e18` = $10,000 |
| Collateral USD value | 18 | `1000e18` = $1,000 |
| Leverage | 18 | `10e18` = 10x |
| Funding rate (per second) | 18 (signed) | Can be negative |
| Funding rate (24h) | 18 (signed) | `fundingRatePerSecond * 86400` |
| Margin ratio | bps (uint256) | `500` = 5.00% |
| Fee config | bps (uint256) | `10` = 0.10% |
| USDC collateral amount | 6 | `1000000` = 1 USDC |
| DAI collateral amount | 18 | `1e18` = 1 DAI |

**Rule:** All USD-denominated values in the protocol use **18 decimals**. Collateral token amounts use their **native decimals** (e.g., USDC = 6). The contract normalizes internally.

### Formatting Helpers

```ts
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem';

// Display price
formatEther(priceRaw);  // "67000.0"

// Display USDC amount
formatUnits(usdcAmount, 6);  // "1000.0"

// Format leverage
`${Number(formatEther(leverage))}x`;  // "10x"

// Format margin ratio
`${Number(marginBps) / 100}%`;  // "5.00%"

// Format funding rate (24h, percentage)
`${(Number(formatEther(fundingRate24h)) * 100).toFixed(4)}%`;
```

---

## Appendix: Full User Flow Sequence

```
1. CONNECT WALLET
   └─ Detect chain (must be chainId 125)
   └─ If wrong chain → prompt switch

2. CHECK ACCOUNT
   └─ getVault(user) → address(0)?
       ├─ YES → Show "Create Trading Account" button
       │        └─ createVault() → wait confirmation
       │        └─ Show deposit prompt
       └─ NO → Load dashboard

3. DEPOSIT COLLATERAL
   └─ Fetch collateralTokens from subgraph
   └─ User selects token + amount
   └─ approve(vaultAddress, amount) on ERC-20
   └─ vault.deposit(token, amount)
   └─ Refresh balance display

4. VIEW MARKETS
   └─ Subgraph: markets { symbol, latestPrice, fundingRate }
   └─ Real-time: quoteMarket() per active market (poll 3-5s)
   └─ Display: mark price, 24h change, funding rate, OI

5. OPEN POSITION (MARKET ORDER)
   └─ User inputs: market, long/short, collateral amount, leverage
   └─ quoteOpenPosition() → display entry price, fee, liq price, impact
   └─ User confirms
   └─ simulateOpenPosition() → catch errors
   └─ writeOpenPosition() → wait confirmation
   └─ Refresh positions list

6. PLACE LIMIT/STOP-LIMIT ORDER
   └─ User inputs: market, direction, trigger price, [limit price], size, leverage, collateral
   └─ writePlaceLimitOrder() or writePlaceStopLimitOrder()
   └─ Order appears in "Open Orders" tab (from subgraph)
   └─ Keeper executes when price conditions met → PositionOpened event

7. MANAGE POSITION
   └─ Display: entry price, current price, unrealized PnL, margin ratio, liq price
   └─ Actions:
       ├─ Close → quoteClosePosition() → writeClosePosition()
       ├─ Partial Close → quotePartialClose() → writePartialClose()
       ├─ Add Collateral → writeAddCollateral()
       └─ Add Size → writeAddSize()

8. WITHDRAW
   └─ Check vault.getBalance(token) for available amount
   └─ vault.withdraw(token, amount)
   └─ Tokens return to user's wallet

9. PORTFOLIO / HISTORY
   └─ Subgraph: positions, trades, liquidations, userStats
   └─ Display: trade history, PnL chart, realized PnL, total volume
```

---

## Market IDs

| ID | Symbol | Max Leverage | Maintenance Margin |
|----|--------|-------------|-------------------|
| 0 | BTC | 1000x | 0.50% (50 bps) |
| 1 | ETH | 1000x | 0.50% (50 bps) |
| 2 | SOL | 500x | 1.00% (100 bps) |
| 3 | AVAX | 500x | 1.00% (100 bps) |
| 4 | LINK | 200x | 1.50% (150 bps) |

---

## Fee Structure

| Fee | Value |
|---|---|
| Taker fee | 0.10% (10 bps) |
| Maker fee | 0.05% (5 bps) |
| Liquidation penalty | 5.00% (500 bps) |
| Insurance fund cut | 20% of trading fees |
| Keeper liquidation reward | 60% of liquidation penalty |
