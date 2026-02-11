# Codex Instructions -- Sidiora Perpetual Protocol

## Project

Synthetic perpetual futures on Paxeer Network (EVM, chain ID 125). EIP-2535 Diamond proxy with 19 facets.

## Rules

- Zero external Solidity dependencies. Everything is built from scratch.
- Facets never call other facets. Use shared libraries + AppStorage.
- AppStorage is append-only. Add new fields at the end.
- All prices: 18-decimal fixed-point. Leverage: 18-decimal. Fees: basis points.
- Net mode: one direction per market per user.
- Protocol-funded central vault. No external LPs.
- Solidity ^0.8.27, optimizer 200 runs, viaIR enabled.

## Quick reference

- Diamond: `0xeA65FE02665852c615774A3041DFE6f00fb77537`
- UserVault: `0x4195155D92451a47bF76987315DaEE499f1D7352`
- Chain: Paxeer Network, chain ID 125
- RPC: `https://public-rpc.paxeer.app/rpc`
- Explorer: `https://paxscan.paxeer.app`

## Key files

- `CLAUDE.md` -- Full project context
- `contracts/diamond/storage/AppStorage.sol` -- Shared state
- `contracts.yaml` -- All deployed addresses
- `docs/` -- Full documentation suite
