-- Migration 0040: Create flows table for backward compatibility
-- The system expects a 'flows' table for backward compatibility with older code
-- This table has minimal schema matching what the code queries

CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  max_iterations INTEGER DEFAULT 20,
  description TEXT,
  agent TEXT DEFAULT 'openhands',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy existing flow definitions to flows table for backward compatibility
INSERT OR IGNORE INTO flows (id, name, repo, branch, max_iterations, description, agent, created_at, updated_at)
SELECT 
  id,
  name,
  repository as repo,
  branch,
  max_iterations,
  description,
  COALESCE(agent, 'openhands') as agent,
  created_at,
  updated_at
FROM flow_definitions;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flows_id ON flows(id);
CREATE INDEX IF NOT EXISTS idx_flows_repo ON flows(repo);