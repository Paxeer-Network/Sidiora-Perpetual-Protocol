---
name: "Web3 DApp Builder — Master Orchestrator"
description: >
  Entry point that chains all sub-workflows in sequence to analyze, build,
  test, deploy, and document a complete Web3 decentralised application.
  Run this workflow to kick off the full pipeline.
triggers:
  - manual
auto_execution_mode: 3
---

# Web3 DApp Builder — Master Orchestrator

## Overview
This orchestrator runs the following sub-workflows in strict order.
Each step must succeed before the next begins. On failure, stop and surface
the error clearly — do not proceed to later stages.

```
01_project_analysis
02_smart_contract_development
03_unit_testing
04_contract_deployment
05_live_testing
06_frontend_backend_development
07_integration_testing
08_dapp_deployment
09_report_generation
```

---

## Global Rules (enforced throughout every sub-workflow)

1. **Use only workspace skills** — do not install tools outside the project's
   declared package managers (`npm`, `pip`, `cargo`, `forge`, etc.).
2. **Minimal command execution** — run only commands required for the current
   step; never run cleanup, shutdown, or restart commands for services not
   spawned by this workflow session.
3. **Preserve running services** — never kill, stop, restart, or reconfigure
   any process/service that was running before this workflow started.
4. **Quality gate** — every stage has explicit pass/fail criteria; the agent
   must not mark a stage complete until all criteria are met.
5. **Idempotency** — all scripts and commands must be safe to re-run without
   corrupting prior state.
6. **Secrets hygiene** — private keys, mnemonics, and API keys are always read
   from `.env` (git-ignored); they are never hard-coded or logged.
7. **Commit discipline** — commit after each stage with a conventional-commit
   message, e.g. `feat(contracts): add ERC-20 token with vesting`.

---

## Execution Instructions

The agent must:

1. Open `01_project_analysis.md` and complete it fully.
2. Record outputs (contract names, chosen framework, network config) in
   `workspace_state.json` at the project root.
3. Proceed sequentially through each numbered workflow.
4. After `09_report_generation.md` completes, notify the user with a summary
   and the path to the final report.

## Workspace State File

Create and maintain `/workspace_state.json` with the following schema:

```json
{
  "project_name": "",
  "dapp_type": "",
  "framework": { "contracts": "", "frontend": "", "backend": "" },
  "network": { "name": "", "chain_id": 0, "rpc_url": "" },
  "contracts": [],
  "deployed_addresses": {},
  "test_results": { "unit": {}, "integration": {}, "live": {} },
  "frontend_url": "",
  "backend_url": "",
  "report_path": "",
  "stage_status": {
    "01_project_analysis": "pending",
    "02_smart_contract_development": "pending",
    "03_unit_testing": "pending",
    "04_contract_deployment": "pending",
    "05_live_testing": "pending",
    "06_frontend_backend_development": "pending",
    "07_integration_testing": "pending",
    "08_dapp_deployment": "pending",
    "09_report_generation": "pending"
  }
}
```

Update `stage_status` to `"in_progress"`, `"complete"`, or `"failed"` as
each stage runs.
