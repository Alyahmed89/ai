-- Migration 0008: Dynamic flow branching for etaflow
-- Extends flow_steps table with conditional branching support

-- Add columns to flow_steps for conditional branching
ALTER TABLE flow_steps ADD COLUMN next_step_conditions TEXT;
ALTER TABLE flow_steps ADD COLUMN default_next_step INTEGER;
ALTER TABLE flow_steps ADD COLUMN response_parser TEXT; -- JSON path or regex for extracting values
ALTER TABLE flow_steps ADD COLUMN step_type TEXT DEFAULT 'standard'; -- 'standard', 'conditional', 'parallel', 'validation'

-- Create a new table for flow step conditions
CREATE TABLE IF NOT EXISTS flow_step_conditions (
  id TEXT PRIMARY KEY,
  flow_step_id TEXT NOT NULL,
  condition_type TEXT NOT NULL, -- 'response_contains', 'response_matches', 'status_equals', 'value_greater_than', etc.
  condition_value TEXT NOT NULL, -- Value to compare against
  condition_operator TEXT DEFAULT 'equals', -- 'equals', 'contains', 'matches', 'greater_than', 'less_than'
  next_step INTEGER NOT NULL, -- Step number to jump to if condition is true
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_step_id) REFERENCES flow_steps(id) ON DELETE CASCADE
);

-- Create index for faster condition lookups
CREATE INDEX IF NOT EXISTS idx_flow_step_conditions_flow_step_id ON flow_step_conditions(flow_step_id);

-- Create a table for flow variables (state that persists across steps)
CREATE TABLE IF NOT EXISTS flow_variables (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, variable_name)
);

-- Create index for flow variables
CREATE INDEX IF NOT EXISTS idx_flow_variables_flow_id ON flow_variables(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_variables_name ON flow_variables(variable_name);

-- Insert example etaflow with conditional branching
INSERT OR IGNORE INTO flows (
  id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at
) VALUES (
  'etaflow',
  'ETA Dynamic Flow',
  'Starting etaflow with dynamic conditional branching',
  'You are an etaflow execution assistant. Follow flow steps precisely. Analyze responses and determine next step based on conditions.',
  'flow/execution',
  'main',
  50,
  '[]', -- Steps will be in flow_steps table
  strftime('%s', 'now')
);

-- Example step 1 for etaflow: Initial task
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  next_step_conditions, default_next_step, response_parser, step_type, created_at, updated_at
) VALUES (
  'etaflow_step_1',
  'etaflow',
  1,
  'Execute the initial task: {{task_description}}',
  'status: success',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "status:"}',
  '[{"condition": "response_contains", "value": "status: success", "next_step": 5}, {"condition": "response_contains", "value": "status: error", "next_step": 2}]',
  3, -- Default next step if no conditions match
  '$.status', -- JSON path parser
  'conditional',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Example step 2 for etaflow: Error handling
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  next_step_conditions, default_next_step, response_parser, step_type, created_at, updated_at
) VALUES (
  'etaflow_step_2',
  'etaflow',
  2,
  'Handle error from previous step. Diagnose and fix the issue: {{error_details}}',
  'error_resolved: true',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "error_resolved:"}',
  '[{"condition": "response_contains", "value": "error_resolved: true", "next_step": 5}, {"condition": "response_contains", "value": "error_resolved: false", "next_step": 3}]',
  2, -- Stay on same step if error not resolved
  '$.error_resolved',
  'conditional',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Example step 3 for etaflow: Retry logic
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  next_step_conditions, default_next_step, response_parser, step_type, created_at, updated_at
) VALUES (
  'etaflow_step_3',
  'etaflow',
  3,
  'Retry the task with alternative approach: {{task_description}}',
  'retry_result:',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "retry_result:"}',
  '[{"condition": "response_contains", "value": "retry_result: success", "next_step": 5}, {"condition": "response_contains", "value": "retry_result: failed", "next_step": 4}]',
  3,
  '$.retry_result',
  'conditional',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Example step 4 for etaflow: Fallback
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  next_step_conditions, default_next_step, response_parser, step_type, created_at, updated_at
) VALUES (
  'etaflow_step_4',
  'etaflow',
  4,
  'Execute fallback procedure for task: {{task_description}}',
  'fallback_complete:',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "fallback_complete:"}',
  '[{"condition": "response_contains", "value": "fallback_complete: true", "next_step": 5}]',
  4,
  '$.fallback_complete',
  'conditional',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Example step 5 for etaflow: Success path
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  next_step_conditions, default_next_step, response_parser, step_type, created_at, updated_at
) VALUES (
  'etaflow_step_5',
  'etaflow',
  5,
  'Task completed successfully. Proceed to next phase: {{next_phase_description}}',
  'phase_complete:',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "phase_complete:"}',
  '[{"condition": "response_contains", "value": "phase_complete: true", "next_step": 6}]',
  5,
  '$.phase_complete',
  'standard',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Insert conditions into the separate conditions table
INSERT OR IGNORE INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at) VALUES
  ('cond_etaflow_1_1', 'etaflow_step_1', 'response_contains', 'status: success', 'contains', 5, strftime('%s', 'now'), strftime('%s', 'now')),
  ('cond_etaflow_1_2', 'etaflow_step_1', 'response_contains', 'status: error', 'contains', 2, strftime('%s', 'now'), strftime('%s', 'now')),
  ('cond_etaflow_2_1', 'etaflow_step_2', 'response_contains', 'error_resolved: true', 'contains', 5, strftime('%s', 'now'), strftime('%s', 'now')),
  ('cond_etaflow_2_2', 'etaflow_step_2', 'response_contains', 'error_resolved: false', 'contains', 3, strftime('%s', 'now'), strftime('%s', 'now')),
  ('cond_etaflow_3_1', 'etaflow_step_3', 'response_contains', 'retry_result: success', 'contains', 5, strftime('%s', 'now'), strftime('%s', 'now')),
  ('cond_etaflow_3_2', 'etaflow_step_3', 'response_contains', 'retry_result: failed', 'contains', 4, strftime('%s', 'now'), strftime('%s', 'now')),
  ('cond_etaflow_4_1', 'etaflow_step_4', 'response_contains', 'fallback_complete: true', 'contains', 5, strftime('%s', 'now'), strftime('%s', 'now')),
  ('cond_etaflow_5_1', 'etaflow_step_5', 'response_contains', 'phase_complete: true', 'contains', 6, strftime('%s', 'now'), strftime('%s', 'now'));

-- Insert example flow variables
INSERT OR IGNORE INTO flow_variables (id, flow_id, variable_name, variable_value, variable_type, created_at, updated_at) VALUES
  ('var_etaflow_1', 'etaflow', 'task_description', 'Initialize system and check dependencies', 'string', strftime('%s', 'now'), strftime('%s', 'now')),
  ('var_etaflow_2', 'etaflow', 'max_retries', '3', 'number', strftime('%s', 'now'), strftime('%s', 'now')),
  ('var_etaflow_3', 'etaflow', 'current_retry_count', '0', 'number', strftime('%s', 'now'), strftime('%s', 'now')),
  ('var_etaflow_4', 'etaflow', 'next_phase_description', 'Begin main processing workflow', 'string', strftime('%s', 'now'), strftime('%s', 'now'));

-- Update existing flows table to support dynamic flows
ALTER TABLE flows ADD COLUMN flow_type TEXT DEFAULT 'standard'; -- 'standard', 'dynamic', 'conditional'
ALTER TABLE flows ADD COLUMN variables_template TEXT; -- JSON template for flow variables

-- Mark etaflow as dynamic
UPDATE flows SET flow_type = 'dynamic', variables_template = '{"task_description": "{{user_input}}", "max_retries": 3, "current_retry_count": 0}' WHERE id = 'etaflow';