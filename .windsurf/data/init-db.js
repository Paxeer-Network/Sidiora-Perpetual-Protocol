#!/usr/bin/env node
/**
 * Windsurf AI Agent Optimization System
 * Database Initialization Script
 * 
 * Usage: node init-db.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname);
const DB_PATH = path.join(DATA_DIR, 'knowledge.db');
const SCHEMA_PATH = path.join(DATA_DIR, 'schema.sql');

console.log('🚀 Initializing Windsurf Agent Database...\n');

// Check if SQLite is available
try {
    execSync('which sqlite3', { stdio: 'ignore' });
} catch (e) {
    console.error('❌ SQLite3 not found. Please install SQLite3.');
    console.log('   Ubuntu/Debian: sudo apt install sqlite3');
    console.log('   macOS: brew install sqlite3');
    process.exit(1);
}

// Create data directory if needed
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory');
}

// Backup existing database
if (fs.existsSync(DB_PATH)) {
    const backupPath = path.join(DATA_DIR, 'backups', `knowledge-${Date.now()}.db`);
    const backupDir = path.dirname(backupPath);
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`📦 Backed up existing database to ${path.basename(backupPath)}`);
}

// Initialize database with schema
try {
    execSync(`sqlite3 "${DB_PATH}" < "${SCHEMA_PATH}"`, { stdio: 'inherit' });
    console.log('✅ Database schema applied');
} catch (e) {
    console.error('❌ Failed to apply schema:', e.message);
    process.exit(1);
}

// Insert initial data
const initData = `
-- Insert default project for current workspace
INSERT OR IGNORE INTO project_graph (workspace_uri, project_name, project_type)
VALUES ('${process.cwd()}', 'Default Project', 'blockchain');

-- Insert initial memories for blockchain development
INSERT OR IGNORE INTO memories (id, title, content, memory_type, tags)
VALUES 
    ('mem_blockchain_security', 
     'Blockchain Security Fundamentals',
     'Always follow CEI pattern. Use ReentrancyGuard. Validate all inputs. Check for flash loan attacks.',
     'lesson',
     '["security", "solidity", "smart-contracts"]'),
    
    ('mem_gas_optimization',
     'Gas Optimization Techniques',
     'Pack storage variables. Use calldata over memory. Minimize storage writes. Use events for non-critical data.',
     'lesson',
     '["gas", "optimization", "solidity"]'),
    
    ('mem_testing_requirements',
     'Testing Requirements',
     'Minimum 90% test coverage. Always test edge cases. Write failing tests first. Use mainnet forking for integration tests.',
     'preference',
     '["testing", "tdd", "coverage"]');
`;

try {
    execSync(`sqlite3 "${DB_PATH}" "${initData.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    console.log('✅ Initial data inserted');
} catch (e) {
    // Ignore if data already exists
    console.log('ℹ️  Initial data already exists or partially inserted');
}

// Verify database
try {
    const tables = execSync(`sqlite3 "${DB_PATH}" ".tables"`, { encoding: 'utf-8' });
    console.log('\n📊 Database Tables:');
    console.log(tables.trim().split(/\s+/).map(t => `   - ${t}`).join('\n'));
    
    const counts = execSync(`sqlite3 "${DB_PATH}" "
        SELECT 'project_graph' as tbl, COUNT(*) as cnt FROM project_graph
        UNION ALL
        SELECT 'memories', COUNT(*) FROM memories
        UNION ALL
        SELECT 'session_state', COUNT(*) FROM session_state
        UNION ALL
        SELECT 'contracts', COUNT(*) FROM contracts;
    "`, { encoding: 'utf-8' });
    
    console.log('\n📈 Record Counts:');
    counts.trim().split('\n').forEach(line => {
        const [table, count] = line.split('|');
        console.log(`   - ${table}: ${count}`);
    });
    
} catch (e) {
    console.error('❌ Verification failed:', e.message);
}

console.log('\n✨ Database initialization complete!');
console.log(`   Location: ${DB_PATH}`);
console.log('\n💡 Usage:');
console.log('   - The agent will automatically use this database');
console.log('   - Query directly: sqlite3 .windsurf/data/knowledge.db');
console.log('   - Backup: cp .windsurf/data/knowledge.db .windsurf/data/backups/\n');
