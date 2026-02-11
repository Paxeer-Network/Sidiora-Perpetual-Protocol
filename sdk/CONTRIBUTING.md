# Contributing to @paxeer-network/sidiora-perpetuals

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feat/your-feature`

## Development Setup

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build

# Lint
pnpm lint
```

## Project Structure

```
src/
  abis/          # Typed ABI exports (as const)
  types/         # TypeScript interfaces for args, returns, events
  hooks/         # Wagmi React hooks
  actions/       # Wagmi non-React actions
  constants/     # Addresses, chain configs, RPCs
subgraph/        # Graph Protocol subgraph
docs/            # Markdown API documentation
```

## Coding Standards

- Use TypeScript strict mode
- Follow the existing Prettier configuration
- Use `as const` for ABI definitions
- Prefer named exports over default exports
- Write descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/)

## Pull Request Process

1. Ensure your code compiles: `pnpm build`
2. Update documentation if needed
3. Add a clear description of the changes
4. Reference any related issues
5. Wait for review and address feedback

## Code of Conduct

Please be respectful and constructive in all interactions. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct.
