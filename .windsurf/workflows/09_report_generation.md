---
name: "Stage 09 — Comprehensive Report Generation"
description: >
  Synthesise all stage outputs, test results, deployment details, and
  recommendations into a thorough final project report.
triggers:
  - manual
  - workflow: 00_master_orchestrator
---

# Stage 09 — Comprehensive Report Generation

## Objective
Produce a detailed, professional report covering every stage of the DApp
build: design decisions, contract architecture, test results, deployment
details, security observations, and next-step recommendations.

---

## Step 1 · Collect All Artefacts

```bash
# Verify all required files exist before writing report
required_files=(
  "docs/SPEC.md"
  "workspace_state.json"
  "tests/reports/unit_results.txt"
  "tests/reports/coverage.txt"
  "tests/reports/live_results.txt"
  "tests/reports/api_integration.txt"
  "tests/reports/e2e_results.txt"
  "scripts/deployment.log"
)

for f in "${required_files[@]}"; do
  [ -f "$f" ] && echo "✅ $f" || echo "⚠️  MISSING: $f"
done
```

---

## Step 2 · Parse Metrics from Reports

```bash
# Extract key numbers
UNIT_PASS=$(grep -c "✅\|PASS\|ok" tests/reports/unit_results.txt || echo 0)
UNIT_FAIL=$(grep -c "❌\|FAIL\|fail" tests/reports/unit_results.txt || echo 0)
COVERAGE=$(grep -oP '\d+(\.\d+)?(?=%)' tests/reports/coverage.txt | head -1 || echo "N/A")
LIVE_PASS=$(grep -c "✅" tests/reports/live_results.txt || echo 0)
LIVE_FAIL=$(grep -c "❌" tests/reports/live_results.txt || echo 0)
E2E_PASS=$(grep -c "passed\|✅" tests/reports/e2e_results.txt || echo 0)
E2E_FAIL=$(grep -c "failed\|❌" tests/reports/e2e_results.txt || echo 0)

TOKEN_ADDRESS=$(node -e \
  "const s=require('./workspace_state.json'); \
   console.log(Object.values(s.deployed_addresses||{})[0]||'N/A')")
NETWORK=$(node -e \
  "console.log(require('./workspace_state.json').network?.name||'N/A')")
FRONTEND_URL=$(node -e \
  "console.log(require('./workspace_state.json').frontend_url||'N/A')")
```

---

## Step 3 · Write the Report

Write `docs/FINAL_REPORT.md` using the template below, substituting all
`{{ variables }}` with real values collected in Step 2:

```markdown
# Web3 DApp — Final Project Report

**Project:** {{ project_name }}
**DApp Type:** {{ dapp_type }}
**Generated:** {{ date }}
**Network:** {{ network_name }} (Chain ID: {{ chain_id }})

---

## Executive Summary

Provide a 3–5 sentence non-technical summary covering:
- What the DApp does and for whom
- Key metrics (contracts deployed, tests passing, coverage)
- Current deployment status and public URL

---

## 1. Project Selection & Rationale

Reproduce the rationale from `docs/SPEC.md § 1`. Explain:
- Why this DApp type was chosen over alternatives
- Scoring matrix results from Stage 01
- How the choice aligns with workspace capabilities

---

## 2. Smart Contract Architecture

### 2.1 Contract Overview

| Contract | Address | Purpose |
|----------|---------|---------|
| {{ contract_name }} | {{ deployed_address }} | {{ purpose }} |

### 2.2 Design Decisions

For each contract, document:
- Inheritance chain and imported standards (ERC-20, OpenZeppelin, etc.)
- Access control model
- Key state variables and their invariants
- Events emitted and their significance

### 2.3 Security Measures

List every security pattern applied:
- Reentrancy protection
- Overflow handling
- Input validation approach
- Admin key risks and mitigations
- Any known limitations or accepted risks

---

## 3. Test Results

### 3.1 Unit Tests

| Metric | Value |
|--------|-------|
| Total tests | {{ unit_total }} |
| Passed | {{ unit_pass }} |
| Failed | {{ unit_fail }} |
| Line coverage | {{ coverage }}% |

Key test scenarios covered: [list]

### 3.2 Live Network Tests

| Metric | Value |
|--------|-------|
| Scenarios | {{ live_total }} |
| Passed | {{ live_pass }} |
| Failed | {{ live_fail }} |

Scenarios tested: [list]

### 3.3 Integration & E2E Tests

| Suite | Passed | Failed |
|-------|--------|--------|
| API Integration | {{ api_pass }} | {{ api_fail }} |
| Frontend Component | {{ fe_pass }} | {{ fe_fail }} |
| Playwright E2E | {{ e2e_pass }} | {{ e2e_fail }} |

---

## 4. Deployment Details

### 4.1 Network

- **Network:** {{ network_name }}
- **Chain ID:** {{ chain_id }}
- **RPC:** {{ rpc_url }}

### 4.2 Deployed Contracts

For each contract:
- Address
- Transaction hash (from deployment log)
- Block number
- Constructor arguments used
- Verification status on block explorer

### 4.3 Frontend

- **URL:** {{ frontend_url }}
- **Framework:** {{ frontend_framework }}
- **Build size:** {{ build_size }}

### 4.4 Backend (if applicable)

- **URL:** {{ backend_url }}
- **Endpoints:** [list]

---

## 5. Gas Analysis

| Contract / Function | Avg Gas | Notes |
|--------------------|---------|-------|
| Deployment | | |
| transfer() | | |
| ... | | |

Include gas snapshot diff if available.

---

## 6. Known Limitations & Risks

Document:
- Any test cases that are skipped and why
- Security assumptions (e.g., trusted owner key)
- Network-specific risks (e.g., mempool MEV on mainnet)
- Frontend wallet compatibility notes (MetaMask vs WalletConnect)

---

## 7. Recommendations & Next Steps

Provide at least 5 actionable improvements ordered by priority:

1. **Security audit** — engage a third-party auditor before mainnet
2. **Upgrade pattern** — evaluate UUPS proxy for contract upgradability
3. **Monitoring** — set up OpenZeppelin Defender or Tenderly alerts
4. **Decentralisation** — transfer ownership to a multisig or DAO
5. **Additional tests** — formal verification with Certora or Halmos
6. ...

---

## 8. File & Artefact Index

| Artefact | Path |
|----------|------|
| Technical Spec | docs/SPEC.md |
| Unit Test Report | tests/reports/unit_results.txt |
| Coverage Report | tests/reports/coverage.txt |
| Live Test Report | tests/reports/live_results.txt |
| API Integration | tests/reports/api_integration.txt |
| E2E Test Report | tests/reports/e2e_results.txt |
| Deployment Log | scripts/deployment.log |
| Gas Snapshot | tests/reports/.gas-snapshot |

---

## Appendix A — Contract ABIs

Paste the full ABI JSON for each deployed contract.

## Appendix B — Full Test Logs

Embed (or link to) the raw test output files.
```

---

## Step 4 · Update Workspace State

```json
{
  "report_path": "docs/FINAL_REPORT.md",
  "stage_status": {
    "09_report_generation": "complete"
  }
}
```

---

## Step 5 · Final Commit & Summary

```bash
git add -A
git commit -m "docs(report): add comprehensive final project report"
```

Print the following completion summary to the terminal:

```
╔══════════════════════════════════════════════════════════╗
║          🎉  Web3 DApp Build Pipeline Complete           ║
╠══════════════════════════════════════════════════════════╣
║  Project:      <project_name>                            ║
║  Network:      <network_name>                            ║
║  Frontend URL: <frontend_url>                            ║
║  Report:       docs/FINAL_REPORT.md                      ║
╠══════════════════════════════════════════════════════════╣
║  Unit tests:   <pass>/<total> passing — <coverage>% cov  ║
║  Live tests:   <live_pass>/<live_total> passing           ║
║  E2E tests:    <e2e_pass>/<e2e_total> passing             ║
╚══════════════════════════════════════════════════════════╝
```

---

## Pass Criteria ✅

- [ ] `docs/FINAL_REPORT.md` exists and all 8 sections are populated
- [ ] No `{{ placeholder }}` tokens remain in the report
- [ ] All metrics in the report match the actual test report files
- [ ] Report committed with message `docs(report): add comprehensive final project report`
- [ ] Completion summary printed to terminal
