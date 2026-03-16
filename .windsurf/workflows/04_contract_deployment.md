---
name: "Stage 04 — Contract Deployment"
description: >
  Deploy smart contracts to the configured network (local dev node or testnet),
  verify on-chain, and record deployed addresses.
triggers:
  - manual
  - workflow: 00_master_orchestrator
---

# Stage 04 — Contract Deployment

## Objective
Deploy all contracts in the correct order using a reproducible script, then
verify correctness of the deployed bytecode and initial state.

---

## Step 1 · Environment Validation

Before touching the network:

```bash
# Confirm .env is present and not committed
test -f .env && echo ".env exists" || (echo "ERROR: .env missing — copy .env.example and fill in values" && exit 1)
grep -r "PRIVATE_KEY\s*=" .env | grep -v "^#" | grep -v "=$" > /dev/null \
  && echo "PRIVATE_KEY set" || (echo "ERROR: PRIVATE_KEY not set" && exit 1)
```

Validate RPC connection:

```bash
cast chain-id --rpc-url $RPC_URL 2>/dev/null \
  || (echo "ERROR: Cannot connect to RPC at $RPC_URL" && exit 1)
```

**If running on a local node (Anvil / Hardhat node):**

```bash
# Start Anvil only if no local node is already running on port 8545
lsof -i :8545 > /dev/null 2>&1 \
  && echo "Local node already running — reusing it" \
  || anvil --chain-id 31337 --accounts 10 &
sleep 2
```

> ⚠️ Never kill an existing process on port 8545 — if one is running,
> use it. Only spawn Anvil when the port is free.

---

## Step 2 · Deployment Script

Create `scripts/deploy.s.sol` (Foundry) or `scripts/deploy.ts` (Hardhat):

### Foundry Script Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/src/MyToken.sol";
// import additional contracts ...

contract DeployAll is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deploy in dependency order
        MyToken token = new MyToken("MyToken", "MTK", 1_000_000 ether);
        console.log("MyToken deployed at:", address(token));

        // Additional contracts referencing token address ...

        vm.stopBroadcast();
    }
}
```

### Hardhat Script Template

```typescript
import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const MyToken = await ethers.getContractFactory("MyToken");
  const token = await MyToken.deploy("MyToken", "MTK", ethers.parseEther("1000000"));
  await token.waitForDeployment();
  console.log("MyToken deployed at:", await token.getAddress());

  // Write addresses to file
  const addresses = { MyToken: await token.getAddress() };
  fs.writeFileSync("scripts/deployed_addresses.json", JSON.stringify(addresses, null, 2));
}

main().catch(console.error);
```

---

## Step 3 · Execute Deployment

```bash
# Foundry
forge script scripts/deploy.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv \
  2>&1 | tee scripts/deployment.log

# Hardhat
npx hardhat run scripts/deploy.ts --network $NETWORK_NAME \
  2>&1 | tee scripts/deployment.log
```

---

## Step 4 · Post-Deployment Verification

For each deployed contract, verify on-chain state matches expected initial state:

```bash
# Example — check token name
cast call $TOKEN_ADDRESS "name()(string)" --rpc-url $RPC_URL

# Check owner
cast call $TOKEN_ADDRESS "owner()(address)" --rpc-url $RPC_URL

# Check total supply
cast call $TOKEN_ADDRESS "totalSupply()(uint256)" --rpc-url $RPC_URL
```

If deploying to a public testnet, verify bytecode on the block explorer:

```bash
forge verify-contract $TOKEN_ADDRESS MyToken \
  --chain-id $CHAIN_ID \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

---

## Step 5 · Record Deployed Addresses

Update `workspace_state.json`:

```json
{
  "deployed_addresses": {
    "MyToken": "0x...",
    "Vesting": "0x..."
  },
  "network": {
    "name": "anvil | goerli | sepolia",
    "chain_id": 31337,
    "rpc_url": "http://127.0.0.1:8545"
  },
  "stage_status": {
    "04_contract_deployment": "complete"
  }
}
```

Also write `frontend/.env.local` and `backend/.env` with contract addresses
so downstream stages can reference them automatically.

---

## Pass Criteria ✅

- [ ] All contracts deployed without revert
- [ ] `cast call` verifications confirm correct initial state for every contract
- [ ] Deployed addresses recorded in `workspace_state.json`
- [ ] `scripts/deployment.log` saved
- [ ] Frontend / backend env files updated with addresses
- [ ] Commit: `deploy(contracts): deploy to <network> — addresses recorded`
