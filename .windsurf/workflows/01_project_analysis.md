---
name: "Stage 01 — Project Analysis & Selection"
description: >
  Analyse the workspace and user intent to identify the most suitable Web3
  application to build, then scaffold the project structure.
triggers:
  - manual
  - workflow: 00_master_orchestrator
auto_execution_mode: 3
---

# Stage 01 — Project Analysis & Selection

## Objective
Determine the optimal Web3 DApp to build based on available workspace context,
then produce a detailed technical specification and scaffold the monorepo.

---

## Step 1 · Workspace Audit

Run the following read-only discovery commands (do not modify anything yet):

```bash
# Understand what is already in the workspace
ls -la
cat package.json 2>/dev/null || echo "No root package.json"
cat foundry.toml  2>/dev/null || echo "No foundry.toml"
cat hardhat.config.* 2>/dev/null || echo "No hardhat config"
cat .env.example 2>/dev/null || echo "No .env.example"
```

Collect:
- Existing frameworks / tooling already installed
- Any partially started contract files
- Network configs already present
- Any stated user preferences in `README.md` or comments

---

## Step 2 · DApp Candidate Evaluation

Based on the workspace audit, evaluate the following candidate categories and
score them (1–10) against: **complexity fitness**, **ecosystem maturity**,
**testability**, and **user value**.

| Candidate | Description |
|-----------|-------------|
| ERC-20 Token + Vesting | Fungible token with cliff/linear vesting schedules |
| ERC-721 NFT Marketplace | Mint, list, buy, and auction NFTs |
| Multi-sig Treasury | N-of-M signature wallet for DAO funds |
| Decentralised Staking | Stake tokens, earn rewards, slash on misbehaviour |
| Lending Protocol (simple) | Collateralised borrow/repay with interest accrual |
| DAO Governance | Propose, vote, and execute on-chain actions |

**Selection Criteria:**
- Prefer the candidate best matched to any existing workspace scaffolding.
- If no prior context exists, default to **ERC-20 Token + Vesting** as the
  baseline (well-understood, rich test surface, clear frontend story).
- Document the choice and rationale in `docs/SPEC.md`.

---

## Step 3 · Technical Specification

Write `docs/SPEC.md` with the following sections:

```markdown
# DApp Technical Specification

## 1. Project Overview
## 2. Smart Contracts
   - Contract names and responsibilities
   - Key state variables
   - External interfaces / standards (ERC-20, ERC-721, etc.)
   - Access control model
## 3. Test Strategy
   - Unit test coverage targets (≥ 90 % line coverage)
   - Integration / live test scenarios
## 4. Network Configuration
   - Target network (local Anvil/Hardhat node for dev, testnet for staging)
   - Required environment variables
## 5. Frontend Requirements
   - Pages and user flows
   - Wallet connection (wagmi / ethers.js / web3.js)
## 6. Backend Requirements (if needed)
   - Indexer / API endpoints
   - Off-chain services
## 7. Deployment Plan
   - Deployment order and constructor arguments
   - Post-deployment verification steps
```

---

## Step 4 · Monorepo Scaffold

Create the following directory structure (skip directories that already exist):

```
/
├── contracts/          # Solidity sources
│   └── src/
├── tests/              # Contract unit tests
│   └── unit/
├── scripts/            # Deployment & utility scripts
├── frontend/           # React / Next.js app
├── backend/            # API server (if required)
├── docs/               # Specs, reports
├── .env.example        # Template — never commit .env
├── foundry.toml        # OR hardhat.config.ts
└── workspace_state.json
```

```bash
mkdir -p contracts/src tests/unit scripts frontend backend docs
```

Scaffold `.env.example` with all required keys (no values):

```
PRIVATE_KEY=
RPC_URL=
CHAIN_ID=
ETHERSCAN_API_KEY=
```

---

## Step 5 · Update Workspace State

Update `workspace_state.json`:

```json
{
  "project_name": "<chosen name>",
  "dapp_type": "<chosen type>",
  "framework": {
    "contracts": "foundry | hardhat",
    "frontend": "next.js | vite+react",
    "backend": "express | none"
  },
  "stage_status": {
    "01_project_analysis": "complete"
  }
}
```

---

## Pass Criteria ✅

- [ ] `docs/SPEC.md` exists and all 7 sections are populated
- [ ] Monorepo directory structure is in place
- [ ] `.env.example` contains all required keys
- [ ] `workspace_state.json` updated with project metadata
- [ ] Commit: `chore(scaffold): initialise Web3 DApp monorepo`
