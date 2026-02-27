-- Migration 0031: Add next_flow_id column to flow_runs table
-- Aligns production schema with code expectations for flow chaining

ALTER TABLE flow_runs ADD COLUMN next_flow_id TEXT;