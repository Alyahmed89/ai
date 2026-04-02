-- Migration 10001: Update flow_step_conditions table schema for unified condition system
-- Add condition_type, condition_value, condition_operator, condition_query, next_flow_id columns
-- Migrate existing condition data from single 'condition' column to structured columns

-- Add new columns for structured condition data
ALTER TABLE flow_step_conditions ADD COLUMN condition_type TEXT;
ALTER TABLE flow_step_conditions ADD COLUMN condition_value TEXT;
ALTER TABLE flow_step_conditions ADD COLUMN condition_operator TEXT;
ALTER TABLE flow_step_conditions ADD COLUMN condition_query TEXT;
ALTER TABLE flow_step_conditions ADD COLUMN next_flow_id TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_flow_step_conditions_condition_type ON flow_step_conditions(condition_type);
CREATE INDEX IF NOT EXISTS idx_flow_step_conditions_next_flow_id ON flow_step_conditions(next_flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_step_conditions_step_id_condition_type ON flow_step_conditions(step_id, condition_type);

-- Migrate existing condition data from 'condition' column to structured format
-- This is a best-effort migration that preserves existing data
-- The application will handle parsing of legacy condition format
UPDATE flow_step_conditions 
SET condition_type = 'legacy',
    condition_value = condition,
    condition_operator = 'equals'
WHERE condition IS NOT NULL AND condition != '';

-- Note: The 'condition' column will remain for backward compatibility
-- New code should use the structured columns (condition_type, condition_value, condition_operator, condition_query)