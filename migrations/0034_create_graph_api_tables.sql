-- Migration 0034: Create tables for Graph API (Projects, Nodes, Relationships, Dependencies, Tags, Rules, Contexts, etc.)
-- This implements the complete API specification with 19 categories

-- ============================================================================
-- 1. PROJECTS (enhanced from existing table)
-- ============================================================================
-- Drop existing projects table if it exists (we'll recreate with enhanced schema)
DROP TABLE IF EXISTS projects;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'deleted'
  node_count INTEGER DEFAULT 0,
  flow_count INTEGER DEFAULT 0,
  task_count INTEGER DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT -- JSON metadata
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

-- ============================================================================
-- 2. NODES (core entity for knowledge graph structure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'task', 'doc', 'api', 'concept', 'rule', 'context', 'data', 'ui', 'system'
  title TEXT NOT NULL,
  content TEXT, -- JSON or text content
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'completed', 'failed'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nodes_project_id ON nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at);

-- ============================================================================
-- 3. LEVELS (hierarchy/parent-child relationships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS levels (
  id TEXT PRIMARY KEY,
  parent_node_id TEXT NOT NULL,
  child_node_id TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (parent_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (child_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(parent_node_id, child_node_id)
);

CREATE INDEX IF NOT EXISTS idx_levels_parent ON levels(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_levels_child ON levels(child_node_id);

-- ============================================================================
-- 4. RELATIONSHIPS (graph edges between nodes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, -- 'depends_on', 'triggers', 'references', 'implements', 'tests', 'documents'
  weight REAL DEFAULT 1.0, -- Strength of relationship (0.0-1.0)
  created_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(source_node_id, target_node_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_node_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_node_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relation_type);

-- ============================================================================
-- 5. DEPENDENCIES (special type of relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dependencies (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  depends_on_node_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL, -- 'hard', 'soft', 'temporal', 'resource'
  created_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(node_id, depends_on_node_id, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_node ON dependencies(node_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_depends_on ON dependencies(depends_on_node_id);

-- ============================================================================
-- 6. TAGS (categorization system)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT, -- Hex color code for UI
  created_at INTEGER NOT NULL,
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS node_tags (
  node_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (node_id, tag_id),
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_node_tags_node ON node_tags(node_id);
CREATE INDEX IF NOT EXISTS idx_node_tags_tag ON node_tags(tag_id);

-- ============================================================================
-- 7. RULES (business logic and conditions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL, -- Node this rule belongs to
  rule_pattern TEXT NOT NULL, -- Pattern or condition expression
  execution_type TEXT NOT NULL, -- 'pre', 'post', 'conditional', 'validation'
  engine TEXT DEFAULT 'javascript', -- 'javascript', 'sql', 'python', 'custom'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rules_node_id ON rules(node_id);
CREATE INDEX IF NOT EXISTS idx_rules_execution_type ON rules(execution_type);

-- ============================================================================
-- 8. RULE VARIABLES (variables used in rules)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rule_variables (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'array', 'object'
  source TEXT NOT NULL, -- 'context', 'node', 'flow', 'external', 'constant'
  default_value TEXT, -- JSON string default value
  created_at INTEGER NOT NULL,
  FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE,
  UNIQUE(rule_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rule_variables_rule_id ON rule_variables(rule_id);

-- ============================================================================
-- 9. FLOW TRANSITIONS (connections between flow steps)
-- ============================================================================
CREATE TABLE IF NOT EXISTS flow_transitions (
  id TEXT PRIMARY KEY,
  from_step_id TEXT NOT NULL, -- References flow_steps.id
  to_step_id TEXT NOT NULL, -- References flow_steps.id
  condition_rule_id TEXT, -- References rules.id (optional condition)
  created_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (from_step_id) REFERENCES flow_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (to_step_id) REFERENCES flow_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (condition_rule_id) REFERENCES rules(id) ON DELETE SET NULL,
  UNIQUE(from_step_id, to_step_id, condition_rule_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_transitions_from ON flow_transitions(from_step_id);
CREATE INDEX IF NOT EXISTS idx_flow_transitions_to ON flow_transitions(to_step_id);

-- ============================================================================
-- 10. CONTEXTS (execution contexts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contexts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'node', 'flow', 'project', 'execution', 'user'
  entity_id TEXT NOT NULL, -- ID of the entity
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_contexts_entity ON contexts(entity_type, entity_id);

-- ============================================================================
-- 11. CONTEXT VARIABLES (variables in execution contexts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS context_variables (
  id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL, -- JSON string value
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
  UNIQUE(context_id, name)
);

CREATE INDEX IF NOT EXISTS idx_context_variables_context ON context_variables(context_id);
CREATE INDEX IF NOT EXISTS idx_context_variables_name ON context_variables(name);

-- ============================================================================
-- 12. EXECUTIONS (enhanced from existing table)
-- ============================================================================
-- Note: executions table already exists in migration 0007
-- We'll add missing columns if needed
ALTER TABLE executions ADD COLUMN IF NOT EXISTS context_id TEXT;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS engine TEXT DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_executions_context_id ON executions(context_id);

-- ============================================================================
-- 7. FLOWS (process graph - workflow definitions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'draft'
  metadata TEXT, -- JSON metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flows_project_id ON flows(project_id);
CREATE INDEX IF NOT EXISTS idx_flows_status ON flows(status);

-- ============================================================================
-- 8. STEPS (steps within flows)
-- ============================================================================
CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'action', 'decision', 'input', 'output', 'validation'
  content TEXT, -- JSON or text content (instructions, configuration)
  order_index INTEGER DEFAULT 0,
  metadata TEXT, -- JSON metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_flow_id ON steps(flow_id);
CREATE INDEX IF NOT EXISTS idx_steps_order_index ON steps(order_index);

-- ============================================================================
-- 9. STEP EDGES (connections between steps for branching/conditions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS step_edges (
  id TEXT PRIMARY KEY,
  source_step_id TEXT NOT NULL,
  target_step_id TEXT NOT NULL,
  condition TEXT, -- Condition expression (optional)
  weight REAL DEFAULT 1.0, -- Weight for probabilistic branching
  metadata TEXT, -- JSON metadata
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_step_id) REFERENCES steps(id) ON DELETE CASCADE,
  FOREIGN KEY (target_step_id) REFERENCES steps(id) ON DELETE CASCADE,
  UNIQUE(source_step_id, target_step_id, condition)
);

CREATE INDEX IF NOT EXISTS idx_step_edges_source ON step_edges(source_step_id);
CREATE INDEX IF NOT EXISTS idx_step_edges_target ON step_edges(target_step_id);

-- ============================================================================
-- 10. FLOW RUNS (execution instances of flows)
-- ============================================================================
CREATE TABLE IF NOT EXISTS flow_runs (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'paused'
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  metadata TEXT, -- JSON metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON flow_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_status ON flow_runs(status);
CREATE INDEX IF NOT EXISTS idx_flow_runs_started_at ON flow_runs(started_at);

-- ============================================================================
-- 11. STEP RUNS (execution instances of steps)
-- ============================================================================
CREATE TABLE IF NOT EXISTS step_runs (
  id TEXT PRIMARY KEY,
  flow_run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped'
  output TEXT, -- JSON or text output from step execution
  started_at INTEGER,
  finished_at INTEGER,
  metadata TEXT, -- JSON metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_run_id) REFERENCES flow_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_step_runs_flow_run_id ON step_runs(flow_run_id);
CREATE INDEX IF NOT EXISTS idx_step_runs_step_id ON step_runs(step_id);
CREATE INDEX IF NOT EXISTS idx_step_runs_status ON step_runs(status);

-- ============================================================================
-- 12. Remove old flow_transitions table (replaced by step_edges)
-- ============================================================================
DROP TABLE IF EXISTS flow_transitions;

-- ============================================================================
-- 13. Insert sample data for testing
-- ============================================================================

-- Insert sample project
INSERT OR IGNORE INTO projects (id, name, status, node_count, flow_count, task_count, execution_count, created_at, updated_at, metadata) VALUES
('project-1', 'DeepSeek Agent', 'active', 0, 0, 0, 0, strftime('%s', 'now'), strftime('%s', 'now'), '{"description": "AI agent for code analysis and execution"}');

-- Insert sample nodes (knowledge graph)
INSERT OR IGNORE INTO nodes (id, project_id, type, title, content, status, created_at, updated_at, metadata) VALUES
('node-1', 'project-1', 'task', 'Implement API endpoints', '{"description": "Create all missing API endpoints"}', 'active', strftime('%s', 'now'), strftime('%s', 'now'), '{"priority": "high"}'),
('node-2', 'project-1', 'api', 'User Authentication API', '{"endpoint": "/auth", "methods": ["POST"]}', 'active', strftime('%s', 'now'), strftime('%s', 'now'), '{"version": "1.0"}'),
('node-3', 'project-1', 'concept', 'Rate Limiting', '{"description": "Limit API requests per user"}', 'active', strftime('%s', 'now'), strftime('%s', 'now'), '{"category": "security"}');

-- Insert sample tags
INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES
('tag-1', 'api', '#3498db', strftime('%s', 'now')),
('tag-2', 'backend', '#2ecc71', strftime('%s', 'now')),
('tag-3', 'priority-high', '#e74c3c', strftime('%s', 'now'));

-- Insert sample flow (process graph)
INSERT OR IGNORE INTO flows (id, project_id, title, status, metadata, created_at, updated_at) VALUES
('flow-1', 'project-1', 'API Development Workflow', 'active', '{"description": "Standard workflow for API development"}', strftime('%s', 'now'), strftime('%s', 'now'));

-- Insert sample steps
INSERT OR IGNORE INTO steps (id, flow_id, title, type, content, order_index, metadata, created_at, updated_at) VALUES
('step-1', 'flow-1', 'Design API Specification', 'action', '{"instructions": "Design the API endpoints, request/response formats"}', 1, '{"estimated_time": "2h"}', strftime('%s', 'now'), strftime('%s', 'now')),
('step-2', 'flow-1', 'Implement Endpoints', 'action', '{"instructions": "Write the actual API implementation code"}', 2, '{"estimated_time": "4h"}', strftime('%s', 'now'), strftime('%s', 'now')),
('step-3', 'flow-1', 'Write Tests', 'action', '{"instructions": "Create unit and integration tests"}', 3, '{"estimated_time": "3h"}', strftime('%s', 'now'), strftime('%s', 'now')),
('step-4', 'flow-1', 'Code Review', 'decision', '{"instructions": "Review the code and tests"}', 4, '{"requires_approval": true}', strftime('%s', 'now'), strftime('%s', 'now')),
('step-5', 'flow-1', 'Deploy to Staging', 'action', '{"instructions": "Deploy the API to staging environment"}', 5, '{"environment": "staging"}', strftime('%s', 'now'), strftime('%s', 'now'));

-- Insert sample step edges (connections)
INSERT OR IGNORE INTO step_edges (id, source_step_id, target_step_id, condition, weight, metadata, created_at) VALUES
('edge-1', 'step-1', 'step-2', NULL, 1.0, '{"type": "sequential"}', strftime('%s', 'now')),
('edge-2', 'step-2', 'step-3', NULL, 1.0, '{"type": "sequential"}', strftime('%s', 'now')),
('edge-3', 'step-3', 'step-4', NULL, 1.0, '{"type": "sequential"}', strftime('%s', 'now')),
('edge-4', 'step-4', 'step-5', 'review_passed == true', 1.0, '{"type": "conditional"}', strftime('%s', 'now'));

-- Insert sample flow run
INSERT OR IGNORE INTO flow_runs (id, flow_id, status, started_at, finished_at, metadata, created_at, updated_at) VALUES
('flow-run-1', 'flow-1', 'running', strftime('%s', 'now') - 3600, NULL, '{"triggered_by": "user123"}', strftime('%s', 'now'), strftime('%s', 'now'));

-- Insert sample step runs
INSERT OR IGNORE INTO step_runs (id, flow_run_id, step_id, status, output, started_at, finished_at, metadata, created_at, updated_at) VALUES
('step-run-1', 'flow-run-1', 'step-1', 'completed', '{"specification": "API spec completed"}', strftime('%s', 'now') - 3600, strftime('%s', 'now') - 3300, '{"duration": "30m"}', strftime('%s', 'now'), strftime('%s', 'now')),
('step-run-2', 'flow-run-1', 'step-2', 'running', NULL, strftime('%s', 'now') - 3300, NULL, '{"progress": "50%"}', strftime('%s', 'now'), strftime('%s', 'now'));

-- Insert node-tag associations
INSERT OR IGNORE INTO node_tags (node_id, tag_id, created_at) VALUES
('node-1', 'tag-1', strftime('%s', 'now')),
('node-1', 'tag-3', strftime('%s', 'now')),
('node-2', 'tag-1', strftime('%s', 'now')),
('node-2', 'tag-2', strftime('%s', 'now'));

-- Insert sample relationship
INSERT OR IGNORE INTO relationships (id, source_node_id, target_node_id, relation_type, weight, created_at, metadata) VALUES
('rel-1', 'node-1', 'node-2', 'implements', 0.8, strftime('%s', 'now'), '{"description": "Task implements flow"}');

-- Insert sample dependency
INSERT OR IGNORE INTO dependencies (id, node_id, depends_on_node_id, dependency_type, created_at, metadata) VALUES
('dep-1', 'node-1', 'node-3', 'hard', strftime('%s', 'now'), '{"description": "Task depends on validation rule"}');

-- Insert sample rule
INSERT OR IGNORE INTO rules (id, node_id, rule_pattern, execution_type, engine, created_at, updated_at, metadata) VALUES
('rule-1', 'node-3', 'return context.status === "active";', 'validation', 'javascript', strftime('%s', 'now'), strftime('%s', 'now'), '{"description": "Validate node is active"}');

-- Insert sample rule variable
INSERT OR IGNORE INTO rule_variables (id, rule_id, name, type, source, default_value, created_at) VALUES
('var-1', 'rule-1', 'status', 'string', 'context', '"active"', strftime('%s', 'now'));

-- Insert sample context
INSERT OR IGNORE INTO contexts (id, entity_type, entity_id, created_at, updated_at, metadata) VALUES
('ctx-1', 'node', 'node-1', strftime('%s', 'now'), strftime('%s', 'now'), '{"description": "Execution context for node-1"}');

-- Insert sample context variable
INSERT OR IGNORE INTO context_variables (id, context_id, name, value, created_at, updated_at) VALUES
('ctx-var-1', 'ctx-1', 'status', '"active"', strftime('%s', 'now'), strftime('%s', 'now'));