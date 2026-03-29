-- Migration 0055: Add flow_run_id to flow_execution_data table
-- This enables direct flow-run-specific variable queries

-- Add flow_run_id column to flow_execution_data table
ALTER TABLE flow_execution_data ADD COLUMN IF NOT EXISTS flow_run_id TEXT;

-- Update existing rows with flow_run_id from flow_runs table
UPDATE flow_execution_data fed
SET flow_run_id = fr.id
FROM flow_runs fr
WHERE fed.conversation_id = fr.conversation_id
  AND fed.flow_run_id IS NULL;

-- Create index for flow_run_id queries
CREATE INDEX IF NOT EXISTS idx_flow_execution_data_flow_run_id ON flow_execution_data(flow_run_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_flow_execution_data_flow_run_key ON flow_execution_data(flow_run_id, key);