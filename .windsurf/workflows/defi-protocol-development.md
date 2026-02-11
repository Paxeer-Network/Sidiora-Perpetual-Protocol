---
name: defi-protocol-development
description: Workflow for building DeFi protocols (AMM, staking, lending, governance)
triggers:
  - pattern: "build defi"
  - pattern: "create protocol"
  - pattern: "implement amm"
  - pattern: "build staking"
skills_required:
  - blockchain-developer
  - defi-protocol-templates
  - solidity-security
  - web3-testing
  - quant-analyst (optional)
  - risk-manager (optional)
checkpoints: true
---

# DeFi Protocol Development Workflow

> **REQUIRED SKILLS:** `blockchain-developer`, `defi-protocol-templates`, `solidity-security`, `web3-testing`
> **OPTIONAL:** `quant-analyst`, `risk-manager`

## Phase 1: Protocol Design

### Step 1.1: Identify Protocol Type
Choose the DeFi primitive(s) to implement:

| Type | Template | Key Contracts |
|------|----------|---------------|
| **Staking** | `defi-protocol-templates` | StakingRewards, RewardDistributor |
| **AMM/DEX** | `defi-protocol-templates` | LiquidityPool, Router, Factory |
| **Lending** | `defi-protocol-templates` | LendingPool, InterestRateModel |
| **Governance** | `defi-protocol-templates` | Governor, Timelock, GovernanceToken |
| **Vault/Yield** | `defi-protocol-templates` | ERC4626 Vault, Strategy |

### Step 1.2: Economic Model Design
- [ ] Define tokenomics (if new token)
- [ ] Model fee structure
- [ ] Design reward distribution
- [ ] Plan liquidity incentives
- [ ] Risk parameter selection

**Load skill:** `quant-analyst` for complex economic modeling

// checkpoint: economic_model_complete

### Step 1.3: Architecture Design
```
┌─────────────────────────────────────────────────────────────┐
│                      Protocol Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Factory   │───▶│    Pool     │───▶│   Router    │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                  │                  │            │
│         ▼                  ▼                  ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │  Registry   │    │   Oracle    │    │  Frontend   │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

// checkpoint: architecture_complete

---

## Phase 2: Core Contract Implementation

### Step 2.1: Base Setup
// turbo
```bash
# Create project structure
mkdir -p contracts/{core,interfaces,libraries,test}
mkdir -p scripts test

# Install dependencies
npm install @openzeppelin/contracts @chainlink/contracts
```

### Step 2.2: Implement Core Contracts

**For Staking Protocol:**
```solidity
// contracts/core/StakingRewards.sol
// Use template from defi-protocol-templates skill
```

**For AMM Protocol:**
```solidity
// contracts/core/LiquidityPool.sol
// contracts/core/Router.sol
// contracts/core/Factory.sol
```

**For Lending Protocol:**
```solidity
// contracts/core/LendingPool.sol
// contracts/core/InterestRateModel.sol
// contracts/core/PriceOracle.sol
```

### Step 2.3: Implement Interfaces
```solidity
// contracts/interfaces/IPool.sol
interface IPool {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getReserves() external view returns (uint256, uint256);
}
```

// checkpoint: core_contracts_complete

---

## Phase 3: DeFi-Specific Security

### Step 3.1: DeFi Security Checklist
- [ ] **Flash Loan Protection**: Check for flash loan attack vectors
- [ ] **Oracle Manipulation**: Use TWAP or multiple oracle sources
- [ ] **Price Manipulation**: Implement slippage protection
- [ ] **Reentrancy**: ReentrancyGuard on all external calls
- [ ] **Front-Running**: Commit-reveal or deadline parameters
- [ ] **Sandwich Attacks**: Slippage limits
- [ ] **Governance Attacks**: Timelock and voting delays

### Step 3.2: Implement Protections

**Flash Loan Protection:**
```solidity
modifier noFlashLoan() {
    require(block.number > lastActionBlock[msg.sender], "Flash loan detected");
    lastActionBlock[msg.sender] = block.number;
    _;
}
```

**Oracle Security:**
```solidity
function getPrice() public view returns (uint256) {
    // Use Chainlink or TWAP oracle
    (, int256 price,,,) = priceFeed.latestRoundData();
    require(price > 0, "Invalid price");
    return uint256(price);
}
```

**Slippage Protection:**
```solidity
function swap(
    uint256 amountIn,
    uint256 minAmountOut,
    uint256 deadline
) external {
    require(block.timestamp <= deadline, "Expired");
    uint256 amountOut = calculateAmountOut(amountIn);
    require(amountOut >= minAmountOut, "Slippage exceeded");
    // ... execute swap
}
```

// checkpoint: defi_security_complete

---

## Phase 4: Integration Testing

### Step 4.1: Unit Tests
// turbo
```bash
npx hardhat test test/unit/
```

### Step 4.2: Integration Tests
```javascript
describe("Protocol Integration", function () {
  it("Should handle full user flow", async function () {
    // 1. User deposits
    await pool.deposit(amount);
    
    // 2. Time passes, rewards accrue
    await time.increase(86400);
    
    // 3. User claims rewards
    await pool.claimRewards();
    
    // 4. User withdraws
    await pool.withdraw(amount);
    
    // Verify final state
    expect(await token.balanceOf(user.address)).to.be.gt(initialBalance);
  });
});
```

### Step 4.3: Mainnet Fork Testing
```javascript
describe("Mainnet Fork Tests", function () {
  before(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: process.env.MAINNET_RPC_URL,
          blockNumber: 18000000,
        },
      }],
    });
  });
  
  it("Should integrate with Uniswap", async function () {
    // Test with real Uniswap contracts
  });
});
```

### Step 4.4: Fuzzing
```solidity
// Foundry fuzz test
function testFuzz_Deposit(uint256 amount) public {
    vm.assume(amount > 0 && amount <= MAX_DEPOSIT);
    
    vm.prank(user);
    pool.deposit(amount);
    
    assertEq(pool.balanceOf(user), amount);
}
```

// checkpoint: integration_tested

---

## Phase 5: Economic Simulation

### Step 5.1: Scenario Testing
**Load skill:** `quant-analyst`

Test scenarios:
- [ ] Normal market conditions
- [ ] High volatility
- [ ] Liquidity crisis
- [ ] Oracle failure
- [ ] Governance attack
- [ ] Bank run

### Step 5.2: Risk Parameters
**Load skill:** `risk-manager`

Define and test:
- Collateral ratios
- Liquidation thresholds
- Interest rate curves
- Fee parameters
- Emergency thresholds

// checkpoint: economic_simulation_complete

---

## Phase 6: Deployment & Launch

### Step 6.1: Pre-Launch Checklist
- [ ] All tests pass (>95% coverage)
- [ ] Security audit complete
- [ ] Slither/Mythril clean
- [ ] Economic model validated
- [ ] Documentation complete
- [ ] Frontend integration tested
- [ ] Monitoring set up
- [ ] Emergency procedures documented

### Step 6.2: Testnet Launch
// turbo
```bash
npx hardhat run scripts/deploy-protocol.js --network sepolia
```

### Step 6.3: Mainnet Launch (REQUIRES CONFIRMATION)
```bash
# ⚠️ MAINNET DEPLOYMENT - Requires explicit confirmation
# Ensure:
# - Audit complete
# - Bug bounty active
# - Emergency contacts ready
# - Monitoring active

npx hardhat run scripts/deploy-protocol.js --network mainnet
```

### Step 6.4: Post-Launch
- [ ] Verify all contracts on Etherscan
- [ ] Monitor transactions
- [ ] Track TVL and metrics
- [ ] Respond to community feedback

// checkpoint: launched

---

## Emergency Procedures

### Pause Protocol
```solidity
// Owner can pause in emergency
await protocol.pause();
```

### Emergency Withdrawal
```solidity
// Users can emergency withdraw (no rewards)
await protocol.emergencyWithdraw();
```

### Upgrade Path
```solidity
// If using proxy pattern
await upgradeProxy(proxyAddress, NewImplementation);
```
