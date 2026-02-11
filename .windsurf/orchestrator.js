#!/usr/bin/env node
/**
 * Windsurf AI Agent Orchestrator
 * 
 * Central coordinator that routes requests, manages state, and ensures coherent execution.
 * This is the entry point for the agent optimization system.
 * 
 * Usage:
 *   node orchestrator.js init          - Initialize the system
 *   node orchestrator.js status        - Show current status
 *   node orchestrator.js trigger <msg> - Test trigger matching
 *   node orchestrator.js workflow <n>  - Start a workflow
 *   node orchestrator.js context       - Show loaded context
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Simple YAML parser (handles basic key: value and lists)
function parseYaml(content) {
    const result = {};
    const lines = content.split('\n');
    let currentKey = null;
    let currentList = null;
    let indent = 0;
    
    for (const line of lines) {
        if (line.trim().startsWith('#') || line.trim() === '') continue;
        
        const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
        if (match) {
            const spaces = match[1].length;
            const key = match[2].trim();
            const value = match[3].trim();
            
            if (value === '' || value.startsWith('[') || value.startsWith('{')) {
                currentKey = key;
                if (value === '') {
                    result[key] = {};
                } else {
                    try { result[key] = JSON.parse(value); } catch(e) { result[key] = value; }
                }
            } else if (value.startsWith('"') || value.startsWith("'")) {
                result[key] = value.slice(1, -1);
            } else {
                result[key] = value;
            }
        }
        
        const listMatch = line.match(/^(\s*)-\s+(.+)$/);
        if (listMatch && currentKey) {
            if (!Array.isArray(result[currentKey])) result[currentKey] = [];
            result[currentKey].push(listMatch[2].trim());
        }
    }
    return result;
}

// Extract frontmatter from markdown
function extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
        return parseYaml(match[1]);
    }
    return {};
}

// Configuration paths
const WINDSURF_DIR = path.join(__dirname);
const CONFIG_PATH = path.join(WINDSURF_DIR, 'config.yaml');
const TRIGGERS_PATH = path.join(WINDSURF_DIR, 'triggers.yaml');
const SKILLS_DIR = path.join(WINDSURF_DIR, 'skills');
const WORKFLOWS_DIR = path.join(WINDSURF_DIR, 'workflows');
const DATA_DIR = path.join(WINDSURF_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'knowledge.db');

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
};

// =============================================================================
// Configuration Loader
// =============================================================================

function loadConfig() {
    try {
        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return parseYaml(content);
    } catch (e) {
        console.error(`${colors.red}Error loading config:${colors.reset}`, e.message);
        return null;
    }
}

function loadTriggers() {
    try {
        const content = fs.readFileSync(TRIGGERS_PATH, 'utf-8');
        return parseYaml(content);
    } catch (e) {
        console.error(`${colors.red}Error loading triggers:${colors.reset}`, e.message);
        return null;
    }
}

// =============================================================================
// Trigger Matcher
// =============================================================================

function matchTrigger(message, triggers) {
    const msgLower = message.toLowerCase();
    const matches = [];
    
    // Check pattern triggers
    if (triggers.pattern_triggers) {
        for (const trigger of triggers.pattern_triggers) {
            for (const pattern of trigger.patterns) {
                if (msgLower.includes(pattern.toLowerCase())) {
                    matches.push({
                        type: 'pattern',
                        name: trigger.name,
                        pattern: pattern,
                        action: trigger.action,
                        priority: trigger.priority || 'medium'
                    });
                    break;
                }
            }
        }
    }
    
    // Check workflow triggers
    if (triggers.workflow_triggers) {
        for (const trigger of triggers.workflow_triggers) {
            for (const pattern of trigger.patterns) {
                if (msgLower.includes(pattern.toLowerCase())) {
                    matches.push({
                        type: 'workflow',
                        name: trigger.name,
                        pattern: pattern,
                        action: trigger.action,
                        workflow: trigger.action.workflow
                    });
                    break;
                }
            }
        }
    }
    
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    matches.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
    
    return matches;
}

// =============================================================================
// Skill Loader
// =============================================================================

function getAvailableSkills() {
    const skills = [];
    
    if (!fs.existsSync(SKILLS_DIR)) return skills;
    
    const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const dir of dirs) {
        if (dir.isDirectory()) {
            const skillPath = path.join(SKILLS_DIR, dir.name, 'SKILL.md');
            if (fs.existsSync(skillPath)) {
                try {
                    const content = fs.readFileSync(skillPath, 'utf-8');
                    const match = content.match(/^---\n([\s\S]*?)\n---/);
                    if (match) {
                        const meta = parseYaml(match[1]);
                        skills.push({
                            name: meta.name || dir.name,
                            description: meta.description || '',
                            path: skillPath
                        });
                    }
                } catch (e) {
                    skills.push({ name: dir.name, description: '', path: skillPath });
                }
            }
        }
    }
    
    return skills;
}

function getBlockchainSkills(config) {
    if (!config || !config.skills || !config.skills.tiers) return [];
    
    const tiers = config.skills.tiers;
    return {
        core: tiers.core || [],
        critical: tiers.critical || [],
        support: tiers.support || []
    };
}

// =============================================================================
// Workflow Loader
// =============================================================================

function getAvailableWorkflows() {
    const workflows = [];
    
    if (!fs.existsSync(WORKFLOWS_DIR)) return workflows;
    
    const files = fs.readdirSync(WORKFLOWS_DIR);
    for (const file of files) {
        if (file.endsWith('.md')) {
            const workflowPath = path.join(WORKFLOWS_DIR, file);
            try {
                const content = fs.readFileSync(workflowPath, 'utf-8');
                const match = content.match(/^---\n([\s\S]*?)\n---/);
                if (match) {
                    const meta = parseYaml(match[1]);
                    workflows.push({
                        name: meta.name || file.replace('.md', ''),
                        description: meta.description || '',
                        triggers: meta.triggers || [],
                        skills: meta.skills_required || [],
                        path: workflowPath
                    });
                }
            } catch (e) {
                workflows.push({ name: file.replace('.md', ''), description: '', path: workflowPath });
            }
        }
    }
    
    return workflows;
}

// =============================================================================
// Database Operations
// =============================================================================

function dbQuery(sql) {
    if (!fs.existsSync(DB_PATH)) return null;
    try {
        return execSync(`sqlite3 "${DB_PATH}" "${sql}"`, { encoding: 'utf-8' });
    } catch (e) {
        return null;
    }
}

function getSessionCount() {
    const result = dbQuery("SELECT COUNT(*) FROM session_state WHERE status='active';");
    return result ? parseInt(result.trim()) : 0;
}

function getMemoryCount() {
    const result = dbQuery("SELECT COUNT(*) FROM memories;");
    return result ? parseInt(result.trim()) : 0;
}

function getContractCount() {
    const result = dbQuery("SELECT COUNT(*) FROM contracts;");
    return result ? parseInt(result.trim()) : 0;
}

// =============================================================================
// Commands
// =============================================================================

function cmdInit() {
    console.log(`${colors.cyan}${colors.bright}🚀 Initializing Windsurf Agent System${colors.reset}\n`);
    
    // Check config
    console.log('Checking configuration...');
    const config = loadConfig();
    if (!config) {
        console.log(`${colors.red}  ✗ config.yaml not found or invalid${colors.reset}`);
        return;
    }
    console.log(`${colors.green}  ✓ config.yaml loaded${colors.reset}`);
    
    // Check triggers
    const triggers = loadTriggers();
    if (!triggers) {
        console.log(`${colors.red}  ✗ triggers.yaml not found or invalid${colors.reset}`);
        return;
    }
    const triggerCount = (triggers.pattern_triggers?.length || 0) + 
                         (triggers.event_triggers?.length || 0) +
                         (triggers.workflow_triggers?.length || 0);
    console.log(`${colors.green}  ✓ triggers.yaml loaded (${triggerCount} triggers)${colors.reset}`);
    
    // Check skills
    const skills = getAvailableSkills();
    console.log(`${colors.green}  ✓ ${skills.length} skills available${colors.reset}`);
    
    // Check workflows
    const workflows = getAvailableWorkflows();
    console.log(`${colors.green}  ✓ ${workflows.length} workflows available${colors.reset}`);
    
    // Initialize database
    console.log('\nInitializing database...');
    const initScript = path.join(DATA_DIR, 'init-db.js');
    if (fs.existsSync(initScript)) {
        try {
            execSync(`node "${initScript}"`, { stdio: 'inherit' });
        } catch (e) {
            console.log(`${colors.yellow}  ⚠ Database initialization had issues${colors.reset}`);
        }
    } else {
        console.log(`${colors.yellow}  ⚠ init-db.js not found${colors.reset}`);
    }
    
    console.log(`\n${colors.green}${colors.bright}✨ System initialized!${colors.reset}`);
    console.log(`\nRun ${colors.cyan}node orchestrator.js status${colors.reset} to see system status.`);
}

function cmdStatus() {
    console.log(`${colors.cyan}${colors.bright}📊 Windsurf Agent System Status${colors.reset}\n`);
    
    const config = loadConfig();
    const triggers = loadTriggers();
    const skills = getAvailableSkills();
    const workflows = getAvailableWorkflows();
    const blockchainSkills = getBlockchainSkills(config);
    
    // System info
    console.log(`${colors.bright}System:${colors.reset}`);
    console.log(`  Name: ${config?.name || 'Unknown'}`);
    console.log(`  Version: ${config?.version || 'Unknown'}`);
    console.log(`  Project Type: ${config?.blockchain?.tools?.framework || 'blockchain'}`);
    
    // Skills
    console.log(`\n${colors.bright}Skills:${colors.reset}`);
    console.log(`  Total Available: ${skills.length}`);
    console.log(`  Core Blockchain: ${blockchainSkills.core?.length || 0}`);
    console.log(`  Critical Support: ${blockchainSkills.critical?.length || 0}`);
    console.log(`  Enhancement: ${blockchainSkills.support?.length || 0}`);
    
    // Triggers
    console.log(`\n${colors.bright}Triggers:${colors.reset}`);
    console.log(`  Pattern: ${triggers?.pattern_triggers?.length || 0}`);
    console.log(`  Event: ${triggers?.event_triggers?.length || 0}`);
    console.log(`  Context: ${triggers?.context_triggers?.length || 0}`);
    console.log(`  Workflow: ${triggers?.workflow_triggers?.length || 0}`);
    
    // Workflows
    console.log(`\n${colors.bright}Workflows:${colors.reset}`);
    for (const wf of workflows) {
        console.log(`  - ${wf.name}`);
    }
    
    // Database
    console.log(`\n${colors.bright}Database:${colors.reset}`);
    if (fs.existsSync(DB_PATH)) {
        console.log(`  Status: ${colors.green}Active${colors.reset}`);
        console.log(`  Active Sessions: ${getSessionCount()}`);
        console.log(`  Memories: ${getMemoryCount()}`);
        console.log(`  Contracts: ${getContractCount()}`);
    } else {
        console.log(`  Status: ${colors.yellow}Not initialized${colors.reset}`);
    }
    
    // Context files
    console.log(`\n${colors.bright}Context Files:${colors.reset}`);
    const contextDir = path.join(WINDSURF_DIR, 'context');
    if (fs.existsSync(contextDir)) {
        const contextFiles = fs.readdirSync(contextDir);
        for (const file of contextFiles) {
            console.log(`  - ${file}`);
        }
    }
}

function cmdTrigger(message) {
    console.log(`${colors.cyan}${colors.bright}🎯 Testing Trigger Match${colors.reset}\n`);
    console.log(`Input: "${message}"\n`);
    
    const triggers = loadTriggers();
    if (!triggers) {
        console.log(`${colors.red}No triggers loaded${colors.reset}`);
        return;
    }
    
    const matches = matchTrigger(message, triggers);
    
    if (matches.length === 0) {
        console.log(`${colors.yellow}No triggers matched${colors.reset}`);
        return;
    }
    
    console.log(`${colors.green}Matched ${matches.length} trigger(s):${colors.reset}\n`);
    
    for (const match of matches) {
        console.log(`${colors.bright}${match.name}${colors.reset}`);
        console.log(`  Type: ${match.type}`);
        console.log(`  Pattern: "${match.pattern}"`);
        console.log(`  Priority: ${match.priority || 'medium'}`);
        
        if (match.action?.skills) {
            console.log(`  Skills to load: ${match.action.skills.join(', ')}`);
        }
        if (match.workflow) {
            console.log(`  Workflow: ${match.workflow}`);
        }
        console.log('');
    }
}

function cmdWorkflow(name) {
    console.log(`${colors.cyan}${colors.bright}📋 Workflow: ${name}${colors.reset}\n`);
    
    const workflows = getAvailableWorkflows();
    const workflow = workflows.find(w => w.name === name || w.name.includes(name));
    
    if (!workflow) {
        console.log(`${colors.red}Workflow not found: ${name}${colors.reset}`);
        console.log(`\nAvailable workflows:`);
        for (const wf of workflows) {
            console.log(`  - ${wf.name}`);
        }
        return;
    }
    
    console.log(`Name: ${workflow.name}`);
    console.log(`Description: ${workflow.description}`);
    console.log(`Required Skills: ${workflow.skills.join(', ') || 'None specified'}`);
    console.log(`Path: ${workflow.path}`);
    
    console.log(`\n${colors.bright}Workflow Content:${colors.reset}`);
    console.log('─'.repeat(60));
    const content = fs.readFileSync(workflow.path, 'utf-8');
    // Show first 50 lines
    const lines = content.split('\n').slice(0, 50);
    console.log(lines.join('\n'));
    if (content.split('\n').length > 50) {
        console.log(`\n... (${content.split('\n').length - 50} more lines)`);
    }
}

function cmdContext() {
    console.log(`${colors.cyan}${colors.bright}📚 Context Files${colors.reset}\n`);
    
    const contextDir = path.join(WINDSURF_DIR, 'context');
    if (!fs.existsSync(contextDir)) {
        console.log(`${colors.yellow}No context directory found${colors.reset}`);
        return;
    }
    
    const files = fs.readdirSync(contextDir);
    for (const file of files) {
        const filePath = path.join(contextDir, file);
        const stats = fs.statSync(filePath);
        console.log(`${colors.bright}${file}${colors.reset}`);
        console.log(`  Size: ${stats.size} bytes`);
        console.log(`  Modified: ${stats.mtime.toISOString()}`);
        console.log('');
    }
}

function cmdHelp() {
    console.log(`${colors.cyan}${colors.bright}Windsurf AI Agent Orchestrator${colors.reset}\n`);
    console.log('Usage: node orchestrator.js <command> [args]\n');
    console.log('Commands:');
    console.log('  init              Initialize the system');
    console.log('  status            Show current status');
    console.log('  trigger <msg>     Test trigger matching');
    console.log('  workflow <name>   Show workflow details');
    console.log('  context           Show context files');
    console.log('  help              Show this help message');
}

// =============================================================================
// Main
// =============================================================================

function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    switch (command) {
        case 'init':
            cmdInit();
            break;
        case 'status':
            cmdStatus();
            break;
        case 'trigger':
            cmdTrigger(args.slice(1).join(' ') || 'help');
            break;
        case 'workflow':
            cmdWorkflow(args[1] || '');
            break;
        case 'context':
            cmdContext();
            break;
        case 'help':
        default:
            cmdHelp();
            break;
    }
}

main();
