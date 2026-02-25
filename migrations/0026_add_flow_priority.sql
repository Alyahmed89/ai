-- Migration 0026: Add priority column to flows table
-- Enables flow-level prioritization

ALTER TABLE flows ADD COLUMN priority INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_flows_priority ON flows(priority);