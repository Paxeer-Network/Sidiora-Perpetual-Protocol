# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-11

### Added

- Initial SDK generation
- Typed ABI exports (`as const`) for: Diamond, DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet, PositionFacet, OrderBookFacet, LiquidationFacet, FundingRateFacet, OracleFacet, VirtualAMMFacet, PriceFeedFacet, AccessControlFacet, PausableFacet, MarketRegistryFacet, InsuranceFundFacet, QuoterFacet, VaultFactoryFacet, CentralVaultFacet, CollateralFacet, UserVault
- React hooks (wagmi v2) for all contract read/write functions and events
- Non-React actions for server-side and script usage
- Contract constants (addresses, chain configs, RPC URLs)
- Graph Protocol subgraph (schema, mappings, manifest)
- TypeScript interfaces for function args, returns, events, and errors
- Markdown API documentation
