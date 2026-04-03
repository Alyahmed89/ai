-- Migration 0062: Add variable_type column to variables table
-- To distinguish between user_input and system variables

-- Add variable_type column to distinguish user vs system variables
ALTER TABLE variables ADD COLUMN IF NOT EXISTS variable_type TEXT DEFAULT 'system'; -- 'system' | 'user_input'

-- Update existing records: if source is 'user', set variable_type to 'user_input'
UPDATE variables SET variable_type = 'user_input' WHERE source = 'user';

-- Create index for faster lookups by variable type
CREATE INDEX IF NOT EXISTS idx_variables_variable_type ON variables(variable_type);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_variables_flow_run_type ON variables(flow_run_id, variable_type);