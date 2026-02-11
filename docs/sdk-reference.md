<p align="center">
  <img src="https://img.shields.io/badge/Package-@paxeer--network/sidiora--perpetuals-3178C6?style=for-the-badge" alt="Package" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Framework-Viem_+_Wagmi-1C1C1C?style=for-the-badge" alt="Viem" />
  <img src="https://img.shields.io/badge/Contracts-20-blue?style=for-the-badge" alt="Contracts" />
</p>

# SDK Reference

<a href="./README.md"><img src="https://img.shields.io/badge/Back_to-Index-grey?style=flat-square" alt="Back" /></a>

The `@paxeer-network/sidiora-perpetuals` SDK provides typed bindings for every contract in the Sidiora protocol. It includes ABIs, action functions, React hooks, and TypeScript types -- all auto-generated from the compiled Hardhat artifacts.

---

## Table of contents

- [Installation](#installation)
- [Package structure](#package-structure)
- [Quick start](#quick-start)
- [ABIs](#abis)
- [Actions](#actions)
- [React hooks](#react-hooks)
- [Constants](#constants)
- [Types](#types)
- [Contract coverage](#contract-coverage)
- [Usage examples](#usage-examples)

---

## Installation

```bash
npm install @paxeer-network/sidiora-perpetuals
```

### Peer dependencies

The SDK requires `viem` as a direct dependency and optionally `wagmi` + `@tanstack/react-query` + `react` for the React hooks:

| Dependency | Version | Required |
|------------|---------|:--------:|
| `viem` | `^2.21.0` | Yes |
| `wagmi` | `^2.14.0` | For hooks |
| `@tanstack/react-query` | `^5.0.0` | For hooks |
| `react` | `^18.0.0` | For hooks |

---

## Package structure

```
@paxeer-network/sidiora-perpetuals
  src/
    abis/           20 typed ABI exports (as const)
    actions/        20 action modules (read, write, simulate)
    hooks/          20 React hook modules
    types/          20 type definition modules
    constants/
      addresses.ts  All contract addresses
      chains.ts     Network configuration (chainId 125)
    index.ts        Barrel export
```

Everything is exported from the package root:

```typescript
import {
  PositionFacetAbi,
  writePositionFacetOpenPosition,
  usePositionFacet,
  POSITION_FACET_ADDRESS,
  HYPERPAXEER_CHAIN,
} from '@paxeer-network/sidiora-perpetuals';
```

---

## Quick start

### Read a position (with viem)

```typescript
import { createPublicClient, http } from 'viem';
import {
  PositionFacetAbi,
  POSITION_FACET_ADDRESS,
  HYPERPAXEER_CHAIN,
} from '@paxeer-network/sidiora-perpetuals';

const client = createPublicClient({
  chain: {
    id: HYPERPAXEER_CHAIN.id,
    name: HYPERPAXEER_CHAIN.name,
    nativeCurrency: { name: 'PAX', symbol: 'PAX', decimals: 18 },
    rpcUrls: { default: { http: [HYPERPAXEER_CHAIN.rpc] } },
  },
  transport: http(),
});

const position = await client.readContract({
  address: POSITION_FACET_ADDRESS,
  abi: PositionFacetAbi,
  functionName: 'getPosition',
  args: [42n],
});
```

### Open a position (with wagmi actions)

```typescript
import { writePositionFacetOpenPosition } from '@paxeer-network/sidiora-perpetuals';

const txHash = await writePositionFacetOpenPosition(wagmiConfig, {
  _marketId: 0n,                    // BTC
  _collateralToken: '0xUSID...',    // stablecoin address
  _collateralAmount: 100000000n,    // 100 USID (6 decimals)
  _leverage: 10000000000000000000n, // 10x (18 decimals)
  _isLong: true,
});
```

---

## ABIs

Each contract has a dedicated ABI module that exports a `const` assertion array. These are fully typed and compatible with viem's type inference.

```typescript
import { PositionFacetAbi } from '@paxeer-network/sidiora-perpetuals';
import { OracleFacetAbi } from '@paxeer-network/sidiora-perpetuals';
import { UserVaultAbi } from '@paxeer-network/sidiora-perpetuals';
```

Available ABI exports:

| Export | Contract | Functions | Events |
|--------|----------|:---------:|:------:|
| `DiamondAbi` | Diamond proxy | 0 | 2 |
| `DiamondCutFacetAbi` | DiamondCutFacet | 1 | 1 |
| `DiamondLoupeFacetAbi` | DiamondLoupeFacet | 5 | 0 |
| `OwnershipFacetAbi` | OwnershipFacet | 2 | 1 |
| `AccessControlFacetAbi` | AccessControlFacet | 13 | 3 |
| `PausableFacetAbi` | PausableFacet | 6 | 4 |
| `VaultFactoryFacetAbi` | VaultFactoryFacet | 6 | 2 |
| `CentralVaultFacetAbi` | CentralVaultFacet | 4 | 2 |
| `CollateralFacetAbi` | CollateralFacet | 6 | 2 |
| `PositionFacetAbi` | PositionFacet | 9 | 3 |
| `OrderBookFacetAbi` | OrderBookFacet | 6 | 4 |
| `LiquidationFacetAbi` | LiquidationFacet | 3 | 2 |
| `FundingRateFacetAbi` | FundingRateFacet | 6 | 1 |
| `OracleFacetAbi` | OracleFacet | 10 | 6 |
| `VirtualAmmfacetAbi` | VirtualAMMFacet | 5 | 3 |
| `PriceFeedFacetAbi` | PriceFeedFacet | 6 | 0 |
| `MarketRegistryFacetAbi` | MarketRegistryFacet | 10 | 5 |
| `InsuranceFundFacetAbi` | InsuranceFundFacet | 5 | 2 |
| `QuoterFacetAbi` | QuoterFacet | 4 | 0 |
| `UserVaultAbi` | UserVault | 11 | 5 |

---

## Actions

Action modules wrap `readContract`, `writeContract`, and `simulateContract` from wagmi. Every read function gets a `read*` wrapper, every write function gets both a `write*` and `simulate*` wrapper.

### Naming convention

```
read{Contract}{FunctionName}       -- for view/pure functions
write{Contract}{FunctionName}      -- for state-changing functions
simulate{Contract}{FunctionName}   -- dry-run of state-changing functions
```

### PositionFacet actions

```typescript
// Read functions
readPositionFacetGetPosition(config, { _positionId: 42n })
readPositionFacetGetUserPositionIds(config, { _user: '0x...' })
readPositionFacetGetUserMarketPosition(config, { _user: '0x...', _marketId: 0n })
readPositionFacetGetOpenInterest(config, { _marketId: 0n })

// Write functions
writePositionFacetOpenPosition(config, {
  _marketId: 0n,
  _collateralToken: '0x...',
  _collateralAmount: 100000000n,
  _leverage: 10000000000000000000n,
  _isLong: true,
})
writePositionFacetClosePosition(config, { _positionId: 42n })
writePositionFacetPartialClose(config, { _positionId: 42n, _closeSizeUsd: 500000000000000000000n })
writePositionFacetAddCollateral(config, { _positionId: 42n, _amount: 50000000n })
writePositionFacetAddSize(config, {
  _positionId: 42n,
  _additionalCollateral: 50000000n,
  _leverage: 10000000000000000000n,
})

// Simulate functions (same args as write, returns result without executing)
simulatePositionFacetOpenPosition(config, { ... })
simulatePositionFacetClosePosition(config, { ... })
```

### OrderBookFacet actions

```typescript
readOrderBookFacetGetOrder(config, { _orderId: 7n })
readOrderBookFacetGetUserOrderIds(config, { _user: '0x...' })

writeOrderBookFacetPlaceLimitOrder(config, {
  _marketId: 1n,
  _isLong: true,
  _triggerPrice: 3400000000000000000000n,  // $3,400
  _sizeUsd: 10000000000000000000000n,      // $10,000
  _leverage: 20000000000000000000n,         // 20x
  _collateralToken: '0x...',
  _collateralAmount: 500000000n,
})

writeOrderBookFacetCancelOrder(config, { _orderId: 7n })
```

### OracleFacet actions

```typescript
readOracleFacetGetPrice(config, { _marketId: 0n })
readOracleFacetIsPriceStale(config, { _marketId: 0n })
readOracleFacetIsAuthorizedPoster(config, { _poster: '0x...' })
readOracleFacetGetMaxPriceStaleness(config)
```

### QuoterFacet actions (trade simulation)

```typescript
readQuoterFacetQuoteOpenPosition(config, {
  _marketId: 0n,
  _collateralToken: '0x...',
  _collateralAmount: 100000000n,
  _leverage: 10000000000000000000n,
  _isLong: true,
})

readQuoterFacetQuoteClosePosition(config, { _positionId: 42n })
readQuoterFacetQuotePartialClose(config, { _positionId: 42n, _closeSizeUsd: 500000000000000000000n })
readQuoterFacetQuoteMarket(config, { _marketId: 0n })
```

### VaultFactoryFacet actions

```typescript
readVaultFactoryFacetGetVault(config, { _user: '0x...' })
readVaultFactoryFacetPredictVaultAddress(config, { _user: '0x...' })
writeVaultFactoryFacetCreateVault(config)
```

---

## React hooks

Each contract has a hook module that provides React hooks wrapping the action functions. These are built on top of wagmi's React primitives.

```typescript
import { usePositionFacet } from '@paxeer-network/sidiora-perpetuals';
import { useOracleFacet } from '@paxeer-network/sidiora-perpetuals';
import { useQuoterFacet } from '@paxeer-network/sidiora-perpetuals';
```

Available hook modules:

| Import | Contract |
|--------|----------|
| `useDiamond` | Diamond proxy |
| `useDiamondCutFacet` | DiamondCutFacet |
| `useDiamondLoupeFacet` | DiamondLoupeFacet |
| `useOwnershipFacet` | OwnershipFacet |
| `useAccessControlFacet` | AccessControlFacet |
| `usePausableFacet` | PausableFacet |
| `useVaultFactoryFacet` | VaultFactoryFacet |
| `useCentralVaultFacet` | CentralVaultFacet |
| `useCollateralFacet` | CollateralFacet |
| `usePositionFacet` | PositionFacet |
| `useOrderBookFacet` | OrderBookFacet |
| `useLiquidationFacet` | LiquidationFacet |
| `useFundingRateFacet` | FundingRateFacet |
| `useOracleFacet` | OracleFacet |
| `useVirtualAmmfacet` | VirtualAMMFacet |
| `usePriceFeedFacet` | PriceFeedFacet |
| `useMarketRegistryFacet` | MarketRegistryFacet |
| `useInsuranceFundFacet` | InsuranceFundFacet |
| `useQuoterFacet` | QuoterFacet |
| `useUserVault` | UserVault |

---

## Constants

### Addresses

All facets are accessed through the Diamond proxy at a single address. The SDK exports a named constant for each contract:

```typescript
import {
  DIAMOND_ADDRESS,
  POSITION_FACET_ADDRESS,
  ORDER_BOOK_FACET_ADDRESS,
  ORACLE_FACET_ADDRESS,
  USER_VAULT_ADDRESS,
  // ... all 20 contracts
} from '@paxeer-network/sidiora-perpetuals';
```

All facet addresses resolve to the Diamond proxy: `0xeA65FE02665852c615774A3041DFE6f00fb77537`

The UserVault implementation address is: `0x4195155D92451a47bF76987315DaEE499f1D7352`

### Chain configuration

```typescript
import {
  HYPERPAXEER_CHAIN,
  CHAINS,
  RPC_URLS,
  SUPPORTED_CHAIN_IDS,
} from '@paxeer-network/sidiora-perpetuals';

// HYPERPAXEER_CHAIN = {
//   id: 125,
//   name: 'Paxeer Mainnet',
//   rpc: 'https://mainnet-beta.rpc.hyperpaxeer.com/rpc',
//   explorer: 'https://paxscan.paxeer.app',
// }
```

---

## Types

Each contract has a dedicated types module with TypeScript interfaces for function parameters and return values.

```typescript
import type {
  PositionFacetTypes,
  OrderBookFacetTypes,
  OracleFacetTypes,
} from '@paxeer-network/sidiora-perpetuals';
```

---

## Contract coverage

The SDK covers all 20 contracts in the protocol with a total of 118 functions and 48 events:

| Group | Contracts | Functions | Events |
|-------|:---------:|:---------:|:------:|
| Diamond Core | 5 | 27 | 12 |
| Vault & Collateral | 3 | 16 | 6 |
| Trading Engine | 4 | 22 | 10 |
| Pricing Layer | 3 | 21 | 9 |
| Support | 3 | 19 | 7 |
| Standalone | 1 | 11 | 5 |
| **Total** | **20** | **118** | **48** |

Every function and event was verified against the compiled Hardhat artifacts. The ABI exports match the on-chain contract bytecode exactly.

---

## Usage examples

### Full trading flow

```typescript
import {
  writeVaultFactoryFacetCreateVault,
  readVaultFactoryFacetGetVault,
  writePositionFacetOpenPosition,
  readPositionFacetGetPosition,
  writePositionFacetClosePosition,
  readQuoterFacetQuoteOpenPosition,
} from '@paxeer-network/sidiora-perpetuals';

// 1. Create a vault (one-time)
await writeVaultFactoryFacetCreateVault(config);

// 2. Get your vault address
const vault = await readVaultFactoryFacetGetVault(config, {
  _user: userAddress,
});

// 3. Deposit collateral to your vault (use ERC20 approve + deposit directly)

// 4. Preview a trade
const quote = await readQuoterFacetQuoteOpenPosition(config, {
  _marketId: 0n,                     // BTC
  _collateralToken: usdcAddress,
  _collateralAmount: 1000000000n,    // 1,000 USDC
  _leverage: 10000000000000000000n,  // 10x
  _isLong: true,
});

// 5. Open the position
const txHash = await writePositionFacetOpenPosition(config, {
  _marketId: 0n,
  _collateralToken: usdcAddress,
  _collateralAmount: 1000000000n,
  _leverage: 10000000000000000000n,
  _isLong: true,
});

// 6. Read the position
const pos = await readPositionFacetGetPosition(config, {
  _positionId: 1n,
});

// 7. Close the position
await writePositionFacetClosePosition(config, {
  _positionId: 1n,
});
```

### Monitoring prices

```typescript
import {
  readOracleFacetGetPrice,
  readPriceFeedFacetGetMarkPrice,
  readPriceFeedFacetGetOracleTWAP,
} from '@paxeer-network/sidiora-perpetuals';

// Oracle index price
const [price, timestamp] = await readOracleFacetGetPrice(config, {
  _marketId: 0n,
});

// vAMM mark price
const markPrice = await readPriceFeedFacetGetMarkPrice(config, {
  _marketId: 0n,
});

// TWAP
const twap = await readPriceFeedFacetGetOracleTWAP(config, {
  _marketId: 0n,
});
```

---

<p align="center">
  <a href="./indexer-api.md"><img src="https://img.shields.io/badge/%E2%86%90_GraphQL_API-grey?style=for-the-badge" alt="Previous" /></a>
  &nbsp;
  <a href="./deployment.md"><img src="https://img.shields.io/badge/Deployment_%E2%86%92-8E44AD?style=for-the-badge" alt="Next" /></a>
</p>
