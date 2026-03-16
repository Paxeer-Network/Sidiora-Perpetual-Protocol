# Windsurf AI Agent Optimization System

> **Blockchain Development Edition** - Optimized for smart contract and DeFi development

## Overview

This system enhances Windsurf AI agents with:
- **Persistent Context** - Maintains knowledge across sessions
- **Auto-Triggers** - Automatically loads relevant skills based on your work
- **Workflows** - Guided multi-step processes with checkpoints
- **Skill Composition** - 20 curated skills for blockchain development

## Quick Start

```bash
# 1. Initialize the system
node .windsurf/orchestrator.js init

# 2. Check status
node .windsurf/orchestrator.js status

# 3. Test trigger matching
node .windsurf/orchestrator.js trigger "build a staking contract"
```

## Directory Structure

```
.windsurf/
├── config.yaml                 # Global configuration
├── triggers.yaml               # Auto-trigger definitions
├── orchestrator.js             # System entry point
├── blockchain-skill-set.md     # Curated skill reference
├── AGENTS.md                   # Agent behavior rules
│
├── workflows/                  # Multi-step processes
│   ├── smart-contract-development.md
│   ├── defi-protocol-development.md
│   └── security-audit.md
│
├── skills/                     # 72 available skills
│   ├── blockchain-developer/
│   ├── solidity-security/
│   ├── defi-protocol-templates/
│   ├── nft-standards/
│   ├── web3-testing/
│   └── ... (67 more)
│
├── context/                    # Project context files
│   ├── project-overview.md
│   ├── conventions.md
│   └── architecture.md
│
├── data/                       # Persistence layer
│   ├── schema.sql
│   ├── init-db.js
│   ├── knowledge.db            # SQLite database
│   └── backups/
│
└── logs/                       # Agent logs
```

## Skill Tiers

### 🔷 Core Blockchain Skills (Always Loaded)
| Skill | Purpose |
|-------|---------|
| `blockchain-developer` | Smart contract development |
| `solidity-security` | Security patterns & vulnerabilities |
| `defi-protocol-templates` | Staking, AMM, governance templates |
| `nft-standards` | ERC-721, ERC-1155, metadata |
| `web3-testing` | Hardhat, Foundry, coverage |

### 🔶 Critical Support Skills
| Skill | Purpose |
|-------|---------|
| `security-audit` | Pre-release security review |
| `systematic-debugging` | Root cause analysis |
| `test-driven-development` | TDD methodology |
| `defense-in-depth` | Multi-layer validation |
| `code-quality` | Linting, standards |
| `pr-review` | Security-first code review |
| `git-workflow` | Branch/commit conventions |
| `architecture` | Project structure |

### 🔹 Enhancement Skills
| Skill | Purpose |
|-------|---------|
| `quant-analyst` | DeFi economics, trading |
| `risk-manager` | Risk assessment |
| `brainstorming` | Design ideation |
| `writing-plans` | Implementation planning |
| `deep-researcher` | Verified research |

## Workflows

### Smart Contract Development
```bash
# Triggered by: "build a contract", "create contract", "solidity"
node orchestrator.js workflow smart-contract-development
```

**Phases:**
1. Requirements & Design
2. Test-First Implementation (TDD)
3. Security Hardening
4. Gas Optimization
5. Documentation & Deployment

### DeFi Protocol Development
```bash
# Triggered by: "build defi", "create protocol", "amm", "staking"
node orchestrator.js workflow defi-protocol-development
```

**Phases:**
1. Protocol Design & Economic Modeling
2. Core Contract Implementation
3. DeFi-Specific Security
4. Integration Testing
5. Economic Simulation
6. Deployment & Launch

### Security Audit
```bash
# Triggered by: "audit this", "security review", "vulnerability"
node orchestrator.js workflow security-audit
```

**Phases:**
1. Scope Definition
2. Automated Analysis (Slither, Mythril)
3. Manual Code Review
4. DeFi-Specific Checks
5. Testing Verification
6. Report Generation
7. Remediation Verification

## Auto-Triggers

Triggers automatically load relevant skills based on your input:

| You Say | Skills Loaded |
|---------|---------------|
| "write a contract" | blockchain-developer, solidity-security, web3-testing |
| "build defi protocol" | defi-protocol-templates, solidity-security |
| "create nft collection" | nft-standards, blockchain-developer |
| "audit this" | security-audit, solidity-security, pr-review |
| "debug this" | systematic-debugging, defense-in-depth |
| "optimize gas" | blockchain-developer (gas focus) |

## Database Schema

The system persists:

| Table | Purpose |
|-------|---------|
| `project_graph` | Cached codebase structure |
| `session_state` | Workflow progress, active context |
| `memories` | Lessons learned, preferences |
| `skill_cache` | Memoized skill outputs |
| `decisions_log` | Audit trail for learning |
| `contracts` | Contract registry & security status |
| `deployments` | Deployment history |

## Configuration

Edit `config.yaml` to customize:

```yaml
# Agent settings
agent:
  default_skills:
    - blockchain-developer
    - solidity-security

# Context limits
context:
  max_tokens: 32000
  compression_threshold: 8000

# Blockchain preferences
blockchain:
  tools:
    framework: hardhat    # or foundry
    testing: hardhat      # or forge
    security: slither
  
  security:
    require_test_coverage: 90
    require_slither_clean: true
```

## Usage Examples

### Starting a New Contract Project
```
You: "I want to build a staking contract with rewards"

Agent: [Loads blockchain-developer, defi-protocol-templates, solidity-security]
       [Starts smart-contract-development workflow]
       "Starting staking contract development. Let me gather requirements..."
```

### Security Review
```
You: "Audit my contracts for vulnerabilities"

Agent: [Loads security-audit, solidity-security, pr-review]
       [Starts security-audit workflow]
       "Beginning security audit. Running Slither analysis..."
```

### Debugging
```
You: "My withdraw function is reverting"

Agent: [Loads systematic-debugging, defense-in-depth]
       "Let me investigate. First, I'll trace the data flow..."
```

## Guardrails

The system enforces safety:

**Requires Confirmation:**
- File deletion
- External requests
- Dependency installation
- Contract deployment
- Mainnet transactions

**Auto-Approved:**
- Read operations
- Search operations
- Test execution
- Local compilation

## Extending the System

### Adding a Custom Skill
1. Create `skills/my-skill/SKILL.md`
2. Add YAML frontmatter with name and description
3. The skill will be auto-discovered

### Adding a Custom Workflow
1. Create `workflows/my-workflow.md`
2. Add YAML frontmatter with triggers and required skills
3. Use `// checkpoint:` markers for resumable steps
4. Use `// turbo` for auto-runnable commands

### Adding Custom Triggers
Edit `triggers.yaml`:
```yaml
pattern_triggers:
  - name: my-trigger
    patterns:
      - "my pattern"
    action:
      type: load_skills
      skills:
        - my-skill
```

## Maintenance

### Backup Database
```bash
cp .windsurf/data/knowledge.db .windsurf/data/backups/knowledge-$(date +%Y%m%d).db
```

### Reset Database
```bash
rm .windsurf/data/knowledge.db
node .windsurf/data/init-db.js
```

### View Logs
```bash
cat .windsurf/logs/agent.log
```

## Troubleshooting

### "Skill not loading"
1. Check skill exists: `ls .windsurf/skills/`
2. Verify SKILL.md frontmatter
3. Check triggers.yaml patterns

### "Workflow not starting"
1. Check workflow exists: `node orchestrator.js workflow <name>`
2. Verify pattern matches in triggers.yaml
3. Check required skills are available

### "Database errors"
1. Reinitialize: `node .windsurf/data/init-db.js`
2. Check SQLite installed: `which sqlite3`
3. Verify permissions on data directory

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-03 | Initial release |

## License

MIT License - Use freely for blockchain development.
