---
auto_execution_mode: 3
---
# Evoscan × Paxeer — Autonomous Agent Execution Workflow

## Agent Operating Rules (Read Before Every Task)

### Hard Constraints — Never Violate
1. **No destructive DB migrations without backup.** Before any `ALTER TABLE` or `DROP`, the agent must emit a backup command and wait for a success signal.
2. **No commits to `main`/`master` directly.** All changes go to a feature branch named `agent/<phase>-<task>` (e.g., `agent/phase1-b2-clickhouse-pin`). PRs are created but NOT merged automatically.
3. **No env var values in code or git.** Private keys, secrets, and URLs live in `.env` (gitignored) or Docker secrets only.
4. **No skipping unit tests.** Every modified or new file must have a corresponding test. The agent must run `cargo test` after every file change and fix failures before moving on.
5. **No proceeding to next phase if current phase tests are red.** The pipeline is sequential; a failing phase is a hard stop.
6. **No modifying matcher.rs, executor.rs (logic), BTreeMap structure, PostgreSQL core tables, ClickHouse aggregation, or the WebSocket system** — these are frozen per spec.
7. **Scope creep is forbidden.** The agent must only touch files listed in the proposal. If an unlisted file must change, log the reason and pause for human approval.
8. **Rate of change limit.** Max 3 files changed per atomic commit. Larger changes must be split.
9. **Rollback trigger.** If `cargo test` fails after 2 auto-fix attempts on the same file, the agent must revert that file, log the failure, and halt the phase.
10. **Secrets scan.** Before every commit, run `git diff --staged | grep -E "(private_key|password|secret|0x[0-9a-fA-F]{40})"` — abort commit if any hit.

---

## Pre-Flight Checklist (Run Once Before Phase 1)

```bash
# 1. Confirm clean working tree
git status  # must be clean

# 2. Confirm test suite baseline (record pass/fail counts)
cargo test --workspace 2>&1 | tee baseline_test_results.txt

# 3. Confirm all required env vars are documented (not set yet)
cat .env.example  # must list all vars from proposal

# 4. Create agent tracking log
touch agent_execution.log
echo "=== Agent Run Started: $(date) ===" >> agent_execution.log
```

---

## Phase 1 — Quick Wins (Low Risk)

**Branch:** `agent/phase1-quick-wins`

### Task B2 — Pin ClickHouse Version

**File:** `docker-compose.yaml:25`

**Action:**
```yaml
# BEFORE
image: clickhouse/clickhouse-server:latest
# AFTER
image: clickhouse/clickhouse-server:24.8-alpine
```

**Validation:**
```bash
docker-compose config | grep clickhouse  # must show pinned version
```

**Unit Test:** (infrastructure, no Rust test needed — add to CI smoke test)
```bash
# tests/infra/test_clickhouse_version.sh
VERSION=$(docker inspect clickhouse/clickhouse-server:24.8-alpine \
  --format '{{index .RepoTags 0}}' 2>/dev/null || echo "not_pulled")
[[ "$VERSION" == *"24.8"* ]] && echo "PASS" || echo "FAIL: wrong version"
```

---

### Task B5 — Fix unlock_balance() Stub

**File:** `apps/backend/src/db/balances.rs:199-207`

**Action:** Replace stub return with real `get_balance()` call post-UPDATE:
```rust
pub async fn unlock_balance(
    &self,
    user_address: &str,
    token_ticker: &str,
    amount: Decimal,
) -> Result<Balance> {
    sqlx::query!(
        "UPDATE balances SET locked = locked - $1
         WHERE user_address = $2 AND token_ticker = $3",
        amount, user_address, token_ticker
    )
    .execute(&self.pool)
    .await?;
    self.get_balance(user_address, token_ticker).await
}
```

**Unit Tests:** `apps/backend/src/db/tests/balances_test.rs`
```rust
#[sqlx::test]
async fn test_unlock_balance_returns_real_values(pool: PgPool) {
    let db = Database::new(pool);
    db.create_user("test_addr").await.unwrap();
    db.add_balance("test_addr", "USDC", dec!(100)).await.unwrap();
    db.lock_balance("test_addr", "USDC", dec!(40)).await.unwrap();
    let bal = db.unlock_balance("test_addr", "USDC", dec!(40)).await.unwrap();
    assert_eq!(bal.available, dec!(100));
    assert_eq!(bal.locked, dec!(0));
}

#[sqlx::test]
async fn test_unlock_balance_does_not_exceed_locked(pool: PgPool) {
    let db = Database::new(pool);
    db.create_user("addr2").await.unwrap();
    db.add_balance("addr2", "USDC", dec!(50)).await.unwrap();
    // Never locked — unlock should fail or return unchanged
    let result = db.unlock_balance("addr2", "USDC", dec!(10)).await;
    // Expect DB constraint error (locked would go negative)
    assert!(result.is_err());
}
```

---

### Task B6 — Fee Recipient Configurable

**Files:** `apps/backend/src/config.rs`, `apps/backend/src/engine/executor.rs`, `apps/backend/config.toml`

**Action — config.rs:**
```rust
#[derive(Deserialize, Clone)]
pub struct Config {
    // ... existing fields ...
    pub fee_recipient_address: String,
}
```

**Action — config.toml:**
```toml
fee_recipient_address = "system"  # override in prod with holding wallet address
```

**Action — executor.rs:** Replace `const FEE_RECIPIENT: &str = "system"` with `self.config.fee_recipient_address.as_str()`

**Unit Tests:** `apps/backend/src/engine/tests/executor_test.rs`
```rust
#[test]
fn test_fee_recipient_from_config() {
    let cfg = Config {
        fee_recipient_address: "0xHoldingWallet".to_string(),
        ..Config::default_test()
    };
    let executor = Executor::new(cfg);
    assert_eq!(executor.fee_recipient(), "0xHoldingWallet");
}

#[test]
fn test_fee_recipient_defaults_to_system() {
    let cfg = Config::default_test(); // fee_recipient = "system"
    let executor = Executor::new(cfg);
    assert_eq!(executor.fee_recipient(), "system");
}
```

---

### Task B7 — Private Key Security

**Files:** `.env.example`, `docker-compose.yaml`, `.dockerignore`, `apps/backend/src/main.rs`

**Action — .dockerignore:** Add `.env`

**Action — docker-compose.yaml:** Move private key to environment block (no hardcoded value):
```yaml
environment:
  - EVOSCAN_WALLET_PRIVATE_KEY=${EVOSCAN_WALLET_PRIVATE_KEY}
```

**Action — main.rs:** Add startup guard:
```rust
fn validate_env() {
    let is_prod = std::env::var("APP_ENV").unwrap_or_default() == "production";
    if is_prod {
        let key = std::env::var("EVOSCAN_WALLET_PRIVATE_KEY")
            .expect("FATAL: EVOSCAN_WALLET_PRIVATE_KEY must be set in production");
        assert!(!key.is_empty(), "FATAL: EVOSCAN_WALLET_PRIVATE_KEY is empty");
        
        let jwt = std::env::var("JWT_SECRET")
            .expect("FATAL: JWT_SECRET must be set in production");
        assert!(jwt.len() >= 32, "FATAL: JWT_SECRET must be at least 32 chars");
    }
}
// Call validate_env() at top of main()
```

**Unit Tests:**
```rust
#[test]
fn test_validate_env_passes_in_dev() {
    std::env::remove_var("APP_ENV"); // not "production"
    validate_env(); // should not panic
}

#[test]
#[should_panic(expected = "EVOSCAN_WALLET_PRIVATE_KEY")]
fn test_validate_env_panics_in_prod_without_key() {
    std::env::set_var("APP_ENV", "production");
    std::env::remove_var("EVOSCAN_WALLET_PRIVATE_KEY");
    validate_env();
}
```

---

### Task B9 — Remove Phantom hardhat.congif.js

**Action:**
```bash
# Check if file exists
[ -f hardhat.congif.js ] && git rm hardhat.congif.js || echo "Already absent"
# Check for stale git reference
git ls-files | grep hardhat
```

---

### Phase 1 Gate
```bash
cargo test --workspace
# MUST: all tests pass (>= baseline count from pre-flight)
# MUST: cargo clippy -- -D warnings produces no new warnings
git push origin agent/phase1-quick-wins
# Create PR — DO NOT MERGE, await human review signal
```

---

## Phase 2 — Engine Internals (Medium Risk)

**Branch:** `agent/phase2-engine`

### Task B4 — O(1) Order Lookup HashMap Index

**File:** `apps/backend/src/engine/orderbook.rs`

**Action — update struct:**
```rust
use std::collections::HashMap;

pub struct Orderbook {
    market_id: String,
    bids: BTreeMap<u128, VecDeque<Order>>,
    asks: BTreeMap<u128, VecDeque<Order>>,
    order_index: HashMap<Uuid, (u128, Side)>,  // NEW
}
```

**Action — maintain index in all mutating methods:**
- `add_order()`: insert `order_index.insert(order.id, (price, side))`
- `remove_order()`: lookup price+side from index, then remove from BTreeMap level; `order_index.remove(order_id)`
- `apply_trades()`: update index when orders are partially/fully filled
- `remove_all_user_orders()`: iterate user orders via index filter

**Unit Tests:** `apps/backend/src/engine/tests/orderbook_test.rs`
```rust
#[test]
fn test_order_index_populated_on_add() {
    let mut book = Orderbook::new("BTC/USDC");
    let order = make_test_order(Uuid::new_v4(), 50000_u128, Side::Bid, dec!(1));
    let id = order.id;
    book.add_order(order);
    assert!(book.order_index.contains_key(&id));
}

#[test]
fn test_remove_order_o1_lookup() {
    let mut book = Orderbook::new("BTC/USDC");
    // Add 1000 orders at different prices
    let ids: Vec<Uuid> = (0..1000).map(|i| {
        let o = make_test_order(Uuid::new_v4(), 40000_u128 + i, Side::Ask, dec!(1));
        let id = o.id;
        book.add_order(o);
        id
    }).collect();
    // Remove middle order — must succeed without linear scan
    let target = ids[500];
    book.remove_order(target);
    assert!(!book.order_index.contains_key(&target));
    assert_eq!(book.ask_depth(), 999);
}

#[test]
fn test_index_cleared_after_full_fill() {
    let mut book = Orderbook::new("ETH/USDC");
    let bid = make_test_order(Uuid::new_v4(), 3000_u128, Side::Bid, dec!(1));
    let ask = make_test_order(Uuid::new_v4(), 3000_u128, Side::Ask, dec!(1));
    let bid_id = bid.id;
    let ask_id = ask.id;
    book.add_order(bid);
    book.add_order(ask);
    book.apply_trades(); // should fully match and remove both
    assert!(!book.order_index.contains_key(&bid_id));
    assert!(!book.order_index.contains_key(&ask_id));
}

#[test]
fn test_remove_all_user_orders_clears_index() {
    let mut book = Orderbook::new("SOL/USDC");
    let user = "alice";
    for i in 0..10 {
        book.add_order(make_user_order(user, 100_u128 + i, Side::Bid));
    }
    book.remove_all_user_orders(user);
    let remaining: Vec<_> = book.order_index.values()
        .filter(|_| true).collect(); // all should be gone for user
    assert_eq!(book.bid_depth(), 0);
}
```

---

### Task B8 — Orderbook Persistence / WAL Replay

**File:** `apps/backend/src/engine/mod.rs`

**Action — add restore function:**
```rust
pub async fn restore_orderbooks(&mut self, db: &Database) -> Result<()> {
    let open_orders = db.get_open_orders_all_markets().await?;
    for order in open_orders {
        if let Some(engine) = self.market_engines.get_mut(&order.market_id) {
            engine.orderbook.add_order(order.into());
        }
    }
    tracing::info!("Restored {} open orders from DB", open_orders.len());
    Ok(())
}
```

**New DB query:** `apps/backend/src/db/orders.rs`
```rust
pub async fn get_open_orders_all_markets(&self) -> Result<Vec<DbOrder>> {
    sqlx::query_as!(DbOrder,
        "SELECT * FROM orders WHERE status IN ('pending', 'partially_filled')"
    )
    .fetch_all(&self.pool)
    .await
    .map_err(Into::into)
}
```

**Unit Tests:**
```rust
#[sqlx::test]
async fn test_restore_orderbooks_repopulates_engine(pool: PgPool) {
    let db = Database::new(pool.clone());
    // Seed a pending order directly in DB
    db.create_order(&make_db_order("BTC/USDC", "pending")).await.unwrap();
    
    let mut engine = MatchingEngine::new_empty();
    engine.restore_orderbooks(&db).await.unwrap();
    
    assert_eq!(engine.orderbook_depth("BTC/USDC"), 1);
}

#[sqlx::test]
async fn test_restore_skips_filled_orders(pool: PgPool) {
    let db = Database::new(pool);
    db.create_order(&make_db_order("ETH/USDC", "filled")).await.unwrap();
    
    let mut engine = MatchingEngine::new_empty();
    engine.restore_orderbooks(&db).await.unwrap();
    assert_eq!(engine.orderbook_depth("ETH/USDC"), 0);
}

#[sqlx::test]
async fn test_restore_is_idempotent(pool: PgPool) {
    let db = Database::new(pool);
    db.create_order(&make_db_order("SOL/USDC", "pending")).await.unwrap();
    
    let mut engine = MatchingEngine::new_empty();
    engine.restore_orderbooks(&db).await.unwrap();
    engine.restore_orderbooks(&db).await.unwrap(); // second call
    // Should not double-insert
    assert_eq!(engine.orderbook_depth("SOL/USDC"), 1);
}
```

---

### Phase 2 Gate
```bash
cargo test --workspace
cargo clippy -- -D warnings
# All pass → push branch → create PR
```

---

## Phase 3 — Auth System Overhaul (Medium Risk)

**Branch:** `agent/phase3-auth`

**Cargo.toml additions:**
```toml
jsonwebtoken = "9"
argon2 = "0.5"   # or bcrypt = "0.15" — match DB 3's hash algo
```

### Task A1 — Paxeer Auth Integration

#### Step 3.1 — AppState + Paxeer DB Pool

**File:** `apps/backend/src/lib.rs`
```rust
pub struct AppState {
    // ... existing ...
    pub paxeer_db: PgPool,  // NEW — read-only
}
```

**File:** `apps/backend/src/db/mod.rs` — add `paxeer_pg.rs` module:
```rust
pub async fn connect_paxeer(url: &str) -> Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(5)
        .connect(url)
        .await
        .map_err(Into::into)
}
```

#### Step 3.2 — JWT Middleware

**File:** `apps/backend/src/api/middleware/auth.rs`
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,          // user_address from Paxeer DB
    pub email: String,
    pub role: String,         // "user" | "admin"
    pub exp: usize,
}

pub async fn jwt_middleware<B>(
    State(state): State<AppState>,
    mut req: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let token = req.headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    let secret = std::env::var("JWT_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let decoded = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default())
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    req.extensions_mut().insert(decoded.claims);
    Ok(next.run(req).await)
}
```

#### Step 3.3 — Auth Endpoints

**File:** `apps/backend/src/api/rest/auth.rs`
```rust
// POST /api/auth/login
pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // 1. Query Paxeer DB 3
    let user = sqlx::query!(
        "SELECT id, email, password_hash, wallet_address, role
         FROM users WHERE email = $1",
        body.email
    )
    .fetch_optional(&state.paxeer_db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // 2. Verify password hash
    let valid = verify_password(&body.password, &user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !valid { return Err(StatusCode::UNAUTHORIZED); }
    
    // 3. Issue JWT
    let claims = Claims {
        sub: user.wallet_address.clone(),
        email: user.email.clone(),
        role: user.role.unwrap_or("user".to_string()),
        exp: (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
    };
    let secret = std::env::var("JWT_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let token = encode(&Header::default(), &claims,
        &EncodingKey::from_secret(secret.as_bytes()))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // 4. Ensure user exists in evoscan DB (upsert)
    state.db.upsert_user(&user.wallet_address).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(LoginResponse { token, wallet_address: user.wallet_address }))
}

// POST /api/auth/session
pub async fn session(
    Extension(claims): Extension<Claims>,
) -> Json<SessionResponse> {
    Json(SessionResponse {
        user_address: claims.sub,
        email: claims.email,
        role: claims.role,
    })
}
```

#### Step 3.4 — Update Trade/User/Drip Handlers

**Files:** `trade.rs`, `user.rs`, `drip.rs`

For each: Remove `user_address` from request body; extract from JWT claims:
```rust
// BEFORE
pub async fn place_order(Json(body): Json<TradeRequest>) -> ... {
    let user_address = &body.user_address;

// AFTER
pub async fn place_order(
    Extension(claims): Extension<Claims>,
    Json(body): Json<TradeRequest>,
) -> ... {
    let user_address = &claims.sub;
```

Remove `signature` field from `TradeRequest`, `DripRequest`, `AdminRequest` models.

#### Step 3.5 — B1: Admin Protection

**File:** `apps/backend/src/api/rest/admin.rs`
```rust
pub async fn admin_handler(
    Extension(claims): Extension<Claims>,
    // ...
) -> Result<...> {
    if claims.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    // ... existing handler logic
}
```

### Task B3 — Rate Limiting

**Cargo.toml:** `tower-governor = "0.3"`

**File:** `apps/backend/src/api/rest/mod.rs`
```rust
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};

// Per-user trade limit: 50 req/s
let trade_governor = GovernorConfigBuilder::default()
    .per_second(50).burst_size(50).finish().unwrap();

// Login limit: 5 req/min per IP
let login_governor = GovernorConfigBuilder::default()
    .per_minute(5).burst_size(5).finish().unwrap();

// Routes
Router::new()
    .route("/api/trade", post(trade_handler))
        .layer(GovernorLayer { config: Arc::new(trade_governor) })
    .route("/api/auth/login", post(login))
        .layer(GovernorLayer { config: Arc::new(login_governor) })
```

### Phase 3 Unit Tests

**File:** `apps/backend/src/api/tests/auth_test.rs`
```rust
#[tokio::test]
async fn test_login_returns_jwt_on_valid_credentials() {
    let app = test_app_with_paxeer_mock().await;
    let resp = app.post("/api/auth/login")
        .json(&json!({"email": "user@test.com", "password": "correct"}))
        .await;
    assert_eq!(resp.status(), 200);
    let body: LoginResponse = resp.json().await;
    assert!(!body.token.is_empty());
}

#[tokio::test]
async fn test_login_rejects_wrong_password() {
    let app = test_app_with_paxeer_mock().await;
    let resp = app.post("/api/auth/login")
        .json(&json!({"email": "user@test.com", "password": "wrong"}))
        .await;
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_trade_requires_valid_jwt() {
    let app = test_app().await;
    let resp = app.post("/api/trade")
        .json(&json!({"market_id": "BTC/USDC", "side": "bid", "price": "50000", "size": "1"}))
        .await; // no Authorization header
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_admin_endpoint_rejects_user_role() {
    let app = test_app().await;
    let user_token = mint_test_jwt("user_addr", "user");
    let resp = app.post("/api/admin")
        .bearer_auth(user_token)
        .json(&json!({"action": "create_token"}))
        .await;
    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn test_admin_endpoint_accepts_admin_role() {
    let app = test_app().await;
    let admin_token = mint_test_jwt("admin_addr", "admin");
    let resp = app.post("/api/admin")
        .bearer_auth(admin_token)
        .json(&json!({"action": "list_markets"}))
        .await;
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn test_jwt_middleware_rejects_expired_token() {
    let expired = mint_expired_jwt("addr");
    let app = test_app().await;
    let resp = app.post("/api/trade")
        .bearer_auth(expired)
        .json(&json!({}))
        .await;
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_session_returns_user_info() {
    let app = test_app().await;
    let token = mint_test_jwt("0xWallet123", "user");
    let resp = app.post("/api/auth/session")
        .bearer_auth(token).await;
    let body: SessionResponse = resp.json().await;
    assert_eq!(body.user_address, "0xWallet123");
}
```

### Phase 3 Gate
```bash
cargo test --workspace
cargo clippy -- -D warnings
# Secrets scan
git diff --staged | grep -iE "(private_key|password_hash|secret)" && exit 1 || echo "Clean"
```

---

## Phase 4 — Per-Market Engine Concurrency (High Risk)

**Branch:** `agent/phase4-concurrency`

> ⚠️ This phase modifies core architecture. Triple-check tests before proceeding.

### Task C1 — Per-Market Matching Engine

**File:** `apps/backend/src/engine/mod.rs`

**Action — New structures:**
```rust
pub struct MarketEngine {
    pub market_id: String,
    pub orderbook: Orderbook,
    pub engine_rx: mpsc::Receiver<EngineRequest>,
}

pub struct EngineRouter {
    senders: HashMap<String, mpsc::Sender<EngineRequest>>,
}

impl EngineRouter {
    pub async fn send(&self, market_id: &str, req: EngineRequest) -> Result<()> {
        self.senders
            .get(market_id)
            .ok_or_else(|| anyhow!("Unknown market: {}", market_id))?
            .send(req).await
            .map_err(Into::into)
    }
}
```

**File:** `apps/backend/src/main.rs`

```rust
// Spawn one engine per market
let mut router_senders = HashMap::new();
for market in &config.markets {
    let (tx, rx) = mpsc::channel::<EngineRequest>(10_000); // was 100
    let engine = MarketEngine::new(market.id.clone(), rx);
    tokio::spawn(engine.run(db.clone(), ws_tx.clone()));
    router_senders.insert(market.id.clone(), tx);
}
let engine_router = EngineRouter { senders: router_senders };
```

**File:** `apps/backend/src/lib.rs`
```rust
// BEFORE: engine_tx: mpsc::Sender<EngineRequest>
// AFTER:
pub engine_router: EngineRouter,
```

**File:** `apps/backend/src/api/rest/trade.rs`
```rust
// BEFORE: state.engine_tx.send(req).await
// AFTER:
state.engine_router.send(&body.market_id, req).await
    .map_err(|_| StatusCode::BAD_REQUEST)?;
```

**Unit Tests:** `apps/backend/src/engine/tests/router_test.rs`
```rust
#[tokio::test]
async fn test_router_dispatches_to_correct_market() {
    let (btc_tx, mut btc_rx) = mpsc::channel(10);
    let (eth_tx, mut eth_rx) = mpsc::channel(10);
    let router = EngineRouter {
        senders: [
            ("BTC/USDC".to_string(), btc_tx),
            ("ETH/USDC".to_string(), eth_tx),
        ].into()
    };
    let req = make_test_request("BTC/USDC");
    router.send("BTC/USDC", req.clone()).await.unwrap();
    assert!(btc_rx.try_recv().is_ok());
    assert!(eth_rx.try_recv().is_err()); // eth untouched
}

#[tokio::test]
async fn test_router_returns_error_for_unknown_market() {
    let router = EngineRouter { senders: HashMap::new() };
    let result = router.send("UNKNOWN/USDC", make_test_request("X")).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_btc_trades_do_not_block_eth_engine() {
    // Saturate BTC channel
    let (btc_tx, _btc_rx) = mpsc::channel(1); // tiny buffer
    let (eth_tx, mut eth_rx) = mpsc::channel(100);
    let router = EngineRouter {
        senders: [
            ("BTC/USDC".to_string(), btc_tx),
            ("ETH/USDC".to_string(), eth_tx),
        ].into()
    };
    // Fill BTC channel (don't await)
    let _ = router.senders["BTC/USDC"].try_send(make_test_request("BTC/USDC"));
    let _ = router.senders["BTC/USDC"].try_send(make_test_request("BTC/USDC")); // this fills it
    
    // ETH should still work
    router.send("ETH/USDC", make_test_request("ETH/USDC")).await.unwrap();
    assert!(eth_rx.try_recv().is_ok());
}

#[tokio::test]
async fn test_channel_capacity_is_ten_thousand() {
    let (tx, _rx) = mpsc::channel::<EngineRequest>(10_000);
    // Fill to capacity - 1
    for _ in 0..9_999 {
        tx.try_send(make_test_request("BTC/USDC")).unwrap();
    }
    // One more should succeed
    assert!(tx.try_send(make_test_request("BTC/USDC")).is_ok());
    // Over capacity should fail
    assert!(tx.try_send(make_test_request("BTC/USDC")).is_err());
}
```

### Phase 4 Gate
```bash
cargo test --workspace
# Run concurrency stress test
cargo test --test concurrency_stress -- --test-threads=1
cargo clippy -- -D warnings
```

---

## Phase 5 — 50-Pair Config Generalization (Medium Risk)

**Branch:** `agent/phase5-50-pairs`

### Task C2 — Bot Framework Generalization

**File:** `apps/bots/src/config.rs`
```rust
#[derive(Deserialize)]
pub struct BotConfig {
    pub exchange: ExchangeConfig,
    pub markets: HashMap<String, MarketBotConfig>,
}

#[derive(Deserialize)]
pub struct MarketBotConfig {
    pub enabled: bool,
    pub base_ticker: String,
    pub quote_ticker: String,
    pub hyperliquid_mirror: Option<HyperliquidMirrorConfig>,
}
```

**File:** `apps/bots/src/main.rs` — replace hardcoded market loop:
```rust
for (market_key, market_cfg) in &config.markets {
    if !market_cfg.enabled { continue; }
    if let Some(hl_cfg) = &market_cfg.hyperliquid_mirror {
        if hl_cfg.enabled {
            tokio::spawn(run_hl_mirror(market_key.clone(), hl_cfg.clone(), ...));
        }
    }
}
```

**Hyperliquid Multiplexer** — `apps/bots/src/markets/hyperliquid/multiplexer.rs`:
```rust
pub struct HyperliquidMultiplexer {
    subscribers: HashMap<String, Vec<mpsc::Sender<HlUpdate>>>,
}
// Opens 1 WS, demultiplexes to per-market channels
```

**Unit Tests:** `apps/bots/src/tests/config_test.rs`
```rust
#[test]
fn test_config_parses_multiple_markets() {
    let toml = r#"
[exchange]
url = "http://localhost:8888"
[markets.btc_usdc]
enabled = true
base_ticker = "BTC"
quote_ticker = "USDC"
[markets.btc_usdc.hyperliquid_mirror]
enabled = true
hl_coin = "BTC"
depth_levels = 15
update_interval_ms = 2000
[markets.eth_usdc]
enabled = false
base_ticker = "ETH"
quote_ticker = "USDC"
"#;
    let cfg: BotConfig = toml::from_str(toml).unwrap();
    assert_eq!(cfg.markets.len(), 2);
    assert!(cfg.markets["btc_usdc"].enabled);
    assert!(!cfg.markets["eth_usdc"].enabled);
    assert!(cfg.markets["btc_usdc"].hyperliquid_mirror.is_some());
}

#[test]
fn test_disabled_markets_are_skipped() {
    let cfg = load_test_config_with_disabled_markets();
    let active: Vec<_> = cfg.markets.values().filter(|m| m.enabled).collect();
    assert_eq!(active.len(), 1); // only BTC enabled
}

#[test]
fn test_multiplexer_routes_to_correct_market_channel() {
    let mut mux = HyperliquidMultiplexer::new();
    let (btc_tx, mut btc_rx) = mpsc::channel(10);
    mux.subscribe("BTC", btc_tx);
    mux.dispatch(HlUpdate { coin: "BTC".to_string(), data: mock_data() });
    assert!(btc_rx.try_recv().is_ok());
}
```

### Task C3 — Backend Config Generalization

**Validation:** Confirm `config.rs` already uses `Vec<TokenConfig>` and `Vec<MarketConfig>`. If so, this is a config.toml data change only — add all 50 markets. No structural code change.

**Unit Tests:**
```rust
#[test]
fn test_config_loads_50_markets() {
    let cfg = Config::load_from_file("config.toml").unwrap();
    assert!(cfg.markets.len() >= 50);
    // Every market has a valid base and quote ticker
    for m in &cfg.markets {
        assert!(!m.base_ticker.is_empty());
        assert_eq!(m.quote_ticker, "USDC");
    }
}

#[test]
fn test_all_market_tickers_have_token_definitions() {
    let cfg = Config::load_from_file("config.toml").unwrap();
    let tickers: HashSet<_> = cfg.tokens.iter().map(|t| &t.ticker).collect();
    for m in &cfg.markets {
        assert!(tickers.contains(&m.base_ticker),
            "Missing token definition for {}", m.base_ticker);
    }
}
```

### Phase 5 Gate
```bash
cargo test --workspace
cd apps/bots && cargo test
```

---

## Phase 6 — On-Chain Deposit/Withdraw (High Risk)

**Branch:** `agent/phase6-onchain`

> ⚠️ Highest risk phase. All on-chain interactions must use mock RPC in tests.

**Cargo.toml:** `alloy = { version = "0.1", features = ["providers", "signers"] }`

### New DB Migration

```sql
-- migrations/YYYYMMDDHHMMSS_deposits_withdrawals.sql
CREATE TYPE deposit_status AS ENUM ('pending', 'confirming', 'confirmed', 'failed');
CREATE TYPE withdraw_status AS ENUM ('pending', 'processing', 'confirmed', 'failed');

CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address TEXT NOT NULL REFERENCES users(address),
    amount NUMERIC NOT NULL,
    tx_hash TEXT,
    status deposit_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address TEXT NOT NULL REFERENCES users(address),
    amount NUMERIC NOT NULL,
    tx_hash TEXT,
    status withdraw_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_deposits_user ON deposits(user_address);
CREATE INDEX idx_withdrawals_user ON withdrawals(user_address);
```

### Chain Client

**File:** `apps/backend/src/chain/mod.rs`
```rust
pub struct PaxeerChainClient {
    provider: Arc<Provider>,
    usdl_address: Address,
}

impl PaxeerChainClient {
    pub async fn transfer_usdl(
        &self,
        from_key: &str,
        to: Address,
        amount: U256,
    ) -> Result<TxHash> { ... }
    
    pub async fn wait_for_confirmation(&self, tx_hash: TxHash) -> Result<TxReceipt> { ... }
}
```

### Deposit Endpoint + Worker

**File:** `apps/backend/src/api/rest/deposit.rs`
```rust
pub async fn request_deposit(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(body): Json<DepositRequest>,
) -> Result<Json<DepositResponse>, StatusCode> {
    // Validate amount > 0
    // Create pending deposit record
    // Signal worker via channel
    // Return deposit ID for polling
}
```

**File:** `apps/backend/src/workers/deposit_worker.rs`
```rust
pub async fn run(db: Database, chain: PaxeerChainClient, paxeer_db: PgPool) {
    loop {
        let pending = db.get_pending_deposits().await.unwrap();
        for deposit in pending {
            // 1. Fetch encrypted private key from Paxeer DB
            // 2. Decrypt key using ENCRYPTION_KEY env var
            // 3. Submit USDL.transfer(holding_wallet, amount) signed by user key
            // 4. On success: update status, add_balance
            // 5. On failure: update status to 'failed'
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}
```

### Unit Tests (Mock RPC)

**File:** `apps/backend/src/chain/tests/chain_test.rs`
```rust
// Use mockall or a mock provider
#[tokio::test]
async fn test_deposit_flow_on_success() {
    let mut mock_chain = MockPaxeerChainClient::new();
    mock_chain.expect_transfer_usdl()
        .returning(|_, _, _| Ok(TxHash::from([1u8; 32])));
    mock_chain.expect_wait_for_confirmation()
        .returning(|_| Ok(mock_receipt(true)));
    
    let db = in_memory_test_db().await;
    let deposit = db.create_deposit("0xUser", dec!(100)).await.unwrap();
    
    process_deposit(&db, &mock_chain, &deposit).await.unwrap();
    
    let bal = db.get_balance("0xUser", "USDL").await.unwrap();
    assert_eq!(bal.available, dec!(100));
    
    let updated = db.get_deposit(deposit.id).await.unwrap();
    assert_eq!(updated.status, DepositStatus::Confirmed);
}

#[tokio::test]
async fn test_deposit_flow_on_chain_failure() {
    let mut mock_chain = MockPaxeerChainClient::new();
    mock_chain.expect_transfer_usdl()
        .returning(|_, _, _| Err(anyhow!("RPC error")));
    
    let db = in_memory_test_db().await;
    let deposit = db.create_deposit("0xUser", dec!(50)).await.unwrap();
    
    let result = process_deposit(&db, &mock_chain, &deposit).await;
    assert!(result.is_err());
    
    let bal = db.get_balance("0xUser", "USDL").await.unwrap();
    assert_eq!(bal.available, dec!(0)); // no balance credited
    
    let updated = db.get_deposit(deposit.id).await.unwrap();
    assert_eq!(updated.status, DepositStatus::Failed);
}

#[tokio::test]
async fn test_withdraw_rollback_on_chain_failure() {
    let mut mock_chain = MockPaxeerChainClient::new();
    mock_chain.expect_transfer_usdl()
        .returning(|_, _, _| Err(anyhow!("network error")));
    
    let db = in_memory_test_db().await;
    db.add_balance("0xUser", "USDL", dec!(200)).await.unwrap();
    
    let withdrawal = db.create_withdrawal("0xUser", dec!(100)).await.unwrap();
    // Balance deducted before tx
    assert_eq!(db.get_balance("0xUser", "USDL").await.unwrap().available, dec!(100));
    
    let result = process_withdrawal(&db, &mock_chain, &withdrawal).await;
    assert!(result.is_err());
    
    // Balance restored on failure
    let bal = db.get_balance("0xUser", "USDL").await.unwrap();
    assert_eq!(bal.available, dec!(200));
}

#[tokio::test]
async fn test_withdraw_requires_sufficient_balance() {
    let app = test_app().await;
    let token = mint_test_jwt("poor_user", "user");
    // poor_user has 0 balance
    let resp = app.post("/api/withdraw")
        .bearer_auth(token)
        .json(&json!({"amount": "500"}))
        .await;
    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn test_drip_disabled_in_production() {
    std::env::set_var("APP_ENV", "production");
    let app = test_app().await;
    let token = mint_test_jwt("user", "user");
    let resp = app.post("/api/drip").bearer_auth(token).await;
    assert_eq!(resp.status(), 404); // disabled in prod
    std::env::remove_var("APP_ENV");
}
```

### Phase 6 Gate
```bash
cargo test --workspace
# Ensure no real RPC calls are made in tests
grep -r "PAXEER_RPC_URL" apps/backend/src --include="*.rs" | grep -v "env::var\|config\|test" && echo "WARN: hardcoded RPC URL" || echo "Clean"
```

---

## Phase 7 — Argus Feed API + Data Pipeline (Additive)

**Branch:** `agent/phase7-argus`

### Task A3 — Argus Feed Endpoints

**File:** `apps/backend/src/api/rest/argus.rs`

**Auth middleware:** Check `X-Argus-API-Key` header against `ARGUS_API_KEY` env var.

**Endpoints:**
```rust
pub fn argus_routes() -> Router<AppState> {
    Router::new()
        .route("/api/argus/user/:address/summary", get(user_summary))
        .route("/api/argus/user/:address/trades", get(user_trades))
        .route("/api/argus/user/:address/positions", get(user_positions))
        .route("/api/argus/user/:address/deposits", get(user_deposits))
        .route("/api/argus/global/stats", get(global_stats))
        .route("/api/argus/global/leaderboard", get(leaderboard))
        .layer(from_fn_with_state(state, argus_api_key_middleware))
}
```

### ClickHouse Materialized Views

**Migration file:** `migrations/clickhouse/user_pnl_summary.sql`
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS user_pnl_summary
ENGINE = AggregatingMergeTree() ORDER BY (user_address)
AS SELECT
    user_address,
    countState() AS trade_count,
    sumState(volume_usd) AS total_volume,
    sumState(pnl_usd) AS total_pnl
FROM trades_raw
GROUP BY user_address;
```

### Unit Tests

```rust
#[tokio::test]
async fn test_argus_endpoint_rejects_missing_api_key() {
    let app = test_app().await;
    let resp = app.get("/api/argus/user/0xAddr/summary").await;
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_argus_endpoint_rejects_wrong_api_key() {
    let app = test_app().await;
    let resp = app.get("/api/argus/user/0xAddr/summary")
        .header("X-Argus-API-Key", "wrong_key")
        .await;
    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn test_argus_user_summary_returns_correct_structure() {
    let app = test_app().await;
    let key = std::env::var("ARGUS_API_KEY").unwrap_or("test_key".to_string());
    let resp = app.get("/api/argus/user/0xAddr/summary")
        .header("X-Argus-API-Key", key)
        .await;
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await;
    assert!(body.get("total_trades").is_some());
    assert!(body.get("total_volume").is_some());
    assert!(body.get("pnl").is_some());
    assert!(body.get("open_positions").is_some());
}

#[tokio::test]
async fn test_argus_leaderboard_returns_sorted_list() {
    let app = test_app_with_trade_history().await;
    let key = "test_key";
    let resp = app.get("/api/argus/global/leaderboard")
        .header("X-Argus-API-Key", key)
        .await;
    let body: Vec<LeaderboardEntry> = resp.json().await;
    // Verify sorted descending by PnL
    for i in 0..body.len().saturating_sub(1) {
        assert!(body[i].pnl >= body[i+1].pnl);
    }
}

#[tokio::test]
async fn test_argus_jwt_cannot_access_argus_routes() {
    // Argus routes must NOT accept user JWTs — different auth
    let app = test_app().await;
    let token = mint_test_jwt("user", "admin"); // even admin JWT
    let resp = app.get("/api/argus/global/stats")
        .bearer_auth(token)
        .await;
    assert_eq!(resp.status(), 401); // only API key works
}
```

### Phase 7 Gate
```bash
cargo test --workspace
cargo clippy -- -D warnings
echo "=== All Phases Complete ===" >> agent_execution.log
echo "Completed: $(date)" >> agent_execution.log
```

---

## Final Integration Test Suite

**File:** `tests/integration/full_flow_test.rs`

```rust
/// Full happy-path: login → deposit → trade → withdraw
#[tokio::test]
async fn test_full_user_lifecycle() {
    let app = test_app_full().await;
    
    // 1. Login
    let login_resp = app.post("/api/auth/login")
        .json(&json!({"email": "trader@test.com", "password": "correct"}))
        .await;
    assert_eq!(login_resp.status(), 200);
    let token: String = login_resp.json::<LoginResponse>().await.token;
    
    // 2. Deposit (mock chain)
    let deposit_resp = app.post("/api/deposit")
        .bearer_auth(&token)
        .json(&json!({"amount": "1000"}))
        .await;
    assert_eq!(deposit_resp.status(), 202);
    
    // 3. Wait for worker to process (test uses synchronous mock)
    tokio::time::sleep(Duration::from_millis(100)).await;
    
    // 4. Check balance
    let balance_resp = app.get("/api/user/balance")
        .bearer_auth(&token).await;
    let bal: BalanceResponse = balance_resp.json().await;
    assert_eq!(bal.available_usdl, dec!(1000));
    
    // 5. Place order
    let trade_resp = app.post("/api/trade")
        .bearer_auth(&token)
        .json(&json!({"market_id": "BTC/USDC", "side": "bid", "price": "50000", "size": "0.01"}))
        .await;
    assert_eq!(trade_resp.status(), 200);
    
    // 6. Withdraw
    let withdraw_resp = app.post("/api/withdraw")
        .bearer_auth(&token)
        .json(&json!({"amount": "500"}))
        .await;
    assert_eq!(withdraw_resp.status(), 202);
}

/// Orderbook survives engine restart
#[tokio::test]
async fn test_orderbook_survives_restart() {
    let (app, db) = test_app_with_db().await;
    let token = mint_test_jwt("survivor", "user");
    
    app.post("/api/trade")
        .bearer_auth(&token)
        .json(&json!({"market_id": "ETH/USDC", "side": "ask", "price": "3000", "size": "1"}))
        .await;
    
    // Simulate restart — rebuild engine from DB
    let new_engine = MatchingEngine::new_empty();
    new_engine.restore_orderbooks(&db).await.unwrap();
    assert_eq!(new_engine.orderbook_depth("ETH/USDC"), 1);
}
```

---

## Agent Execution Log Template

```
agent_execution.log
═══════════════════════════════════════
[PHASE 1] Started: <timestamp>
  [B2] ClickHouse pin: PASS
  [B5] unlock_balance fix: PASS
  [B6] Fee config: PASS
  [B7] Private key security: PASS
  [B9] Phantom file removal: PASS
  Tests: 12/12 PASS
  Branch pushed: agent/phase1-quick-wins
  PR created: #<n>
[PHASE 1] Completed: <timestamp>
─────────────────────────────────────
[PHASE 2] Started: <timestamp>
  ...
```

---

## Summary — What the Agent Must Never Do

| Rule | Consequence of Violation |
|------|--------------------------|
| Commit to main directly | Hard stop — revert |
| Put secrets in code | Hard stop — revert, scan |
| Skip tests on modified file | Hard stop |
| Touch frozen files (matcher, executor logic) | Hard stop |
| Proceed with red tests | Hard stop |
| Change > 3 files per commit | Split commits |
| Make real RPC calls in tests | Test must use mock |
| Auto-merge PRs | Human approval required |