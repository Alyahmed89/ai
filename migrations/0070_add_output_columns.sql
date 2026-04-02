-- Migration 0019: Add output and output_url columns to flow_steps table
-- Date: 2026-02-20
-- Description: 
-- 1. Add output column (BOOLEAN DEFAULT FALSE) to indicate if step response should be sent to output_url
-- 2. Add output_url column (TEXT) to specify endpoint where JSON response should be sent
-- 3. Similar pattern to requires_task for task injection

-- Add output column to flow_steps table
ALTER TABLE flow_steps ADD COLUMN output BOOLEAN DEFAULT FALSE;

-- Add output_url column to flow_steps table
ALTER TABLE flow_steps ADD COLUMN output_url TEXT;

-- Create index for faster lookups of steps with output enabled
CREATE INDEX IF NOT EXISTS idx_flow_steps_output ON flow_steps(output);

-- Update existing steps to have output disabled by default
-- (No need to update existing rows, default value will be FALSE)