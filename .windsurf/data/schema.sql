-- Windsurf AI Agent Optimization System
-- SQLite Database Schema
-- Version: 1.0.0

-- =============================================================================
-- PROJECT GRAPH
-- Cached codebase structure, dependencies, and relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_graph (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_uri TEXT NOT NULL UNIQUE,
    project_name TEXT,
    project_type TEXT DEFAULT 'blockchain',
    
    -- Cached structure (JSON)
    file_tree JSON,
    dependency_map JSON,
    symbol_index JSON,
    
    -- Metadata
    total_files INTEGER DEFAULT 0,
    total_contracts INTEGER DEFAULT 0,
    frameworks_detected JSON,  -- ["hardhat", "foundry", etc.]
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_indexed DATETIME
);

CREATE INDEX idx_project_workspace ON project_graph(workspace_uri);

-- =============================================================================
-- SESSION STATE
-- Current workflow progress, active files, pending actions
-- =============================================================================

CREATE TABLE IF NOT EXISTS session_state (
    session_id TEXT PRIMARY KEY,
    workspace_uri TEXT NOT NULL,
    
    -- State data (JSON)
    workflow_state JSON,        -- Active workflow checkpoint data
    active_context JSON,        -- Currently loaded context
    checkpoint_data JSON,       -- Workflow checkpoints
    user_decisions JSON,        -- Decisions made in this session
    loaded_skills JSON,         -- Currently loaded skills
    
    -- Session metadata
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',  -- active, paused, completed
    
    -- Summary for context restoration
    session_summary TEXT,
    
    FOREIGN KEY (workspace_uri) REFERENCES project_graph(workspace_uri)
);

CREATE INDEX idx_session_workspace ON session_state(workspace_uri);
CREATE INDEX idx_session_status ON session_state(status);

-- =============================================================================
-- MEMORIES
-- User preferences, project-specific knowledge, lessons learned
-- =============================================================================

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    
    -- Memory content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    memory_type TEXT DEFAULT 'general',  -- general, preference, lesson, decision
    
    -- Association
    corpus_names JSON,          -- Associated workspaces
    tags JSON,                  -- Searchable tags
    
    -- Relevance scoring
    relevance_score REAL DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_triggered BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_relevance ON memories(relevance_score DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(title, content, tags);

-- =============================================================================
-- SKILL CACHE
-- Memoized skill outputs to avoid redundant computation
-- =============================================================================

CREATE TABLE IF NOT EXISTS skill_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id TEXT NOT NULL,
    
    -- Input/Output
    input_hash TEXT NOT NULL,   -- Hash of input parameters
    output JSON NOT NULL,       -- Cached result
    
    -- Cache metadata
    ttl INTEGER DEFAULT 3600,   -- Time to live in seconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    hit_count INTEGER DEFAULT 0,
    
    UNIQUE(skill_id, input_hash)
);

CREATE INDEX idx_skill_cache_lookup ON skill_cache(skill_id, input_hash);
CREATE INDEX idx_skill_cache_expiry ON skill_cache(expires_at);

-- =============================================================================
-- DECISIONS LOG
-- Audit trail of agent decisions for learning and debugging
-- =============================================================================

CREATE TABLE IF NOT EXISTS decisions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    
    -- Decision context
    context TEXT NOT NULL,          -- What was being decided
    options JSON,                   -- Available options
    chosen TEXT NOT NULL,           -- What was chosen
    rationale TEXT,                 -- Why it was chosen
    
    -- Outcome tracking
    outcome TEXT,                   -- What happened
    outcome_positive BOOLEAN,       -- Was outcome good?
    
    -- Categorization
    decision_type TEXT,             -- skill_selection, workflow_step, code_change
    skills_involved JSON,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES session_state(session_id)
);

CREATE INDEX idx_decisions_session ON decisions_log(session_id);
CREATE INDEX idx_decisions_type ON decisions_log(decision_type);
CREATE INDEX idx_decisions_outcome ON decisions_log(outcome_positive);

-- =============================================================================
-- WORKFLOW CHECKPOINTS
-- Saved workflow state for resumption across sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS workflow_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    workflow_name TEXT NOT NULL,
    checkpoint_name TEXT NOT NULL,
    
    -- Checkpoint data
    step_index INTEGER,
    state_data JSON NOT NULL,
    context_snapshot JSON,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resumed_at DATETIME,
    status TEXT DEFAULT 'saved',  -- saved, resumed, expired
    
    FOREIGN KEY (session_id) REFERENCES session_state(session_id)
);

CREATE INDEX idx_checkpoint_workflow ON workflow_checkpoints(workflow_name);
CREATE INDEX idx_checkpoint_session ON workflow_checkpoints(session_id);

-- =============================================================================
-- CONTEXT CHUNKS
-- Indexed content for semantic search
-- =============================================================================

CREATE TABLE IF NOT EXISTS context_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_uri TEXT NOT NULL,
    
    -- Content
    file_path TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    content_hash TEXT,
    
    -- Metadata
    chunk_type TEXT,            -- code, comment, documentation
    language TEXT,              -- solidity, javascript, etc.
    symbols JSON,               -- Functions, contracts, variables in chunk
    
    -- For vector search (embedding stored separately or computed on demand)
    embedding_id TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_modified DATETIME,
    
    FOREIGN KEY (workspace_uri) REFERENCES project_graph(workspace_uri)
);

CREATE INDEX idx_chunks_workspace ON context_chunks(workspace_uri);
CREATE INDEX idx_chunks_file ON context_chunks(file_path);
CREATE INDEX idx_chunks_type ON context_chunks(chunk_type);

-- =============================================================================
-- TRIGGER HISTORY
-- Record of triggered actions
-- =============================================================================

CREATE TABLE IF NOT EXISTS trigger_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    
    -- Trigger info
    trigger_name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,     -- pattern, event, context, schedule, compound
    matched_pattern TEXT,
    
    -- Action taken
    action_type TEXT,
    skills_loaded JSON,
    workflow_started TEXT,
    
    -- Metadata
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES session_state(session_id)
);

CREATE INDEX idx_trigger_session ON trigger_history(session_id);
CREATE INDEX idx_trigger_name ON trigger_history(trigger_name);

-- =============================================================================
-- BLOCKCHAIN-SPECIFIC TABLES
-- =============================================================================

-- Contract Registry
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_uri TEXT NOT NULL,
    
    -- Contract info
    contract_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    contract_type TEXT,             -- token, defi, nft, governance, custom
    
    -- Standards compliance
    standards JSON,                 -- ["ERC20", "ERC721", etc.]
    
    -- Security status
    audit_status TEXT DEFAULT 'unaudited',
    slither_clean BOOLEAN,
    test_coverage REAL,
    
    -- Deployment info
    deployed_networks JSON,         -- [{network, address, verified}]
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME,
    
    FOREIGN KEY (workspace_uri) REFERENCES project_graph(workspace_uri)
);

CREATE INDEX idx_contracts_workspace ON contracts(workspace_uri);
CREATE INDEX idx_contracts_type ON contracts(contract_type);

-- Deployment History
CREATE TABLE IF NOT EXISTS deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER,
    
    -- Deployment info
    network TEXT NOT NULL,
    address TEXT NOT NULL,
    deployer TEXT,
    transaction_hash TEXT,
    
    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verification_url TEXT,
    
    -- Metadata
    deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    gas_used INTEGER,
    
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

CREATE INDEX idx_deployments_network ON deployments(network);
CREATE INDEX idx_deployments_contract ON deployments(contract_id);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Active sessions view
CREATE VIEW IF NOT EXISTS v_active_sessions AS
SELECT 
    s.session_id,
    s.workspace_uri,
    p.project_name,
    s.loaded_skills,
    s.started_at,
    s.last_activity,
    (SELECT COUNT(*) FROM decisions_log d WHERE d.session_id = s.session_id) as decisions_count,
    (SELECT COUNT(*) FROM workflow_checkpoints w WHERE w.session_id = s.session_id) as checkpoints_count
FROM session_state s
LEFT JOIN project_graph p ON s.workspace_uri = p.workspace_uri
WHERE s.status = 'active';

-- Contract security status view
CREATE VIEW IF NOT EXISTS v_contract_security AS
SELECT 
    c.contract_name,
    c.file_path,
    c.audit_status,
    c.slither_clean,
    c.test_coverage,
    CASE 
        WHEN c.audit_status = 'audited' AND c.slither_clean = 1 AND c.test_coverage >= 90 THEN 'ready'
        WHEN c.slither_clean = 1 AND c.test_coverage >= 80 THEN 'review'
        ELSE 'needs_work'
    END as deployment_readiness
FROM contracts c;

-- Recent decisions view
CREATE VIEW IF NOT EXISTS v_recent_decisions AS
SELECT 
    d.context,
    d.chosen,
    d.rationale,
    d.outcome,
    d.outcome_positive,
    d.created_at,
    s.workspace_uri
FROM decisions_log d
LEFT JOIN session_state s ON d.session_id = s.session_id
ORDER BY d.created_at DESC
LIMIT 100;
