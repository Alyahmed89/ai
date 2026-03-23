-- Migration 0047: Add payload columns for flow-to-flow data propagation
-- Adds input_payload to flow_runs and both payload columns to step_runs

-- Add input_payload to flow_runs (JSON, nullable)
ALTER TABLE flow_runs ADD COLUMN input_payload TEXT;

-- Add input_payload to step_runs (JSON, nullable) - referenced in code but might not exist
ALTER TABLE step_runs ADD COLUMN input_payload TEXT;

-- Add output_payload to step_runs (JSON, nullable) - referenced in code but might not exist  
ALTER TABLE step_runs ADD COLUMN output_payload TEXT;

-- Note: The code in database.ts already tries to insert into step_runs.input_payload and step_runs.output_payload
-- This migration ensures the database schema matches the code expectations
