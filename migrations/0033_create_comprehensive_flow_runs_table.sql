-- Migration 0033: Create comprehensive flow_runs table with all required columns
-- This replaces any existing flow_runs table with a schema that supports all code requirements

-- Drop existing table if it exists (data will be lost, but this is for development)
DROP TABLE IF EXISTS flow_runs;

-- Create new table with all required columns
CREATE TABLE flow_runs (
  id TEXT PRIMARY KEY,
  flow_id TEXT,
  conversation_id TEXT NOT NULL,
  step_id TEXT,
  input_prompt TEXT,
  output_response TEXT,
  status TEXT DEFAULT 'active',
  duration_ms INTEGER DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  next_flow_id TEXT,
  stop_reason TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_flow_runs_conversation_id ON flow_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_status ON flow_runs(status);
CREATE INDEX IF NOT EXISTS idx_flow_runs_created_at ON flow_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON flow_runs(flow_id);