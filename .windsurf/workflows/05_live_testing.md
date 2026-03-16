---
name: "Stage 05 — Live Network Testing"
description: >
  Execute end-to-end tests against deployed contracts on the live (local or
  testnet) network to validate real transaction flows and event emissions.
triggers:
  - manual
  - workflow: 00_master_orchestrator
---

# Stage 05 — Live Network Testing

## Objective
Verify that deployed contracts behave correctly under real network conditions:
gas costs, event logs, multi-account interactions, and failure modes.

---

## Step 1 · Load Deployed Addresses

```bash
# Read addresses from workspace state
TOKEN_ADDRESS=$(node -e "const s=require('./workspace_state.json'); \
  console.log(s.deployed_addresses.MyToken)")
RPC_URL=$(node -e "const s=require('./workspace_state.json'); \
  console.log(s.network.rpc_url)")
echo "Testing token at: $TOKEN_ADDRESS on $RPC_URL"
```

---

## Step 2 · Live Test Script

Create `tests/live/live_test.sh` for `cast`-based transaction tests, or
`tests/live/live.test.ts` for a Hardhat/ethers test runner against a fork.

### cast-Based Live Test Template

```bash
#!/usr/bin/env bash
set -euo pipefail

source .env
PASS=0; FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ PASS: $desc"
    ((PASS++))
  else
    echo "  ❌ FAIL: $desc"
    echo "     expected: $expected"
    echo "     actual:   $actual"
    ((FAIL++))
  fi
}

echo "=== Live Network Tests ==="

### Test 1: Token Name
NAME=$(cast call $TOKEN_ADDRESS "name()(string)" --rpc-url $RPC_URL)
assert_eq "token name" '"MyToken"' "$NAME"

### Test 2: Transfer
ALICE=$(cast wallet address --private-key $ALICE_KEY)
AMOUNT=$(cast to-wei 100)
cast send $TOKEN_ADDRESS "transfer(address,uint256)(bool)" \
  $ALICE $AMOUNT \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL > /dev/null

BALANCE=$(cast call $TOKEN_ADDRESS "balanceOf(address)(uint256)" \
  $ALICE --rpc-url $RPC_URL)
assert_eq "alice balance after transfer" "$AMOUNT" "$BALANCE"

### Test 3: Event Emission
LOGS=$(cast logs --from-block latest \
  --address $TOKEN_ADDRESS \
  "Transfer(address,address,uint256)" \
  --rpc-url $RPC_URL)
[ -n "$LOGS" ] && { echo "  ✅ PASS: Transfer event emitted"; ((PASS++)); } \
  || { echo "  ❌ FAIL: No Transfer event found"; ((FAIL++)); }

### Test 4: Revert on insufficient balance
RESULT=$(cast send $TOKEN_ADDRESS \
  "transfer(address,uint256)(bool)" \
  $ALICE $(cast to-wei 9999999999) \
  --private-key $ALICE_KEY \
  --rpc-url $RPC_URL 2>&1 || true)
echo "$RESULT" | grep -q "revert\|Revert\|error" \
  && { echo "  ✅ PASS: Over-transfer correctly reverts"; ((PASS++)); } \
  || { echo "  ❌ FAIL: Over-transfer did not revert"; ((FAIL++)); }

echo ""
echo "Results: $PASS passed / $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
```

---

## Step 3 · Ethers.js / Hardhat Live Test Template

```typescript
// tests/live/live.test.ts
import { ethers } from "ethers";
import * as fs from "fs";
import { expect } from "chai";

const addresses = JSON.parse(fs.readFileSync("scripts/deployed_addresses.json", "utf8"));
const provider  = new ethers.JsonRpcProvider(process.env.RPC_URL);
const deployer  = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const alice     = new ethers.Wallet(process.env.ALICE_KEY!, provider);

describe("Live Network Tests", () => {
  let token: ethers.Contract;

  before(async () => {
    const abi = JSON.parse(fs.readFileSync("out/MyToken.sol/MyToken.json", "utf8")).abi;
    token = new ethers.Contract(addresses.MyToken, abi, deployer);
  });

  it("returns correct name", async () => {
    expect(await token.name()).to.equal("MyToken");
  });

  it("transfers tokens and emits event", async () => {
    const amount = ethers.parseEther("100");
    const tx = await token.transfer(alice.address, amount);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((l: any) => l.fragment?.name === "Transfer");
    expect(event).to.not.be.undefined;
    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });

  it("reverts on insufficient balance", async () => {
    const overAmount = ethers.parseEther("999999999");
    await expect(token.connect(alice).transfer(deployer.address, overAmount))
      .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });
});
```

---

## Step 4 · Execute Live Tests

```bash
# cast script
chmod +x tests/live/live_test.sh
bash tests/live/live_test.sh 2>&1 | tee tests/reports/live_results.txt

# Hardhat alternative
npx hardhat test tests/live/live.test.ts --network localhost \
  2>&1 | tee tests/reports/live_results.txt
```

---

## Step 5 · Update Workspace State

```json
{
  "test_results": {
    "live": {
      "total_tests": 0,
      "passed": 0,
      "failed": 0,
      "report_path": "tests/reports/live_results.txt"
    }
  },
  "stage_status": {
    "05_live_testing": "complete"
  }
}
```

---

## Pass Criteria ✅

- [ ] All live test scenarios pass (0 failures)
- [ ] Transfer, revert, and event tests included
- [ ] `tests/reports/live_results.txt` saved
- [ ] `workspace_state.json` updated
- [ ] Commit: `test(live): all live network tests pass`
