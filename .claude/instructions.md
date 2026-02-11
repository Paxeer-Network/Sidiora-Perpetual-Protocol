# Claude Instructions -- Sidiora Perpetual Protocol

## Project context

You are working on the Sidiora Perpetual Protocol, a synthetic perpetual futures platform deployed on Paxeer Network (EVM, chain ID 125). The entire protocol lives behind a single EIP-2535 Diamond proxy at `0xeA65FE02665852c615774A3041DFE6f00fb77537`.

## Critical rules

1. **Zero external Solidity dependencies.** Do not import OpenZeppelin, Solmate, or any external library. All code is written from scratch.
2. **No cross-facet calls.** Facets communicate through shared libraries that read/write `AppStorage`. Never add DELEGATECALL between facets.
3. **AppStorage is append-only.** New fields go at the end of the struct. Never reorder, rename, or remove existing fields.
4. **All prices are 18-decimal fixed-point.** `97250e18` means $97,250.
5. **Leverage is 18-decimal fixed-point.** `10e18` means 10x.
6. **Fees are in basis points.** `100` means 1%.
7. **Net mode.** One direction per market per user. Do not implement hedge mode.
8. **Protocol-funded only.** The CentralVault is funded by the network owner. No external LP mechanics.

## Architecture reference

See `CLAUDE.md` in the project root for the full project context, directory layout, facet groups, and conventions.

## Testing

- Smart contract tests: `npx hardhat test`
- Gas reporting: `REPORT_GAS=true npx hardhat test`
- Coverage: `npx hardhat coverage`
- Linting: `pnpm lint`

## Key files to understand the codebase

- `contracts/diamond/storage/AppStorage.sol` -- All shared state
- `contracts/diamond/Diamond.sol` -- Proxy with fallback routing
- `contracts/diamond/facets/trading/PositionFacet.sol` -- Core trading logic
- `contracts/diamond/libraries/LibPosition.sol` -- PnL and margin calculations
- `hardhat.config.js` -- Compiler settings and network config
- `deployments/paxeer-network.json` -- Deployed addresses and selectors
