---
auto_execution_mode: 2
---

## WORKFLOW OVERVIEW

This workflow runs a deep audit of the evoscan codebase after all Phase 1–7 changes, documents
known issues and faulty logic, stores structured memories, and asks the user what to do next.

**Tools required:**
- Sequential Thinking MCP
- Memory MCP (main)
- Memory Advance MCP (`/root/evoscan/.windsurf/orchestrator.js`)
- All skills in `/root/evoscan/.windsurf/skills/`

---

## STEP 0 — Load Skills & Initialize Orchestrator

```js
// Load all available skills before starting any analysis
const skills = await loadSkills('/root/evoscan/.windsurf/skills/');
// Initialize orchestrator for memory coordination
const orchestrator = require('/root/evoscan/.windsurf/orchestrator.js');
await orchestrator.init({ project: 'evoscan', session: Date.now() });
```

**Skills to activate (check each exists before use):**
- `analyze-workspace` — directory and dependency mapping
- `read-code-context` — AST-aware code reading
- `detect-security-issues` — auth, secrets, injection patterns
- `find-dead-code` — unused imports, unreachable branches
- `check-error-handling` — unwrap, panic, unhandled Results
- `detect-race-conditions` — concurrent state access patterns
- `review-api-contracts` — request/response type consistency

---

## STEP 1 — Sequential Thinking: Decompose the Audit

Use the Sequential Thinking MCP to break the audit into atomic tasks before reading any files.

```
<sequentialthinking>
Problem: Audit the evoscan codebase after Phases 1-7 of agent modifications.
Goal: Identify all flaws, faulty logic, incomplete implementations, and risks.

Step 1: Map workspace structure (what exists vs what was planned)
Step 2: Audit backend — auth, engine, DB, API endpoints
Step 3: Audit bots — config correctness, Hyperliquid integration, tick size math
Step 4: Audit frontend — component wiring, auth flow, deposit/withdraw UI
Step 5: Audit SDK (TypeScript + Rust) — market order fix, JWT propagation
Step 6: Audit deployment — Railway configs, Dockerfiles, env vars
Step 7: Cross-cutting concerns — rate limiting, deadlock handling, security
Step 8: Store all findings to memory
Step 9: Present report and ask user for next steps
</sequentialthinking>
```

---

## STEP 2 — Read Core Files (parallel where possible)

Read the following files for the audit. Use the `read-code-context` skill on each:

```
apps/backend/src/main.rs
apps/backend/src/lib.rs
apps/backend/src/engine/mod.rs
apps/backend/src/engine/router.rs
apps/backend/src/engine/orderbook.rs
apps/backend/src/engine/executor.rs
apps/backend/src/api/rest/auth.rs
apps/backend/src/api/rest/trade.rs
apps/backend/src/api/rest/admin.rs
apps/backend/src/api/rest/deposit.rs
apps/backend/src/api/rest/withdraw.rs
apps/backend/src/api/rest/argus.rs
apps/backend/src/api/rest/mod.rs
apps/backend/src/api/ws/server.rs
apps/backend/src/workers/deposit_worker.rs
apps/backend/src/chain/mod.rs
apps/backend/src/db/balances.rs
apps/backend/src/db/deposits.rs
apps/backend/src/db/orders.rs
apps/backend/config.toml
apps/bots/src/main.rs
apps/bots/src/config.rs
apps/bots/config-1.toml
apps/bots/config-2.toml
apps/bots/config-3.toml
apps/bots/src/markets/btc_usdc/orderbook_mirror.rs
apps/bots/src/markets/btc_usdc/trade_mirror.rs
packages/sdk-rust/src/client.rs
packages/sdk-typescript/src/rest.ts
packages/sdk-typescript/src/index.ts
apps/frontend/src/components/AuthButton.tsx
apps/frontend/src/components/LoginModal.tsx
apps/frontend/src/components/DepositWithdrawDialog.tsx
apps/frontend/src/components/MarketHeader.tsx
apps/frontend/src/lib/api.ts
apps/frontend/src/lib/store.ts
apps/backend/src/db/pg/migrations/
seed.sql
seed-bots.sql
docker-compose.yaml
apps/backend/Dockerfile
apps/bots/Dockerfile
apps/frontend/Dockerfile
apps/backend/railway.toml
apps/bots/railway.toml
apps/frontend/railway.toml
.env
```

---

## STEP 3 — Generate Audit Report

After reading all files, produce the following structured report:

---

### SECTION A: WORKSPACE MAP (Current State)

Produce a directory tree of meaningful source files (exclude `target/`, `node_modules/`, `.git/`).
For each major module, note: **what it does**, **what changed in Phases 1-7**, and **current status**.

---

### SECTION B: KNOWN FLAWS & FAULTY LOGIC

For each issue found, format as:

```
[SEVERITY: CRITICAL|HIGH|MEDIUM|LOW]
[AREA: backend|bots|frontend|sdk|deploy|security]
[FILE: path:line]
ISSUE: <description>
IMPACT: <what breaks if not fixed>
FIX: <recommended action>
```

**Minimum checks to perform:**

#### B1 — Auth System
- Does `POST /api/auth/login` correctly query `password_hash` from Paxeer DB? (Was broken, was fixed — verify fix landed)
- Is there a CORS header on the backend for the Railway frontend domain?
- Does the JWT secret have a safe default in dev? Is `dev-secret-change-in-production` still the fallback?
- Does session restore (`POST /api/auth/session`) work correctly?
- Is `role` checked correctly for admin endpoints when Paxeer DB has no `role` column?

#### B2 — Market Order Price=0
- Is the TS SDK fix (`orderType === 'market'` bypasses price conversion) correctly applied?
- Is the Rust SDK fix (`OrderType::Market` bypasses price atoms calculation) correctly applied?
- Does the backend's `handle_place_order` accept price=0 for market orders without rejecting?

#### B3 — Deposit/Withdraw Worker
- Does `deposit_worker.rs` actually poll `get_pending_deposits()` and `get_pending_withdrawals()`?
- Is it spawned in `main.rs`?
- Does it have retry logic for failed on-chain txs?
- Are the `deposits`/`withdrawals` migration files correctly ordered?

#### B4 — Tick Size / Lot Size Errors
- For low-priced tokens (SHIB, PEPE, BONK, DOGE at <$0.01), do the market tick/lot sizes in `config.toml` accommodate sub-cent pricing?
- Does rounding to tick_size produce 0 for any configured market?

#### B5 — EngineRouter & Concurrency
- Does `CancelOrder` routing work when the market_id isn't known at request time? (Uses DB lookup — is this safe under load?)
- Does the fallback sender in EngineRouter cause any ordering issues?
- Is the deadlock retry logic generating fresh UUIDs correctly on retry?

#### B6 — Bot Config & Balance Issues
- Do `config-1/2/3.toml` have `maker_address`/`taker_address` matching the seeded SQL users?
- Does `seed-bots.sql` cover ALL tokens listed across all 3 configs?
- Is the `auto_faucet` path dead/bypassed for the new bot users?

#### B7 — Frontend Auth & Deposit UI
- Is `DepositWithdrawDialog` reachable from the UI (wired into MarketHeader)?
- Does it read the JWT from the SDK client correctly?
- Is `LoginModal` calling `setJwtToken()` on the SDK client after login?
- Is there a logout path that clears JWT from both localStorage and SDK client?

#### B8 — Rate Limiting
- Is `RATE_LIMIT=false` the safe default for Railway (where `PeerIpKeyExtractor` fails)?
- Is there a proxy-aware alternative implemented?

#### B9 — Security Issues
Run `detect-security-issues` skill:
- Hardcoded secrets anywhere (not in .env)
- Missing auth on any endpoint that should be protected
- SQL injection risks in raw sqlx queries
- Missing CORS config on backend

#### B10 — Dead Code & Unused Files
Run `find-dead-code` skill:
- `FaucetDialog.tsx` — confirmed deleted?
- `turnkey-provider.tsx` — confirmed deleted?
- Any other orphaned components or modules

#### B11 — Error Handling
Run `check-error-handling` skill:
- Any `.unwrap()` or `.expect()` in production paths?
- Unhandled `Result` types in async tasks?
- Missing error variants in `ExchangeError`?

---

### SECTION C: INCOMPLETE IMPLEMENTATIONS

List all TODO comments and stub implementations found across the codebase:

```
FILE: <path>
LINE: <n>
TODO: <content>
STATUS: [new|pre-existing|partially-done]
```

---

### SECTION D: DEPLOYMENT READINESS

Check each Railway service:

| Service | Dockerfile | railway.toml | Env Vars Needed | Known Issues |
|---------|-----------|--------------|----------------|--------------|
| Backend | | | | |
| Market_Makers | | | | |
| Bots-1 | | | | |
| Bots-2 | | | | |
| Bots-3 | | | | |
| Frontend | | | | |

---

### SECTION E: RISK MATRIX

| Item | Risk Level | Mitigation Status |
|------|-----------|-------------------|
| Single holding wallet for all deposits | CRITICAL | No multisig |
| Private key in env var | HIGH | Gitignored only |
| No signature verification on trade (JWT only) | HIGH | Phase 3 partial fix |
| Admin endpoint role check (no `role` in Paxeer DB) | HIGH | Needs review |
| No WAL beyond PG query on restart | MEDIUM | B8 implemented |
| Rate limiting disabled (proxy IP issue) | MEDIUM | Needs proxy extractor |
| Bot auto-faucet still in codebase | LOW | Dead path |

---

## STEP 4 — Store All Findings to Memory

After completing the audit, store memories using BOTH memory systems:

### 4A — Main Memory MCP

```js
// Store one memory per major finding category
await memory.store({
  key: 'evoscan/audit/auth-system',
  value: {
    status: '',
    issues: ['', ''],
    files: ['apps/backend/src/api/rest/auth.rs'],
    fixedInPhase: 3,
    remainingWork: ['']
  }
});

await memory.store({
  key: 'evoscan/audit/market-order-fix',
  value: { /* TS SDK fix status, Rust SDK fix status */ }
});

await memory.store({
  key: 'evoscan/audit/deposit-withdraw',
  value: { /* worker status, UI wiring status, chain client status */ }
});

await memory.store({
  key: 'evoscan/audit/bot-config',
  value: { /* config-1/2/3 status, tick size issues, balance seeding */ }
});

await memory.store({
  key: 'evoscan/audit/deployment',
  value: { /* Railway service names, env vars set/missing, known blockers */ }
});

await memory.store({
  key: 'evoscan/audit/security',
  value: { /* CORS status, JWT secret strength, admin auth gap, CORS config */ }
});

await memory.store({
  key: 'evoscan/architecture/phases-complete',
  value: {
    phases: [1,2,3,4,5,6,7],
    branch: 'main',
    lastCommit: '',
    railwayServices: ['Backend', 'Market_Makers', 'Bots-1', 'Bots-2', 'Bots-3', 'Frontend'],
    databases: {
      evoscan: 'gondola.proxy.rlwy.net:22225',
      paxeer: 'tramway.proxy.rlwy.net:17795',
      clickhouse: 'clickhouse-production-fa6e.up.railway.app'
    }
  }
});
```

### 4B — Memory Advance MCP (orchestrator.js)

```js
const orchestrator = require('/root/evoscan/.windsurf/orchestrator.js');

// Store structured project state for future agent sessions
await orchestrator.remember('evoscan:project-state', {
  lastAuditDate: new Date().toISOString(),
  criticalIssues: [ /* list all CRITICAL severity items */ ],
  highIssues: [ /* list all HIGH severity items */ ],
  incompleteFeatures: [
    'deposit_worker: on-chain tx execution (endpoint exists, worker polls, chain call TBD)',
    'rate_limiting: proxy-aware IP extractor not implemented',
    'admin_role: Paxeer DB has no role column — admin check may always fail in prod',
    'argus_leaderboard: queries by trade count only, no PnL calculation yet'
  ],
  botStatus: {
    service1: 'config-1.toml — 14 markets (major L1s)',
    service2: 'config-2.toml — 14 markets (DeFi + memes)',
    service3: 'config-3.toml — 15 markets (infra + AI + BP)',
    knownIssue: 'tick_size rounding may produce 0 for sub-cent tokens'
  },
  frontendStatus: {
    auth: 'LoginModal → /api/auth/login → Paxeer DB',
    deposit: 'DepositWithdrawDialog in MarketHeader — needs JWT wiring verify',
    removed: ['FaucetDialog', 'TurnkeyProvider', 'AuthButton (Turnkey version)']
  }
});

await orchestrator.remember('evoscan:known-bugs', [
  {
    id: 'BUG-001',
    title: 'Admin role check broken — Paxeer DB has no role column',
    severity: 'HIGH',
    file: 'apps/backend/src/api/rest/auth.rs',
    description: 'JWT claims include role but Paxeer DB users table has no role column. Admin check in production will always see role=null or default.',
    fix: 'Add role to JWT based on a hardcoded admin list OR add role column to Paxeer DB OR use ARGUS_API_KEY as admin gate'
  },
  {
    id: 'BUG-002',
    title: 'Tick size produces 0 atoms for sub-cent tokens',
    severity: 'HIGH',
    file: 'apps/backend/config.toml + packages/sdk-rust/src/client.rs',
    description: 'SHIB, PEPE, BONK etc. trade at $0.00001. With USDC decimals=6 and tick_size=10000: price=0.00001 → 10 atoms → rounded to tick_size 10000 → 0.',
    fix: 'Recalculate tick_size for sub-cent tokens. SHIB tick_size should be 1 (1 micro-USDC = $0.000001)'
  },
  {
    id: 'BUG-003',
    title: 'CORS not configured — cross-origin requests may fail',
    severity: 'HIGH',
    file: 'apps/backend/src/api/rest/mod.rs',
    description: 'No CORS middleware found. Railway frontend (different domain) calling backend will be blocked by browser CORS policy.',
    fix: 'Add tower-http CorsLayer with frontend Railway domain as allowed origin'
  },
  {
    id: 'BUG-004',
    title: 'Rate limiting disabled — PeerIpKeyExtractor fails behind Railway proxy',
    severity: 'MEDIUM',
    file: 'apps/backend/src/api/rest/mod.rs',
    description: 'GovernorLayer with PeerIpKeyExtractor returns UnableToExtractKey behind Railway reverse proxy. Workaround: RATE_LIMIT=false. Real fix: X-Forwarded-For extractor.',
    fix: 'Implement custom KeyExtractor reading X-Real-IP or X-Forwarded-For header'
  },
  {
    id: 'BUG-005',
    title: 'Deposit worker chain execution incomplete',
    severity: 'MEDIUM',
    file: 'apps/backend/src/workers/deposit_worker.rs',
    description: 'Worker polls pending deposits but chain client requires user private key decryption from Paxeer DB. DEPOSIT_SIGNER_KEY env var semantics unclear.',
    fix: 'Clarify whether deposits are user-signed (need decrypted key from Paxeer DB) or backend-signed (need holding wallet key)'
  }
]);

await orchestrator.remember('evoscan:env-vars-checklist', {
  backend: {
    required: ['HOST','PORT','PG_URL','CH_URL','CH_USER','CH_PASSWORD','PAXEER_PG_URL','JWT_SECRET'],
    optional: ['EVOSCAN_WALLET_PRIVATE_KEY','EVOSCAN_WALLET_ADDRESS','USDL_CONTRACT_ADDRESS','PAXEER_RPC_URL','APP_ENV','RATE_LIMIT','ARGUS_API_KEY','DEPOSIT_SIGNER_KEY'],
    critical: 'JWT_SECRET must not be empty in production — current fallback is dev-secret-change-in-production'
  },
  bots: {
    required: ['EXCHANGE_URL','BOTS_CONFIG','RAILWAY_DOCKERFILE_PATH'],
  },
  frontend: {
    required: ['NEXT_PUBLIC_API_URL','NEXT_PUBLIC_WS_URL','PORT'],
    optional: ['NEXT_PUBLIC_ORGANIZATION_ID','NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID']
  }
});
```

---

## STEP 5 — Present Report & Ask User

After completing Steps 1-4, output the full audit report and then present this question:

---

```
====================================================================
EVOSCAN POST-INTEGRATION AUDIT — COMPLETE
====================================================================

[Full report content from Step 3 here]

====================================================================
MEMORY STORED:
  ✅ evoscan/audit/auth-system
  ✅ evoscan/audit/market-order-fix
  ✅ evoscan/audit/deposit-withdraw
  ✅ evoscan/audit/bot-config
  ✅ evoscan/audit/deployment
  ✅ evoscan/audit/security
  ✅ evoscan/architecture/phases-complete
  ✅ evoscan:project-state (orchestrator)
  ✅ evoscan:known-bugs (orchestrator)
  ✅ evoscan:env-vars-checklist (orchestrator)
====================================================================

CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:
  1. [BUG-001] Admin role check — Paxeer DB has no role column
  2. [BUG-002] Tick size = 0 for sub-cent tokens (SHIB/PEPE/BONK)
  3. [BUG-003] CORS not configured — frontend API calls blocked

HIGH PRIORITY:
  4. [BUG-004] Rate limiting disabled (proxy IP extractor)
  5. [BUG-005] Deposit worker chain execution path incomplete

What would you like to do next?
Please describe your goal and I will produce a full breakdown
of all necessary changes and additions before making any edits.
```

---

## STEP 6 — Requirements Gathering (After User Responds)

When the user responds, use Sequential Thinking again to:

1. Parse the user's intent into discrete tasks
2. Classify each task by area (backend/frontend/bots/SDK/deploy/infra)
3. Assign risk level per task
4. Identify dependencies between tasks
5. Propose implementation order

Then present a full plan using this format:

```
## PROPOSED PLAN: <title>

### Tasks
| # | Task | Area | Risk | Deps | Est. |
|---|------|------|------|------|------|
| 1 | ... | ... | 🔴/🟡/🟢 | — | ... |

### Implementation Order
Phase A → Phase B → Phase C

### Files to Create
- path/to/new/file.rs — purpose

### Files to Modify
- path/to/existing/file.rs:line — what changes

### New Dependencies
- crate/package — purpose

### New Env Vars
- VAR_NAME — purpose

### Database Changes
- Migration needed? Y/N — description

### Test Plan
- How to verify each change works

Shall I proceed? (yes / adjust plan / cancel)
```

**Do NOT make any file changes until the user approves the plan.**

---

## WORKFLOW COMPLETE

After approval, create a new branch `agent/post-audit-<taskname>` and execute
the approved plan using the same gate pattern from previous phases:
build → test → clippy → secrets scan → commit → merge.

Store a final memory after completion:
```js
await orchestrator.remember('evoscan:last-completed-work', {
  date: new Date().toISOString(),
  branch: 'agent/post-audit-',
  tasks: [ /* completed tasks */ ],
  nextUp: [ /* user-mentioned future work */ ]
});
```