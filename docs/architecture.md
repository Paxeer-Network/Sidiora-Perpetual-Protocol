<p align="center">
  <img src="https://img.shields.io/badge/Pattern-EIP--2535%20Diamond-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white" alt="Diamond" />
  <img src="https://img.shields.io/badge/Facets-19-blue?style=for-the-badge" alt="Facets" />
  <img src="https://img.shields.io/badge/Libraries-10-teal?style=for-the-badge" alt="Libraries" />
  <img src="https://img.shields.io/badge/External_Deps-0-orange?style=for-the-badge" alt="Zero Dependencies" />
</p>

# Architecture

<a href="./README.md"><img src="https://img.shields.io/badge/Back_to-Index-grey?style=flat-square" alt="Back" /></a>

---

## Table of contents

- [The Diamond pattern](#the-diamond-pattern)
- [System diagram](#system-diagram)
- [Facet groups](#facet-groups)
- [Shared storage](#shared-storage)
- [Cross-facet communication](#cross-facet-communication)
- [Per-user vault model](#per-user-vault-model)
- [Library inventory](#library-inventory)
- [Access control matrix](#access-control-matrix)

---

## The Diamond pattern

Sidiora uses EIP-2535 (Diamond, Multi-Facet Proxy). A single proxy contract -- the Diamond -- holds all protocol state and delegates function calls to the appropriate facet contract based on the function selector.

This means:

- **One address** for the entire protocol. Users, frontends, and indexers interact with a single contract.
- **Upgradeable** without migrating state. New facets can be added, existing ones replaced, or selectors removed through `diamondCut()`.
- **Modular** by design. Each facet handles one domain (trading, pricing, vaults, etc.) and can be developed, tested, and audited independently.
- **No storage collisions.** All facets share a single `AppStorage` struct stored at a fixed diamond storage slot.

The Diamond implementation is entirely custom. No OpenZeppelin, no `diamond-3` library, no external imports of any kind.

---

## System diagram

```
                            USER / FRONTEND
                                  |
                    write txs     |     read / simulate
                  +---------------+----------------+
                  |                                 |
                  v                                 v
  +---------------------------------------------------------------+
  |                                                               |
  |                  DIAMOND PROXY  (single address)              |
  |                  0xeA65FE02...fb77537                         |
  |                                                               |
  |   +-------------------------------------------------------+  |
  |   |              DIAMOND CORE  (5 facets)                  |  |
  |   |  DiamondCut - DiamondLoupe - Ownership                 |  |
  |   |  AccessControl - Pausable                              |  |
  |   +-------------------------------------------------------+  |
  |                                                               |
  |   +-------------------------------------------------------+  |
  |   |              VAULT & COLLATERAL  (3 facets)            |  |
  |   |  VaultFactory - CentralVault - Collateral              |  |
  |   +-------------------------------------------------------+  |
  |                                                               |
  |   +-------------------------------------------------------+  |
  |   |              TRADING ENGINE  (4 facets)                |  |
  |   |  Position - OrderBook - Liquidation - FundingRate      |  |
  |   +-------------------------------------------------------+  |
  |                                                               |
  |   +-------------------------------------------------------+  |
  |   |              PRICING LAYER  (3 facets)                 |  |
  |   |  Oracle - VirtualAMM - PriceFeed                       |  |
  |   +-------------------------------------------------------+  |
  |                                                               |
  |   +-------------------------------------------------------+  |
  |   |              SUPPORT  (4 facets)                       |  |
  |   |  MarketRegistry - InsuranceFund - Quoter - Events      |  |
  |   +-------------------------------------------------------+  |
  |                                                               |
  |   +-------------------------------------------------------+  |
  |   |              SHARED STORAGE  (AppStorage)              |  |
  |   |  Single struct at fixed diamond storage slot.          |  |
  |   |  All facets read and write the same state.             |  |
  |   +-------------------------------------------------------+  |
  |                                                               |
  +---------------------------------------------------------------+
          |                    |                      |
          | deploys clones     | emits events         | prices
          v                    v                      v
  +----------------+  +------------------+  +--------------------+
  |  UserVault     |  |  Event Indexer   |  |  Oracle Node       |
  |  (EIP-1167    |  |  (PostgreSQL +   |  |  (Pyth -> chain)   |
  |   per-user)   |  |   GraphQL API)   |  |                    |
  +----------------+  +------------------+  +--------------------+
```

---

## Facet groups

### Diamond Core -- 5 facets

These handle the Diamond standard itself plus protocol-level access control and emergency stops.

| Facet | Read functions | Write functions | Events | Role |
|-------|:-:|:-:|:-:|------|
| **DiamondCutFacet** | 0 | 1 | 1 | Add, replace, or remove facets |
| **DiamondLoupeFacet** | 5 | 0 | 0 | EIP-2535 introspection and ERC-165 |
| **OwnershipFacet** | 1 | 1 | 1 | ERC-173 ownership transfer |
| **AccessControlFacet** | 9 | 4 | 3 | Role-based permissions (grant, revoke, check) |
| **PausableFacet** | 2 | 4 | 4 | Global and per-market emergency pause |

### Vault & Collateral -- 3 facets

These manage user funds, the protocol's central liquidity pool, and accepted stablecoins.

| Facet | Read functions | Write functions | Events | Role |
|-------|:-:|:-:|:-:|------|
| **VaultFactoryFacet** | 4 | 2 | 2 | Deploy per-user vault clones (EIP-1167 + CREATE2) |
| **CentralVaultFacet** | 2 | 2 | 2 | Protocol-funded central liquidity pool |
| **CollateralFacet** | 4 | 2 | 2 | Whitelist stablecoins, query collateral values |

### Trading Engine -- 4 facets

The core trading logic: positions, orders, liquidations, and funding.

| Facet | Read functions | Write functions | Events | Role |
|-------|:-:|:-:|:-:|------|
| **PositionFacet** | 4 | 5 | 3 | Open, close, modify positions |
| **OrderBookFacet** | 2 | 4 | 4 | Limit and stop-limit orders |
| **LiquidationFacet** | 1 | 2 | 2 | Liquidate undercollateralized positions, ADL |
| **FundingRateFacet** | 5 | 1 | 1 | Per-second funding rate accrual |

### Pricing Layer -- 3 facets

Oracle prices, virtual AMM impact, and TWAP aggregation.

| Facet | Read functions | Write functions | Events | Role |
|-------|:-:|:-:|:-:|------|
| **OracleFacet** | 6 | 4 | 6 | Batch price posting, staleness checks |
| **VirtualAMMFacet** | 3 | 2 | 3 | Per-market virtual reserves for price impact |
| **PriceFeedFacet** | 6 | 0 | 0 | Aggregated execution prices, TWAP, index |

### Support -- 4 facets

Market management, insurance, trade simulation, and centralized event emission.

| Facet | Read functions | Write functions | Events | Role |
|-------|:-:|:-:|:-:|------|
| **MarketRegistryFacet** | 5 | 5 | 5 | Market CRUD, fee configuration |
| **InsuranceFundFacet** | 3 | 2 | 2 | Insurance fund balances, ADL threshold |
| **QuoterFacet** | 4 | 0 | 0 | Read-only trade simulation |
| **LibEvents** | -- | -- | 15 | Centralized event definitions (library, not a facet) |

**Totals across all facets: 118 functions, 48 events.**

---

## Shared storage

Every facet reads and writes a single `AppStorage` struct. This struct lives at a fixed diamond storage slot, which prevents collisions between facets. Here is the layout:

```
AppStorage
+-- Access Control
|   roles: mapping(bytes32 => mapping(address => bool))
|   roleAdmins: mapping(bytes32 => bytes32)
|
+-- Pausable
|   globalPaused: bool
|   marketPaused: mapping(uint256 => bool)
|
+-- Reentrancy
|   reentrancyStatus: uint256
|
+-- Vault Factory
|   userVaultImplementation: address
|   userVaults: mapping(address => address)
|   allVaults: address[]
|
+-- Central Vault
|   vaultBalances: mapping(address => uint256)
|   protocolFunder: address
|
+-- Collateral
|   acceptedCollateral: mapping(address => bool)
|   collateralDecimals: mapping(address => uint8)
|   collateralTokens: address[]
|
+-- Markets
|   nextMarketId: uint256
|   markets: mapping(uint256 => Market)
|   activeMarketIds: uint256[]
|
+-- Positions (net mode: one direction per market per user)
|   nextPositionId: uint256
|   positions: mapping(uint256 => Position)
|   userPositionIds: mapping(address => uint256[])
|   userMarketPosition: mapping(address => mapping(uint256 => uint256))
|   openInterest: mapping(uint256 => MarketOI)
|
+-- Orders
|   nextOrderId: uint256
|   orders: mapping(uint256 => Order)
|   userOrderIds: mapping(address => uint256[])
|
+-- Oracle
|   priceHistory: mapping(uint256 => PricePoint[])
|   latestPrice: mapping(uint256 => uint256)
|   latestPriceTimestamp: mapping(uint256 => uint256)
|   authorizedPricePosters: mapping(address => bool)
|   maxPriceStaleness: uint256       (default: 120 seconds)
|
+-- Virtual AMM
|   virtualPools: mapping(uint256 => VirtualPool)
|
+-- Funding
|   fundingStates: mapping(uint256 => FundingState)
|
+-- Insurance Fund
|   insuranceBalances: mapping(address => uint256)
|   adlThreshold: uint256
|
+-- Fees
    makerFeeBps: uint256
    takerFeeBps: uint256
    liquidationFeeBps: uint256
    insuranceFeeBps: uint256
```

---

## Cross-facet communication

Facets never call each other directly. There are no cross-facet `DELEGATECALL` invocations. All shared logic lives in libraries that read from and write to `AppStorage`.

Here is a concrete example -- what happens when `PositionFacet.openPosition()` needs a price:

```
PositionFacet.openPosition()
    |
    +-- LibAppStorage.appStorage()           // get storage reference
    +-- LibPosition.validateLeverage()       // check leverage limits
    +-- LibPriceFeed.getExecutionPrice()     // reads oracle + vAMM data from AppStorage
    +-- LibFee.calculateTradingFee()         // compute fee
    +-- LibSafeERC20.safeTransferFrom()      // move collateral
    +-- LibEvents.emitPositionOpened()       // emit event from diamond address
    +-- write to AppStorage.positions[]      // store position
```

This approach keeps each facet lean and testable. Libraries are stateless functions that operate on the shared storage struct.

---

## Per-user vault model

Every trader gets their own on-chain vault, deployed as an EIP-1167 minimal proxy clone. The address is deterministic (CREATE2), so it can be predicted before creation.

```
1. User calls VaultFactoryFacet.createVault()
   --> Deploys EIP-1167 clone of UserVault implementation
   --> CREATE2 for deterministic address
   --> One vault per user, reusable across all trades

2. User deposits stablecoins
   --> user.approve(vault, amount)
   --> vault.deposit(token, amount)
   --> Funds sit in the user's personal contract

3. User opens a trade
   --> Diamond calls UserVault.lockCollateral(token, amount)
   --> Funds transfer: UserVault --> CentralVault
   --> Position created in AppStorage

4. User closes a trade
   --> PnL calculated
   --> Collateral +/- PnL: CentralVault --> UserVault
   --> User can withdraw idle funds anytime

5. Emergency withdrawal
   --> User can ALWAYS withdraw idle (unlocked) funds
   --> Works even if the protocol is globally paused
   --> Only locked (in-position) collateral is inaccessible
```

**Why per-user vaults?**

- **Security isolation.** Idle funds are not sitting in the central vault. If the central vault were exploited, idle balances would remain safe.
- **UX simplicity.** Deposit once, trade many times. No per-trade token approvals after the initial setup.
- **Clean accounting.** Per-user balance tracking with a clear audit trail.
- **Gas efficiency.** After vault creation and initial token approval, subsequent trades skip the `approve` transaction.

---

## Library inventory

All 10 libraries are internal. None import external code.

| Library | Purpose | Used by |
|---------|---------|---------|
| **LibDiamond** | Diamond storage slot, facet mapping, cut logic, ownership | Diamond.sol, DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet |
| **LibAppStorage** | `AppStorage` struct definition and `appStorage()` getter | All facets |
| **LibAccessControl** | Role checking, granting, and revoking | AccessControlFacet, all write facets |
| **LibReentrancyGuard** | Reentrancy mutex (`nonReentrantBefore` / `nonReentrantAfter`) | PositionFacet, OrderBookFacet, LiquidationFacet, CentralVaultFacet |
| **LibSafeERC20** | Safe ERC20 transfer wrappers | CentralVaultFacet, VaultFactoryFacet, CollateralFacet, UserVault |
| **LibTWAP** | Time-weighted average price over configurable windows | PriceFeedFacet, FundingRateFacet |
| **LibPosition** | PnL, margin ratio, liquidation price, leverage validation | PositionFacet, LiquidationFacet, QuoterFacet |
| **LibFee** | Trading fee tiers, funding fee math, liquidation penalty | PositionFacet, LiquidationFacet, FundingRateFacet, QuoterFacet |
| **LibMath** | Fixed-point arithmetic (18 decimals), `mulDiv`, safe cast | All math-heavy libraries and facets |
| **LibEvents** | Event definitions and internal emit helpers | All facets that emit events |

---

## Access control matrix

Sidiora is a network-level protocol on Paxeer. The network owner controls all administrative roles. There is no multi-sig, no timelock, and no governance token.

| Role | Assigned to | What it controls |
|------|-------------|------------------|
| `DIAMOND_OWNER` | Network owner (Paxeer) | `diamondCut()`, upgrade facets, all admin functions |
| `MARKET_ADMIN` | Network owner | Create, update, pause, and configure markets |
| `ORACLE_POSTER` | Price bot address(es) | `batchUpdatePrices()` |
| `KEEPER` | Keeper bot address(es) | `executeOrder()`, `liquidate()`, `syncToOracle()` |
| `INSURANCE_ADMIN` | Network owner | `withdrawInsurance()` |
| `PAUSER` | Network owner | `pauseGlobal()`, `pauseMarket()` |
| `PROTOCOL_FUNDER` | Network owner | `fundVault()`, `defundVault()` on CentralVault |
| _(any user)_ | Public | `createVault()`, `openPosition()`, `closePosition()`, `placeLimitOrder()`, `cancelOrder()`, all view functions |

---

<p align="center">
  <a href="./contracts.md"><img src="https://img.shields.io/badge/Next-Contract_Reference_%E2%86%92-4A90D9?style=for-the-badge" alt="Next" /></a>
</p>
