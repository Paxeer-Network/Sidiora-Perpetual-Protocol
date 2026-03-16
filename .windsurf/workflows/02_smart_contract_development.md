---
name: "Stage 02 — Smart Contract Development"
description: >
  Author, lint, and statically analyse all smart contracts defined in the
  technical specification.
triggers:
  - manual
  - workflow: 00_master_orchestrator
auto_execution_mode: 3
---

# Stage 02 — Smart Contract Development

## Objective
Write production-quality Solidity contracts that implement every feature in
`docs/SPEC.md`, following security best practices and Solidity style guides.

---

## Step 1 · Toolchain Verification

Verify (do not install globally) that the contract framework is available:

```bash
# Foundry
forge --version 2>/dev/null || echo "forge not found — check PATH"

# Hardhat (alternative)
npx hardhat --version 2>/dev/null || echo "hardhat not found"
```

If neither is available, install locally inside the project:

```bash
# Foundry local install
curl -L https://foundry.paradigm.xyz | bash
~/.foundry/bin/foundryup
```

Do NOT modify PATH for processes outside this terminal session.

---

## Step 2 · Dependency Management

Install only the libraries declared in `docs/SPEC.md`. Common choices:

```bash
# Foundry
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit

# Hardhat
npm install --save-dev @openzeppelin/contracts ethers hardhat \
  @nomicfoundation/hardhat-toolbox
```

Pin exact versions in `foundry.toml` or `package-lock.json`. Never use
floating `*` or `latest` version specifiers.

---

## Step 3 · Contract Authoring Standards

Write contracts to `contracts/src/<ContractName>.sol` following these rules:

### Security Checklist (must be applied to every contract)

- [ ] Reentrancy — use `ReentrancyGuard` or checks-effects-interactions
- [ ] Integer overflow — Solidity ≥ 0.8 has built-in checked arithmetic;
      use `unchecked` blocks only where overflow is intentional and documented
- [ ] Access control — `Ownable`, `AccessControl`, or custom role mapping;
      no unprotected admin functions
- [ ] Input validation — `require` / `revert` with descriptive error messages
      or custom errors for all public/external function parameters
- [ ] Event emission — emit events for every state mutation
- [ ] No `tx.origin` for authentication
- [ ] No hardcoded addresses in logic (use constructor params or constants)
- [ ] No unrestricted `selfdestruct` or `delegatecall` to untrusted addresses
- [ ] Pull-over-push payment pattern for ETH transfers
- [ ] Circuit breaker / pause mechanism for high-value contracts

### Code Style

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  ContractName
/// @notice One-line description of what this contract does.
/// @dev    Extended developer notes.
contract ContractName {
    // ─── State Variables ───────────────────────────────────────────
    // ─── Events ────────────────────────────────────────────────────
    // ─── Errors ────────────────────────────────────────────────────
    // ─── Modifiers ─────────────────────────────────────────────────
    // ─── Constructor ───────────────────────────────────────────────
    // ─── External Functions ────────────────────────────────────────
    // ─── Public Functions ──────────────────────────────────────────
    // ─── Internal Functions ────────────────────────────────────────
    // ─── Private Functions ─────────────────────────────────────────
    // ─── View / Pure Functions ─────────────────────────────────────
}
```

---

## Step 4 · Static Analysis

Run all available linters and analysers against the written contracts:

```bash
# Solhint
npx solhint 'contracts/src/**/*.sol'

# Slither (if available)
slither contracts/src/ --exclude naming-convention 2>/dev/null \
  || echo "Slither not installed — skipping"

# Forge build (compilation check)
forge build --force
```

**All compilation errors and `solhint` errors must be resolved before
proceeding. Warnings must be reviewed and either fixed or explicitly
suppressed with an inline comment explaining why.**

---

## Step 5 · Contract Inventory

For each deployed contract, append to `workspace_state.json`:

```json
{
  "contracts": [
    {
      "name": "MyToken",
      "path": "contracts/src/MyToken.sol",
      "constructor_args": ["name", "symbol", "initialSupply"],
      "interfaces": ["IERC20"],
      "notes": ""
    }
  ]
}
```

---

## Pass Criteria ✅

- [ ] `forge build` (or `npx hardhat compile`) exits with code 0
- [ ] Zero `solhint` errors
- [ ] Every security checklist item addressed for each contract
- [ ] All public/external functions have NatSpec documentation
- [ ] `workspace_state.json` contract inventory populated
- [ ] Commit: `feat(contracts): implement <DApp type> smart contracts`
