# Contributing to Sidiora Perpetual Protocol

Thank you for your interest in contributing. This document covers the practical steps for getting your changes reviewed and merged.

## Getting started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feature/your-feature`

## Development setup

```bash
# Install dependencies
pnpm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Run linting
pnpm lint

# Format code
pnpm format
```

## Code standards

### Solidity

- **Version:** ^0.8.27
- **Style:** Follow the existing codebase conventions. 4-space indentation. 120-character line limit.
- **Linting:** Run `pnpm lint:sol` before committing. Config is in `.solhint.json`.
- **No external dependencies.** The protocol has zero imported Solidity libraries by design. Do not add any.
- **Storage:** All new state variables go in `AppStorage`. Do not append to the middle of the struct -- add to the end only.
- **Libraries over cross-facet calls.** Shared logic goes in a library that reads/writes `AppStorage`. Facets never call other facets.

### JavaScript / TypeScript

- **Style:** 2-space indentation. Double quotes. Semicolons.
- **Linting:** Run `pnpm lint:js` before committing. Config is in `.eslintrc.js`.
- **Testing:** Hardhat + Mocha/Chai for smart contract tests. Jest for oracle/indexer/SDK tests.

## Pull request process

1. Ensure all tests pass: `npx hardhat test`
2. Ensure linting passes: `pnpm lint`
3. Write a clear PR description explaining what changed and why
4. Reference any related issues
5. Keep PRs focused -- one feature or fix per PR

## Commit messages

Use conventional commits:

```
feat: add new market type support
fix: correct funding rate calculation for edge case
test: add liquidation cascade integration test
docs: update oracle node setup instructions
chore: update hardhat to v2.23
```

## Testing requirements

- Every new facet function needs at least one test
- Bug fixes should include a regression test
- Integration tests go in `tests/integration/`
- Unit tests go in the domain-specific directory (e.g., `tests/trading/`)

## Security

If you find a security vulnerability, do not open a public issue. See [SECURITY.md](./SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under GPL-3.0-only, consistent with the project license.
