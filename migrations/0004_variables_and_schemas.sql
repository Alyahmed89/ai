-- Migration 0004: Add variables table and lock schemas
-- Minimal changes only

-- Add variables table for variable storage and resolution
CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL, -- 'api', 'manual', 'extracted'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, name)
);

-- Create index for faster variable lookups
CREATE INDEX IF NOT EXISTS idx_variables_flow_id ON variables(flow_id);
CREATE INDEX IF NOT EXISTS idx_variables_name ON variables(name);

-- Add schema_version to flows table to track schema changes
ALTER TABLE flows ADD COLUMN schema_version INTEGER DEFAULT 1;

-- Add validation_schema to flows table for success criteria validation
ALTER TABLE flows ADD COLUMN validation_schema TEXT; -- JSON schema for validation

-- Insert default variable for test flow
INSERT OR IGNORE INTO variables (id, flow_id, name, value, source, created_at, updated_at)
VALUES (
  'var_test_001',
  'test_flow_001',
  'test_value',
  'default_test_value_' || CAST(strftime('%s', 'now') AS TEXT),
  'manual',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);