---
name: Perpetual Futures Protocol
description: Windsurf Agentic Skills Reference — Industry Standards & Deep Technical Knowledge
---

> This file encodes industry-standard design knowledge for building production-grade on-chain
> perpetual futures systems. Covers architecture, mechanisms, math, security, and tooling.
> Reference protocols: GMX v1/v2, dYdX v3/v4, Perpetual Protocol v2, Gains Network, Synthetix Perps, Drift Protocol.

---

## TABLE OF CONTENTS

1. [Perpetual Futures Fundamentals](#1-perpetual-futures-fundamentals)
2. [Smart Contract Architecture Patterns](#2-smart-contract-architecture-patterns)
3. [Storage Design](#3-storage-design)
4. [Collateral & Vault Models](#4-collateral--vault-models)
5. [Oracle Design](#5-oracle-design)
6. [Pricing Models & Virtual AMM](#6-pricing-models--virtual-amm)
7. [Funding Rate Mechanisms](#7-funding-rate-mechanisms)
8. [Position Management](#8-position-management)
9. [Order Types & Order Book](#9-order-types--order-book)
10. [Liquidation Engine](#10-liquidation-engine)
11. [Insurance Fund & Auto-Deleveraging](#11-insurance-fund--auto-deleveraging)
12. [Fee Architecture](#12-fee-architecture)
13. [Access Control & Roles](#13-access-control--roles)
14. [Keeper Bot Design](#14-keeper-bot-design)
15. [Oracle Node Design](#15-oracle-node-design)
16. [Event Indexer Architecture](#16-event-indexer-architecture)
17. [GraphQL API Design for Perps](#17-graphql-api-design-for-perps)
18. [SDK & Frontend Integration Patterns](#18-sdk--frontend-integration-patterns)
19. [Fixed-Point Math & Decimal Conventions](#19-fixed-point-math--decimal-conventions)
20. [Security Patterns & Attack Vectors](#20-security-patterns--attack-vectors)
21. [Testing Strategy](#21-testing-strategy)
22. [Upgrade & Migration Patterns](#22-upgrade--migration-patterns)

---

## 1. PERPETUAL FUTURES FUNDAMENTALS

### What a Perpetual Future Is
A perpetual futures contract (perp) is a derivative that tracks an underlying asset price with no expiry date. Unlike dated futures, perps use a **funding rate** mechanism to keep the contract price anchored to the spot index price. Traders pay or receive funding periodically based on whether they are long or short and whether the mark price is above or below the index.

### Key Concepts Every Agent Must Know

**Mark Price** — The price used for PnL calculation and liquidation checks. In vAMM-based systems this is `quoteReserve / baseReserve`. In oracle-based systems (GMX style) this is the oracle price itself, optionally adjusted for spread.

**Index Price** — The reference spot price from an external oracle (Pyth, Chainlink, custom). Used as the anchor for funding rate calculation. Should never be the same feed that can be easily manipulated.

**Entry Price** — The price at which a position was opened. PnL is measured relative to this.

**Notional Size (sizeUsd)** — The total leveraged exposure. `sizeUsd = collateralUsd × leverage`.

**Collateral** — The margin posted by the trader. At risk of liquidation when it can no longer cover losses.

**Leverage** — `leverage = sizeUsd / collateralUsd`. Usually stored as 18-decimal fixed-point integer.

**Unrealized PnL**
```
Long:  pnl = sizeUsd × (currentPrice - entryPrice) / entryPrice
Short: pnl = sizeUsd × (entryPrice - currentPrice) / entryPrice
```

**Margin Ratio** — `marginRatio = (collateralUsd + unrealizedPnl) / sizeUsd`

**Maintenance Margin** — The minimum margin ratio below which a position is liquidatable. Expressed in basis points (bps). Common values: 50 bps (0.5%) for BTC/ETH, 100–200 bps for altcoins.

**Initial Margin** — The margin required to open a position. `initialMargin = 1 / maxLeverage`.

**Liquidation Price (Long)**
```
liqPrice = entryPrice × (1 - (collateralUsd/sizeUsd - maintenanceMarginBps/10000))
```

**Liquidation Price (Short)**
```
liqPrice = entryPrice × (1 + (collateralUsd/sizeUsd - maintenanceMarginBps/10000))
```

**Open Interest (OI)** — Total notional value of all open positions. Tracked separately for long and short. Used for OI caps and funding rate skew calculations.

**Net Mode vs Hedge Mode**
- *Net mode*: one position per market per user (long OR short, not both simultaneously). Simpler, used by GMX v1, Gains.
- *Hedge mode*: simultaneous long and short positions in the same market. Used by dYdX, Binance Futures.

**Settlement** — On perpetuals, there is no physical delivery. Settlement is purely cash (stablecoin). PnL is paid out in the collateral token.

---

## 2. SMART CONTRACT ARCHITECTURE PATTERNS

### Pattern A: Monolithic Proxy (OpenZeppelin Transparent / UUPS)
Single implementation contract behind a single proxy. Simplest but hits Solidity's 24KB contract size limit quickly. Used by small protocols or early versions.

**When to use**: Early stage, simple feature set, single team.
**Risks**: Size limit, upgrade replaces entire logic, storage layout must be preserved manually.

### Pattern B: EIP-2535 Diamond Multi-Facet Proxy
Single proxy delegates to multiple implementation contracts (facets) based on function selector. No size limit. Storage is shared via a single struct at a fixed storage slot.

**Key invariants:**
- All facets share one storage layout — AppStorage struct at `keccak256("some.unique.namespace") - 1`
- `diamondCut()` is the only upgrade path — owner-gated
- `DiamondLoupe` functions (`facets()`, `facetAddress()`, etc.) are required by the standard
- Each function selector maps to exactly one facet address
- Selectors cannot be duplicated across facets

**DiamondStorage position pattern:**
```solidity
bytes32 constant POSITION = keccak256("diamond.standard.diamond.storage");
assembly { ds.slot := POSITION }
```

**AppStorage position pattern:**
```solidity
bytes32 constant APP_STORAGE = keccak256("protocol.app.storage");
function appStorage() pure returns (AppStorage storage s) {
    assembly { s.slot := APP_STORAGE }
}
```

**Diamond cut action enum:** `Add = 0`, `Replace = 1`, `Remove = 2`

**Facet deployment order matters:** DiamondCutFacet must be wired in the constructor before any other cut.

### Pattern C: Hub-and-Spoke (GMX v2 style)
Separate contracts for each domain (Router, OrderHandler, PositionHandler, MarketStore, etc.) connected via a shared DataStore. No proxy — each contract is immutable. Upgrades deploy new handlers and migrate state.

**When to use**: Maximum auditability, large team, separation of concerns is critical.
**Tradeoffs**: Complex routing, more gas for cross-contract calls, harder to upgrade atomically.

### Pattern D: Singleton with Libraries
One large contract that imports all logic as internal library calls. The entire protocol lives in one deployed address with no delegation. Limited by 24KB but used in early GMX v1 style.

### Facet Design Best Practices (Diamond)
- One domain per facet: `PositionFacet`, `OrderBookFacet`, `LiquidationFacet`, etc.
- Facets are stateless — all state lives in AppStorage
- Never call one facet from another via external call — use internal libraries instead
- Libraries should be pure functions that accept a storage reference: `function foo(AppStorage storage s, ...) internal`
- All write functions should have reentrancy guards
- Emit events from the Diamond address (not facet address) — indexers only watch one address
- Use `LibEvents` pattern: define all events in a single library, `emit LibEvents.EventName(...)`

---

## 3. STORAGE DESIGN

### AppStorage Pattern
The single source of truth for all protocol state. Defined as one struct. Accessed via a `pure` getter function using inline assembly to read from a fixed EVM storage slot.

```solidity
struct AppStorage {
    // Group fields by domain, document every field
    // Never reorder existing fields — will corrupt storage
    // Only append new fields at the end of the struct
    // Use explicit sizes (uint256 not uint) for clarity
    mapping(address => mapping(uint256 => uint256)) userMarketPosition;
    // ...
}
```

### Storage Slot Collision Prevention
- Diamond storage: `keccak256("diamond.standard.diamond.storage")`
- AppStorage: `keccak256("your.protocol.app.storage") - 1` (subtract 1 to avoid preimage attacks)
- Never use slot 0 for storage structs
- Never mix Diamond storage pattern with inherited storage (OpenZeppelin style)

### Struct Packing
Pack small types together to save gas. EVM storage slots are 32 bytes.
```solidity
// Good — packed into one slot
struct Position {
    address user;      // 20 bytes
    uint96 timestamp;  // 12 bytes — fits in same slot as address
}
// Bad — wastes a slot
struct Position {
    address user;      // 20 bytes, slot 0 (12 bytes wasted)
    uint256 timestamp; // 32 bytes, slot 1
}
```

### Mappings vs Arrays
- Use `mapping(uint256 => Struct)` with a `nextId` counter for O(1) access by ID
- Use `address[]` arrays only for enumeration (e.g., all vault addresses)
- Never delete from the middle of arrays without swap-and-pop pattern
- Track array indices in a parallel mapping for O(1) removal

### Key Storage Mappings in a Perps Protocol
```
positions: mapping(uint256 => Position)               // positionId → Position
orders: mapping(uint256 => Order)                     // orderId → Order
markets: mapping(uint256 => Market)                   // marketId → Market
userMarketPosition: mapping(address => mapping(uint256 => uint256))  // user → marketId → positionId (net mode)
openInterest: mapping(uint256 => MarketOI)            // marketId → (longOI, shortOI)
latestPrice: mapping(uint256 => uint256)              // marketId → price
priceHistory: mapping(uint256 => PricePoint[])        // marketId → rolling price array
virtualPools: mapping(uint256 => VirtualPool)         // marketId → vAMM pool
fundingStates: mapping(uint256 => FundingState)       // marketId → funding accumulator
insuranceBalances: mapping(address => uint256)        // token → balance
vaultBalances: mapping(address => uint256)            // token → central vault balance
userVaults: mapping(address => address)               // user → vault clone address
roles: mapping(bytes32 => mapping(address => bool))  // role → account → hasRole
```

---

## 4. COLLATERAL & VAULT MODELS

### Model A: Single Global Vault (GMX v1 GLP)
All user collateral and protocol liquidity pooled together. LPs deposit into a multi-asset vault and receive LP tokens. The vault is the counterparty to all trades.

**Pros**: Simple, deep liquidity, composable LP token.
**Cons**: LPs take on all counterparty risk, correlated with trader PnL.

### Model B: Per-User Isolated Vault + Central Protocol Vault
Each user has their own contract (minimal proxy clone). Idle funds stay in the user vault. When a position opens, collateral moves to the central vault. Protocol funds the central vault separately.

**Pros**: Idle funds isolated from protocol risk, cleaner accounting, emergency withdrawal always works.
**Cons**: Extra contract deployment cost, extra transfer on each position open/close.

**Clone deployment (EIP-1167 + CREATE2):**
```solidity
// Deterministic salt per user
bytes32 salt = keccak256(abi.encodePacked(userAddress));
// EIP-1167 bytecode prefix + implementation address + suffix
// Deployed via CREATE2 for predictable addresses before deployment
```

**UserVault lifecycle:**
1. `createVault()` → deploy clone, store in `userVaults[msg.sender]`
2. `vault.deposit(token, amount)` → user approves vault, vault pulls tokens
3. Position open → `vault.lockCollateral(token, amount, centralVault)` → transfers to central vault
4. Position close → `vault.receiveCollateral(token, amount)` → central vault sends back
5. `vault.withdraw(token, amount)` → user gets idle funds back anytime

### Model C: Cross-Margin Account (dYdX)
Single account per user holds all collateral. PnL across all markets netted against the account balance. More capital efficient but harder to isolate risk.

### Collateral Whitelist
Always whitelist collateral tokens. Track decimals per token — never assume 18 decimals.
```solidity
mapping(address => bool) acceptedCollateral;
mapping(address => uint8) collateralDecimals;
```

Normalization to 18-decimal USD equivalent:
```solidity
function normalizeToUsd(address token, uint256 amount) internal view returns (uint256) {
    uint8 dec = collateralDecimals[token];
    if (dec < 18) return amount * 10**(18 - dec);
    if (dec > 18) return amount / 10**(dec - 18);
    return amount;
}
```

### Safe ERC20 Transfers
USDT, USDC on some chains do not return `bool` from `transfer`/`approve`. Always use a safe wrapper:
```solidity
function safeTransfer(address token, address to, uint256 amount) internal {
    (bool success, bytes memory data) = token.call(
        abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
    );
    require(success && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
}
```
For `approve`: reset to 0 first (USDT-style requirement), then set new amount.

---

## 5. ORACLE DESIGN

### Oracle Types

**Decentralized push oracle (Chainlink)** — External network of nodes agrees on a price and pushes it on-chain. Reliable but slow (heartbeat ~1–60 min depending on feed), costs gas for updates, latency risk on volatile markets.

**Pull oracle (Pyth Network)** — Prices are published off-chain. Users or keepers pull a signed price attestation and submit it with their transaction. Low latency (~400ms), cheap, but requires the caller to include the price update.

**Custom off-chain → on-chain oracle** — Protocol runs its own bot that fetches prices (from Pyth, Binance, etc.) and calls `batchUpdatePrices()` on a smart contract. Simple, controllable, but centralized. Best for early-stage or network-controlled protocols.

**TWAP oracle (Uniswap v3)** — Time-weighted average from on-chain DEX pool observations. Manipulation-resistant but laggy and only works for assets with on-chain liquidity.

### Oracle Design Considerations

**Staleness check** — Always compare `block.timestamp - lastUpdateTimestamp` to a maximum staleness threshold (e.g., 120 seconds). If stale, halt new position opens and order executions. Do NOT halt liquidations — trapped positions are worse than stale-price liquidations.

**Deviation threshold** — Only update on-chain if price moved more than X% (e.g., 0.5%) or after a maximum interval (e.g., 60 seconds). Saves gas.

**Confidence interval** — Pyth provides a confidence interval (±range). Reject prices where confidence > threshold (e.g., reject if confidence > 1% of price).

**Price normalization** — Convert all prices to 18-decimal fixed-point USD. Never mix decimal scales in calculations.

**Multi-source aggregation** — For production: use median of multiple sources. For simple systems: single source with backup.

**Rolling price history for TWAP** — Store an array of `{price, timestamp}` structs per market. Cap the array length or use circular buffer to prevent unbounded growth.

```solidity
struct PricePoint {
    uint256 price;      // 18 dec
    uint256 timestamp;
}
mapping(uint256 => PricePoint[]) priceHistory; // marketId → history
```

### TWAP Calculation
Time-weighted average: each price point is weighted by the duration it was active.

```
weightedSum += price[i] × (nextTimestamp[i] - timestamp[i])
totalWeight += (nextTimestamp[i] - timestamp[i])
TWAP = weightedSum / totalWeight
```

Walk the history array backwards from the current time. Stop when you reach the start of the window. Handle the edge case where the oldest relevant point started before the window began (use the window boundary as start time).

### Oracle Security
- Store authorized poster addresses in a role mapping, not a single address
- Require minimum update interval to prevent replay/spam
- Validate `price > 0` and `price < MAX_REASONABLE_PRICE`
- Emit events on every price update for indexer and monitoring
- Never let the oracle price be set by governance vote with no timelock — instant oracle manipulation

---

## 6. PRICING MODELS & VIRTUAL AMM

### Oracle-Based Pricing (GMX Style)
Execution price = oracle index price (no slippage for the trader). Price impact is charged as a fee based on position size relative to pool depth. This eliminates sandwiching but requires a large protocol vault as counterparty.

**Spread model**: Protocol charges a spread on opens/closes (e.g., 0.1% taker fee). No AMM impact, but PnL is calculated purely vs oracle.

### Virtual AMM (vAMM) — Perpetual Protocol Style
Virtual reserves simulate a constant-product AMM. No real tokens in the AMM — it is purely synthetic. Used to:
1. Create price impact proportional to order size
2. Generate a mark price that diverges from index under imbalanced OI
3. Drive funding rates by comparing mark vs index

**Constant product invariant:** `k = baseReserve × quoteReserve = constant`

**Mark price:** `markPrice = quoteReserve / baseReserve`

**Opening a long (buying base):**
```
newQuote = quoteReserve + sizeUsd
newBase  = k / newQuote
baseDelta = baseReserve - newBase
executionPrice = sizeUsd / baseDelta   (average price paid)
```

**Opening a short (selling base):**
```
newQuote = quoteReserve - sizeUsd
newBase  = k / newQuote
baseDelta = newBase - baseReserve
executionPrice = sizeUsd / baseDelta
```

**vAMM Oracle Anchoring** — Pure vAMM diverges from reality under one-sided flow. Solve by periodically re-centering reserves toward the oracle price:
```
targetQuote = baseReserve × oraclePrice
delta = targetQuote - quoteReserve
newQuote = quoteReserve + delta × dampingFactor / 10000
// dampingFactor in bps: 5000 = move 50% of the way per sync
```

**Virtual liquidity depth** — Higher base reserve = less price impact per dollar traded. Initialize as:
```
baseReserve  = virtualLiquidity
quoteReserve = virtualLiquidity × initialPrice
```

### Hybrid: Oracle + vAMM Spread
Blend oracle index price with vAMM-derived price impact:
```
spread = vammExecutionPrice - markPrice
executionPrice = oracleIndexPrice + spread
```
This gives oracle-quality base prices while still creating realistic price impact from order flow.

### Price Impact Models
- **Linear:** `impact = size / depth`. Simple but can be negative for large trades.
- **Constant product (CFMM):** Impact grows with square root of size. Realistic.
- **Dynamic fee:** Higher fee for larger trades. Simpler to implement than full vAMM.

---

## 7. FUNDING RATE MECHANISMS

### Purpose
Funding rates are the mechanism that keeps perp mark price anchored to spot index price. When mark > index, longs pay shorts (discourages longs, encourages shorts, pushes mark down). When mark < index, shorts pay longs.

### Calculation Methods

**Simple premium-based:**
```
fundingRate8h = (markPrice - indexPrice) / indexPrice
```
Applied every 8 hours (Binance/BitMEX style). Clamp between [-0.75%, +0.75%] per period.

**TWAP-based (more manipulation resistant):**
```
fundingRatePerDay = (markTWAP - indexTWAP) / indexTWAP
fundingRatePerSecond = fundingRatePerDay / 86400
```
Use 15-minute or 1-hour TWAP for both sides. This is the production-grade standard.

**OI-skew amplification:**
When longs heavily outweigh shorts (or vice versa), amplify the funding rate to accelerate convergence:
```
imbalance = (longOI - shortOI) / totalOI   // signed, range [-1, +1]
amplifier = 1 + |imbalance|
ratePerSecond = baseRatePerSecond × amplifier
```

### Continuous Per-Second Accrual (Industry Best Practice)
Instead of discrete settlement periods, accrue funding continuously using a cumulative index:

```solidity
struct FundingState {
    int256 cumulativeFundingPerUnitLong;   // grows every second
    int256 cumulativeFundingPerUnitShort;  // shrinks every second (mirror)
    uint256 lastUpdateTimestamp;
    int256 currentFundingRatePerSecond;
}
```

**Accrual (called on any position interaction):**
```solidity
uint256 elapsed = block.timestamp - fs.lastUpdateTimestamp;
int256 accrued = fs.currentFundingRatePerSecond * int256(elapsed);
fs.cumulativeFundingPerUnitLong  += accrued;
fs.cumulativeFundingPerUnitShort -= accrued;
fs.lastUpdateTimestamp = block.timestamp;
```

**Settlement per position:**
```solidity
int256 fundingDelta = currentCumulative - position.lastFundingIndex;
int256 fundingPayment = int256(position.sizeUsd) * fundingDelta / 1e18;
// Positive = position owes funding (deducted from collateral)
// Negative = position receives funding (added to collateral)
position.lastFundingIndex = currentCumulative;
```

**Key invariant:** Always settle funding BEFORE changing position size. Failure to do this creates accounting errors.

**Funding sign convention:**
- `currentFundingRatePerSecond > 0`: longs pay shorts (mark > index)
- `currentFundingRatePerSecond < 0`: shorts pay longs (mark < index)
- `cumulativeFundingPerUnitShort = -cumulativeFundingPerUnitLong` (exact mirror)

### Rate Caps
Always implement a maximum funding rate (e.g., ±0.01% per hour = ±0.24% per day). Prevents runaway rates during extreme market conditions or oracle failure.

---

## 8. POSITION MANAGEMENT

### Position Struct — Minimum Fields
```solidity
struct Position {
    address user;
    uint256 marketId;
    bool isLong;
    uint256 sizeUsd;            // notional, 18 dec
    uint256 collateralUsd;      // margin, 18 dec
    address collateralToken;    // which stablecoin
    uint256 collateralAmount;   // raw token amount (token decimals)
    uint256 entryPrice;         // 18 dec
    int256  lastFundingIndex;   // cumulative at last settlement
    uint256 timestamp;          // open time
    bool    active;
}
```

### Open Position Flow
1. Validate: market active, not paused, collateral accepted, price not stale
2. Check net mode: no existing active position in same market
3. Compute `sizeUsd = collateralUsd × leverage`
4. Check `sizeUsd + currentOI ≤ maxOpenInterest`
5. Validate leverage ≤ market max leverage
6. Get execution price (oracle ± vAMM impact)
7. Lock collateral: transfer from UserVault to CentralVault
8. Calculate fee, deduct from collateral
9. Accrue funding to cumulative index
10. Store position with `lastFundingIndex = currentCumulative`
11. Update OI: `oi.longOI += sizeUsd` or `oi.shortOI += sizeUsd`
12. Update vAMM reserves
13. Emit `PositionOpened` event

### Close Position Flow
1. Validate: position active, caller is owner, price not stale
2. Settle pending funding (call `_accrueFunding` + apply delta to collateral)
3. Calculate PnL at current oracle/mark price
4. Calculate fee on sizeUsd
5. Net payout = collateralAmount ± PnL tokens - fee tokens
6. Update OI (subtract sizeUsd)
7. Reverse vAMM impact
8. Deactivate position (`active = false`, clear `userMarketPosition` mapping)
9. Transfer payout from CentralVault to UserVault
10. Emit `PositionClosed` event with `realizedPnl`

### Partial Close
Proportional reduction. Fraction = `closeSizeUsd / totalSizeUsd`.
- `releasedCollateral = collateralAmount × fraction`
- `closedPnl = totalPnl × fraction`
- Reduce `pos.sizeUsd`, `pos.collateralAmount`, `pos.collateralUsd` proportionally
- Update OI proportionally
- Payout = releasedCollateral ± closedPnl - fee

### Add Size (Position Increase)
Settle funding first. New entry price = weighted average:
```
newEntryPrice = (existingSize × entryPrice + addedSize × currentPrice) / (existingSize + addedSize)
```
Add to OI. Update vAMM. Emit `PositionModified`.

### Weighted Average Entry Price Bug
Common bug: forgetting to multiply by `1e18` after division in weighted average.
```solidity
// WRONG — loses precision
newEntryPrice = (existingSize * entryPrice + addedSize * currentPrice) / totalSize;

// CORRECT — maintains 18-dec precision
newEntryPrice = (mulFp(existingSize, entryPrice) + mulFp(addedSize, currentPrice)) / totalSize * 1e18;
// OR use mulDiv to avoid intermediate overflow
```

---

## 9. ORDER TYPES & ORDER BOOK

### On-Chain vs Off-Chain Order Books

**Fully on-chain (this pattern):**
- Orders stored in contract storage mapping
- Trigger conditions validated on-chain when keeper calls `executeOrder()`
- Collateral stays in UserVault until execution (not locked at placement)
- Pros: trustless, transparent, censorship-resistant
- Cons: keepers can front-run, MEV exposure on execution

**Hybrid (dYdX v3 style):**
- Orders signed off-chain (EIP-712), broadcast to off-chain matching engine
- Execution happens on-chain via batch settlement
- Pros: CEX-like speed, no placement gas cost
- Cons: matching engine is centralized, sequencer risk

**Fully off-chain (dYdX v4/cosmos):**
- L2 orderbook, purely off-chain matching
- Settlement is final on the L1 occasionally
- Pros: CEX performance
- Cons: not truly trustless

### Order Types

**Market Order** — Executes immediately at current mark/oracle price. No on-chain order stored. Just calls `openPosition()` directly.

**Limit Order** — Stored on-chain. Trigger when oracle price ≤ triggerPrice (for long limit) or ≥ triggerPrice (for short limit). Executes at triggerPrice or better.

**Stop-Market Order** — Triggers when price crosses triggerPrice (breakout). Executes at market.

**Stop-Limit Order** — Triggers when price crosses triggerPrice. Executes only if execution price ≤ limitPrice (long) or ≥ limitPrice (short). Prevents excessive slippage.

**Take-Profit Order** — Closes an existing position when price reaches a target. Often modeled as a limit close order.

**Stop-Loss Order** — Closes an existing position when price drops to a threshold. Often modeled as a stop-market close order.

### Trigger Condition Logic
```
LIMIT_LONG:      currentPrice ≤ triggerPrice   (buy the dip)
LIMIT_SHORT:     currentPrice ≥ triggerPrice   (sell the rip)
STOP_LONG:       currentPrice ≥ triggerPrice   (breakout long)
STOP_SHORT:      currentPrice ≤ triggerPrice   (breakdown short)
TP_CLOSE_LONG:   currentPrice ≥ triggerPrice   (take profit on long)
SL_CLOSE_LONG:   currentPrice ≤ triggerPrice   (stop loss on long)
TP_CLOSE_SHORT:  currentPrice ≤ triggerPrice
SL_CLOSE_SHORT:  currentPrice ≥ triggerPrice
```

### Order Storage
```solidity
struct Order {
    address user;
    uint256 marketId;
    bool isLong;
    uint8 orderType;        // 0=LIMIT, 1=STOP_LIMIT, 2=TP, 3=SL
    uint256 triggerPrice;
    uint256 limitPrice;     // for stop-limit only
    uint256 sizeUsd;
    uint256 leverage;
    address collateralToken;
    uint256 collateralAmount;
    bool active;
}
mapping(uint256 => Order) orders;
mapping(address => uint256[]) userOrderIds;
uint256 nextOrderId;
```

### Keeper Execution Flow
1. Monitor `latestPrice[marketId]` via RPC polling or event subscription
2. Scan active orders for triggered conditions
3. Call `executeOrder(orderId)`
4. Contract re-validates trigger condition on-chain (replay protection)
5. Lock collateral, create position, deactivate order
6. Emit `OrderExecuted` + `PositionOpened`

---

## 10. LIQUIDATION ENGINE

### Liquidation Check
```
marginRatio = (collateralUsd + unrealizedPnl) / sizeUsd
liquidatable = marginRatio < maintenanceMarginBps / 10000
```

Critical: settle pending funding BEFORE computing margin ratio. Unfunded funding can push a position into liquidation territory not reflected in stored collateral.

### Permissionless Liquidation
Any address should be able to call `liquidate(positionId)`. The contract validates on-chain. This creates a competitive keeper market — bots race to liquidate for the fee.

### Liquidation Price Execution
Use the oracle price (no vAMM impact). Liquidation must be fair — the trader already lost, adding slippage on top is penalization, not accounting.

### Penalty Distribution
Standard industry split:
```
penalty = remainingCollateral × liquidationFeeBps / 10000
keeperReward  = penalty × 60%   (incentivizes liquidators)
insuranceFund = penalty × 40%   (protocol buffer)
userRemainder = remainingCollateral - penalty
```
Return `userRemainder` to user's vault. Never take 100% as penalty unless collateral is exactly zero.

### Negative Equity (Bad Debt)
If `collateralUsd + pnl < 0`, the position has negative equity. The loss exceeds the collateral. Deficit is absorbed by:
1. Insurance fund (first line of defense)
2. Auto-deleveraging (ADL) if insurance is depleted
3. Socialized loss across the protocol (last resort, avoid)

### Batch Liquidation
For efficiency, keepers can batch-check liquidatability off-chain, then submit individual `liquidate()` calls. Do not implement on-chain batch liquidation unless you carefully handle partial failures (one bad position should not block the rest).

### Liquidation Events
Always emit enough data for indexers:
```solidity
event Liquidation(
    uint256 indexed positionId,
    address indexed user,
    uint256 indexed marketId,
    uint256 liquidationPrice,
    uint256 penalty,
    address keeper
);
```

---

## 11. INSURANCE FUND & AUTO-DELEVERAGING

### Insurance Fund
Accumulates from:
- Portion of liquidation penalties
- Portion of trading fees (the `insuranceFeeBps` cut)

Used for:
- Covering bad debt (negative equity positions)
- Paying out profitable positions when vault is low

```solidity
mapping(address => uint256) insuranceBalances; // per token
```

### ADL (Auto-Deleveraging)
Last resort when insurance fund is depleted below `adlThreshold`. Forces partial closure of the most profitable positions to generate funds to pay losing positions.

**ADL priority queue** — Positions are ranked by `profitability ratio = unrealizedPnl / collateral`. The most profitable are ADL'd first.

**ADL execution:**
```
closeFraction = deleverageSize / position.sizeUsd
releasedCollateral = collateral × closeFraction
closedPnl = totalPnl × closeFraction
payout = releasedCollateral + closedPnl
```
Transfer payout to user vault. Reduce position proportionally.

**ADL is never a punishment** — it's a protocol-level force-close at fair oracle price. The user receives their full proportional PnL.

**ADL check:**
```solidity
function shouldTriggerADL(address token) external view returns (bool) {
    return insuranceBalance[token] < adlThreshold;
}
```

### Socialized Loss (Final Fallback)
If insurance is empty and no ADL candidates exist, losses are spread across all liquidity providers or protocol vault depositors proportionally. Very rare, indicates systemic risk. Avoid by maintaining adequate insurance fund.

---

## 12. FEE ARCHITECTURE

### Fee Types

| Fee | When Charged | Typical Range | Destination |
|---|---|---|---|
| Taker fee | Market order open/close | 0.05–0.10% | Protocol vault |
| Maker fee | Limit order execution | 0.01–0.05% | Protocol vault |
| Liquidation penalty | Position liquidated | 0.5–5% of collateral | Keeper + Insurance |
| Borrowing fee | Open position held over time | 0.01–0.08%/hr | Protocol vault |
| Spread | Difference between mark and execution price | Implicit in vAMM | Protocol (PnL) |

### Fee Basis Points Pattern
Store all fees in basis points (bps): `1 bps = 0.01%`. Use a single function:
```solidity
function applyFee(uint256 amount, uint256 feeBps) internal pure returns (uint256 fee, uint256 net) {
    fee = amount * feeBps / 10000;
    net = amount - fee;
}
```

### Fee Caps
Always validate fee parameters on update:
- `takerFeeBps <= 1000` (max 10%)
- `makerFeeBps <= 500`
- `liquidationFeeBps <= 5000`
- `insuranceFeeBps <= 10000` (100% of fee going to insurance is valid)

### Fee Distribution
At position open/close:
```solidity
uint256 fee = sizeUsd * takerFeeBps / 10000;
uint256 feeTokens = usdToTokens(token, fee);
uint256 insuranceCut = feeTokens * insuranceFeeBps / 10000;
uint256 protocolCut = feeTokens - insuranceCut;
insuranceBalances[token] += insuranceCut;
// protocolCut remains in central vault
```

---

## 13. ACCESS CONTROL & ROLES

### Role-Based Access Control (RBAC) Pattern
Don't use `Ownable` alone for complex protocols. Use a role system:

```solidity
mapping(bytes32 => mapping(address => bool)) roles;
mapping(bytes32 => bytes32) roleAdmins;  // which role can manage which role
```

### Standard Role Set for Perps Protocol

| Role | Controls | Assigned To |
|---|---|---|
| `DIAMOND_OWNER` | `diamondCut()`, everything | Protocol owner multisig |
| `MARKET_ADMIN` | Create/update markets, set fees, manage collateral | Operations team |
| `ORACLE_POSTER` | `batchUpdatePrices()` | Oracle bot address(es) |
| `KEEPER` | `executeOrder()`, `liquidate()`, `syncToOracle()`, `updateFundingRate()` | Keeper bot address(es) |
| `INSURANCE_ADMIN` | Withdraw insurance, set ADL threshold | Governance / owner |
| `PAUSER` | Emergency pause/unpause | Owner + security team |
| `PROTOCOL_FUNDER` | Deposit/withdraw central vault | Owner |

### Role Guard Pattern
```solidity
function enforceRole(bytes32 role) internal view {
    require(roles[role][msg.sender], "missing role");
}
// Usage in facet functions:
function batchUpdatePrices(...) external {
    enforceRole(ORACLE_POSTER_ROLE);
    // ...
}
```

### Diamond Owner vs Role Admin
Diamond owner can always manage all roles. For additional flexibility, assign a `roleAdmin` per role so that specific sub-admins can manage specific roles without full owner access.

### Pausable Pattern
```solidity
bool globalPaused;
mapping(uint256 => bool) marketPaused;

modifier whenNotPaused(uint256 marketId) {
    require(!globalPaused, "protocol paused");
    require(!marketPaused[marketId], "market paused");
    _;
}
```
Always allow liquidations and emergency withdrawals even when paused. Never lock users' idle collateral.

---

## 14. KEEPER BOT DESIGN

### Responsibilities
Keepers are off-chain bots that monitor on-chain state and call permissioned/permissionless contract functions when conditions are met:

1. **Order execution** — Watch `OrderPlaced` events. Monitor oracle prices. Call `executeOrder(orderId)` when triggers fire.
2. **Liquidation** — Watch all open positions. Compute margin ratio with latest prices. Call `liquidate(positionId)` when under-collateralized.
3. **Oracle sync / vAMM sync** — After `batchUpdatePrices()`, call `syncToOracle(marketId)` for each market.
4. **Funding rate update** — After oracle sync, call `updateFundingRate(marketId)` for each market.

### Keeper Architecture

```
┌─────────────────────────────────────────────────┐
│                  Keeper Process                  │
│                                                  │
│  ┌────────────┐   ┌──────────────┐               │
│  │ Price Feed │   │ RPC Poller   │               │
│  │ (Pyth etc) │   │ (events/state│               │
│  └─────┬──────┘   └──────┬───────┘               │
│        │                 │                       │
│        └────────┬────────┘                       │
│                 ▼                                │
│          ┌─────────────┐                         │
│          │  Task Queue  │  (per market/position) │
│          └──────┬──────┘                         │
│                 ▼                                │
│   ┌─────────────────────────────┐                │
│   │  Executor (ethers/viem)     │                │
│   │  - Gas estimation           │                │
│   │  - Retry with backoff       │                │
│   │  - Nonce management         │                │
│   └─────────────────────────────┘                │
└─────────────────────────────────────────────────┘
```

### Keeper Implementation Patterns

**Price monitoring** — Use websocket subscription to oracle contract `PricesUpdated` event OR poll `latestPrice` every N seconds. For low-latency liquidations, use off-chain price feeds directly.

**Liquidation scanning** — Maintain an in-memory list of all open position IDs (built from `PositionOpened` / `PositionClosed` events). For each, compute estimated margin ratio using latest price. Submit liquidation tx when margin < maintenance.

**Gas management:**
```javascript
// Always estimate gas before submitting
const gasEstimate = await contract.estimateGas.liquidate(positionId);
const gasLimit = gasEstimate * 120n / 100n; // 20% buffer
```

**Nonce management** — Use a nonce manager when submitting multiple transactions in parallel. Track pending nonces to prevent gaps.

**Error handling** — Catch revert reasons. If `"position is healthy"`, refresh position data. If `"price is stale"`, wait for oracle update. If gas estimation fails, skip and retry.

**MEV/Front-run protection** — For liquidations, consider using a private mempool (Flashbots, private RPC endpoint). For order execution on custom chains, front-running may be less of a concern.

**Retry with exponential backoff:**
```javascript
async function executeWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try { return await fn(); }
        catch (e) {
            if (i === maxRetries - 1) throw e;
            await sleep(1000 * 2**i); // 1s, 2s, 4s
        }
    }
}
```

**Keeper incentive model** — Permissionless liquidations (any address can liquidate, earns fee) are more robust than whitelisted keepers. For order execution, a keeper role reduces MEV attack surface but introduces liveness dependency.

---

## 15. ORACLE NODE DESIGN

### Architecture

```
  External Price Source (Pyth Hermes REST / Binance WS / Chainlink)
         │
         ▼
  Price Fetcher
  - Fetch prices for all markets
  - Normalize to 18-decimal USD
  - Compute deviation from last submitted
         │
         ▼
  Deviation Check
  - Has any market moved > threshold% since last submission?  → submit
  - Has max interval elapsed?  → submit
  - Neither?  → wait
         │
         ▼
  Transaction Submitter
  - Encode batchUpdatePrices(marketIds[], prices[])
  - Sign with ORACLE_POSTER private key
  - Submit with gas limit
  - Wait for confirmation
  - Log result
```

### Key Implementation Details

**Pyth Hermes REST:**
```javascript
const res = await fetch(`${HERMES_URL}/v2/updates/price/latest?ids[]=0xe62df6...`);
const data = await res.json();
const price = data.parsed[0].price;
// Pyth price: { price: "6700000000", expo: -5 } → 67000.00000
const normalized = BigInt(price.price) * 10n**(18n + BigInt(price.expo));
```

**Deviation check:**
```javascript
const deviation = Math.abs(newPrice - lastSubmitted) / lastSubmitted;
if (deviation > DEVIATION_THRESHOLD || elapsed > MAX_INTERVAL) submit();
```

**Batch submission:** Submit all markets in a single `batchUpdatePrices` call to minimize gas.

**Failure handling:** If RPC call fails, retry. If max consecutive failures exceeded, trigger alert (PagerDuty, Slack webhook). Never silently fail — stale oracle halts trading.

**Multiple poster addresses:** Run 2+ oracle nodes with different keys for redundancy. The contract should accept updates from any authorized poster.

---

## 16. EVENT INDEXER ARCHITECTURE

### Why Index Events
Smart contracts are write-optimized. Reading historical data on-chain is expensive and slow. An indexer:
- Listens for on-chain events, decodes them
- Stores structured data in PostgreSQL
- Exposes it via GraphQL for fast reads
- Enables rich queries: "all positions for user X", "liquidations in market Y last 24h", "PnL chart"

### Indexer Components

```
Block Scanner
- Connect to RPC via websocket or polling
- Fetch logs for Diamond address with combined ABI
- Decode event topics and data
- Handle reorgs (keep `blockNumber` and `txHash` in every row, allow re-indexing)

PostgreSQL Models
- One table per entity: positions, trades, orders, liquidations, price_updates, etc.
- Upsert pattern: INSERT ... ON CONFLICT DO UPDATE
- Track indexer checkpoint: last_indexed_block

GraphQL Server (Apollo / Hasura / PostGraphile)
- Auto-generate or manually write resolvers
- Pagination on all list queries
- Filters: userAddress, marketId, status, dateRange
- Aggregate queries: stats, volumes, PnL
```

### Key Tables for a Perps Indexer

```sql
-- Core entities
positions       (positionId, userAddress, marketId, isLong, sizeUsd, entryPrice, exitPrice, status, pnl, openTx, closeTx, openBlock, closeBlock)
trades          (id, positionId, userAddress, tradeType, sizeUsd, price, pnl, feeUsd, txHash, blockNumber, blockTimestamp)
orders          (orderId, userAddress, marketId, orderType, triggerPrice, status, executionPrice, txHash)
liquidations    (id, positionId, userAddress, price, penalty, keeper, txHash, blockNumber)

-- Market data
price_updates   (id, marketId, price, onchainTimestamp, blockNumber, txHash)
latest_prices   (marketId, price, onchainTimestamp, blockNumber)    -- upsert on each update
funding_rates   (id, marketId, ratePerSecond, rate24h, blockNumber)
pool_states     (marketId, baseReserve, quoteReserve, oraclePrice, blockNumber)

-- Vault/collateral
user_vaults     (userAddress, vaultAddress, createdBlock, createdAt)
vault_events    (id, eventType, userAddress, tokenAddress, amount, txHash, blockNumber)

-- Aggregates (materialized or computed)
user_stats      (userAddress, totalPositions, openPositions, totalRealizedPnl, totalVolume)
market_stats    (marketId, openPositions, totalVolume, totalLiquidations)
global_stats    (totalPositions, totalVolume, totalUsers, totalLiquidations)

-- System
indexer_state   (id, last_indexed_block)
```

### Reorg Handling
```javascript
// On each new block, check if the parent hash matches our stored parent
// If not, we have a reorg — walk back until we find a common ancestor
// Delete rows with blockNumber > reorgPoint, re-index from reorgPoint
```

### Event Processing Pattern
```javascript
const events = await provider.getLogs({
    address: DIAMOND_ADDRESS,
    fromBlock: lastIndexedBlock + 1,
    toBlock: currentBlock,
    topics: [] // all events from diamond
});

for (const log of events) {
    const decoded = iface.parseLog(log);
    switch (decoded.name) {
        case 'PositionOpened':   await upsertPosition(decoded.args); break;
        case 'PositionClosed':   await closePosition(decoded.args); break;
        case 'Liquidation':      await upsertLiquidation(decoded.args); break;
        case 'PricesUpdated':    await upsertPrices(decoded.args); break;
        // ...
    }
}
await updateCheckpoint(currentBlock);
```

### Performance Tips
- Process events in batches (100–1000 blocks per batch for historical sync)
- Use `eth_getLogs` with the diamond address filter — do NOT poll individual functions
- Index `userAddress`, `marketId`, `status`, `blockNumber` columns in PostgreSQL
- Use materialized views or periodic cron jobs for aggregate stats
- Cache `latestPrices` in Redis for sub-millisecond reads

---

## 17. GRAPHQL API DESIGN FOR PERPS

### Schema Design Principles
- Use `BigDecimal` (string) for all on-chain numeric values to avoid JavaScript precision loss on large uint256
- Use `DateTime` (ISO 8601 string) for timestamps
- Use `String` for addresses (lowercase, checksummed)
- Pagination: `limit` + `offset` on all list queries
- Filtering: `where` input type or individual filter args per query

### Core Query Patterns

```graphql
# Single entity by ID
position(positionId: String!): Position

# Filtered list with pagination
positions(
    userAddress: String
    marketId: Int
    status: String        # "open" | "closed" | "liquidated"
    limit: Int
    offset: Int
): [Position!]!

# Aggregates
userStats(userAddress: String!): UserStats
marketStats(marketId: Int!): MarketStats
globalStats: GlobalStats

# Real-time data
latestPrices: [LatestPrice!]!
fundingRates(marketId: Int!): [FundingRate!]!
```

### Essential Resolvers

```javascript
// positions resolver
async positions({ userAddress, marketId, status, limit = 20, offset = 0 }) {
    const where = {};
    if (userAddress) where.user_address = userAddress.toLowerCase();
    if (marketId !== undefined) where.market_id = marketId;
    if (status) where.status = status;
    return db('positions').where(where).limit(limit).offset(offset).orderBy('open_block', 'desc');
}

// User stats — computed on query or cached
async userStats({ userAddress }) {
    const [stats] = await db('positions')
        .where({ user_address: userAddress.toLowerCase() })
        .select(
            db.count('* as totalPositions'),
            db.sum('realized_pnl as totalRealizedPnl'),
            db.countDistinct('market_id as marketsTraded')
        );
    return stats;
}
```

### Real-Time Subscriptions (Optional)
Use GraphQL subscriptions or Server-Sent Events for live price updates and position changes. Apollo Server supports `PubSub` pattern:
```javascript
pubsub.publish('PRICE_UPDATED', { priceUpdated: { marketId, price } });
// Trigger from indexer event handler on each PricesUpdated event
```

---

## 18. SDK & FRONTEND INTEGRATION PATTERNS

### SDK Structure (viem + wagmi)
```
sdk/
  abis/           - TypeScript const-asserted ABI arrays per contract
  actions/        - read*, write*, simulate* wrappers using wagmi actions
  hooks/          - React hooks (useReadContract, useWriteContract wrappers)
  constants/
    addresses.ts  - Diamond address, UserVault impl address
    chains.ts     - Chain config (id, rpc, name, nativeCurrency)
  types/          - TypeScript interfaces for all structs
  index.ts        - Barrel export
```

### Action Naming Convention
```typescript
// Reads
readPositionFacetGetPosition(config, { _positionId: 1n })
// Writes
writePositionFacetOpenPosition(config, { _marketId: 0n, ... })
// Simulations (dry-run, no broadcast)
simulatePositionFacetOpenPosition(config, { _marketId: 0n, ... })
```

### Always Simulate Before Write
```typescript
try {
    await simulatePositionFacetOpenPosition(config, args);
    const hash = await writePositionFacetOpenPosition(config, args);
    await waitForTransactionReceipt(config, { hash });
} catch (e) {
    // Parse revert message, show user-friendly error
    const reason = parseRevertReason(e);
    showError(reason);
}
```

### ERC20 Approve Gotcha
Non-standard tokens (USDT, USDC on some networks) do NOT return `bool` from `approve()`. Use an ABI with no return value for approve:
```typescript
const APPROVE_ABI = [{
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: []  // ← no bool return
}] as const;
```

### Token Decimal Handling — Critical
```typescript
// NEVER hardcode 18 for all tokens
const decimals = await readCollateralFacetGetCollateralDecimals(config, { _token });
const amount = parseUnits(userInput, decimals);
// USDC: parseUnits("1000", 6) = 1_000_000n
// USID: parseUnits("1000", 18) = 1_000_000_000_000_000_000_000n
```

### Frontend Data Strategy
| Data Type | Source | Update Frequency |
|---|---|---|
| Historical positions/trades | GraphQL subgraph | On-demand |
| Market list, OI, funding | GraphQL subgraph | Every 30s |
| Mark price, index price | On-chain `quoteMarket()` | Every 3–5s |
| Open orders | GraphQL subgraph | On-demand + event |
| Real-time PnL | Computed client-side | Every price tick |

### Client-Side PnL Calculation (No RPC Call)
```typescript
function unrealizedPnl(isLong: boolean, sizeUsd: bigint, entryPrice: bigint, currentPrice: bigint): bigint {
    const priceDelta = currentPrice - entryPrice;
    const pnl = sizeUsd * priceDelta / entryPrice;
    return isLong ? pnl : -pnl;
}
```

### Wagmi Chain Config
```typescript
const myChain = {
    id: 125,
    name: 'Paxeer Mainnet',
    nativeCurrency: { name: 'PAX', symbol: 'PAX', decimals: 18 },
    rpcUrls: { default: { http: ['https://public-rpc.paxeer.app/rpc'] } },
    blockExplorers: { default: { name: 'Paxscan', url: 'https://paxscan.paxeer.app' } },
} as const satisfies Chain;
```

---

## 19. FIXED-POINT MATH & DECIMAL CONVENTIONS

### 18-Decimal Fixed-Point (WAD)
All USD values, prices, sizes, leverage, and rates in the protocol use 18-decimal fixed-point.
- `1e18 = 1.0` (one dollar, one unit, one times leverage)
- `67000e18 = $67,000`
- `10e18 = 10x leverage`

### Core Operations
```solidity
uint256 constant PRECISION = 1e18;

// Multiply: a × b → result all in 18 dec
function mulFp(uint256 a, uint256 b) pure returns (uint256) {
    return a * b / PRECISION;
}

// Divide: a / b → result in 18 dec
function divFp(uint256 a, uint256 b) pure returns (uint256) {
    return a * PRECISION / b;
}

// Full-precision multiply-divide (no intermediate overflow for values < 2^128)
function mulDiv(uint256 a, uint256 b, uint256 denominator) pure returns (uint256) {
    // Use 512-bit intermediate via assembly (see Uniswap v3 FullMath)
}

// Signed variants for funding rates and PnL
function mulFpSigned(int256 a, int256 b) pure returns (int256) {
    return a * b / int256(PRECISION);
}
```

### Basis Points (BPS)
`1 bps = 0.01%`. Fees, margin ratios, and rates often stored as bps uint256.
- Conversion: `bps → 18 dec fraction`: `bps * 1e18 / 10000`
- Conversion: `18 dec fraction → bps`: `fraction * 10000 / 1e18`
- Example: `50 bps = 0.5% = 5e15` (as 18-dec fraction)

### Collateral Decimal Normalization
```solidity
// Token amount (token decimals) → USD (18 dec)
function toUsd(uint8 tokenDecimals, uint256 amount) pure returns (uint256) {
    if (tokenDecimals < 18) return amount * 10**(18 - tokenDecimals);
    if (tokenDecimals > 18) return amount / 10**(tokenDecimals - 18);
    return amount;
}

// USD (18 dec) → token amount (token decimals)
function toTokens(uint8 tokenDecimals, uint256 usdAmount) pure returns (uint256) {
    if (tokenDecimals < 18) return usdAmount / 10**(18 - tokenDecimals);
    if (tokenDecimals > 18) return usdAmount * 10**(tokenDecimals - 18);
    return usdAmount;
}
```

### Overflow Prevention
- `uint256 max ≈ 1.15 × 10^77`. For 18-dec values, `max safe value ≈ 1.15 × 10^59` (57 digits before decimal).
- `a * b` overflows if either value is large (e.g., `sizeUsd = 1e25` and `price = 1e23` → `a*b = 1e48`, safe).
- For `mulDiv`: intermediate `a * b` can overflow. Use Uniswap v3's `FullMath` or equivalent 512-bit assembly.
- Always check: `result / b == a` after multiplication for important paths.

### Frontend Formatting
```typescript
// Display price (18 dec bigint → string)
formatEther(price)                    // "67000.0"

// Display USDC (6 dec bigint → string)
formatUnits(amount, 6)               // "1000.0"

// Display leverage
`${Number(formatEther(leverage))}x`  // "10x"

// Display margin ratio (bps)
`${Number(marginBps) / 100}%`        // "5.00%"

// Display funding rate (18 dec signed, as daily %)
`${(Number(formatEther(rate24h)) * 100).toFixed(4)}%`
```

---

## 20. SECURITY PATTERNS & ATTACK VECTORS

### Reentrancy
**Risk:** External calls to user vault or ERC20 tokens before state updates allow reentrant calls.
**Defense:** Always follow Checks-Effects-Interactions. Use a reentrancy lock stored in AppStorage (not a contract-level modifier, since facets don't inherit).
```solidity
uint256 constant ENTERED = 2;
uint256 constant NOT_ENTERED = 1;
function nonReentrantBefore() internal {
    require(s.reentrancyStatus != ENTERED, "reentrant call");
    s.reentrancyStatus = ENTERED;
}
function nonReentrantAfter() internal { s.reentrancyStatus = NOT_ENTERED; }
```

### Oracle Manipulation
**Risk:** Attacker manipulates oracle price, opens large position, triggers own liquidation or extracts profit.
**Defense:** Use TWAP (not spot) for liquidation triggers. Use multiple oracle sources. Implement max price deviation per update. Rate-limit oracle updates.

### Price Staleness Exploit
**Risk:** Oracle stops updating. Prices frozen. Attacker opens positions knowing actual price moved.
**Defense:** `maxPriceStaleness` check reverts new position opens when price is stale. Liquidations may continue at last known price.

### Flash Loan + Oracle Attack
**Risk:** Manipulate on-chain TWAP oracle (Uniswap v3) via flash loan, open large perp position, profit.
**Defense:** Don't use Uniswap v3 TWAP as primary oracle for perps. Use Pyth / Chainlink instead. Use long TWAP windows (15+ min) if using on-chain TWAPs.

### Sandwich Attack on Order Execution
**Risk:** MEV bot sees a limit order execution in mempool, front-runs with a trade to move the price, back-runs after execution.
**Defense:** Use private mempool for keeper transactions. Validate trigger + limit price on-chain (double validation). The contract re-checks conditions — if price moved too much, the tx reverts.

### Storage Collision (Diamond)
**Risk:** Two facets accidentally use the same storage slot for different data.
**Defense:** All state in a single AppStorage struct at a fixed keccak slot. Never use assembly to read/write raw slots outside of this pattern. Never import OpenZeppelin storage variables into Diamond facets.

### Griefing via Dust Positions
**Risk:** Attacker opens thousands of tiny positions to bloat storage and increase gas costs for keepers.
**Defense:** Minimum position size (`require(sizeUsd >= MIN_SIZE)`). Minimum collateral amount. Fee makes tiny positions economically unviable.

### Liquidation Race Conditions
**Risk:** Multiple keepers try to liquidate the same position. All but one waste gas.
**Defense:** The `require(pos.active, ...)` check ensures only one liquidation succeeds. Others revert cheaply. This is acceptable and expected.

### Fee Calculation Rounding
**Risk:** Integer division truncates fees, allowing traders to open tiny positions with zero fees.
**Defense:** Always round fees up (`fee = (size * feeBps + 9999) / 10000`). Set minimum fee amounts. Minimum size prevents dust.

### ADL Vulnerability
**Risk:** ADL function callable by unauthorized address forces profitable traders out at unfavorable times.
**Defense:** ADL should require `KEEPER_ROLE` or `DIAMOND_OWNER`. Validate `shouldTriggerADL()` returns true before executing.

### Approval Front-Running (ERC20)
**Risk:** USDT-style approve requires reset to 0 first. If attacker sees a pending `approve(spender, X)`, they can front-run and spend the old allowance before the new one is set.
**Defense:** Always use `safeApprove` which resets to 0 first. Or use `permit` / `increaseAllowance`.

---

## 21. TESTING STRATEGY

### Test Pyramid for Perps Protocols

**Unit Tests (70%)**
- Library functions: PnL math, margin ratio, liquidation price, TWAP, fee calculations
- Each function in isolation with edge cases
- Overflow/underflow cases for all math functions
- Zero values, max values, negative values for signed arithmetic
- Tools: Hardhat + Chai, Foundry (forge test)

**Integration Tests (20%)**
- Full position lifecycle: open → modify → close
- Liquidation: approach liquidation price → liquidate → check distributions
- Order lifecycle: place → trigger → execute → position created
- Funding rate: open position → wait blocks → close → check funding payment
- Multi-user scenarios: long vs short, OI caps, net mode enforcement

**Scenario/Fork Tests (10%)**
- Mainnet fork tests with real oracle data
- Flash crash scenario: price drops 50% in one update, verify liquidations work
- Oracle staleness: stop oracle, verify trading halts, verify liquidations continue
- ADL trigger: deplete insurance fund, verify ADL executes correctly
- Diamond upgrade: add new facet, verify selectors work, verify storage preserved

### Critical Test Cases

```javascript
describe("Position Math", () => {
    it("long PnL: price up 10%", ...)
    it("long PnL: price down 10% (negative)", ...)
    it("short PnL: price down 10%", ...)
    it("short PnL: price up 10% (negative)", ...)
    it("liquidation price: long at 100x leverage", ...)
    it("liquidation price: short at 10x leverage", ...)
    it("funding settlement: 1 day elapsed, positive rate", ...)
    it("funding settlement: funding exceeds collateral", ...)
});

describe("Diamond", () => {
    it("facet selector routing: all selectors route correctly", ...)
    it("storage: upgrade facet, existing storage preserved", ...)
    it("access: non-owner cannot diamondCut", ...)
});

describe("Liquidation", () => {
    it("healthy position: cannot liquidate", ...)
    it("borderline: marginRatio == maintenanceMargin: cannot liquidate", ...)
    it("under-margin: liquidates, distributes penalty correctly", ...)
    it("negative equity: deficit absorbed by insurance", ...)
    it("negative equity, no insurance: ADL triggers", ...)
});

describe("Oracle", () => {
    it("stale price: openPosition reverts", ...)
    it("stale price: liquidate does NOT revert", ...)
    it("zero price: reverts", ...)
    it("unauthorized poster: reverts", ...)
});
```

### Foundry-Specific Patterns
```solidity
// Time manipulation for funding tests
vm.warp(block.timestamp + 86400); // advance 1 day

// Price staleness test
vm.warp(block.timestamp + 200); // advance past maxPriceStaleness
vm.expectRevert("price is stale");
positionFacet.openPosition(...);

// Fuzzing margin ratio calculation
function testFuzzMarginRatio(uint128 collateral, uint128 size, uint128 price) public {
    vm.assume(size > 0 && price > 0 && collateral > 0);
    // assert no overflow, result in [0, 10000] bps range
}
```

---

## 22. UPGRADE & MIGRATION PATTERNS

### Diamond Upgrade Process
1. Deploy new facet implementation contract
2. Identify selectors to Add/Replace/Remove
3. Call `diamondCut(cuts, initAddress, initCalldata)` from owner
4. If storage migration needed, pass `initAddress` = a one-time init contract
5. Verify with `DiamondLoupe.facetAddress(selector)` returns new facet
6. Run fork test on mainnet fork before executing upgrade

### diamondCut Call Construction
```javascript
const cuts = [{
    facetAddress: newFacetAddress,
    action: FacetCutAction.Replace,  // 0=Add, 1=Replace, 2=Remove
    functionSelectors: [
        contract.interface.getSighash('openPosition'),
        contract.interface.getSighash('closePosition'),
    ]
}];
await diamond.diamondCut(cuts, ethers.ZeroAddress, '0x');
```

### Storage Migration Pattern
When AppStorage struct changes (new field added):
- **Appending fields**: Always safe. New fields initialize to zero. No migration needed.
- **Modifying existing fields**: Never do this. Deploy a separate migration contract called via `diamondCut` init parameter.
- **Removing fields**: Leave the field in the struct (just stop using it). Removing shifts all subsequent fields.

```solidity
// Migration contract (called once via diamondCut init)
contract MigrationV2 {
    function initialize() external {
        AppStorage storage s = appStorage();
        // Set new fields to their initial values
        s.newField = defaultValue;
    }
}
```

### Versioning
Track deployed facet versions in an off-chain manifest (`deployments/network.json`):
```json
{
    "PositionFacet": {
        "address": "0x...",
        "version": "1.2.0",
        "deployedAt": 1234567890,
        "selectors": ["0xa1b2c3d4", "0xe5f6a7b8"]
    }
}
```

### Emergency Upgrade Protocol
1. Pause protocol via `PAUSER_ROLE` (`pauseGlobal()`)
2. Deploy fixed facet
3. Execute `diamondCut` to replace vulnerable selectors
4. Test on live state (read-only verification)
5. Unpause via `unpauseGlobal()`
6. Post-incident report + monitoring

### Immutable Deployments (Non-Diamond)
For GMX v2 style: deploy new handler contracts. Update router to point to new handlers. Old handlers remain deployed but unused. Migration requires off-chain coordination to drain/migrate open positions.

---

*End of skills.md — On-Chain Perpetual Futures Protocol Agentic Knowledge Base*
*Version: 1.0 | Domain: DeFi Perps | Applicable to any EVM perpetuals implementation*
