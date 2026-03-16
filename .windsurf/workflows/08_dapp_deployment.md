---
name: "Stage 08 — DApp Deployment"
description: >
  Build and deploy the frontend to a static host, and deploy the backend (if
  present) to a process manager or container, making the DApp publicly
  accessible.
triggers:
  - manual
  - workflow: 00_master_orchestrator
---

# Stage 08 — DApp Deployment

## Objective
Produce production builds of the frontend and backend, deploy them to the
target environment, and confirm the live deployment is reachable and
fully functional.

---

## Step 1 · Pre-Deployment Checklist

Before building:

- [ ] All Stage 07 integration tests pass
- [ ] `workspace_state.json` shows `07_integration_testing: "complete"`
- [ ] `.env.production` (or equivalent) is populated with production RPC URL
      and contract addresses
- [ ] ABI files in `frontend/src/contracts/abis/` match the deployed contracts
- [ ] No `console.log` debug statements left in production code paths

```bash
# Quick sanity check — no hardcoded local addresses in frontend src
grep -r "127.0.0.1\|localhost" frontend/src/ \
  && echo "⚠️  WARNING: localhost references found in frontend source" \
  || echo "✅ No localhost refs in frontend source"
```

---

## Step 2 · Frontend Production Build

```bash
cd frontend

# Write production env
cat > .env.production << EOF
VITE_TOKEN_ADDRESS=${TOKEN_ADDRESS}
VITE_CHAIN_ID=${CHAIN_ID}
VITE_RPC_URL=${PROD_RPC_URL}
VITE_BACKEND_URL=${BACKEND_URL}
EOF

# Build
npm run build 2>&1 | tee ../logs/frontend_build.log

# Confirm dist was created
ls -lh dist/index.html && echo "✅ Frontend build succeeded" \
  || (echo "❌ Frontend build failed" && exit 1)

cd ..
```

---

## Step 3 · Frontend Deployment Options

The agent must choose the deployment target based on what is available in the
workspace. Evaluate in this priority order:

### Option A · Vercel (preferred for Next.js / Vite)

```bash
# Only if vercel CLI is installed in workspace
which vercel > /dev/null 2>&1 && \
  vercel --prod --cwd frontend --yes 2>&1 | tee logs/vercel_deploy.log
```

Extract the deployed URL from the output and record it.

### Option B · Netlify

```bash
which netlify > /dev/null 2>&1 && \
  netlify deploy --prod --dir frontend/dist 2>&1 | tee logs/netlify_deploy.log
```

### Option C · Local Static Server (dev / no external service)

```bash
# Serve the production build locally using a workspace-scoped server
cd frontend
npx serve dist -p 4173 > ../logs/static_serve.log 2>&1 &
SERVE_PID=$!
echo "Static server PID: $SERVE_PID"

# Append to workspace_pids.json
node -e "
  const f = '../workspace_pids.json';
  const d = require(f);
  d.static_serve = $SERVE_PID;
  require('fs').writeFileSync(f, JSON.stringify(d, null, 2));
"
cd ..

FRONTEND_PROD_URL="http://localhost:4173"
```

---

## Step 4 · Backend Deployment Options

If a backend is present:

### Option A · PM2 (preferred for long-running Node.js services)

```bash
which pm2 > /dev/null 2>&1 && \
  pm2 start backend/src/index.ts \
    --name "dapp-backend" \
    --interpreter ts-node \
    --log logs/backend_prod.log \
  2>&1 | tee logs/pm2_deploy.log
```

### Option B · Direct Node.js Process (workspace-session only)

```bash
cd backend
NODE_ENV=production node -r ts-node/register src/index.ts \
  > ../logs/backend_prod.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
node -e "
  const f = '../workspace_pids.json';
  const d = require(f);
  d.backend_prod = $BACKEND_PID;
  require('fs').writeFileSync(f, JSON.stringify(d, null, 2));
"
cd ..
```

---

## Step 5 · Post-Deployment Smoke Tests

```bash
FRONTEND_PROD_URL=$(node -e \
  "console.log(require('./workspace_state.json').frontend_url)")

# 1. Frontend is reachable
curl -sf $FRONTEND_PROD_URL | grep -q "<div id=\"root\">" \
  && echo "✅ Frontend root element found" \
  || (echo "❌ Frontend not responding correctly" && exit 1)

# 2. Backend health check (if backend deployed)
curl -sf http://localhost:3001/health | grep -q '"ok"' \
  && echo "✅ Backend healthy" \
  || echo "⚠️  Backend not responding (may not be required)"

# 3. Contract still reachable from production RPC
cast call $TOKEN_ADDRESS "name()(string)" --rpc-url $PROD_RPC_URL \
  && echo "✅ Contract reachable on production RPC" \
  || (echo "❌ Cannot reach contract on production RPC" && exit 1)
```

---

## Step 6 · Update Workspace State

```json
{
  "frontend_url": "https://my-dapp.vercel.app | http://localhost:4173",
  "backend_url":  "http://localhost:3001",
  "stage_status": {
    "08_dapp_deployment": "complete"
  }
}
```

---

## Pass Criteria ✅

- [ ] `npm run build` completed with exit code 0
- [ ] Frontend is reachable at the production URL
- [ ] Frontend HTML contains expected root element
- [ ] Backend `/health` returns 200 (if backend deployed)
- [ ] Contract is reachable from the production RPC
- [ ] All PIDs of new processes recorded in `workspace_pids.json`
- [ ] Commit: `deploy(dapp): production deployment complete`
