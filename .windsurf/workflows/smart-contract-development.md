---
name: smart-contract-development
description: End-to-end workflow for developing secure smart contracts
triggers:
  - pattern: "build a contract"
  - pattern: "create new contract"
  - pattern: "implement contract"
skills_required:
  - blockchain-developer
  - solidity-security
  - web3-testing
  - test-driven-development
checkpoints: true
---

# Smart Contract Development Workflow

> **REQUIRED SKILLS:** `blockchain-developer`, `solidity-security`, `web3-testing`, `test-driven-development`

## Phase 1: Requirements & Design

### Step 1.1: Gather Requirements
- [ ] Identify contract purpose and functionality
- [ ] Define token standards needed (ERC20, ERC721, ERC1155, custom)
- [ ] List all functions and their access controls
- [ ] Identify external integrations (oracles, other contracts)
- [ ] Define upgrade requirements (immutable vs proxy)

**Questions to ask:**
1. What is the core functionality?
2. Who are the actors (admin, users, contracts)?
3. What tokens or assets are involved?
4. What are the security requirements?
5. Is upgradeability needed?

// checkpoint: requirements_gathered

### Step 1.2: Architecture Design
- [ ] Draw contract inheritance hierarchy
- [ ] Define storage layout
- [ ] Plan function signatures
- [ ] Identify OpenZeppelin contracts to use
- [ ] Design access control model

**Output:** Architecture diagram and interface definitions

// checkpoint: design_complete

---

## Phase 2: Test-First Implementation

### Step 2.1: Set Up Test Environment
```bash
# Hardhat setup
npx hardhat init
npm install @openzeppelin/contracts @nomicfoundation/hardhat-toolbox

# Or Foundry setup
forge init
forge install OpenZeppelin/openzeppelin-contracts
```

### Step 2.2: Write Failing Tests First
**MANDATORY: Follow TDD - write test before implementation**

```javascript
describe("MyContract", function () {
  it("Should [expected behavior]", async function () {
    // Arrange
    const [owner, user] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("MyContract");
    const contract = await Contract.deploy();
    
    // Act
    const result = await contract.someFunction();
    
    // Assert
    expect(result).to.equal(expectedValue);
  });
});
```

// turbo
### Step 2.3: Run Tests - Verify They Fail
```bash
npx hardhat test
# Expected: FAIL (contract not implemented yet)
```

### Step 2.4: Implement Minimal Contract
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MyContract is Ownable, ReentrancyGuard, Pausable {
    // State variables
    
    // Events
    
    // Constructor
    constructor() Ownable(msg.sender) {}
    
    // Functions (follow Checks-Effects-Interactions)
}
```

// turbo
### Step 2.5: Run Tests - Verify They Pass
```bash
npx hardhat test
# Expected: PASS
```

// checkpoint: core_implementation_complete

---

## Phase 3: Security Hardening

### Step 3.1: Security Checklist
- [ ] **Reentrancy Protection**: ReentrancyGuard on all external calls
- [ ] **Access Control**: Proper modifiers on all functions
- [ ] **Input Validation**: All inputs validated with require()
- [ ] **Integer Safety**: Using Solidity 0.8+ or SafeMath
- [ ] **External Calls**: Follow CEI pattern
- [ ] **Emergency Stop**: Pausable implemented
- [ ] **Events**: All state changes emit events

### Step 3.2: Run Static Analysis
// turbo
```bash
# Slither
slither . --exclude-dependencies

# Mythril
myth analyze contracts/MyContract.sol

# Solhint
npx solhint 'contracts/**/*.sol'
```

### Step 3.3: Fix All Findings
- Address all HIGH/MEDIUM findings
- Document any accepted LOW findings with rationale

// checkpoint: security_hardened

---

## Phase 4: Gas Optimization

### Step 4.1: Gas Report
// turbo
```bash
REPORT_GAS=true npx hardhat test
```

### Step 4.2: Optimization Techniques
- [ ] Pack storage variables
- [ ] Use `calldata` instead of `memory` for read-only args
- [ ] Use `uint256` over smaller types (unless packing)
- [ ] Minimize storage writes
- [ ] Use events for data that doesn't need on-chain access
- [ ] Consider using `unchecked` for safe math operations

### Step 4.3: Re-run Gas Report
Compare before/after gas usage

// checkpoint: gas_optimized

---

## Phase 5: Documentation & Deployment Prep

### Step 5.1: NatSpec Documentation
```solidity
/// @title MyContract
/// @author [Author]
/// @notice [What this contract does for end users]
/// @dev [Technical implementation notes]
contract MyContract {
    /// @notice [Function description]
    /// @param paramName [Parameter description]
    /// @return [Return value description]
    function myFunction(uint256 paramName) external returns (uint256) {
        // ...
    }
}
```

### Step 5.2: Deployment Script
```javascript
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  const Contract = await ethers.getContractFactory("MyContract");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  
  console.log("Deployed to:", await contract.getAddress());
  
  // Verify on Etherscan
  await hre.run("verify:verify", {
    address: await contract.getAddress(),
    constructorArguments: [],
  });
}
```

### Step 5.3: Final Checklist
- [ ] All tests pass (100% coverage target)
- [ ] Slither clean (no HIGH/MEDIUM)
- [ ] Gas optimized
- [ ] NatSpec complete
- [ ] Deployment script tested on testnet
- [ ] Upgrade plan documented (if applicable)

// checkpoint: ready_for_deployment

---

## Phase 6: Deployment

### Step 6.1: Testnet Deployment
// turbo
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Step 6.2: Testnet Verification
- [ ] All functions work as expected
- [ ] Events emit correctly
- [ ] Access controls enforced
- [ ] Edge cases handled

### Step 6.3: Mainnet Deployment (REQUIRES CONFIRMATION)
```bash
# ⚠️ MAINNET - Requires explicit user confirmation
npx hardhat run scripts/deploy.js --network mainnet
```

// checkpoint: deployed

---

## Workflow Complete

**Outputs:**
- Deployed contract address
- Verified source code
- Test suite with coverage report
- Security audit results
- Gas optimization report
- Documentation
