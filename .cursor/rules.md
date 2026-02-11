# Cursor Rules -- Sidiora Perpetual Protocol

## Identity

- **Project:** Sidiora Perpetual Protocol
- **Type:** Synthetic perpetual futures
- **Chain:** Paxeer Network (EVM, chain ID 125)
- **Pattern:** EIP-2535 Diamond with 19 facets
- **External Solidity deps:** Zero

## Mandatory constraints

1. Never import external Solidity libraries (OpenZeppelin, Solmate, etc.)
2. Never add cross-facet DELEGATECALL. Use libraries + AppStorage.
3. Never reorder AppStorage fields. Append-only.
4. Prices are 18-decimal fixed-point. Leverage is 18-decimal. Fees are basis points.
5. Net mode only -- one direction per market per user.
6. Protocol-funded central vault. No external LP mechanics.

## Style

- Solidity: ^0.8.27, 4-space indent, 120 char lines
- JavaScript: 2-space indent, double quotes, semicolons
- Tests: Hardhat + Mocha/Chai
- Deployment: numbered scripts in `scripts/deploy/`

## Context files

Read these first when working on this codebase:

- `CLAUDE.md` -- Complete project context for AI assistants
- `contracts/diamond/storage/AppStorage.sol` -- All shared state
- `contracts.yaml` -- Deployed addresses and market registry
- `docs/architecture.md` -- System design
- `docs/contracts.md` -- Full function/event reference

## Testing

```bash
npx hardhat test
npx hardhat coverage
pnpm lint
```
