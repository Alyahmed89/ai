-- Migration 0024: Create safe flow conditions engine
-- Fixed version with safe evaluation engines (sql, state, static)

CREATE TABLE IF NOT EXISTS flow_conditions (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('prerequisite', 'skip_if', 'execute_if', 'next_flow')),
  condition_engine TEXT NOT NULL CHECK (condition_engine IN ('sql', 'state', 'static')) DEFAULT 'static',
  condition_key TEXT, -- For 'state' engine: key in execution_data
  condition_value TEXT, -- For 'state' engine: expected value
  condition_query TEXT, -- For 'sql' engine: SQL query returning 1/0
  next_flow_id TEXT, -- Static next flow ID (not dynamic)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES flow_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (next_flow_id) REFERENCES flows(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_flow_conditions_flow_step ON flow_conditions(flow_id, step_id);
CREATE INDEX IF NOT EXISTS idx_flow_conditions_type ON flow_conditions(condition_type);
CREATE INDEX IF NOT EXISTS idx_flow_conditions_engine ON flow_conditions(condition_engine);

-- Create flow_execution_data table for state conditions
CREATE TABLE IF NOT EXISTS flow_execution_data (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flow_execution_data_flow ON flow_execution_data(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_execution_data_conversation ON flow_execution_data(conversation_id);
CREATE INDEX IF NOT EXISTS idx_flow_execution_data_key ON flow_execution_data(key);