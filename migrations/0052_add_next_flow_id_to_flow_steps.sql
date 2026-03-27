-- Migration 0052: Add next_flow_id column to flow_steps table
-- Date: 2026-03-26
-- Purpose: Allow steps to transition to other flows (DAG chaining at step level)

BEGIN TRANSACTION;

-- Add next_flow_id column to flow_steps
-- Note: If the column already exists, this will fail, but that's OK
-- The migration runner should handle this
ALTER TABLE flow_steps ADD COLUMN next_flow_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_steps_next_flow_id 
ON flow_steps(next_flow_id) 
WHERE next_flow_id IS NOT NULL;

COMMIT;

-- Verification query
SELECT 
  COUNT(*) as total_steps,
  COUNT(next_flow_id) as steps_with_next_flow,
  COUNT(DISTINCT flow_id) as unique_flows
FROM flow_steps;