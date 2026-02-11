<p align="center">
  <img src="https://img.shields.io/badge/Solidity-%5E0.8.27-363636?style=for-the-badge&logo=solidity&logoColor=white" alt="Solidity" />
  <img src="https://img.shields.io/badge/EIP--2535-Diamond%20Pattern-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white" alt="Diamond" />
  <img src="https://img.shields.io/badge/Chain-Paxeer%20(125)-00B4D8?style=for-the-badge" alt="Paxeer" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Status-Deployed-brightgreen?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Dependencies-Zero-orange?style=for-the-badge" alt="Zero Deps" />
</p>

<h1 align="center">Sidiora Perpetual Protocol</h1>

<p align="center">
  <strong>Synthetic perpetual futures. Any asset. Up to 1000x leverage. One diamond address.</strong>
</p>

<p align="center">
  <a href="./architecture.md">Architecture</a> &#8226;
  <a href="./contracts.md">Contract Reference</a> &#8226;
  <a href="./trading-guide.md">Trading Guide</a> &#8226;
  <a href="./oracle.md">Oracle System</a> &#8226;
  <a href="./indexer-api.md">GraphQL API</a> &#8226;
  <a href="./sdk-reference.md">SDK Reference</a> &#8226;
  <a href="./deployment.md">Deployment</a>
</p>

---

## What is Sidiora?

Sidiora is a synthetic perpetual futures protocol built on Paxeer Network. It lets traders open leveraged long and short positions on crypto, RWA, stocks, and indexes -- all collateralized by stablecoins and settled entirely on-chain.

The protocol runs behind a **single smart contract address** using the EIP-2535 Diamond pattern. There are no external library dependencies. Every line of Solidity was written from scratch.

### Key numbers

| Metric | Value |
|--------|-------|
| Facets (modules) | 19 |
| Maximum leverage | 1000x |
| Collateral types | Multi-stablecoin (USID, USDC, USDT, USDL) |
| Markets at launch | 5 (BTC, ETH, SOL, AVAX, LINK) |
| Oracle update frequency | ~60 seconds |
| Funding model | Per-second continuous accrual |
| External dependencies | 0 |

---

## How it works, briefly

A trader deposits stablecoins into a personal on-chain vault. When they open a position, collateral moves from their vault into the protocol's central liquidity pool. The central vault acts as counterparty to every trade -- there are no external liquidity providers.

Prices come from a custom oracle node that pulls data from Pyth Network and posts it on-chain every minute. A virtual AMM creates price impact proportional to order size, and TWAP smoothing prevents manipulation. Funding rates accrue per-second and settle automatically whenever a position is touched.

If a position's margin drops below maintenance, anyone can liquidate it. The keeper receives a fee, the insurance fund takes a share, and if the fund runs dry, auto-deleveraging kicks in as a last resort.

---

## Documentation map

| Document | What you will find |
|----------|--------------------|
| <a href="./architecture.md"><img src="https://img.shields.io/badge/-Architecture-4A90D9?style=flat-square" alt="Architecture" /></a> | Diamond pattern, facet layout, storage design, cross-facet communication, vault model |
| <a href="./contracts.md"><img src="https://img.shields.io/badge/-Contracts-E6522C?style=flat-square" alt="Contracts" /></a> | Every facet, every function, every event -- with signatures and descriptions |
| <a href="./trading-guide.md"><img src="https://img.shields.io/badge/-Trading_Guide-2ECC71?style=flat-square" alt="Trading" /></a> | Position lifecycle, order types, liquidation mechanics, funding rates |
| <a href="./oracle.md"><img src="https://img.shields.io/badge/-Oracle_System-F39C12?style=flat-square" alt="Oracle" /></a> | Pyth integration, price posting, vAMM mechanics, TWAP, staleness rules |
| <a href="./indexer-api.md"><img src="https://img.shields.io/badge/-GraphQL_API-E10098?style=flat-square" alt="GraphQL" /></a> | Indexed event data, query reference, schema types, example queries |
| <a href="./sdk-reference.md"><img src="https://img.shields.io/badge/-SDK_Reference-3178C6?style=flat-square" alt="SDK" /></a> | TypeScript SDK installation, actions, hooks, types, code examples |
| <a href="./deployment.md"><img src="https://img.shields.io/badge/-Deployment-8E44AD?style=flat-square" alt="Deployment" /></a> | Deployed addresses, verification links, network configuration |

---

## Quick links

| Resource | URL |
|----------|-----|
| Block Explorer | [paxscan.paxeer.app](https://paxscan.paxeer.app) |
| Diamond Proxy | [`0xeA65FE02665852c615774A3041DFE6f00fb77537`](https://paxscan.paxeer.app/address/0xeA65FE02665852c615774A3041DFE6f00fb77537) |
| Sidiora Interface | [sidiora.hyperpaxeer.com](https://sidiora.hyperpaxeer.com) |
| Protocol Docs | [docs.hyperpaxeer.com](https://docs.hyperpaxeer.com) |
| Website | [paxeer.app](https://paxeer.app) |
| Twitter/X | [@paxeer_app](https://x.com/paxeer_app) |
| SDK Package | `@paxeer-network/sidiora-perpetuals` |

---

## Design influences

The protocol takes ideas from several existing systems and combines them into something new.

| Protocol | What we borrowed | What we changed |
|----------|-----------------|-----------------|
| **GMX v2** | Central vault as counterparty, oracle-based pricing | Added per-user vault isolation and vAMM impact pricing |
| **Gains Network** | Synthetic perps, multi-asset support | Replaced single-vault model with user vault + central vault split |
| **dYdX v3** | Off-chain order matching for limits/stops | Kept order storage on-chain; only execution is triggered off-chain |
| **Perpetual Protocol v2** | vAMM concept for mark price | Oracle-anchored vAMM that re-centers every minute instead of free-floating |
| **Nick Mudge EIP-2535** | Diamond standard | Implemented entirely from scratch with no library dependencies |

---

## Contact

| | |
|---|---|
| General inquiries | [infopaxeer@paxeer.app](mailto:infopaxeer@paxeer.app) |
| Security reports | [security@paxeer.app](mailto:security@paxeer.app) |

---

<p align="center">
  <sub>Sidiora Perpetual Protocol &copy; 2026 PaxLabs Inc. &mdash; Licensed under GPL-3.0</sub>
</p>
