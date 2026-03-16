---
name: "Stage 03 — Unit Testing"
description: >
  Write and execute a comprehensive unit test suite for every smart contract,
  achieving ≥ 90 % line coverage and verifying all edge cases.
triggers:
  - manual
  - workflow: 00_master_orchestrator
---

# Stage 03 — Unit Testing

## Objective
Prove contract correctness through exhaustive unit tests covering happy paths,
failure paths, access control, edge cases, and fuzz scenarios.

---

## Step 1 · Test Framework Setup

```bash
# Foundry — no extra setup needed; forge-std is already installed
# Hardhat — ensure mocha/chai are present
npm install --save-dev mocha chai @nomicfoundation/hardhat-chai-matchers
```

Create `tests/unit/<ContractName>.t.sol` (Foundry) or
`tests/unit/<ContractName>.test.ts` (Hardhat) for each contract.

---

## Step 2 · Test Architecture

Structure every test file using the following pattern:

### Foundry Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/src/MyContract.sol";

contract MyContractTest is Test {
    // ─── Fixtures ──────────────────────────────────────────────────
    MyContract internal sut; // System Under Test
    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");

    function setUp() public {
        vm.startPrank(owner);
        sut = new MyContract(/* constructor args */);
        vm.stopPrank();
    }

    // ─── Happy Path ────────────────────────────────────────────────
    function test_<action>_<expected_outcome>() public { ... }

    // ─── Revert Cases ──────────────────────────────────────────────
    function test_RevertWhen_<condition>() public { ... }

    // ─── Access Control ────────────────────────────────────────────
    function test_RevertWhen_CallerIsNotOwner() public { ... }

    // ─── Fuzz Tests ────────────────────────────────────────────────
    function testFuzz_<action>(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        ...
    }

    // ─── Invariant Tests ───────────────────────────────────────────
    function invariant_<property>() public { ... }
}
```

---

## Step 3 · Required Test Scenarios

For **every** contract, tests must cover:

| Category | Scenarios |
|----------|-----------|
| Deployment | Constructor sets state correctly; owner is set |
| Core Logic | Each external function produces correct state changes |
| Events | Correct events emitted with correct args |
| Revert Paths | Invalid inputs revert with correct error/message |
| Access Control | Non-owner/non-role callers are rejected |
| Edge Cases | Zero values, max values, boundary conditions |
| Reentrancy | Attempted reentrancy is blocked (if applicable) |
| Fuzz | At least one fuzz test per numerical input |
| Invariants | Key protocol invariants hold across all state changes |

---

## Step 4 · Run Tests & Coverage

```bash
# Foundry
forge test -vvv 2>&1 | tee tests/reports/unit_results.txt
forge coverage --report lcov 2>&1 | tee tests/reports/coverage.txt

# Hardhat alternative
npx hardhat test 2>&1 | tee tests/reports/unit_results.txt
npx hardhat coverage 2>&1 | tee tests/reports/coverage.txt
```

Parse coverage output:
- If line coverage < 90 %, write additional tests for uncovered lines.
- Re-run until ≥ 90 % is achieved.
- Store final coverage percentage in `workspace_state.json`.

```json
{
  "test_results": {
    "unit": {
      "total_tests": 0,
      "passed": 0,
      "failed": 0,
      "line_coverage_pct": 0,
      "report_path": "tests/reports/unit_results.txt"
    }
  }
}
```

---

## Step 5 · Gas Snapshot

```bash
forge snapshot --snap tests/reports/.gas-snapshot
```

Record the snapshot so regressions can be detected in future runs.

---

## Pass Criteria ✅

- [ ] All tests pass (0 failures)
- [ ] Line coverage ≥ 90 % for every contract
- [ ] At least one fuzz test per external numerical input
- [ ] At least one invariant test per stateful contract
- [ ] Gas snapshot saved
- [ ] `workspace_state.json` updated with unit test results
- [ ] Commit: `test(contracts): add unit tests — <X>% coverage`
