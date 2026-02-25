-- Migration 0025: Add next_flow_id column to flows table
-- Enables static flow transitions

ALTER TABLE flows ADD COLUMN next_flow_id TEXT;
CREATE INDEX IF NOT EXISTS idx_flows_next_flow_id ON flows(next_flow_id);