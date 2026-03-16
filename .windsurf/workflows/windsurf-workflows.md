# Windsurf Agent Workflows: Codebase Analysis & Guided Prompting

---

## WORKFLOW 1 — `analyze-workspace`
> **Trigger:** Run this first. Maps the full workspace structure.

```
You are a senior software architect performing a full workspace analysis.

## STEP 1 — Directory & File Mapping
- List every top-level directory and its purpose
- Identify all configuration files (package.json, tsconfig, .env*, docker-compose, etc.)
- Note the tech stack, frameworks, and languages in use
- Identify entry points (main.ts, index.js, app.py, etc.)
- Note test directories and testing frameworks present

## STEP 2 — Dependency Analysis
- Parse all dependency manifests (package.json, requirements.txt, Cargo.toml, go.mod, etc.)
- Flag outdated, deprecated, or potentially conflicting dependencies
- Identify internal packages vs external

## STEP 3 — Architecture Pattern Recognition
- Identify the architectural pattern in use (MVC, microservices, monorepo, layered, etc.)
- Map the data flow at a high level
- Identify state management approaches
- Note any design patterns observed (singleton, factory, observer, etc.)

## OUTPUT FORMAT
Produce a structured report in this exact format:

### WORKSPACE SUMMARY
- **Stack:** [languages, frameworks, runtimes]
- **Architecture:** [pattern identified]
- **Entry Points:** [list]
- **Config Files:** [list]
- **Test Coverage:** [framework + rough coverage notes]

### DIRECTORY MAP
[Annotated directory tree, max 3 levels deep]

### DEPENDENCY FLAGS
[Any warnings about deps — outdated, conflicting, missing]

After completing this output, automatically trigger WORKFLOW 2.
```

---

## WORKFLOW 2 — `map-codebase`
> **Trigger:** Runs automatically after `analyze-workspace`.

```
Continue the analysis. Now perform deep codebase mapping.

## STEP 1 — Module & File Inventory
For each significant file/module:
- State its responsibility in one sentence
- List its imports/dependencies on other internal modules
- Note its exports/public API surface

## STEP 2 — Function & Method Inventory
For each function/method of significance:
- Name and file location
- Purpose (one sentence)
- Inputs and outputs (types if available)
- Side effects (DB calls, API calls, mutations, I/O)
- Approximate complexity (simple / moderate / complex)

## STEP 3 — Data Model Mapping
- List all data models, schemas, or types
- Note relationships between models
- Identify any inconsistencies or mismatches between models

## OUTPUT FORMAT

### MODULE MAP
| Module/File | Responsibility | Key Exports | Internal Deps |
|---|---|---|---|

### FUNCTION INVENTORY
| Function | File | Purpose | Side Effects | Complexity |
|---|---|---|---|---|

### DATA MODELS
[List models and their relationships]

After completing this output, automatically trigger WORKFLOW 3.
```

---

## WORKFLOW 3 — `classify-changes`
> **Trigger:** Runs automatically after `map-codebase`.

```
Now classify every significant element of the codebase by change risk.

## STEP 1 — Easy/Safe Changes (Green Zone)
Identify elements that can be changed with low risk:
- Pure utility functions with no side effects
- Isolated UI components with clear interfaces
- Static config values and constants
- Styling / presentation layer
- Logging and instrumentation
- Dead code / unused exports
- Simple type alias changes
- Documentation and comments

## STEP 2 — Moderate Changes (Yellow Zone)
Identify elements that require care but are manageable:
- Functions called in multiple places (track all call sites)
- Shared utility modules
- API response transformations
- Validation logic
- Non-critical background jobs or workers

## STEP 3 — Complex / Potentially Breaking Changes (Red Zone)
Identify high-risk elements:
- Core business logic functions
- Authentication and authorization flows
- Database schema and migration files
- Public API contracts (REST, GraphQL, RPC)
- Inter-service communication layers
- State management core (Redux store, context providers, etc.)
- Functions with many dependents or deep call chains
- Anything touching payments, security, or compliance
- Shared interfaces/types used across many modules

## STEP 4 — Limitations & Constraints
Flag the following:
- Hardcoded values that should be configurable
- Missing error handling
- Circular dependencies
- Tightly coupled modules that resist change
- Missing or insufficient tests for critical paths
- Technical debt hotspots

## OUTPUT FORMAT

### 🟢 GREEN ZONE — Safe to Change
[List with file + brief rationale]

### 🟡 YELLOW ZONE — Change with Care
[List with file + what to watch out for]

### 🔴 RED ZONE — High Risk / Potentially Breaking
[List with file + specific risks + recommended precautions]

### ⚠️ LIMITATIONS & CONSTRAINTS
[Bulleted list of flags]

After completing this output, automatically trigger WORKFLOW 4.
```

---

## WORKFLOW 4 — `gather-requirements`
> **Trigger:** Runs automatically after `classify-changes`. This is the interactive handoff.

```
The codebase analysis is complete. Now enter requirements-gathering mode.

Your job is to ask the user a focused set of questions to understand what they want to do with this codebase. Ask ALL of the following questions in a single, well-formatted message. Do NOT proceed with any changes until the user has answered.

---

## ASK THE USER:

**1. GOAL**
What is the primary outcome you want? (e.g., add a feature, refactor, fix bugs, migrate to a new stack, improve performance, add tests, build a new module, etc.)

**2. SCOPE**
Should changes be:
- [ ] Isolated to a specific file or module
- [ ] Across a feature or domain area
- [ ] Codebase-wide

Which specific files, modules, or features are in scope if known?

**3. CONSTRAINTS**
- Are there any files, modules, or patterns I must NOT touch?
- Are there any external APIs, contracts, or interfaces that must remain unchanged?
- Are there performance, security, or compliance constraints I need to respect?

**4. STYLE & STANDARDS**
- Should I follow the existing code style exactly, or improve it where I see issues?
- Any naming conventions, patterns, or architectural choices you want enforced?

**5. TEST EXPECTATIONS**
- Should I write or update tests for any changes I make?
- Is there a minimum coverage requirement or specific test cases you want?

**6. PRIORITY**
If this is a large task, how should I prioritize? (e.g., core functionality first, UI last / fix critical bugs first / etc.)

**7. ANYTHING ELSE**
Is there any business context, prior decisions, known bugs, or background information that would help me do this well?

---

Once the user provides their answers, proceed to WORKFLOW 5.
```

---

## WORKFLOW 5 — `execute-plan`
> **Trigger:** Runs after the user responds to WORKFLOW 4.

```
You now have full codebase context and user requirements. Create and execute a precise implementation plan.

## STEP 1 — Plan Generation
Before making any changes, output a detailed plan:

### IMPLEMENTATION PLAN
- **Objective:** [one sentence summary of the goal]
- **Approach:** [brief strategy]
- **Files to Modify:** [list]
- **Files to Create:** [list if any]
- **Files to Delete:** [list if any]
- **Risk Assessment:** [note any Red Zone items being touched and mitigation strategy]
- **Test Plan:** [what tests will be written or updated]
- **Execution Order:** [numbered sequence of changes]

Ask the user: "Does this plan look correct? Should I proceed, or would you like to adjust anything?"

## STEP 2 — Execution
Once the user confirms, execute changes in the order specified. For each change:
- State what you're doing and why before doing it
- Make the change
- Note any unexpected issues encountered

## STEP 3 — Post-Change Summary
After all changes are complete:

### CHANGE SUMMARY
| File | Change Type | Description |
|---|---|---|

### TESTS RUN
[List tests run and their outcomes if applicable]

### FOLLOW-UP RECOMMENDATIONS
[Any next steps, cleanup, or improvements to consider]
```

---

## HOW TO USE THESE WORKFLOWS IN WINDSURF

### Option A — Run All Workflows in Sequence (Recommended)
Paste this into the Cascade/Agent prompt box:

```
Run the analyze-workspace workflow, then automatically continue through 
map-codebase, classify-changes, and gather-requirements in sequence. 
Do not stop between workflows unless the gather-requirements step is reached — 
pause there and wait for my input before proceeding.
```

### Option B — Run Individual Workflows
Copy and paste any single workflow block above into Cascade when needed.

### Option C — Save as `.windsurf/workflows/` files
Create the following files in your project root for reuse:

```
.windsurf/
  workflows/
    01-analyze-workspace.md
    02-map-codebase.md
    03-classify-changes.md
    04-gather-requirements.md
    05-execute-plan.md
```

Paste the corresponding workflow prompt into each file. Windsurf will make them accessible from the workflow picker.

---

## TIPS FOR BEST RESULTS

- **Large codebases:** Add `"Focus on the /src directory only"` to limit scope on first pass.
- **Monorepos:** Add `"Treat each package in /packages as a separate module"` to the workspace prompt.
- **Legacy code:** Add `"Assume minimal test coverage — flag all changes as Yellow or Red zone unless clearly isolated"` to the classify prompt.
- **Speed:** If you only need a quick read, run Workflow 1 + 3 and skip Workflow 2 for large repos.
```
