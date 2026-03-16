---
name: "Stage 06 — Frontend & Backend Development"
description: >
  Build a polished, fully functional frontend and (if required) backend that
  interact with the deployed smart contracts.
triggers:
  - manual
  - workflow: 00_master_orchestrator
---

# Stage 06 — Frontend & Backend Development

## Objective
Deliver a production-grade UI and API layer that lets users interact with the
DApp through a browser, with wallet connection, real-time chain data, and
robust error handling.

---

## Step 1 · Read Contract Addresses

```bash
TOKEN_ADDRESS=$(node -e \
  "console.log(require('./workspace_state.json').deployed_addresses.MyToken)")
CHAIN_ID=$(node -e \
  "console.log(require('./workspace_state.json').network.chain_id)")
```

---

## Step 2 · Frontend Setup

### Scaffold (skip if `frontend/` already contains a project)

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install wagmi viem @tanstack/react-query
npm install @rainbow-me/rainbowkit
```

### Required Environment Variables (`frontend/.env.local`)

```
VITE_TOKEN_ADDRESS=<from workspace_state.json>
VITE_CHAIN_ID=<from workspace_state.json>
VITE_RPC_URL=<from workspace_state.json>
```

---

## Step 3 · Frontend Architecture

Create the following file structure inside `frontend/src/`:

```
src/
├── main.tsx                    # App entry — wagmi/QueryClient providers
├── App.tsx                     # Router root
├── config/
│   ├── chains.ts               # Configured chain object
│   └── wagmi.ts                # wagmi config (RainbowKit / custom)
├── contracts/
│   ├── abis/                   # Copy ABI JSON from build artifacts
│   └── addresses.ts            # Import from VITE_ env vars
├── hooks/
│   ├── useTokenBalance.ts      # useReadContract wrapper
│   ├── useTransfer.ts          # useWriteContract wrapper
│   └── useContractEvents.ts    # useWatchContractEvent wrapper
├── components/
│   ├── ConnectButton.tsx       # Wallet connect / disconnect
│   ├── BalanceDisplay.tsx
│   ├── TransferForm.tsx
│   └── EventLog.tsx
└── pages/
    ├── Dashboard.tsx           # Main app view
    └── NotFound.tsx
```

### `main.tsx` Template

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "./config/wagmi";
import App from "./App";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
```

### Design Standards (from frontend-design skill)

Apply a **bold, intentional aesthetic** — not generic AI output:
- Choose a distinctive font pairing (e.g. Syne + DM Mono for crypto-tech feel)
- Use a dark theme with high-contrast accent (amber, cyan, or emerald)
- Animate wallet connect state changes with smooth CSS transitions
- Use CSS grid / asymmetric layouts — avoid plain Bootstrap card stacks
- Add micro-interactions: button press effects, loading skeletons, toast
  notifications for transaction state (`idle → pending → success / error`)

---

## Step 4 · Backend Setup (if required by SPEC)

If `docs/SPEC.md` specifies a backend:

```bash
cd backend
npm init -y
npm install express cors dotenv ethers
npm install --save-dev typescript ts-node @types/express @types/node nodemon
```

### Backend Structure

```
backend/src/
├── index.ts           # Express entry point
├── config.ts          # Env vars + contract config
├── routes/
│   ├── token.ts       # GET /token/balance/:address, GET /token/info
│   └── events.ts      # GET /events/transfers
└── services/
    ├── provider.ts    # ethers JsonRpcProvider singleton
    └── tokenService.ts
```

### Backend API Contract

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{ status: "ok" }` |
| GET | `/token/info` | name, symbol, decimals, totalSupply |
| GET | `/token/balance/:address` | formatted balance for address |
| GET | `/events/transfers?limit=20` | Last N Transfer events |

```typescript
// backend/src/index.ts
import express from "express";
import cors from "cors";
import "dotenv/config";
import tokenRouter from "./routes/token";
import eventsRouter from "./routes/events";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_, res) => res.json({ status: "ok" }));
app.use("/token",  tokenRouter);
app.use("/events", eventsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
```

---

## Step 5 · Start Dev Servers (workspace-session only)

```bash
# Frontend (background, log to file)
cd frontend && npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Backend (if present)
cd ../backend && npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Record PIDs so only these processes are managed by the workflow
echo "{\"frontend\": $FRONTEND_PID, \"backend\": $BACKEND_PID}" \
  > workspace_pids.json
```

> ⚠️ Only processes recorded in `workspace_pids.json` may be managed
> (inspected, restarted) by subsequent workflow stages.

---

## Step 6 · Update Workspace State

```json
{
  "frontend_url": "http://localhost:5173",
  "backend_url":  "http://localhost:3001",
  "stage_status": {
    "06_frontend_backend_development": "complete"
  }
}
```

---

## Pass Criteria ✅

- [ ] `npm run build` in `frontend/` exits 0 (no TypeScript errors)
- [ ] Backend starts and `/health` returns 200
- [ ] Wallet connect renders without console errors
- [ ] Token balance displays correctly for the deployer account
- [ ] Transfer form submits a real transaction and shows success toast
- [ ] Logs directory populated for both services
- [ ] Commit: `feat(frontend): build DApp UI with wallet integration`
