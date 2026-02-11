<div align="center">

# @paxeer-network/sidiora-perpetuals

> TypeScript SDK for the Sidora Perpetual Product Market Maker smart contracts on Paxeer (chainId 125)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![wagmi](https://img.shields.io/badge/wagmi-v2-purple)](https://wagmi.sh/)
[![viem](https://img.shields.io/badge/viem-v2-green)](https://viem.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Contracts](#contracts)
- [Networks](#networks)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Subgraph](#subgraph)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Typed ABIs** -- `as const` ABI exports for full type safety
- **React Hooks** -- Wagmi v2 hooks for reads, writes, simulations & event watching
- **Non-React Actions** -- Use from Node.js, scripts, or server-side code
- **Contract Constants** -- Addresses, chain configs, RPC URLs
- **Graph Protocol Subgraph** -- Ready-to-deploy schema, mappings & manifest
- **Full TypeScript** -- Interfaces for every function arg, return, event & error

## Installation

```bash
# pnpm (recommended)
pnpm add @paxeer-network/sidiora-perpetuals

# npm
npm install @paxeer-network/sidiora-perpetuals

# yarn
yarn add @paxeer-network/sidiora-perpetuals
```

### Peer Dependencies

```bash
pnpm add wagmi viem @tanstack/react-query react
```

## Contracts

| Contract | Read | Write | Events | Addresses |
| -------- | ---- | ----- | ------ | --------- |
| Diamond | 0 | 0 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| DiamondCutFacet | 0 | 1 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| DiamondLoupeFacet | 5 | 0 | 0 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| OwnershipFacet | 1 | 1 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| PositionFacet | 4 | 5 | 3 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| OrderBookFacet | 2 | 4 | 4 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| LiquidationFacet | 1 | 2 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| FundingRateFacet | 5 | 1 | 1 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| OracleFacet | 6 | 4 | 6 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| VirtualAMMFacet | 3 | 2 | 3 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| PriceFeedFacet | 6 | 0 | 0 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| AccessControlFacet | 9 | 4 | 3 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| PausableFacet | 2 | 4 | 4 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| MarketRegistryFacet | 5 | 5 | 5 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| InsuranceFundFacet | 3 | 2 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| QuoterFacet | 4 | 0 | 0 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| VaultFactoryFacet | 4 | 2 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| CentralVaultFacet | 2 | 2 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| CollateralFacet | 4 | 2 | 2 | hyperpaxeer: `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| UserVault | 5 | 6 | 5 | hyperpaxeer: `0x4195155D92451a47bF76987315DaEE499f1D7352` |

## Networks

| Network | Chain ID | RPC | Explorer |
| ------- | -------- | --- | -------- |
| Paxeer Mainnet | 125 | `https://mainnet-beta.rpc.hyperpaxeer.com/rpc` | [Explorer](https://paxscan.paxeer.app) |

## Quick Start

```tsx
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SUPPORTED_CHAIN_IDS, RPC_URLS } from '@paxeer-network/sidiora-perpetuals/constants';

const config = createConfig({
  chains: [/* your chain */],
  transports: { /* chain-specific transports */ },
});

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={new QueryClient()}>
        {/* Your app */}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Usage

### Reading contract data

```tsx
import { useReadNativeSwapOwner } from '@paxeer-network/sidiora-perpetuals/hooks';

function PriceDisplay() {
  const { data, isLoading } = useReadNativeSwapOwner();

  if (isLoading) return <div>Loading...</div>;
  return <div>Value: {data?.toString()}</div>;
}
```

### Non-React usage (scripts / server)

```ts
import { readDiamondOwner } from '@paxeer-network/sidiora-perpetuals/actions';

const result = await readDiamondOwner(wagmiConfig);
console.log(result);
```

## API Reference

See the [docs/](./docs) directory for detailed per-contract documentation.

## Subgraph

A ready-to-deploy Graph Protocol subgraph is included under `subgraph/`.

```bash
cd subgraph
pnpm install
pnpm codegen
pnpm build
```

Refer to [The Graph docs](https://thegraph.com/docs/) for deployment instructions.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](./SECURITY.md) for the security policy.

## License

This project is licensed under the MIT License -- see [LICENSE](./LICENSE) for details.
