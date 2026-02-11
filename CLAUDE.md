# CLAUDE.md -- Project Context for AI Assistants

This file provides structured context for Claude, Codex, Copilot, and other AI coding assistants working on the Sidiora Perpetual Protocol codebase.

## Project identity

- **Name:** Sidiora Perpetual Protocol
- **Type:** Synthetic perpetual futures protocol
- **Owner:** PaxLabs Inc.
- **Chain:** Paxeer Network (EVM, chain ID 125)
- **License:** GPL-3.0-only

## Architecture

- **Pattern:** EIP-2535 Diamond proxy with 19 facets behind a single address
- **External dependencies:** Zero Solidity dependencies. All contracts built from scratch.
- **Solidity version:** ^0.8.27 with optimizer (200 runs) and viaIR enabled
- **Storage:** Single `AppStorage` struct at a fixed diamond storage slot. All facets share this state.
- **Position model:** Net mode -- one direction per market per user
- **LP model:** Protocol-funded only. No external liquidity providers.
- **Funding:** Per-second continuous accrual. No separate funding settler keeper.
- **Governance:** Network owner is the sole admin. No multi-sig, no timelock, no governance token.

## Key addresses

| Contract | Address |
|----------|---------|
| Diamond proxy | `0xeA65FE02665852c615774A3041DFE6f00fb77537` |
| UserVault impl | `0x4195155D92451a47bF76987315DaEE499f1D7352` |

## Directory layout

```
contracts/diamond/facets/   -- All 19 facets organized by domain
contracts/diamond/libraries/ -- 10 internal libraries (zero external deps)
contracts/diamond/storage/   -- AppStorage struct definition
contracts/vaults/            -- UserVault clone template
scripts/deploy/              -- Numbered deployment scripts (01 through 07)
scripts/upgrade/             -- Facet upgrade tooling
tests/                       -- Hardhat + Mocha/Chai tests
.oracle/                     -- Off-chain oracle node (Pyth -> chain)
.indexer/                    -- Event indexer (PostgreSQL + GraphQL)
sdk/                         -- TypeScript SDK (@paxeer-network/sidiora-perpetuals)
docs/                        -- Full documentation suite
```

## Facet groups

- **Core (5):** DiamondCut, DiamondLoupe, Ownership, AccessControl, Pausable
- **Vault (3):** VaultFactory, CentralVault, Collateral
- **Trading (4):** Position, OrderBook, Liquidation, FundingRate
- **Pricing (3):** Oracle, VirtualAMM, PriceFeed
- **Support (4):** MarketRegistry, InsuranceFund, Quoter, EventEmitter

## Conventions

- All prices use 18-decimal fixed-point (e.g., `97250e18` = $97,250)
- Leverage uses 18-decimal fixed-point (e.g., `10e18` = 10x)
- Fee rates are in basis points (1 bps = 0.01%)
- Market IDs are sequential uint256 starting from 0
- Position IDs are sequential uint256 starting from 1
- Facets never call each other. Shared logic lives in libraries.
- All events emit from the Diamond address.

## Testing

```bash
npx hardhat test                    # Run all tests
npx hardhat test --grep "Position"  # Run specific tests
REPORT_GAS=true npx hardhat test    # With gas reporting
npx hardhat coverage                # Coverage report
```

## Deployment

```bash
node scripts/deploy/deploy-all.js --network paxeer-network
```

## What NOT to do

- Do not add external Solidity dependencies. The protocol has zero and should stay that way.
- Do not add cross-facet DELEGATECALL. Communication goes through libraries + AppStorage.
- Do not change AppStorage field ordering. It would break storage layout.
- Do not modify deployment manifest format. SDK generator and verification scripts depend on it.
