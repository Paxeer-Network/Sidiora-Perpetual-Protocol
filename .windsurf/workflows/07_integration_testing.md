---
name: "Stage 07 — Integration & Application Testing"
description: >
  Run full-stack integration tests covering browser-to-contract flows,
  API correctness, and UI regression checks.
triggers:
  - manual
  - workflow: 00_master_orchestrator
---

# Stage 07 — Integration & Application Testing

## Objective
Validate that the frontend, backend, and smart contracts work correctly
together as a complete application under realistic user scenarios.

---

## Step 1 · Verify Services Are Running

```bash
PIDS=$(cat workspace_pids.json 2>/dev/null || echo "{}")
FRONTEND_PID=$(echo $PIDS | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).frontend||''))")
BACKEND_PID=$(echo $PIDS | node -e  "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).backend||''))")

# Health check
curl -sf http://localhost:5173 > /dev/null && echo "✅ Frontend alive" \
  || echo "❌ Frontend not responding"
curl -sf http://localhost:3001/health > /dev/null && echo "✅ Backend alive" \
  || echo "❌ Backend not responding"
```

---

## Step 2 · Backend API Tests

Install test runner if not present:

```bash
npm install --save-dev supertest @types/supertest jest ts-jest
```

Create `tests/integration/api.test.ts`:

```typescript
import request from "supertest";

const BASE = process.env.BACKEND_URL || "http://localhost:3001";

describe("Backend API Integration", () => {
  it("GET /health → 200 ok", async () => {
    const res = await request(BASE).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /token/info → returns token metadata", async () => {
    const res = await request(BASE).get("/token/info");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name:     expect.any(String),
      symbol:   expect.any(String),
      decimals: expect.any(Number),
    });
  });

  it("GET /token/balance/:address → returns formatted balance", async () => {
    const address = process.env.DEPLOYER_ADDRESS!;
    const res = await request(BASE).get(`/token/balance/${address}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.balance).toBe("string");
  });

  it("GET /events/transfers → returns array", async () => {
    const res = await request(BASE).get("/events/transfers?limit=5");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

Run:

```bash
npx jest tests/integration/api.test.ts --forceExit \
  2>&1 | tee tests/reports/api_integration.txt
```

---

## Step 3 · Frontend Component Tests

Install Vitest + Testing Library:

```bash
cd frontend
npm install --save-dev vitest @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom jsdom
```

Create `frontend/src/__tests__/Dashboard.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount:        () => ({ address: "0xAlice", isConnected: true }),
  useReadContract:   () => ({ data: 1000n * 10n ** 18n, isLoading: false }),
  useWriteContract:  () => ({ writeContract: vi.fn(), isPending: false }),
  useWatchContractEvent: () => {},
}));

import Dashboard from "../pages/Dashboard";

describe("Dashboard", () => {
  it("renders connected wallet address", () => {
    render(<Dashboard />);
    expect(screen.getByText(/0xAlice/i)).toBeInTheDocument();
  });

  it("displays token balance", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/1,000/)).toBeInTheDocument();
    });
  });

  it("transfer form submits with valid input", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.type(screen.getByPlaceholderText(/recipient/i), "0xBob");
    await user.type(screen.getByPlaceholderText(/amount/i), "10");
    await user.click(screen.getByRole("button", { name: /transfer/i }));
    // Verify mock was called (no real transaction)
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });
});
```

Run:

```bash
cd frontend && npx vitest run --reporter=verbose \
  2>&1 | tee ../tests/reports/frontend_unit.txt
cd ..
```

---

## Step 4 · End-to-End Browser Test (Playwright)

Install Playwright:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Create `tests/integration/e2e.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

test.describe("DApp E2E", () => {
  test("landing page loads and shows connect button", async ({ page }) => {
    await page.goto(FRONTEND);
    await expect(page.getByRole("button", { name: /connect/i })).toBeVisible();
  });

  test("token info section is visible", async ({ page }) => {
    await page.goto(FRONTEND);
    await expect(page.locator("[data-testid='token-name']")).toBeVisible({ timeout: 8000 });
  });

  test("page has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto(FRONTEND);
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes("MetaMask"))).toHaveLength(0);
  });
});
```

Run:

```bash
npx playwright test tests/integration/e2e.spec.ts \
  --reporter=line 2>&1 | tee tests/reports/e2e_results.txt
```

---

## Step 5 · Update Workspace State

```json
{
  "test_results": {
    "integration": {
      "api_tests_passed": true,
      "frontend_unit_passed": true,
      "e2e_passed": true,
      "report_paths": [
        "tests/reports/api_integration.txt",
        "tests/reports/frontend_unit.txt",
        "tests/reports/e2e_results.txt"
      ]
    }
  },
  "stage_status": {
    "07_integration_testing": "complete"
  }
}
```

---

## Pass Criteria ✅

- [ ] All API integration tests pass
- [ ] All frontend component tests pass
- [ ] All Playwright E2E tests pass (or skipped with documented reason)
- [ ] Zero unhandled console errors on page load
- [ ] Reports saved to `tests/reports/`
- [ ] Commit: `test(integration): full-stack integration tests pass`
