# Blockchain Development Skill Set

> **Curated skill collection optimized for building blockchain applications with Windsurf AI agents.**

---

## Skill Tiers

| Tier | Purpose | Count |
|------|---------|-------|
| **🔷 CORE** | Essential blockchain-specific skills | 5 |
| **🔶 CRITICAL** | Security, quality, and workflow essentials | 8 |
| **🔹 SUPPORT** | Enhancement and optimization skills | 7 |
| **Total Curated** | | **20 skills** |

---

## 🔷 TIER 1: CORE BLOCKCHAIN SKILLS

These skills are **blockchain-native** and should be loaded for any blockchain project.

### 1. `blockchain-developer`
**Priority:** ALWAYS LOAD FIRST  
**Trigger:** Any blockchain/smart contract work

**Capabilities:**
- Smart contract architecture & development
- Token standards (ERC20, ERC721, ERC1155, ERC4626)
- DeFi protocol patterns (AMM, lending, staking)
- Gas optimization techniques
- Cross-chain development
- DApp frontend integration

**Key Checklists:**
- 100% test coverage
- Gas optimization applied
- Security audit passed
- Slither/Mythril clean
- Upgradeable patterns implemented
- Emergency stops included

---

### 2. `solidity-security`
**Priority:** LOAD FOR ALL CONTRACT WORK  
**Trigger:** Writing/auditing smart contracts

**Capabilities:**
- Reentrancy prevention (CEI pattern, ReentrancyGuard)
- Integer overflow protection
- Access control patterns
- Front-running mitigation
- Flash loan attack prevention
- Oracle manipulation defense

**Critical Patterns:**
```solidity
// Checks-Effects-Interactions
function withdraw() public {
    require(amount <= balances[msg.sender]);  // CHECKS
    balances[msg.sender] -= amount;           // EFFECTS
    msg.sender.call{value: amount}("");       // INTERACTIONS
}
```

**Security Checklist:**
- [ ] Reentrancy protection
- [ ] Overflow checks (0.8+ or SafeMath)
- [ ] Access control
- [ ] Input validation
- [ ] No tx.origin auth
- [ ] External calls at end
- [ ] Check return values

---

### 3. `defi-protocol-templates`
**Priority:** HIGH for DeFi projects  
**Trigger:** Building DeFi applications

**Production Templates:**
- **Staking Rewards** - Token staking with reward distribution
- **AMM (SimpleAMM)** - Automated market maker with liquidity pools
- **Governance** - Token voting and proposal system
- **Flash Loans** - Flash loan provider and receiver patterns

**Best Practices:**
1. Use OpenZeppelin/Solmate libraries
2. Test thoroughly (unit + integration + fuzzing)
3. Professional security audit before launch
4. Start simple, add features incrementally
5. Implement emergency pause mechanisms

---

### 4. `nft-standards`
**Priority:** HIGH for NFT projects  
**Trigger:** NFT collections, marketplaces, digital assets

**Standards Covered:**
- **ERC-721** - Non-fungible tokens with URI storage
- **ERC-1155** - Multi-token standard for gaming
- **ERC721A** - Gas-optimized batch minting
- **EIP-2981** - Royalty standard

**Special Patterns:**
- On-chain vs off-chain metadata
- Soulbound tokens (non-transferable)
- Dynamic/evolving NFTs
- Reveal mechanisms
- Merkle tree whitelisting

---

### 5. `web3-testing`
**Priority:** HIGH for all contract development  
**Trigger:** Testing smart contracts

**Frameworks:**
- **Hardhat** - JavaScript/TypeScript testing
- **Foundry (Forge)** - Solidity-native testing with fuzzing

**Testing Patterns:**
- Unit tests with fixtures
- Mainnet forking for realistic testing
- Account impersonation
- Time manipulation
- Gas optimization testing
- Fuzzing for edge cases
- Coverage reporting (>90% target)

**CI/CD Integration:**
```yaml
- run: npx hardhat compile
- run: npx hardhat test
- run: npx hardhat coverage
```

---

## 🔶 TIER 2: CRITICAL SUPPORTING SKILLS

Essential for professional blockchain development workflow.

### 6. `security-audit`
**When:** Pre-release, dependency updates  
**Focus:** Supply-chain risk, dependency inspection, source diff security

**Audit Scope:**
- Source-code diffs for security regressions
- Dependency changes (direct + transitive)
- node_modules behavior inspection
- CI/CD workflow risks
- Lockfile determinism

---

### 7. `systematic-debugging`
**When:** Any bug, test failure, unexpected behavior  
**Core Rule:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

**Four Phases:**
1. **Root Cause Investigation** - Read errors, reproduce, trace data flow
2. **Pattern Analysis** - Find working examples, compare
3. **Hypothesis Testing** - Form theory, test minimally
4. **Implementation** - Create test, fix, verify

**Critical for Blockchain:** Smart contract bugs can lose real money. Systematic debugging prevents costly mistakes.

---

### 8. `test-driven-development`
**When:** Any feature or bugfix  
**Core Rule:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

**Red-Green-Refactor:**
1. **RED** - Write failing test
2. **Verify RED** - Watch it fail (MANDATORY)
3. **GREEN** - Write minimal code to pass
4. **Verify GREEN** - Watch it pass
5. **REFACTOR** - Clean up while staying green

**Critical for Blockchain:** Untested contract code is a liability.

---

### 9. `defense-in-depth`
**When:** Invalid data causes failures deep in execution  
**Core Rule:** Validate at EVERY layer data passes through

**Four Validation Layers:**
1. **Entry Point** - Reject obviously invalid input
2. **Business Logic** - Ensure data makes sense
3. **Environment Guards** - Prevent dangerous operations
4. **Debug Instrumentation** - Capture context for forensics

**Critical for Blockchain:** Multiple validation layers prevent exploits.

---

### 10. `code-quality`
**When:** Always during development  
**Focus:** Linting, documentation, code standards

**Standards:**
- All comments in English
- Single responsibility functions
- No over-abstraction
- Consistent naming conventions

**Commands:**
```bash
yarn lint:staged    # Pre-commit (fast)
yarn tsc:staged     # Type check staged files
```

---

### 11. `pr-review`
**When:** Reviewing any code changes  
**Priority:** security > correctness > architecture > performance

**Focus Areas for Blockchain:**
- Secrets/PII leakage prevention
- AuthN/AuthZ verification
- Dependency & supply-chain security
- node_modules outbound request inspection
- Cross-platform architecture

**Output Categories:**
- **Blockers** - Must fix
- **High Risk** - Strongly recommended
- **Suggestions** - Nice-to-have
- **Questions** - Needs clarification

---

### 12. `git-workflow`
**When:** Branch management, commits, PRs  
**Focus:** Clean history, conventional commits

**Branch Naming:**
- `feat/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring

**Commit Format:**
```
feat: add staking rewards contract
fix: resolve reentrancy vulnerability
refactor: optimize gas in swap function
```

---

### 13. `architecture`
**When:** Understanding project structure, package relationships  
**Focus:** Monorepo patterns, import hierarchy, platform abstraction

**Key Patterns:**
- Package isolation with clear boundaries
- Platform-specific file extensions (`.native.ts`, `.web.ts`)
- Import hierarchy enforcement (prevents circular deps)

---

## 🔹 TIER 3: ENHANCEMENT SKILLS

Load when specific capability is needed.

### 14. `quant-analyst`
**When:** Trading strategies, DeFi protocol math, risk analytics  
**Capabilities:** Financial modeling, statistical arbitrage, backtesting, VaR calculation

---

### 15. `risk-manager`
**When:** Risk assessment, compliance, stress testing  
**Capabilities:** Risk quantification, stress scenarios, regulatory compliance, model validation

---

### 16. `payment-integration`
**When:** Fiat on/off ramps, multi-currency, subscription models  
**Capabilities:** Gateway integration, PCI compliance, fraud prevention, webhook handling

---

### 17. `api-documenter`
**When:** Creating API documentation for DApps  
**Capabilities:** OpenAPI specs, interactive docs, code examples, SDK references

---

### 18. `brainstorming`
**When:** Designing new features before implementation  
**Process:** Questions → Explore approaches → Present design in sections → Validate incrementally

---

### 19. `writing-plans`
**When:** Design complete, need implementation tasks  
**Output:** Bite-sized tasks with exact file paths, complete code, verification steps

---

### 20. `deep-researcher`
**When:** Verified research from multiple authoritative sources  
**Output:** Structured findings with confidence levels, evidence trails, source verification

---

## Skill Loading Strategy

### Project Initialization
```
LOAD: blockchain-developer, solidity-security, architecture
```

### Smart Contract Development
```
LOAD: blockchain-developer, solidity-security, web3-testing, test-driven-development
```

### DeFi Protocol Development
```
LOAD: blockchain-developer, defi-protocol-templates, solidity-security, web3-testing
OPTIONAL: quant-analyst, risk-manager
```

### NFT Project
```
LOAD: blockchain-developer, nft-standards, solidity-security, web3-testing
```

### Pre-Release Audit
```
LOAD: security-audit, pr-review, solidity-security
```

### Debugging Session
```
LOAD: systematic-debugging, defense-in-depth, web3-testing
```

### Design Phase
```
LOAD: brainstorming, deep-researcher, architecture
THEN: writing-plans
```

---

## Trigger Patterns for Auto-Loading

```yaml
triggers:
  # Contract work
  - pattern: ["write contract", "create contract", "solidity"]
    skills: [blockchain-developer, solidity-security, web3-testing]
    
  # DeFi
  - pattern: ["defi", "amm", "staking", "lending", "flash loan"]
    skills: [defi-protocol-templates, solidity-security]
    
  # NFT
  - pattern: ["nft", "erc721", "erc1155", "collection"]
    skills: [nft-standards, blockchain-developer]
    
  # Security
  - pattern: ["audit", "security", "vulnerability"]
    skills: [security-audit, solidity-security, pr-review]
    
  # Testing
  - pattern: ["test", "hardhat", "foundry", "coverage"]
    skills: [web3-testing, test-driven-development]
    
  # Debugging
  - pattern: ["bug", "fix", "debug", "error"]
    skills: [systematic-debugging, defense-in-depth]
    
  # Planning
  - pattern: ["design", "plan", "architect"]
    skills: [brainstorming, writing-plans, architecture]
```

---

## Skills NOT Included (Intentionally Excluded)

| Skill | Reason |
|-------|--------|
| `game-developer` | Not blockchain-specific |
| `mobile-app-developer` | Use for DApp frontends only if needed |
| `embedded-systems` | Not relevant |
| `iot-engineer` | Not relevant |
| `seo-specialist` | Not relevant to core blockchain dev |
| `i18n` | Add later for internationalization |
| `implementing-figma-designs` | Add for frontend work |

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────────┐
│                 BLOCKCHAIN DEV SKILL CHEATSHEET                │
├────────────────────────────────────────────────────────────────┤
│ CONTRACT WORK     → blockchain-developer + solidity-security   │
│ DEFI              → + defi-protocol-templates                  │
│ NFT               → + nft-standards                            │
│ TESTING           → web3-testing + test-driven-development     │
│ DEBUGGING         → systematic-debugging + defense-in-depth    │
│ PR/AUDIT          → security-audit + pr-review                 │
│ PLANNING          → brainstorming → writing-plans              │
│ RESEARCH          → deep-researcher                            │
├────────────────────────────────────────────────────────────────┤
│ ALWAYS: code-quality + git-workflow + architecture             │
└────────────────────────────────────────────────────────────────┘
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-03 | Initial curated skill set from 72 available skills |
