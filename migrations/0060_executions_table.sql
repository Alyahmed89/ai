-- Migration 0007: Add executions table (flow_run)
-- Record each run with execution_id, flow_id, current_step, status, timestamps

CREATE TABLE IF NOT EXISTS executions (
  execution_id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  project_id TEXT,
  current_step INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'stopped'
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  error_message TEXT,
  metadata TEXT, -- JSON metadata about the execution
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_executions_flow_id ON executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_executions_project_id ON executions(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at);

-- Create execution_steps table to track step-level execution details
CREATE TABLE IF NOT EXISTS execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_id TEXT NOT NULL, -- References flow_steps.id
  prompt_sent TEXT,
  response_received TEXT,
  validation_called BOOLEAN DEFAULT FALSE,
  validation_passed BOOLEAN,
  validation_response TEXT, -- JSON response from validator
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  metadata TEXT, -- JSON metadata about step execution
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES flow_steps(id) ON DELETE CASCADE
);

-- Create indexes for execution_steps
CREATE INDEX IF NOT EXISTS idx_execution_steps_execution_id ON execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_steps_step_number ON execution_steps(step_number);

-- Insert a test execution record for the existing test flow
INSERT OR IGNORE INTO executions (
  execution_id, flow_id, project_id, current_step, status, started_at, finished_at, created_at, updated_at
) VALUES (
  'test_execution_001',
  'test_flow_001',
  'test_project',
  2, -- Completed both steps
  'completed',
  strftime('%s', 'now') - 3600, -- Started 1 hour ago
  strftime('%s', 'now') - 1800, -- Finished 30 minutes ago
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Insert test execution steps
INSERT OR IGNORE INTO execution_steps (
  id, execution_id, step_number, step_id, prompt_sent, response_received, validation_called, validation_passed, started_at, completed_at, created_at, updated_at
) VALUES 
  (
    'exec_step_001_1',
    'test_execution_001',
    1,
    'step_test_001_1',
    'Store test data with key "test_key" and value: test_value_123',
    'DATA_READY',
    TRUE,
    TRUE,
    strftime('%s', 'now') - 3600,
    strftime('%s', 'now') - 3500,
    strftime('%s', 'now'),
    strftime('%s', 'now')
  ),
  (
    'exec_step_001_2',
    'test_execution_001',
    2,
    'step_test_001_2',
    'Echo back retrieved data',
    'Retrieved value: test_value_123',
    TRUE,
    TRUE,
    strftime('%s', 'now') - 3500,
    strftime('%s', 'now') - 3400,
    strftime('%s', 'now'),
    strftime('%s', 'now')
  );