-- Migration 003: Add next_flow_id to flow_step_conditions table
-- Date: 2026-03-25
-- Purpose: Allow steps to transition to other flows (DAG chaining)

BEGIN TRANSACTION;

-- Add next_flow_id column to flow_step_conditions
ALTER TABLE flow_step_conditions ADD COLUMN next_flow_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_step_conditions_next_flow_id 
ON flow_step_conditions(next_flow_id) 
WHERE next_flow_id IS NOT NULL;

-- Update existing conditions: If next_step is 0, treat as "end of flow" 
-- (no next flow, just complete)
-- Note: We'll keep next_step for backward compatibility

COMMIT;

-- Verification query
SELECT 
  COUNT(*) as total_conditions,
  COUNT(next_flow_id) as conditions_with_next_flow,
  COUNT(next_step) as conditions_with_next_step
FROM flow_step_conditions;