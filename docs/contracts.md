<p align="center">
  <img src="https://img.shields.io/badge/Functions-118-blue?style=for-the-badge" alt="Functions" />
  <img src="https://img.shields.io/badge/Events-48-teal?style=for-the-badge" alt="Events" />
  <img src="https://img.shields.io/badge/Facets-19-3C3C3D?style=for-the-badge" alt="Facets" />
</p>

# Contract Reference

<a href="./README.md"><img src="https://img.shields.io/badge/Back_to-Index-grey?style=flat-square" alt="Back" /></a>

Every function and event listed here was extracted directly from the compiled Hardhat artifacts. Nothing is fabricated. If a signature differs from what you see on-chain, the on-chain version is authoritative.

All facets are accessed through the Diamond proxy at `0xeA65FE02665852c615774A3041DFE6f00fb77537`. You never call a facet implementation address directly -- the Diamond routes your call based on the function selector.

---

## Table of contents

- [Diamond Core](#diamond-core)
  - [DiamondCutFacet](#diamondcutfacet)
  - [DiamondLoupeFacet](#diamondloupefacet)
  - [OwnershipFacet](#ownershipfacet)
  - [AccessControlFacet](#accesscontrolfacet)
  - [PausableFacet](#pausablefacet)
- [Vault & Collateral](#vault--collateral)
  - [VaultFactoryFacet](#vaultfactoryfacet)
  - [CentralVaultFacet](#centralvaultfacet)
  - [CollateralFacet](#collateralfacet)
- [Trading Engine](#trading-engine)
  - [PositionFacet](#positionfacet)
  - [OrderBookFacet](#orderbookfacet)
  - [LiquidationFacet](#liquidationfacet)
  - [FundingRateFacet](#fundingratefacet)
- [Pricing Layer](#pricing-layer)
  - [OracleFacet](#oraclefacet)
  - [VirtualAMMFacet](#virtualammfacet)
  - [PriceFeedFacet](#pricefeedfacet)
- [Support](#support)
  - [MarketRegistryFacet](#marketregistryfacet)
  - [InsuranceFundFacet](#insurancefundfacet)
  - [QuoterFacet](#quoterfacet)
- [Standalone Contracts](#standalone-contracts)
  - [UserVault](#uservault)

---

## Diamond Core

### DiamondCutFacet

<img src="https://img.shields.io/badge/read-0-informational?style=flat-square" alt="0 read" /> <img src="https://img.shields.io/badge/write-1-critical?style=flat-square" alt="1 write" /> <img src="https://img.shields.io/badge/events-1-yellow?style=flat-square" alt="1 event" />

Manages facet additions, replacements, and removals. Owner-only.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `diamondCut(tuple[] _diamondCut, address _init, bytes _calldata)` | write | Add, replace, or remove facet selectors. Optionally call an init function. |

#### Events

| Event | Parameters |
|-------|------------|
| `DiamondCut` | `tuple[] _diamondCut, address _init, bytes _calldata` |

---

### DiamondLoupeFacet

<img src="https://img.shields.io/badge/read-5-informational?style=flat-square" alt="5 read" /> <img src="https://img.shields.io/badge/write-0-green?style=flat-square" alt="0 write" /> <img src="https://img.shields.io/badge/events-0-lightgrey?style=flat-square" alt="0 events" />

EIP-2535 introspection. Lets anyone inspect which facets are installed and what selectors they expose.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `facets()` | view | Returns all facet addresses and their selectors |
| `facetFunctionSelectors(address _facet)` | view | Returns selectors for a specific facet |
| `facetAddresses()` | view | Returns all facet addresses |
| `facetAddress(bytes4 _functionSelector)` | view | Returns the facet that handles a given selector |
| `supportsInterface(bytes4 _interfaceId)` | view | ERC-165 interface detection |

---

### OwnershipFacet

<img src="https://img.shields.io/badge/read-1-informational?style=flat-square" alt="1 read" /> <img src="https://img.shields.io/badge/write-1-critical?style=flat-square" alt="1 write" /> <img src="https://img.shields.io/badge/events-1-yellow?style=flat-square" alt="1 event" />

ERC-173 ownership. The owner controls `diamondCut()` and all admin roles.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `owner()` | view | Returns the current diamond owner |
| `transferOwnership(address _newOwner)` | write | Transfers ownership to a new address |

#### Events

| Event | Parameters |
|-------|------------|
| `OwnershipTransferred` | `indexed address previousOwner, indexed address newOwner` |

---

### AccessControlFacet

<img src="https://img.shields.io/badge/read-9-informational?style=flat-square" alt="9 read" /> <img src="https://img.shields.io/badge/write-4-critical?style=flat-square" alt="4 write" /> <img src="https://img.shields.io/badge/events-3-yellow?style=flat-square" alt="3 events" />

Role-based access control. The diamond owner can grant and revoke roles. Seven role constants are exposed as view functions.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `DIAMOND_OWNER_ROLE()` | view | Returns the bytes32 role identifier |
| `MARKET_ADMIN_ROLE()` | view | Returns the bytes32 role identifier |
| `ORACLE_POSTER_ROLE()` | view | Returns the bytes32 role identifier |
| `KEEPER_ROLE()` | view | Returns the bytes32 role identifier |
| `INSURANCE_ADMIN_ROLE()` | view | Returns the bytes32 role identifier |
| `PROTOCOL_FUNDER_ROLE()` | view | Returns the bytes32 role identifier |
| `PAUSER_ROLE()` | view | Returns the bytes32 role identifier |
| `hasRole(bytes32 _role, address _account)` | view | Check if an account has a role |
| `getRoleAdmin(bytes32 _role)` | view | Returns the admin role for a given role |
| `grantRole(bytes32 _role, address _account)` | write | Grant a role to an account |
| `revokeRole(bytes32 _role, address _account)` | write | Revoke a role from an account |
| `renounceRole(bytes32 _role)` | write | Renounce your own role |
| `setRoleAdmin(bytes32 _role, bytes32 _adminRole)` | write | Set the admin role for a role |

#### Events

| Event | Parameters |
|-------|------------|
| `RoleGranted` | `indexed bytes32 role, indexed address account, indexed address sender` |
| `RoleRevoked` | `indexed bytes32 role, indexed address account, indexed address sender` |
| `RoleAdminChanged` | `indexed bytes32 role, indexed bytes32 previousAdminRole, indexed bytes32 newAdminRole` |

---

### PausableFacet

<img src="https://img.shields.io/badge/read-2-informational?style=flat-square" alt="2 read" /> <img src="https://img.shields.io/badge/write-4-critical?style=flat-square" alt="4 write" /> <img src="https://img.shields.io/badge/events-4-yellow?style=flat-square" alt="4 events" />

Emergency stop mechanism. Can pause the entire protocol or individual markets.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `isGlobalPaused()` | view | Check if the protocol is globally paused |
| `isMarketPaused(uint256 _marketId)` | view | Check if a specific market is paused |
| `pauseGlobal()` | write | Pause all trading globally |
| `unpauseGlobal()` | write | Resume all trading |
| `pauseMarket(uint256 _marketId)` | write | Pause trading on one market |
| `unpauseMarket(uint256 _marketId)` | write | Resume trading on one market |

#### Events

| Event | Parameters |
|-------|------------|
| `GlobalPaused` | `indexed address by` |
| `GlobalUnpaused` | `indexed address by` |
| `MarketPaused` | `indexed uint256 marketId, indexed address by` |
| `MarketUnpaused` | `indexed uint256 marketId, indexed address by` |

---

## Vault & Collateral

### VaultFactoryFacet

<img src="https://img.shields.io/badge/read-4-informational?style=flat-square" alt="4 read" /> <img src="https://img.shields.io/badge/write-2-critical?style=flat-square" alt="2 write" /> <img src="https://img.shields.io/badge/events-2-yellow?style=flat-square" alt="2 events" />

Deploys per-user vault clones using EIP-1167 minimal proxies with CREATE2 for deterministic addresses.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getVault(address _user)` | view | Get the vault address for a user |
| `predictVaultAddress(address _user)` | view | Predict the CREATE2 vault address before deployment |
| `getUserVaultImplementation()` | view | Returns the UserVault implementation address |
| `totalVaults()` | view | Total number of deployed vaults |
| `createVault()` | write | Deploy a new vault for `msg.sender` |
| `setImplementation(address _implementation)` | write | Update the vault implementation (admin) |

#### Events

| Event | Parameters |
|-------|------------|
| `VaultCreated` | `indexed address user, indexed address vault` |
| `VaultImplementationUpdated` | `indexed address oldImpl, indexed address newImpl` |

---

### CentralVaultFacet

<img src="https://img.shields.io/badge/read-2-informational?style=flat-square" alt="2 read" /> <img src="https://img.shields.io/badge/write-2-critical?style=flat-square" alt="2 write" /> <img src="https://img.shields.io/badge/events-2-yellow?style=flat-square" alt="2 events" />

The protocol's central liquidity pool. It is protocol-funded only -- there are no external LPs. The owner deposits and withdraws protocol capital.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getVaultBalance(address _token)` | view | Balance of a token in the central vault |
| `getUtilization(address _token)` | view | Utilization ratio of the vault |
| `fundVault(address _token, uint256 _amount)` | write | Deposit protocol capital into the vault |
| `defundVault(address _token, uint256 _amount)` | write | Withdraw protocol capital from the vault |

#### Events

| Event | Parameters |
|-------|------------|
| `VaultFunded` | `indexed address token, uint256 amount` |
| `VaultDefunded` | `indexed address token, uint256 amount` |

---

### CollateralFacet

<img src="https://img.shields.io/badge/read-4-informational?style=flat-square" alt="4 read" /> <img src="https://img.shields.io/badge/write-2-critical?style=flat-square" alt="2 write" /> <img src="https://img.shields.io/badge/events-2-yellow?style=flat-square" alt="2 events" />

Manages the whitelist of accepted stablecoin collateral and provides USD-equivalent valuation.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `isAcceptedCollateral(address _token)` | view | Check if a token is whitelisted |
| `getCollateralTokens()` | view | List all accepted collateral tokens |
| `getCollateralValue(address _token, uint256 _amount)` | view | USD value of a token amount |
| `getCollateralDecimals(address _token)` | view | Decimal precision for a collateral token |
| `addCollateral(address _token, uint8 _decimals)` | write | Whitelist a new collateral token |
| `removeCollateral(address _token)` | write | Remove a collateral token from the whitelist |

#### Events

| Event | Parameters |
|-------|------------|
| `CollateralAdded` | `indexed address token, uint8 decimals` |
| `CollateralRemoved` | `indexed address token` |

---

## Trading Engine

### PositionFacet

<img src="https://img.shields.io/badge/read-4-informational?style=flat-square" alt="4 read" /> <img src="https://img.shields.io/badge/write-5-critical?style=flat-square" alt="5 write" /> <img src="https://img.shields.io/badge/events-3-yellow?style=flat-square" alt="3 events" />

Full position lifecycle. The protocol uses **net mode**: one direction per market per user. If you are long BTC, you cannot short BTC until the long is closed.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getPosition(uint256 _positionId)` | view | Returns full position data (user, market, side, size, collateral, entry price, timestamp, active) |
| `getUserPositionIds(address _user)` | view | Returns all position IDs for a user |
| `getUserMarketPosition(address _user, uint256 _marketId)` | view | Returns the position ID for a user in a specific market |
| `getOpenInterest(uint256 _marketId)` | view | Returns (longOI, shortOI) for a market |
| `openPosition(uint256 _marketId, address _collateralToken, uint256 _collateralAmount, uint256 _leverage, bool _isLong)` | write | Open a new position. Returns the position ID. |
| `closePosition(uint256 _positionId)` | write | Fully close a position |
| `partialClose(uint256 _positionId, uint256 _closeSizeUsd)` | write | Close a portion of a position |
| `addCollateral(uint256 _positionId, uint256 _amount)` | write | Deposit additional collateral into an open position |
| `addSize(uint256 _positionId, uint256 _additionalCollateral, uint256 _leverage)` | write | Increase position size |

#### Events

| Event | Parameters |
|-------|------------|
| `PositionOpened` | `indexed uint256 positionId, indexed address user, indexed uint256 marketId, bool isLong, uint256 sizeUsd, uint256 leverage, uint256 entryPrice, address collateralToken, uint256 collateralAmount` |
| `PositionModified` | `indexed uint256 positionId, uint256 newSizeUsd, uint256 newCollateralUsd, uint256 newCollateralAmount` |
| `PositionClosed` | `indexed uint256 positionId, indexed address user, indexed uint256 marketId, uint256 closedSizeUsd, uint256 exitPrice, int256 realizedPnl, bool isFullClose` |

---

### OrderBookFacet

<img src="https://img.shields.io/badge/read-2-informational?style=flat-square" alt="2 read" /> <img src="https://img.shields.io/badge/write-4-critical?style=flat-square" alt="4 write" /> <img src="https://img.shields.io/badge/events-4-yellow?style=flat-square" alt="4 events" />

On-chain limit and stop-limit order storage. Orders are placed by users and executed by keepers when trigger conditions are met.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getOrder(uint256 _orderId)` | view | Returns full order data (user, market, side, type, prices, size, leverage, collateral, active) |
| `getUserOrderIds(address _user)` | view | Returns all order IDs for a user |
| `placeLimitOrder(uint256 _marketId, bool _isLong, uint256 _triggerPrice, uint256 _sizeUsd, uint256 _leverage, address _collateralToken, uint256 _collateralAmount)` | write | Place a limit order. Returns order ID. |
| `placeStopLimitOrder(uint256 _marketId, bool _isLong, uint256 _triggerPrice, uint256 _limitPrice, uint256 _sizeUsd, uint256 _leverage, address _collateralToken, uint256 _collateralAmount)` | write | Place a stop-limit order. Returns order ID. |
| `cancelOrder(uint256 _orderId)` | write | Cancel an active order |
| `executeOrder(uint256 _orderId)` | write | Execute an order when trigger conditions are met (keeper) |

#### Events

| Event | Parameters |
|-------|------------|
| `OrderPlaced` | `indexed uint256 orderId, indexed address user, indexed uint256 marketId, uint8 orderType, bool isLong, uint256 triggerPrice, uint256 sizeUsd` |
| `OrderExecuted` | `indexed uint256 orderId, indexed uint256 positionId, uint256 executionPrice` |
| `OrderCancelled` | `indexed uint256 orderId, indexed address user` |
| `PositionOpened` | `indexed uint256 positionId, indexed address user, indexed uint256 marketId, bool isLong, uint256 sizeUsd, uint256 leverage, uint256 entryPrice, address collateralToken, uint256 collateralAmount` |

---

### LiquidationFacet

<img src="https://img.shields.io/badge/read-1-informational?style=flat-square" alt="1 read" /> <img src="https://img.shields.io/badge/write-2-critical?style=flat-square" alt="2 write" /> <img src="https://img.shields.io/badge/events-2-yellow?style=flat-square" alt="2 events" />

Anyone can call `liquidate()`. The contract validates margin on-chain. When the insurance fund is depleted, auto-deleveraging (ADL) kicks in.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `checkLiquidatable(uint256 _positionId)` | view | Check if a position can be liquidated |
| `liquidate(uint256 _positionId)` | write | Liquidate an undercollateralized position |
| `autoDeleverage(uint256 _positionId)` | write | Force-reduce a profitable position when insurance is depleted |

#### Events

| Event | Parameters |
|-------|------------|
| `Liquidation` | `indexed uint256 positionId, indexed address user, indexed uint256 marketId, uint256 liquidationPrice, uint256 penalty` |
| `ADLExecuted` | `indexed uint256 positionId, uint256 deleveragedSize` |

---

### FundingRateFacet

<img src="https://img.shields.io/badge/read-5-informational?style=flat-square" alt="5 read" /> <img src="https://img.shields.io/badge/write-1-critical?style=flat-square" alt="1 write" /> <img src="https://img.shields.io/badge/events-1-yellow?style=flat-square" alt="1 event" />

Per-second continuous funding rate accrual. Funding settles automatically on every position interaction. No separate keeper needed.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getCurrentFundingRate(uint256 _marketId)` | view | Current funding rate per second for a market |
| `getFundingState(uint256 _marketId)` | view | Full funding state (cumulative long/short, last update, rate) |
| `getFundingRate24h(uint256 _marketId)` | view | Annualized 24h funding rate |
| `getPositionFunding(uint256 _positionId)` | view | Pending funding owed/earned by a position |
| `getPendingFunding(uint256 _marketId)` | view | Pending unsettled funding for a market |
| `updateFundingRate(uint256 _marketId)` | write | Force-update funding rate (typically called during oracle sync) |

#### Events

| Event | Parameters |
|-------|------------|
| `FundingRateUpdated` | `indexed uint256 marketId, int256 newRate, int256 cumulativeLong, int256 cumulativeShort` |

---

## Pricing Layer

### OracleFacet

<img src="https://img.shields.io/badge/read-6-informational?style=flat-square" alt="6 read" /> <img src="https://img.shields.io/badge/write-4-critical?style=flat-square" alt="4 write" /> <img src="https://img.shields.io/badge/events-6-yellow?style=flat-square" alt="6 events" />

The oracle receives batch price updates from authorized poster bots. Prices are stored with rolling history for TWAP calculations. Staleness rules halt trading if prices go stale.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getPrice(uint256 _marketId)` | view | Returns (price, timestamp) for a market |
| `getPriceHistoryLength(uint256 _marketId)` | view | Number of stored price points |
| `getPricePoint(uint256 _marketId, uint256 _index)` | view | Returns a specific historical price point |
| `isAuthorizedPoster(address _poster)` | view | Check if an address is an authorized poster |
| `isPriceStale(uint256 _marketId)` | view | Check if the price exceeds max staleness |
| `getMaxPriceStaleness()` | view | Returns the staleness threshold in seconds (default: 120) |
| `batchUpdatePrices(uint256[] _marketIds, uint256[] _prices)` | write | Post prices for multiple markets in one transaction |
| `addPricePoster(address _poster)` | write | Authorize an oracle poster address |
| `removePricePoster(address _poster)` | write | Revoke an oracle poster |
| `setMaxPriceStaleness(uint256 _maxStaleness)` | write | Set the staleness threshold |

#### Events

| Event | Parameters |
|-------|------------|
| `PricesUpdated` | `uint256[] marketIds, uint256[] prices, uint256 timestamp` |
| `PricePosterAdded` | `indexed address poster` |
| `PricePosterRemoved` | `indexed address poster` |
| `MaxPriceStalenessUpdated` | `uint256 oldValue, uint256 newValue` |
| `RoleGranted` | `indexed bytes32 role, indexed address account, indexed address sender` |
| `RoleRevoked` | `indexed bytes32 role, indexed address account, indexed address sender` |

---

### VirtualAMMFacet

<img src="https://img.shields.io/badge/read-3-informational?style=flat-square" alt="3 read" /> <img src="https://img.shields.io/badge/write-2-critical?style=flat-square" alt="2 write" /> <img src="https://img.shields.io/badge/events-3-yellow?style=flat-square" alt="3 events" />

Per-market virtual reserves that simulate an AMM. Creates price impact proportional to order size. Re-centers toward the oracle price every sync.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getMarkPrice(uint256 _marketId)` | view | Current mark price from the vAMM |
| `getPool(uint256 _marketId)` | view | Returns (baseReserve, quoteReserve, lastSyncTimestamp, dampingFactor) |
| `simulateImpact(uint256 _marketId, uint256 _sizeUsd, bool _isLong)` | view | Simulates price impact for a given order |
| `initializePool(uint256 _marketId, uint256 _initialPrice, uint256 _virtualLiquidity, uint256 _dampingFactor)` | write | Set up a new vAMM pool for a market |
| `syncToOracle(uint256 _marketId)` | write | Re-center the vAMM toward the oracle price |

#### Events

| Event | Parameters |
|-------|------------|
| `PoolInitialized` | `indexed uint256 marketId, uint256 baseReserve, uint256 quoteReserve` |
| `PoolReservesUpdated` | `indexed uint256 marketId, uint256 newBase, uint256 newQuote` |
| `PoolSynced` | `indexed uint256 marketId, uint256 newBase, uint256 newQuote, uint256 oraclePrice` |

---

### PriceFeedFacet

<img src="https://img.shields.io/badge/read-6-informational?style=flat-square" alt="6 read" /> <img src="https://img.shields.io/badge/write-0-green?style=flat-square" alt="0 write" /> <img src="https://img.shields.io/badge/events-0-lightgrey?style=flat-square" alt="0 events" />

Aggregates oracle prices, vAMM impact, and TWAP smoothing into final execution prices. Entirely read-only.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getIndexPrice(uint256 _marketId)` | view | Raw oracle index price |
| `getMarkPrice(uint256 _marketId)` | view | vAMM-derived mark price |
| `getExecutionPrice(uint256 _marketId, uint256 _sizeUsd, bool _isLong)` | view | Final execution price including impact |
| `getLiquidationPrice(uint256 _marketId)` | view | Reference liquidation price for a market |
| `getOracleTWAP(uint256 _marketId)` | view | TWAP over the default window |
| `getOracleTWAPCustom(uint256 _marketId, uint256 _windowSeconds)` | view | TWAP over a custom time window |

---

## Support

### MarketRegistryFacet

<img src="https://img.shields.io/badge/read-5-informational?style=flat-square" alt="5 read" /> <img src="https://img.shields.io/badge/write-5-critical?style=flat-square" alt="5 write" /> <img src="https://img.shields.io/badge/events-5-yellow?style=flat-square" alt="5 events" />

CRUD for perpetual markets. Also manages protocol-wide fee configuration.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getMarket(uint256 _marketId)` | view | Returns market details (name, symbol, maxLeverage, etc.) |
| `getActiveMarketIds()` | view | Returns all active market IDs |
| `isMarketActive(uint256 _marketId)` | view | Check if a market is active |
| `totalMarkets()` | view | Total number of created markets |
| `getFees()` | view | Returns (takerFeeBps, makerFeeBps, liquidationFeeBps, insuranceFeeBps) |
| `createMarket(string _name, string _symbol, uint256 _maxLeverage, uint256 _maintenanceMarginBps, uint256 _maxOpenInterest)` | write | Create a new market |
| `updateMarket(uint256 _marketId, uint256 _maxLeverage, uint256 _maintenanceMarginBps, uint256 _maxOpenInterest)` | write | Update market parameters |
| `enableMarket(uint256 _marketId)` | write | Enable a disabled market |
| `disableMarket(uint256 _marketId)` | write | Disable a market |
| `setFees(uint256 _takerFeeBps, uint256 _makerFeeBps, uint256 _liquidationFeeBps, uint256 _insuranceFeeBps)` | write | Set protocol fee rates |

#### Events

| Event | Parameters |
|-------|------------|
| `MarketCreated` | `indexed uint256 marketId, string name, string symbol` |
| `MarketUpdated` | `indexed uint256 marketId` |
| `MarketEnabled` | `indexed uint256 marketId` |
| `MarketDisabled` | `indexed uint256 marketId` |
| `FeesUpdated` | `uint256 takerFeeBps, uint256 makerFeeBps, uint256 liquidationFeeBps, uint256 insuranceFeeBps` |

---

### InsuranceFundFacet

<img src="https://img.shields.io/badge/read-3-informational?style=flat-square" alt="3 read" /> <img src="https://img.shields.io/badge/write-2-critical?style=flat-square" alt="2 write" /> <img src="https://img.shields.io/badge/events-2-yellow?style=flat-square" alt="2 events" />

The insurance fund collects a portion of liquidation and trading fees. When the fund is exhausted, auto-deleveraging is triggered.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `getInsuranceBalance(address _token)` | view | Insurance fund balance for a token |
| `shouldTriggerADL(address _token)` | view | Check if the fund is below the ADL threshold |
| `getADLThreshold()` | view | Returns the ADL trigger threshold |
| `withdrawInsurance(address _token, uint256 _amount)` | write | Withdraw from the insurance fund (admin) |
| `setADLThreshold(uint256 _threshold)` | write | Update the ADL threshold |

#### Events

| Event | Parameters |
|-------|------------|
| `InsuranceWithdrawn` | `indexed address token, uint256 amount` |
| `ADLThresholdUpdated` | `uint256 oldThreshold, uint256 newThreshold` |

---

### QuoterFacet

<img src="https://img.shields.io/badge/read-4-informational?style=flat-square" alt="4 read" /> <img src="https://img.shields.io/badge/write-0-green?style=flat-square" alt="0 write" /> <img src="https://img.shields.io/badge/events-0-lightgrey?style=flat-square" alt="0 events" />

Read-only trade simulation. Returns expected fill prices, fees, PnL estimates, and market snapshots without executing any state changes.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `quoteOpenPosition(uint256 _marketId, address _collateralToken, uint256 _collateralAmount, uint256 _leverage, bool _isLong)` | view | Simulate opening a position |
| `quoteClosePosition(uint256 _positionId)` | view | Simulate closing a position |
| `quotePartialClose(uint256 _positionId, uint256 _closeSizeUsd)` | view | Simulate partial close (returns exitPrice, pnl, fee, remaining) |
| `quoteMarket(uint256 _marketId)` | view | Market snapshot (OI, prices, funding, utilization) |

---

## Standalone Contracts

### UserVault

<img src="https://img.shields.io/badge/read-5-informational?style=flat-square" alt="5 read" /> <img src="https://img.shields.io/badge/write-6-critical?style=flat-square" alt="6 write" /> <img src="https://img.shields.io/badge/events-5-yellow?style=flat-square" alt="5 events" />

Per-user collateral vault. Deployed as an EIP-1167 minimal proxy clone. Each user gets exactly one vault, reusable across all trades.

The implementation contract is deployed at `0x4195155D92451a47bF76987315DaEE499f1D7352`.

#### Functions

| Function | Mutability | Description |
|----------|:----------:|-------------|
| `isInitialized()` | view | Whether the vault has been initialized |
| `diamond()` | view | The Diamond proxy address |
| `vaultOwner()` | view | The user who owns this vault |
| `getBalance(address _token)` | view | Available (unlocked) balance |
| `getLockedBalance(address _token)` | view | Collateral locked in active positions |
| `initialize(address owner_, address diamond_)` | write | One-time initialization (called by VaultFactory) |
| `deposit(address _token, uint256 _amount)` | write | Deposit stablecoins |
| `withdraw(address _token, uint256 _amount)` | write | Withdraw idle funds |
| `emergencyWithdraw(address _token)` | write | Withdraw all idle funds (works even when protocol is paused) |
| `lockCollateral(address _token, uint256 _amount, address _centralVault)` | write | Lock collateral for a trade (called by Diamond) |
| `receiveCollateral(address _token, uint256 _amount)` | write | Receive collateral back from a closed trade (called by Diamond) |

#### Events

| Event | Parameters |
|-------|------------|
| `Deposited` | `indexed address token, uint256 amount` |
| `Withdrawn` | `indexed address token, uint256 amount` |
| `EmergencyWithdrawn` | `indexed address token, uint256 amount` |
| `CollateralLocked` | `indexed address token, uint256 amount` |
| `CollateralReleased` | `indexed address token, uint256 amount` |

---

<p align="center">
  <a href="./architecture.md"><img src="https://img.shields.io/badge/%E2%86%90_Architecture-grey?style=for-the-badge" alt="Previous" /></a>
  &nbsp;
  <a href="./trading-guide.md"><img src="https://img.shields.io/badge/Trading_Guide_%E2%86%92-2ECC71?style=for-the-badge" alt="Next" /></a>
</p>
