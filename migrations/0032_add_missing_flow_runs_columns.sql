-- Migration 0032: Add missing columns to flow_runs table to match code expectations
-- The saveFlowRun function expects these columns but they don't exist in the current schema

-- Add step_id column for tracking which step is being executed
ALTER TABLE flow_runs ADD COLUMN step_id TEXT;

-- Add input_prompt column for storing the initial prompt
ALTER TABLE flow_runs ADD COLUMN input_prompt TEXT;

-- Add output_response column for storing the final response
ALTER TABLE flow_runs ADD COLUMN output_response TEXT;

-- Add duration_ms column for tracking execution time
ALTER TABLE flow_runs ADD COLUMN duration_ms INTEGER DEFAULT 0;

-- Note: conversation_id already exists in migration 0001
-- Note: next_flow_id already exists in migration 0031