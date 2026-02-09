-- Migration 0003: Minimal test tables for deterministic loop validation
-- STEP 0 — DATABASE (MINIMAL)

-- Create flows table if it does not exist
CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_prompt TEXT NOT NULL,
  deepseek_system TEXT,
  repo TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  max_iterations INTEGER DEFAULT 20,
  steps TEXT NOT NULL, -- JSON string
  created_at INTEGER NOT NULL
);

-- Create flow_test_data table for data round-trip
CREATE TABLE IF NOT EXISTS flow_test_data (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_test_data_flow_id ON flow_test_data(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_test_data_key ON flow_test_data(key);