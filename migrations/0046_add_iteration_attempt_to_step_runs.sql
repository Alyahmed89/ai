-- Migration 0046: Add iteration and attempt columns to step_runs table
-- These columns are referenced in the code but missing from the schema

-- Add iteration column to step_runs (references iterations table)
ALTER TABLE step_runs ADD COLUMN iteration INTEGER DEFAULT 0;

-- Add attempt column to step_runs (tracks retry attempts for each step)
ALTER TABLE step_runs ADD COLUMN attempt INTEGER DEFAULT 0;

-- Update existing step_runs to have default values
UPDATE step_runs SET iteration = 0 WHERE iteration IS NULL;
UPDATE step_runs SET attempt = 0 WHERE attempt IS NULL;