-- Migration to remove first_prompt and deepseek_system fields from flows table
-- These fields are no longer needed as prompts come from flow steps

-- Create a temporary table with the new structure
CREATE TABLE flows_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo TEXT,
    branch TEXT,
    max_iterations INTEGER DEFAULT 5,
    steps TEXT, -- JSON string of steps
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table to new table, excluding the removed fields
INSERT INTO flows_new (id, name, repo, branch, max_iterations, steps, priority, created_at)
SELECT id, name, repo, branch, max_iterations, steps, COALESCE(priority, 0), created_at
FROM flows;

-- Drop the old table
DROP TABLE flows;

-- Rename the new table to the original name
ALTER TABLE flows_new RENAME TO flows;

-- Update the create_tables.sql file reference structure
-- Note: This migration assumes priority field exists (added in later migrations)
-- If priority doesn't exist in some environments, it will be created with default 0