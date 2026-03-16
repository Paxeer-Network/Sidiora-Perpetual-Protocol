# evoscan — Backend Fix + Frontend Redesign Workflow
# Save to: /root/evoscan/.windsurf/workflows/evoscan_fix_and_redesign.md
# Trigger: @[/evoscan_fix_and_redesign]

---

## WORKFLOW OVERVIEW

This workflow:
1. Loads all skills and initializes the orchestrator memory system
2. Uses sequential thinking to plan all work before touching files
3. Stores rich context memories in both memory systems
4. Fixes all known backend flaws from the audit
5. Gathers requirements for a full frontend redesign
6. Implements the redesign with user approval at each gate

**Branch naming:** `agent/backend-fixes` → `agent/frontend-redesign`
**Gate pattern:** build → test → clippy → secrets scan → commit → merge

---

## ═══════════════════════════════════════════════════
## STEP 0 — Load Skills & Initialize Orchestrator
## ═══════════════════════════════════════════════════

Execute before reading any file:

```js
// 0.1 — Load all available skills
const skillsDir = '/root/evoscan/.windsurf/skills/';
const skills = await loadSkills(skillsDir);
// Expected skills to activate:
//   analyze-workspace, read-code-context, detect-security-issues,
//   find-dead-code, check-error-handling, detect-race-conditions,
//   review-api-contracts

// 0.2 — Initialize orchestrator
 node .windsurf/orchestrator.js init
 🚀 Initializing Windsurf Agent System

 Checking configuration...
  ✓ config.yaml loaded
  ✓ triggers.yaml loaded (3 triggers)
  ✓ 67 skills available
  ✓ 15 workflows available
Initializing database...
  ⚠ init-db.js not found

 ✨ System initialized!
Run node orchestrator.js status to see system status.


// 0.3 — Load prior audit memories so we don't re-read the codebase blind
const priorState    = await orchestrator.recall('evoscan:project-state');
const knownBugs     = await orchestrator.recall('evoscan:known-bugs');
const envChecklist  = await orchestrator.recall('evoscan:env-vars-checklist');
const auditSecurity = await memory.get('evoscan/audit/security');
const auditDeploy   = await memory.get('evoscan/audit/deployment');
const auditAuth     = await memory.get('evoscan/audit/auth-system');

console.log('Loaded prior context:', {
  criticalIssues: priorState?.criticalIssues?.length,
  knownBugs: knownBugs?.length,
  lastAuditDate: priorState?.lastAuditDate
});
```

**If orchestrator.recall returns null** (first run or memory cleared), fall back to
reading the audit document at `/root/evoscan/.windsurf/workflows/evoscan_audit_and_next.md`
and re-parsing its Section B and Section E findings before continuing.

---

## ═══════════════════════════════════════════════════
## STEP 1 — Sequential Thinking Decomposition
## ═══════════════════════════════════════════════════

```
<sequentialthinking>
Context: Post-audit evoscan codebase. 7 phases of changes completed.
         Audit identified 5 HIGH/CRITICAL backend issues + frontend needs full redesign.

Goal A: Fix all backend flaws without breaking existing functionality.
Goal B: Redesign the frontend with modern UI, collecting requirements first.

Decomposition of Goal A — Backend Fixes:

  Fix 1: Admin role check (BUG-001)
    — Paxeer DB has no `role` column
    — JWT claims hardcode role="user" for all logins
    — Solution: Admin gate via hardcoded address list from env var OR ARGUS_API_KEY reuse
    — Files: auth.rs, admin.rs
    — Risk: MEDIUM (admin was already unreachable, so this is additive)

  Fix 2: Deposit worker signer semantics (BUG-005)
    — DEPOSIT_SIGNER_KEY used as single signer for ALL user deposits
    — Should fetch user's private key from Paxeer DB per deposit
    — Alternative: treat deposits as user-initiated (user pre-approves, backend reads key from Paxeer DB)
    — Files: deposit_worker.rs, chain/mod.rs, db/mod.rs (add paxeer key query)
    — Risk: HIGH (touches on-chain tx construction)

  Fix 3: Rate limiting with proxy-aware IP extractor
    — PeerIpKeyExtractor fails behind Railway reverse proxy
    — Solution: Custom KeyExtractor reading X-Forwarded-For or X-Real-IP
    — Enable RATE_LIMIT by default in production
    — Files: api/rest/mod.rs, Cargo.toml (no new deps needed)
    — Risk: LOW

  Fix 4: Drip endpoint production gate
    — /api/drip open to anyone in production
    — Solution: Check APP_ENV == "production" → return 403
    — Files: drip.rs
    — Risk: LOW

  Fix 5: Argus API key enforcement
    — Empty ARGUS_API_KEY = endpoints open to anyone
    — Solution: If ARGUS_API_KEY is set in env, require it; if not set in production, return 500
    — Files: argus.rs
    — Risk: LOW

  Fix 6: CORS restriction
    — CorsLayer::permissive() allows all origins
    — Solution: Read ALLOWED_ORIGIN env var (frontend Railway URL), restrict to that
    — Files: main.rs
    — Risk: LOW

  Fix 7: Deposit/Withdraw retry logic
    — Failed on-chain txs marked "failed" immediately, no retry
    — Solution: Add retry counter to deposits/withdrawals tables, retry up to 3 times
    — Files: deposit_worker.rs, db/deposits.rs, migration SQL
    — Risk: LOW

Decomposition of Goal B — Frontend Redesign:
  — Requirements gathering phase FIRST (ask user)
  — No code changes until approved
  — Plan component architecture, routing, state, theme
  — Implement with shadcn/ui, Tailwind, existing API/WS infrastructure

Ordering:
  Phase A: Fixes 3,4,5,6 (low risk, no DB changes) → commit
  Phase B: Fix 1 (admin auth) → commit
  Phase C: Fixes 2,7 (deposit worker + retry, DB migration) → commit
  Phase D: Frontend requirements gathering → user approval
  Phase E: Frontend redesign implementation
</sequentialthinking>
```

---

## ═══════════════════════════════════════════════════
## STEP 2 — Store Pre-Work Memories
## ═══════════════════════════════════════════════════

Store all planning context BEFORE touching any files:

```js
// --- Main Memory MCP ---
await memory.store({
  key: 'evoscan/fix-session/plan',
  value: {
    startedAt: new Date().toISOString(),
    goalsA: ['admin-role-fix','deposit-worker-signer','rate-limit-proxy',
              'drip-prod-gate','argus-key-enforce','cors-restrict','deposit-retry'],
    goalB: 'full-frontend-redesign',
    phasePlan: ['A:low-risk-fixes','B:admin-auth','C:deposit-worker','D:frontend-req','E:frontend-impl'],
    currentPhase: 'A'
  }
});

await memory.store({
  key: 'evoscan/fix-session/bug-status',
  value: {
    'BUG-001-admin-role':    { status: 'IN_PROGRESS', file: 'auth.rs + admin.rs' },
    'BUG-005-deposit-signer':{ status: 'QUEUED',      file: 'deposit_worker.rs + chain/mod.rs' },
    'rate-limit-proxy':      { status: 'QUEUED',      file: 'api/rest/mod.rs' },
    'drip-prod-gate':        { status: 'QUEUED',      file: 'drip.rs' },
    'argus-key-enforce':     { status: 'QUEUED',      file: 'argus.rs' },
    'cors-restrict':         { status: 'QUEUED',      file: 'main.rs' },
    'deposit-retry':         { status: 'QUEUED',      file: 'deposit_worker.rs + migration' }
  }
});

// --- Orchestrator Memory ---
await orchestrator.remember('evoscan:fix-session', {
  startedAt: new Date().toISOString(),
  fromAuditDate: priorState?.lastAuditDate,
  knownBugsToFix: knownBugs?.map(b => b.id),
  frontendRedesign: { status: 'PENDING_REQUIREMENTS' },
  branchStrategy: {
    backendFixes: 'agent/backend-fixes',
    frontendRedesign: 'agent/frontend-redesign',
    mergeTarget: 'main'
  }
});
```

---

## ═══════════════════════════════════════════════════
## STEP 3 — Read Files Needed for Fixes
## ═══════════════════════════════════════════════════

Read only the files required for the planned fixes (not the full codebase):

```
# Auth / Admin
apps/backend/src/api/rest/auth.rs
apps/backend/src/api/rest/admin.rs
apps/backend/src/errors.rs

# Rate limiting
apps/backend/src/api/rest/mod.rs
apps/backend/Cargo.toml

# Drip gate
apps/backend/src/api/rest/drip.rs

# Argus key enforcement
apps/backend/src/api/rest/argus.rs

# CORS
apps/backend/src/main.rs

# Deposit worker + chain + DB
apps/backend/src/workers/deposit_worker.rs
apps/backend/src/chain/mod.rs
apps/backend/src/db/deposits.rs
apps/backend/src/db/mod.rs
apps/backend/src/db/pg/migrations/  (latest migration file)

# Frontend structure (for redesign planning only, no changes yet)
apps/frontend/src/app/
apps/frontend/src/components/
apps/frontend/src/lib/
apps/frontend/package.json
apps/frontend/next.config.ts
apps/frontend/tailwind.config.ts  (if exists)
```

---

## ═══════════════════════════════════════════════════
## STEP 4 — PHASE A: Low-Risk Backend Fixes
## ═══════════════════════════════════════════════════

```bash
git checkout -b agent/backend-fixes
```

### Fix A1 — Rate Limiting: Proxy-Aware IP Extractor

**File:** `apps/backend/src/api/rest/mod.rs`

Replace `PeerIpKeyExtractor` with a custom extractor that reads
`X-Forwarded-For` → `X-Real-IP` → peer address (in that priority order):

```rust
// Add to api/rest/mod.rs (or a new middleware/rate_limit.rs)
use axum::extract::ConnectInfo;
use std::net::SocketAddr;
use tower_governor::key_extractor::KeyExtractor;

#[derive(Clone)]
pub struct ProxyAwareIpExtractor;

impl KeyExtractor for ProxyAwareIpExtractor {
    type Key = String;
    type KeyExtractionError = std::convert::Infallible;

    fn extract<B>(
        &self,
        req: &axum::http::Request<B>,
    ) -> Result<Self::Key, Self::KeyExtractionError> {
        // 1. X-Forwarded-For (Railway / Cloudflare / nginx)
        if let Some(xff) = req.headers().get("x-forwarded-for") {
            if let Ok(val) = xff.to_str() {
                if let Some(first_ip) = val.split(',').next() {
                    return Ok(first_ip.trim().to_string());
                }
            }
        }
        // 2. X-Real-IP (nginx)
        if let Some(xri) = req.headers().get("x-real-ip") {
            if let Ok(val) = xri.to_str() {
                return Ok(val.trim().to_string());
            }
        }
        // 3. Socket peer address fallback
        if let Some(addr) = req.extensions().get::<ConnectInfo<SocketAddr>>() {
            return Ok(addr.0.ip().to_string());
        }
        Ok("unknown".to_string())
    }
}
```

Update `create_rest()` to use `ProxyAwareIpExtractor` and enable rate limiting
when `RATE_LIMIT=true` (keep env var gate for zero-downtime rollout).

Also add `ConnectInfo<SocketAddr>` to the router via `.into_make_service_with_connect_info::<SocketAddr>()`.
Check `apps/backend/src/main.rs` — update the `.serve()` call if needed.

---

### Fix A2 — Drip Endpoint Production Gate

**File:** `apps/backend/src/api/rest/drip.rs`

Add at the top of the `drip()` handler:

```rust
// Gate: disable drip in production
if std::env::var("APP_ENV").as_deref() == Ok("production") {
    return Err(ExchangeError::Unauthorized(
        "Faucet is disabled in production".to_string()
    ));
}
```

---

### Fix A3 — Argus API Key Enforcement

**File:** `apps/backend/src/api/rest/argus.rs`

Replace the current optional check:

```rust
// BEFORE: empty key = open endpoints
// AFTER:
fn require_argus_key(headers: &HeaderMap) -> Result<(), ExchangeError> {
    let configured_key = std::env::var("ARGUS_API_KEY").unwrap_or_default();
    if configured_key.is_empty() {
        if std::env::var("APP_ENV").as_deref() == Ok("production") {
            return Err(ExchangeError::InternalError(
                "ARGUS_API_KEY must be set in production".to_string()
            ));
        }
        return Ok(()); // dev: open without key
    }
    let provided = headers
        .get("x-argus-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != configured_key {
        return Err(ExchangeError::Unauthorized("Invalid Argus API key".to_string()));
    }
    Ok(())
}
```

Add `InternalError` variant to `ExchangeError` if not already present.

---

### Fix A4 — CORS Origin Restriction

**File:** `apps/backend/src/main.rs`

Replace `CorsLayer::permissive()` with:

```rust
let allowed_origin = std::env::var("ALLOWED_ORIGIN")
    .unwrap_or_else(|_| "*".to_string());

let cors = if allowed_origin == "*" {
    CorsLayer::permissive()
} else {
    CorsLayer::new()
        .allow_origin(allowed_origin.parse::<HeaderValue>()
            .expect("Invalid ALLOWED_ORIGIN"))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE, AUTHORIZATION, HeaderName::from_static("x-argus-api-key")])
        .allow_credentials(true)
};
```

**New env var:** `ALLOWED_ORIGIN=https://frontend-production-xxx.up.railway.app`

---

### Phase A Gate

```bash
cargo build --workspace 2>&1 | tail -20
cargo test --workspace 2>&1 | tail -20
cargo clippy --workspace 2>&1 | tail -10
git add -A
# secrets scan (exclude known-safe patterns)
git diff --staged -- ':(exclude).env' | grep -iE "(private_key|password|secret|0x[0-9a-fA-F]{40})" \
  | grep -v '.windsurf/' | grep -v 'validate_env\|JWT_SECRET\|EVOSCAN_WALLET' | head -10
git commit -m "fix(phase-a): proxy rate limiting, drip gate, argus enforcement, CORS restriction

- ProxyAwareIpExtractor reads X-Forwarded-For for rate limiting behind Railway proxy
- RATE_LIMIT=true now works correctly in production
- Drip endpoint returns 403 when APP_ENV=production
- Argus endpoints require ARGUS_API_KEY in production; open in dev
- CORS restricted to ALLOWED_ORIGIN env var (falls back to permissive in dev)"
```

**Update memory after Phase A:**
```js
await memory.store({
  key: 'evoscan/fix-session/bug-status',
  value: { /* update rate-limit-proxy, drip-prod-gate, argus-key-enforce, cors-restrict to DONE */ }
});
await orchestrator.remember('evoscan:fix-session', { currentPhase: 'B' });
```

---

## ═══════════════════════════════════════════════════
## STEP 5 — PHASE B: Admin Role Fix (BUG-001)
## ═══════════════════════════════════════════════════

### Fix B1 — Admin Role via ADMIN_ADDRESSES Env Var

**Problem:** Paxeer DB has no `role` column. All JWT tokens have `role: "user"`.
Admin endpoints (`CreateToken`, `CreateMarket`, `Faucet`) are unreachable in production.

**Solution:** Read a comma-separated list of admin wallet addresses from the
`ADMIN_ADDRESSES` env var. During login, check if the authenticated user's
`wallet_address` is in this list and set `role: "admin"` in the JWT.

**File: `apps/backend/src/api/rest/auth.rs`**

```rust
// In the login handler, after fetching user from Paxeer DB:
let admin_addresses: Vec<String> = std::env::var("ADMIN_ADDRESSES")
    .unwrap_or_default()
    .split(',')
    .map(|s| s.trim().to_lowercase())
    .filter(|s| !s.is_empty())
    .collect();

let role = if admin_addresses.contains(&user.wallet_address.to_lowercase()) {
    "admin"
} else {
    "user"
};

let claims = Claims {
    sub: user.wallet_address.clone(),
    role: role.to_string(),
    exp: (Utc::now() + Duration::hours(24)).timestamp() as usize,
};
```

**File: `apps/backend/src/api/rest/admin.rs`**

Verify the existing admin check uses `claims.role == "admin"` — confirm it does.

**New env var:** `ADMIN_ADDRESSES=0xabc...,0xdef...`
(wallet addresses of Paxeer network accounts that should have admin access)

**Alternative secondary gate:** Admin endpoints also accept `X-Admin-Key` header
matching `ARGUS_API_KEY` as a machine-to-machine bypass (for `init_exchange` scripts).

### Phase B Gate

```bash
cargo build --workspace && cargo test --workspace && cargo clippy --workspace
git commit -m "fix(phase-b): admin role via ADMIN_ADDRESSES env var

- Login handler checks wallet_address against ADMIN_ADDRESSES comma-separated list
- Matching addresses receive role='admin' in JWT
- Admin endpoints now reachable in production for configured addresses
- Fallback: X-Admin-Key header (matching ARGUS_API_KEY) for machine access"
```

**Update memory:**
```js
await memory.store({ key: 'evoscan/fix-session/bug-status',
  value: { 'BUG-001-admin-role': { status: 'DONE' } } });
await orchestrator.remember('evoscan:fix-session', { currentPhase: 'C' });
```

---

## ═══════════════════════════════════════════════════
## STEP 6 — PHASE C: Deposit Worker + Retry (BUG-005)
## ═══════════════════════════════════════════════════

### Fix C1 — Deposit Worker: Per-User Key from Paxeer DB

**Problem:** `DEPOSIT_SIGNER_KEY` env var is used as the signing key for ALL user
deposits, but each user has their own wallet on the Paxeer network. Deposits must
be signed by the user's own key (fetched from Paxeer DB per-deposit).

**Changes:**

**File: `apps/backend/src/db/mod.rs`** — Add Paxeer DB query method:

```rust
// Add to Db or a new PaxeerDb struct
impl Db {
    pub async fn get_paxeer_user_private_key(
        paxeer_db: &PgPool,
        wallet_address: &str,
    ) -> Result<String> {
        let row = sqlx::query!(
            "SELECT private_key FROM users WHERE wallet_address = $1",
            wallet_address
        )
        .fetch_one(paxeer_db)
        .await
        .map_err(|_| ExchangeError::NotFound("User not found in Paxeer DB".to_string()))?;

        Ok(row.private_key)
    }
}
```

> ⚠️ Check the actual column name for private keys in Paxeer DB before writing this query.
> Run: `SELECT column_name FROM information_schema.columns WHERE table_name='users'`
> against `tramway.proxy.rlwy.net:17795`.

**File: `apps/backend/src/workers/deposit_worker.rs`**

Update deposit execution to:
1. Fetch user's private key from Paxeer DB using `paxeer_db` pool
2. Construct PaxeerChainClient with user's key (not global `DEPOSIT_SIGNER_KEY`)
3. Call `transfer_to_holding(amount)` signed by user's key

```rust
// Pseudocode for deposit execution loop:
for deposit in pending_deposits {
    // Get user's key from Paxeer DB
    let user_key = match Db::get_paxeer_user_private_key(&paxeer_db, &deposit.user_address).await {
        Ok(k) => k,
        Err(e) => {
            error!("Cannot fetch key for {}: {}", deposit.user_address, e);
            db.update_deposit_status(deposit.id, "failed").await.ok();
            continue;
        }
    };
    // Build client signed with USER's key
    let user_client = PaxeerChainClient::with_key(&rpc_url, &user_key, &usdl_address, &holding_wallet)?;
    match user_client.transfer_to_holding(deposit.amount).await {
        Ok(tx_hash) => { /* mark confirmed, credit balance */ }
        Err(e) if attempt < 3 => { /* increment retry_count, backoff */ }
        Err(e) => { /* mark failed */ }
    }
}
```

### Fix C2 — Deposit/Withdraw Retry Logic

**File: `apps/backend/src/db/pg/migrations/` — new migration:**

```sql
-- Add retry tracking to deposits and withdrawals
ALTER TABLE deposits    ADD COLUMN retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE withdrawals ADD COLUMN retry_count INT NOT NULL DEFAULT 0;

-- Update get_pending to only retry if retry_count < 3
-- Worker will filter: WHERE status IN ('pending','failed') AND retry_count < 3
```

**File: `apps/backend/src/db/deposits.rs`** — Update queries:

```rust
// get_pending_deposits — include failed with retry_count < 3
pub async fn get_retryable_deposits(db: &PgPool) -> Result<Vec<Deposit>> {
    sqlx::query_as!(Deposit,
        "SELECT * FROM deposits WHERE status IN ('pending','failed') AND retry_count < 3
         ORDER BY created_at ASC LIMIT 50"
    ).fetch_all(db).await.map_err(Into::into)
}

// increment_retry
pub async fn increment_deposit_retry(db: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query!(
        "UPDATE deposits SET retry_count = retry_count + 1, status = 'pending' WHERE id = $1", id
    ).execute(db).await.map_err(Into::into).map(|_| ())
}
```

### Phase C Gate

```bash
cargo build --workspace && cargo test --workspace && cargo clippy --workspace
git commit -m "fix(phase-c): deposit worker per-user key + retry logic

- Deposit worker fetches user private key from Paxeer DB per-deposit (correct semantics)
- DEPOSIT_SIGNER_KEY env var no longer needed for deposits (still used for withdrawals)
- DB migration: retry_count column on deposits/withdrawals tables
- Worker retries up to 3 times before marking as permanently failed
- get_retryable_deposits() replaces get_pending_deposits()"
```

**Update memory:**
```js
await memory.store({ key: 'evoscan/fix-session/bug-status',
  value: { 'BUG-005-deposit-signer': { status: 'DONE' },
           'deposit-retry': { status: 'DONE' } } });

await orchestrator.remember('evoscan:backend-fixes-complete', {
  completedAt: new Date().toISOString(),
  fixesApplied: ['proxy-rate-limit','drip-gate','argus-key','cors-restrict',
                 'admin-role','deposit-signer','deposit-retry'],
  branch: 'agent/backend-fixes',
  readyForFrontend: true
});
```

---

## ═══════════════════════════════════════════════════
## STEP 7 — Merge Backend Fixes to Main
## ═══════════════════════════════════════════════════

```bash
git checkout main
git merge agent/backend-fixes --no-ff -m "merge: backend fixes (admin role, deposit worker, rate limiting, security hardening)"
git push
railway up --service Backend
```

**New env vars to set in Railway Backend service:**

| Variable | Value |
|----------|-------|
| `ADMIN_ADDRESSES` | Comma-separated wallet addresses for admin users |
| `ALLOWED_ORIGIN` | `https://frontend-production-xxx.up.railway.app` |
| `ARGUS_API_KEY` | A strong random key (required in production) |
| `RATE_LIMIT` | `true` |

---

## ═══════════════════════════════════════════════════
## STEP 8 — PHASE D: Frontend Redesign Requirements
## ═══════════════════════════════════════════════════

After backend fixes are merged and deployed, survey the existing frontend
then ask the user the following structured questions:

### 8A — Read Current Frontend

Read these files to understand the existing structure before asking questions:

```
apps/frontend/src/app/page.tsx
apps/frontend/src/app/layout.tsx
apps/frontend/src/components/MarketHeader.tsx
apps/frontend/src/components/trade-panel/TradePanel.tsx
apps/frontend/src/components/orderbook-panel/
apps/frontend/src/components/chart/
apps/frontend/src/components/bottom-panel/
apps/frontend/src/lib/store.ts
apps/frontend/src/lib/hooks/
apps/frontend/package.json
```

### 8B — Requirements Questions

Present the following questions and wait for user answers before creating any code:

```
════════════════════════════════════════════════
FRONTEND REDESIGN — REQUIREMENTS GATHERING
════════════════════════════════════════════════

I've reviewed the existing Next.js trading UI. Before redesigning,
I need your answers on the following:

1. LAYOUT
   Current: Single page — Chart | Orderbook | TradePanel stacked
   Options:
   a) Keep same layout, just restyle it (modern dark theme)
   b) Add sidebar navigation for multiple pages (Markets, Portfolio, History)
   c) Full redesign with new layout (describe your vision)
   → What layout do you want?

2. PAGES / ROUTES
   Current: Single route ("/")
   Options:
   a) Single page (current)
   b) Multi-page: / (trading) + /portfolio + /markets + /history
   c) Other
   → Which routes should exist?

3. DESIGN LANGUAGE
   Options:
   a) Dark mode (black/dark grey, neon accents — like Hyperliquid)
   b) Dark mode (deep navy/slate, gold/amber accents — premium feel)
   c) Dark mode (charcoal, cyan/purple gradient — crypto native)
   d) Custom (describe colors, fonts, vibe)
   → What visual style do you want?

4. COMPONENT LIBRARY
   Current: shadcn/ui + Tailwind
   Options:
   a) Keep shadcn/ui + Tailwind (recommended — already installed)
   b) Add Framer Motion for animations
   c) Other
   → Keep or change?

5. TRADING PANEL
   Current: Buy/Sell form with limit/market order types
   What to add or change:
   a) Add order book depth visualization (color bars)
   b) Add recent trades ticker (live scroll)
   c) Add PnL display for open positions
   d) Add leverage/margin controls (future feature placeholder)
   e) Keep as-is, just restyle
   → What changes?

6. MARKETS LIST
   Current: Dropdown selector in header
   Options:
   a) Dropdown (current)
   b) Left sidebar with scrollable market list + search
   c) Full /markets page with cards
   → How should market selection work?

7. BOTTOM PANEL
   Current: Tabs — Open Orders | Trade History | Balances
   Changes:
   a) Keep same tabs, restyle
   b) Add Deposit/Withdraw tab (currently modal only)
   c) Add PnL/Performance tab
   → What tabs do you need?

8. MOBILE
   a) Desktop only (no responsive work)
   b) Responsive (works on tablet/mobile)
   → Which?

9. AUTHENTICATION
   Current: Modal appears on Sign In click, email/password → Paxeer DB
   Changes:
   a) Keep modal approach
   b) Dedicated /login page
   c) Slide-in panel
   → Which?

10. ANYTHING ELSE
    Any specific components, integrations, animations, or features
    you want added that aren't listed above?
```

**Wait for user responses. Do not write any code until responses are received.**

---

## ═══════════════════════════════════════════════════
## STEP 9 — PHASE E: Frontend Redesign Implementation
## ═══════════════════════════════════════════════════

After user responds to requirements questions:

### 9A — Store Requirements to Memory

```js
// Store requirements immediately after user responds
await orchestrator.remember('evoscan:frontend-requirements', {
  gatheredAt: new Date().toISOString(),
  layout: '<user answer 1>',
  pages: '<user answer 2>',
  designLanguage: '<user answer 3>',
  components: '<user answer 4>',
  tradingPanel: '<user answer 5>',
  marketsList: '<user answer 6>',
  bottomPanel: '<user answer 7>',
  mobile: '<user answer 8>',
  auth: '<user answer 9>',
  extras: '<user answer 10>'
});

await memory.store({
  key: 'evoscan/frontend/requirements',
  value: { /* same as above */ }
});
```

### 9B — Generate Implementation Plan

Using the requirements, produce a detailed plan:

```
## FRONTEND REDESIGN PLAN

### New File Structure
apps/frontend/src/
├── app/
│   ├── layout.tsx          — Root layout (theme, providers, fonts)
│   ├── page.tsx            — Trading page (/)
│   ├── [routes if added]
│   └── globals.css         — CSS variables + animations
├── components/
│   ├── layout/             — Shell, Navbar, Sidebar
│   ├── trading/            — Orderbook, TradePanel, Chart, MarketsList
│   ├── portfolio/          — Balances, Orders, TradeHistory
│   ├── auth/               — LoginModal or LoginPage
│   ├── wallet/             — DepositWithdraw, TransactionHistory
│   └── ui/                 — shadcn primitives (existing)
├── lib/
│   ├── store.ts            — Zustand (existing + additions)
│   ├── hooks/              — (existing + new)
│   ├── theme.ts            — Color tokens, design system
│   └── api.ts              — (existing)

### Components to Create
| Component | Purpose | Replaces |
|-----------|---------|---------|
| [list based on user answers] | | |

### Components to Keep (restyle only)
| Component | Changes |
|-----------|---------|
| [list based on user answers] | |

### Dependencies to Add
| Package | Purpose |
|---------|---------|
| framer-motion (if chosen) | Animations |
| [others based on answers] | |

### Implementation Order
1. Theme system (CSS vars + tailwind config)
2. Layout shell (navbar, sidebar if needed)
3. Auth flow (login modal/page)
4. Trading page components
5. Portfolio/history panels
6. Deposit/withdraw flow
7. Responsive polish (if mobile required)

Proceed? (yes / adjust / cancel)
```

### 9C — Branch & Implement

```bash
git checkout -b agent/frontend-redesign
```

**For each component:**
1. Write the component
2. Wire it to existing hooks/store (no store changes unless necessary)
3. Keep all existing API calls intact — only UI changes
4. Build check after every 3-4 components: `cd apps/frontend && bun run build`

**Final gate:**
```bash
cd apps/frontend && bun run build 2>&1 | tail -20
git add -A
git commit -m "feat(frontend): complete redesign — [brief description of changes]"
git checkout main
git merge agent/frontend-redesign --no-ff -m "merge: frontend redesign"
git push
railway up --service Frontend
```

### 9D — Store Completion Memory

```js
await orchestrator.remember('evoscan:last-completed-work', {
  completedAt: new Date().toISOString(),
  backendFixes: ['admin-role','deposit-worker','rate-limiting','drip-gate','argus-key','cors'],
  frontendRedesign: {
    status: 'COMPLETE',
    branch: 'agent/frontend-redesign',
    newComponents: [ /* list */ ],
    removedComponents: [ /* list */ ]
  },
  deployedServices: ['Backend', 'Frontend'],
  nextUp: 'Ask user what to tackle next'
});

await memory.store({
  key: 'evoscan/fix-session/complete',
  value: {
    completedAt: new Date().toISOString(),
    allFixesApplied: true,
    frontendRedesigned: true
  }
});
```

---

## ═══════════════════════════════════════════════════
## WORKFLOW COMPLETE
## ═══════════════════════════════════════════════════

After all phases are done, present:

```
════════════════════════════════════════════════════════
EVOSCAN — ALL DONE
════════════════════════════════════════════════════════

✅ PHASE A: Rate limiting, drip gate, argus enforcement, CORS
✅ PHASE B: Admin role via ADMIN_ADDRESSES env var
✅ PHASE C: Deposit worker per-user key + retry logic
✅ PHASE D: Frontend requirements gathered
✅ PHASE E: Frontend redesigned and deployed

MEMORY WRITTEN:
  evoscan/fix-session/plan             ✅
  evoscan/fix-session/bug-status       ✅
  evoscan:fix-session (orchestrator)   ✅
  evoscan:backend-fixes-complete       ✅
  evoscan:frontend-requirements        ✅
  evoscan:last-completed-work          ✅
  evoscan/frontend/requirements        ✅
  evoscan/fix-session/complete         ✅

RAILWAY ENV VARS TO SET (if not already):
  Backend:
    ADMIN_ADDRESSES=<wallet addresses>
    ALLOWED_ORIGIN=<frontend URL>
    ARGUS_API_KEY=<strong key>
    RATE_LIMIT=true

What would you like to work on next?
════════════════════════════════════════════════════════
```