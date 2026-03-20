-- Migration 0039: Create flow_definitions table
-- This table is the primary table for flow definitions, replacing the flows table
-- The flows table (created in migration 0040) is for backward compatibility only

CREATE TABLE IF NOT EXISTS flow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  max_iterations INTEGER DEFAULT 20,
  repository TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  agent TEXT DEFAULT 'openhands',
  priority INTEGER DEFAULT 0,
  next_flow_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_definitions_id ON flow_definitions(id);
CREATE INDEX IF NOT EXISTS idx_flow_definitions_repository ON flow_definitions(repository);
CREATE INDEX IF NOT EXISTS idx_flow_definitions_priority ON flow_definitions(priority);

-- Insert default flow definitions if they don't exist
INSERT OR IGNORE INTO flow_definitions (
  id, name, description, max_iterations, repository, branch, agent, priority
) VALUES 
  ('etaflow', 'ETA Flow', 'Flow for ETA calculations', 20, 'Alyahmed89/deepseek-agent', 'main', 'openhands', 1),
  ('honoflow', 'Hono Flow', 'Flow for Hono framework', 20, 'Alyahmed89/deepseek-agent', 'main', 'openhands', 1),
  ('honorch', 'Hono Research Flow', 'Flow for Hono research', 20, 'Alyahmed89/deepseek-agent', 'main', 'openhands', 1);

-- Note: The flows table will be created in migration 0040 for backward compatibility
-- and will copy data from this flow_definitions table