-- Migration 0012: Complete test_flow_001 data migration
-- Insert flow definition, project context, testing priorities, and API commands

-- First, ensure the flows table exists and insert test_flow_001 definition
INSERT OR IGNORE INTO flows (
  id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at
) VALUES (
  'test_flow_001',
  'Test Flow 001',
  'Execute test flow with database-driven context',
  'You are a test execution assistant. Use the provided project context, testing priorities, and API commands to execute the flow.',
  'Alyahmed89/deepseek-agent',
  'flow',
  20,
  '[]', -- Steps are in flow_steps table
  strftime('%s', 'now')
);

-- Create project_context table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_context (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  context_key TEXT NOT NULL,
  context_value TEXT NOT NULL,
  context_type TEXT DEFAULT 'text', -- 'text', 'json', 'code', 'url'
  priority INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, context_key)
);

-- Create testing_priorities table if it doesn't exist
CREATE TABLE IF NOT EXISTS testing_priorities (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  priority INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tests TEXT,
  ui_requirements TEXT,
  sections TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, priority)
);

-- Create api_commands table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_commands (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  description TEXT NOT NULL,
  placeholder_example TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, name)
);

-- Insert project context data (11 items)
INSERT OR IGNORE INTO project_context (id, flow_id, context_key, context_value, context_type, priority, created_at, updated_at) VALUES
  ('ctx_001', 'test_flow_001', 'project_name', 'DeepSeek Agent Flow System', 'text', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_002', 'test_flow_001', 'repository', 'Alyahmed89/deepseek-agent', 'text', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_003', 'test_flow_001', 'branch', 'flow', 'text', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_004', 'test_flow_001', 'architecture', 'Cloudflare Workers + D1 Database + Durable Objects', 'text', 2, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_005', 'test_flow_001', 'purpose', 'Migrate flow execution context from JSON payloads to structured database tables', 'text', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_006', 'test_flow_001', 'database_id', '35f4cc1c-5656-4c02-bda8-26b62b63e6ca', 'text', 3, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_007', 'test_flow_001', 'current_state', 'TypeScript errors fixed, server starts but HTTP requests hang', 'text', 2, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_008', 'test_flow_001', 'goal', 'Execute flow with minimal payload {"flow": "test_flow_001"}', 'text', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_009', 'test_flow_001', 'dependencies', 'Cloudflare D1 Database API, Cloudflare API token, Dynamic imports in Durable Object', 'text', 3, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_010', 'test_flow_001', 'test_payload', '{"flow": "test_flow_001"}', 'json', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('ctx_011', 'test_flow_001', 'expected_outcome', 'Database-driven execution without large JSON payloads', 'text', 1, strftime('%s', 'now'), strftime('%s', 'now'));

-- Insert testing priorities (7 items)
INSERT OR IGNORE INTO testing_priorities (id, flow_id, priority, name, description, tests, ui_requirements, sections, created_at, updated_at) VALUES
  ('pri_001', 'test_flow_001', 1, 'Flow Initialization', 'Test flow initialization with minimal payload', 'POST /initialize with {"flow": "test_flow_001"}', 'None', 'initialization', strftime('%s', 'now'), strftime('%s', 'now')),
  ('pri_002', 'test_flow_001', 2, 'Database Context Loading', 'Verify flow context loads from database', 'Check database queries return project context, testing priorities, API commands', 'None', 'database', strftime('%s', 'now'), strftime('%s', 'now')),
  ('pri_003', 'test_flow_001', 3, 'Task Execution', 'Test task execution flow', 'Verify next task is selected and executed', 'Task progress tracking', 'execution', strftime('%s', 'now'), strftime('%s', 'now')),
  ('pri_004', 'test_flow_001', 4, 'Response Processing', 'Test DeepSeek response processing', 'Verify responses are processed and validated', 'Response validation UI', 'processing', strftime('%s', 'now'), strftime('%s', 'now')),
  ('pri_005', 'test_flow_001', 5, 'Flow Completion', 'Test flow completion logic', 'Verify flow completes when all tasks done', 'Completion status display', 'completion', strftime('%s', 'now'), strftime('%s', 'now')),
  ('pri_006', 'test_flow_001', 6, 'Error Handling', 'Test error handling and recovery', 'Simulate database errors, network failures', 'Error messages and retry UI', 'error_handling', strftime('%s', 'now'), strftime('%s', 'now')),
  ('pri_007', 'test_flow_001', 7, 'Performance', 'Test performance with database-driven approach', 'Measure response times vs JSON payload approach', 'Performance metrics display', 'performance', strftime('%s', 'now'), strftime('%s', 'now'));

-- Insert API commands (5 items)
INSERT OR IGNORE INTO api_commands (id, flow_id, name, command, description, placeholder_example, created_at, updated_at) VALUES
  ('api_001', 'test_flow_001', 'Initialize Flow', 'POST /initialize', 'Initialize a new flow execution', '{"flow": "test_flow_001", "repository": "Alyahmed89/deepseek-agent", "branch": "flow"}', strftime('%s', 'now'), strftime('%s', 'now')),
  ('api_002', 'test_flow_001', 'Get Flow Context', 'GET /flows/{flow_id}/context', 'Get complete flow context from database', '{"flow_id": "test_flow_001"}', strftime('%s', 'now'), strftime('%s', 'now')),
  ('api_003', 'test_flow_001', 'Execute Task', 'POST /tasks/{task_id}/execute', 'Execute a specific task', '{"task_id": "test_task_001", "parameters": {}}', strftime('%s', 'now'), strftime('%s', 'now')),
  ('api_004', 'test_flow_001', 'Update Flow Status', 'PUT /flows/{flow_id}/status', 'Update flow execution status', '{"flow_id": "test_flow_001", "status": "completed", "result": "success"}', strftime('%s', 'now'), strftime('%s', 'now')),
  ('api_005', 'test_flow_001', 'Query Database', 'POST /database/query', 'Execute direct database query', '{"query": "SELECT * FROM project_context WHERE flow_id = ?", "params": ["test_flow_001"]}', strftime('%s', 'now'), strftime('%s', 'now'));

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_project_context_flow_id ON project_context(flow_id);
CREATE INDEX IF NOT EXISTS idx_project_context_priority ON project_context(priority);
CREATE INDEX IF NOT EXISTS idx_testing_priorities_flow_id ON testing_priorities(flow_id);
CREATE INDEX IF NOT EXISTS idx_testing_priorities_priority ON testing_priorities(priority);
CREATE INDEX IF NOT EXISTS idx_api_commands_flow_id ON api_commands(flow_id);

-- Update flow definition with system prompt
UPDATE flows SET deepseek_system = 'You are executing test_flow_001. Use the following context:
PROJECT CONTEXT:
- Project: DeepSeek Agent Flow System
- Repository: Alyahmed89/deepseek-agent (branch: flow)
- Architecture: Cloudflare Workers + D1 Database + Durable Objects
- Purpose: Migrate flow execution context from JSON payloads to structured database tables
- Database ID: 35f4cc1c-5656-4c02-bda8-26b62b63e6ca
- Goal: Execute flow with minimal payload {"flow": "test_flow_001"}
- Current State: TypeScript errors fixed, testing database-driven execution

TESTING PRIORITIES:
1. Flow Initialization - Test with minimal payload
2. Database Context Loading - Verify context loads from DB
3. Task Execution - Test task selection and execution
4. Response Processing - Validate DeepSeek responses
5. Flow Completion - Verify completion logic
6. Error Handling - Test recovery from failures
7. Performance - Measure database-driven approach

API COMMANDS:
1. POST /initialize - Initialize flow execution
2. GET /flows/{flow_id}/context - Get flow context
3. POST /tasks/{task_id}/execute - Execute specific task
4. PUT /flows/{flow_id}/status - Update flow status
5. POST /database/query - Execute database query

Execute the flow step by step, reporting progress at each stage.' WHERE id = 'test_flow_001';