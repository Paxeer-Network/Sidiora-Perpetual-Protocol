---
name: security-audit
description: Comprehensive security audit workflow for smart contracts
triggers:
  - pattern: "audit this"
  - pattern: "security review"
  - pattern: "check for vulnerabilities"
skills_required:
  - security-audit
  - solidity-security
  - pr-review
  - defense-in-depth
checkpoints: true
priority: critical
---

# Security Audit Workflow

> **REQUIRED SKILLS:** `security-audit`, `solidity-security`, `pr-review`, `defense-in-depth`
> **PRIORITY:** Critical - Follow every step

## Phase 1: Audit Scope Definition

### Step 1.1: Identify Audit Target
- [ ] List all contracts in scope
- [ ] Identify external dependencies
- [ ] Note compiler versions
- [ ] Document deployment context (mainnet, L2, etc.)

### Step 1.2: Gather Context
- [ ] Read project documentation
- [ ] Understand intended functionality
- [ ] Review previous audits (if any)
- [ ] Identify high-value targets (funds, governance)

**Output: Audit scope document**

// checkpoint: scope_defined

---

## Phase 2: Automated Analysis

### Step 2.1: Static Analysis Tools

// turbo
```bash
# Slither - Primary static analyzer
slither . --exclude-dependencies --json slither-report.json

# Mythril - Symbolic execution
myth analyze contracts/*.sol --execution-timeout 300

# Solhint - Linting
npx solhint 'contracts/**/*.sol' > solhint-report.txt

# Aderyn - Rust-based analyzer
aderyn . --output aderyn-report.json
```

### Step 2.2: Compile Tool Results
Create findings table:

| Tool | Severity | Finding | File:Line | Status |
|------|----------|---------|-----------|--------|
| Slither | High | Reentrancy | Contract.sol:45 | TODO |
| Mythril | Medium | Integer overflow | Token.sol:23 | TODO |

// checkpoint: automated_analysis_complete

---

## Phase 3: Manual Code Review

### Step 3.1: Critical Path Analysis
Review in priority order:

1. **Funds Flow** - Where can value enter/exit?
2. **Access Control** - Who can call what?
3. **State Changes** - What state can be modified?
4. **External Calls** - What external contracts are called?
5. **Math Operations** - Any overflow/underflow risks?

### Step 3.2: Vulnerability Checklist

#### Reentrancy
- [ ] All external calls follow CEI pattern
- [ ] ReentrancyGuard on functions with external calls
- [ ] No cross-function reentrancy

```solidity
// Check for this pattern (VULNERABLE)
function withdraw() external {
    uint256 amount = balances[msg.sender];
    (bool success,) = msg.sender.call{value: amount}("");  // External call
    balances[msg.sender] = 0;  // State change AFTER - BAD
}
```

#### Access Control
- [ ] All admin functions protected
- [ ] Role-based access properly implemented
- [ ] No missing access controls
- [ ] Constructor properly sets owner

#### Integer Issues
- [ ] Solidity 0.8+ used (or SafeMath)
- [ ] Division by zero prevented
- [ ] Precision loss considered
- [ ] Overflow in multiplication checked

#### External Calls
- [ ] Return values checked
- [ ] Untrusted contracts handled carefully
- [ ] No delegatecall to untrusted targets
- [ ] Pull over push pattern for payments

#### Oracle Security
- [ ] Price manipulation resistance
- [ ] Stale price checks
- [ ] Multiple oracle sources (if critical)
- [ ] TWAP or manipulation protection

#### Flash Loan Attacks
- [ ] Single-transaction manipulation prevented
- [ ] State consistency maintained
- [ ] No reliance on spot prices

#### Front-Running
- [ ] Slippage protection
- [ ] Commit-reveal where needed
- [ ] Deadline parameters

#### Denial of Service
- [ ] No unbounded loops
- [ ] Push patterns avoided
- [ ] Gas limits considered

#### Logic Errors
- [ ] Edge cases handled (0, max, overflow)
- [ ] Off-by-one errors
- [ ] Correct comparison operators
- [ ] State machine transitions correct

// checkpoint: manual_review_complete

---

## Phase 4: DeFi-Specific Checks

### Step 4.1: Economic Exploits
- [ ] Flash loan attack vectors
- [ ] Sandwich attack vectors
- [ ] Governance attack vectors
- [ ] Liquidation manipulation
- [ ] Interest rate manipulation

### Step 4.2: Protocol Integration Risks
- [ ] Composability assumptions
- [ ] Token compatibility (rebasing, fee-on-transfer)
- [ ] Oracle dependencies
- [ ] External protocol upgrades

### Step 4.3: Invariant Analysis
Define and verify protocol invariants:

```solidity
// Example invariants
assert(totalSupply == sum(balances));
assert(reserves[0] * reserves[1] >= k);
assert(totalDebt <= totalCollateral * LTV);
```

// checkpoint: defi_checks_complete

---

## Phase 5: Testing Verification

### Step 5.1: Test Coverage
// turbo
```bash
npx hardhat coverage
```

**Requirement:** >90% line coverage, >80% branch coverage

### Step 5.2: Missing Test Cases
Identify untested scenarios:
- [ ] Edge cases (0, 1, max values)
- [ ] Error conditions
- [ ] Access control violations
- [ ] Reentrancy attempts
- [ ] Flash loan attacks

### Step 5.3: Write PoC for Findings
For each High/Critical finding, create proof of concept:

```javascript
it("PoC: Reentrancy attack drains funds", async function () {
  // Deploy attacker contract
  const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
  const attacker = await Attacker.deploy(victim.address);
  
  // Fund victim
  await victim.deposit({ value: ethers.parseEther("10") });
  
  // Execute attack
  await attacker.attack({ value: ethers.parseEther("1") });
  
  // Verify exploit
  expect(await ethers.provider.getBalance(victim.address)).to.equal(0);
});
```

// checkpoint: testing_verified

---

## Phase 6: Report Generation

### Step 6.1: Finding Classification

| Severity | Criteria | Example |
|----------|----------|---------|
| **Critical** | Direct fund loss | Reentrancy drain |
| **High** | Significant fund risk | Oracle manipulation |
| **Medium** | Limited fund risk | Missing access control |
| **Low** | Best practice | Missing events |
| **Info** | Optimization | Gas improvements |

### Step 6.2: Report Template

```markdown
# Security Audit Report

## Executive Summary
- **Project:** [Name]
- **Audit Date:** [Date]
- **Commit:** [Hash]
- **Auditor:** [AI Agent + Human Review]

## Scope
- contracts/Token.sol
- contracts/Pool.sol
- [...]

## Findings Summary
| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 0 | - |
| High | 1 | ✓ |
| Medium | 3 | 2/3 |
| Low | 5 | - |

## Detailed Findings

### [H-01] Reentrancy in withdraw()

**Severity:** High
**Status:** Fixed

**Description:**
The `withdraw()` function in `Pool.sol` is vulnerable to reentrancy...

**Impact:**
An attacker can drain all funds from the pool...

**Location:**
`contracts/Pool.sol:45-52`

**Recommendation:**
Apply ReentrancyGuard or follow CEI pattern...

**Fix:**
[Link to fix commit]

---
[Additional findings...]
```

### Step 6.3: Generate Report
// turbo
```bash
# Generate report file
echo "Generating security audit report..."
```

**Output:** `security-audit-report-[date].md`

// checkpoint: report_complete

---

## Phase 7: Remediation Verification

### Step 7.1: Review Fixes
For each finding:
- [ ] Fix addresses root cause
- [ ] No new vulnerabilities introduced
- [ ] Tests added for fix

### Step 7.2: Re-run Analysis
// turbo
```bash
# Re-run all tools
slither . --exclude-dependencies
myth analyze contracts/*.sol
npx hardhat test
npx hardhat coverage
```

### Step 7.3: Final Sign-off
- [ ] All Critical/High fixed
- [ ] Medium fixes reviewed
- [ ] Coverage maintained
- [ ] No regressions

// checkpoint: remediation_verified

---

## Audit Deliverables

1. **Audit Report** - Full findings with severity and recommendations
2. **PoC Tests** - Proof of concept for each finding
3. **Tool Reports** - Raw output from Slither, Mythril, etc.
4. **Fix Verification** - Confirmation of remediations
5. **Residual Risk** - Document any accepted risks

---

## Post-Audit Recommendations

- [ ] Set up monitoring (Forta, OpenZeppelin Defender)
- [ ] Establish bug bounty program
- [ ] Plan for future audits on upgrades
- [ ] Document emergency procedures
- [ ] Train team on security best practices
