-- Migration 10000: Fix flow_step_conditions table schema
-- Add missing flow_step_id column

-- Note: This migration will fail if flow_step_conditions table doesn't exist
-- That's okay - application will create table with correct schema when needed

-- Try to add flow_step_id column
-- If column already exists, this will fail but migration continues
ALTER TABLE flow_step_conditions ADD COLUMN flow_step_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_step_conditions_flow_step_id ON flow_step_conditions(flow_step_id);