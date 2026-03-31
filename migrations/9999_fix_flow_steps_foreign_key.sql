-- Migration 9999: Fix all foreign keys to reference flow_definitions instead of flows
-- This fixes the foreign key constraint issues preventing deletions

-- 1. Fix flow_steps table foreign key
CREATE TABLE IF NOT EXISTS flow_steps_new (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  expected_response TEXT,
  validator_api TEXT NOT NULL,
  validator_payload_template TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  input_keys TEXT,
  output_keys TEXT,
  step_type TEXT DEFAULT 'standard',
  default_next_step_id TEXT,
  next_step_conditions TEXT,
  response_parser TEXT,
  FOREIGN KEY (flow_id) REFERENCES flow_definitions(id) ON DELETE CASCADE
);

INSERT INTO flow_steps_new SELECT * FROM flow_steps;
DROP TABLE flow_steps;
ALTER TABLE flow_steps_new RENAME TO flow_steps;
CREATE INDEX IF NOT EXISTS idx_flow_steps_flow_id ON flow_steps(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_step_number ON flow_steps(step_number);

-- 2. Fix flow_variables table foreign key (if table exists)
-- Check if flow_variables table exists
CREATE TABLE IF NOT EXISTS flow_variables_new (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'string',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flow_definitions(id) ON DELETE CASCADE,
  UNIQUE(flow_id, variable_name)
);

-- Try to copy data if table exists
INSERT OR IGNORE INTO flow_variables_new SELECT * FROM flow_variables;
DROP TABLE IF EXISTS flow_variables;
ALTER TABLE flow_variables_new RENAME TO flow_variables;
CREATE INDEX IF NOT EXISTS idx_flow_variables_flow_id ON flow_variables(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_variables_name ON flow_variables(variable_name);

-- 3. Fix flow_runs table foreign key
CREATE TABLE IF NOT EXISTS flow_runs_new (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flow_definitions(id) ON DELETE CASCADE
);

INSERT INTO flow_runs_new SELECT * FROM flow_runs;
DROP TABLE flow_runs;
ALTER TABLE flow_runs_new RENAME TO flow_runs;
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON flow_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_status ON flow_runs(status);

-- 4. Fix step_runs table foreign key  
CREATE TABLE IF NOT EXISTS step_runs_new (
  id TEXT PRIMARY KEY,
  flow_run_id TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flow_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (flow_run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
);

INSERT INTO step_runs_new SELECT * FROM step_runs;
DROP TABLE step_runs;
ALTER TABLE step_runs_new RENAME TO step_runs;
CREATE INDEX IF NOT EXISTS idx_step_runs_flow_id ON step_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_step_runs_flow_run_id ON step_runs(flow_run_id);
CREATE INDEX IF NOT EXISTS idx_step_runs_step_id ON step_runs(step_id);

-- Note: flow_step_conditions table already correctly references flow_steps(id), not flows(id)
-- So no change needed for flow_step_conditions