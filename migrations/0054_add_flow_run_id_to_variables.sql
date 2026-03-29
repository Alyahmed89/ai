-- Migration 0054: Ensure flow_run_id column exists in variables table
-- This migration adds the flow_run_id column if it doesn't exist

-- Add flow_run_id column to variables table if it doesn't exist
ALTER TABLE variables ADD COLUMN IF NOT EXISTS flow_run_id TEXT;

-- Update existing rows to have flow_run_id where possible
-- This is a best-effort update based on available data
UPDATE variables 
SET flow_run_id = (
  SELECT fr.id 
  FROM flow_runs fr 
  WHERE fr.flow_id = variables.flow_id 
  ORDER BY fr.created_at DESC 
  LIMIT 1
) 
WHERE flow_run_id IS NULL AND flow_id IS NOT NULL;

-- Create index for flow_run_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_variables_flow_run_id ON variables(flow_run_id);

-- Composite index for common variable lookups
CREATE INDEX IF NOT EXISTS idx_variables_flow_run_key ON variables(flow_run_id, key);