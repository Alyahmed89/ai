-- Migration 0053: Create persistence tables for API calls and variables
-- Minimal tables for queryable state without touching execution logic

-- Table for normalized API calls
CREATE TABLE IF NOT EXISTS api_calls (
  id TEXT PRIMARY KEY,
  flow_id TEXT,
  flow_run_id TEXT,
  step_id TEXT,
  step_run_id TEXT,
  endpoint_id TEXT,
  endpoint_name TEXT,
  method TEXT, -- input | output | command
  request JSONB,
  response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for variables extracted from API calls, AI responses, or user input
CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY,
  flow_id TEXT,
  flow_run_id TEXT,
  step_id TEXT,
  step_run_id TEXT,
  key TEXT,
  value JSONB,
  source TEXT, -- api | ai | user
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_calls_flow_run_id ON api_calls(flow_run_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_step_id ON api_calls(step_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_endpoint_id ON api_calls(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_created_at ON api_calls(created_at);

CREATE INDEX IF NOT EXISTS idx_variables_flow_run_id ON variables(flow_run_id);
CREATE INDEX IF NOT EXISTS idx_variables_key ON variables(key);
CREATE INDEX IF NOT EXISTS idx_variables_source ON variables(source);
CREATE INDEX IF NOT EXISTS idx_variables_created_at ON variables(created_at);

-- Composite index for common variable lookups
CREATE INDEX IF NOT EXISTS idx_variables_flow_run_key ON variables(flow_run_id, key);