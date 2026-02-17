-- Migration 0016: Consolidate all flow-related tables to flow-runs-db
-- Move tasks, flow_tasks, task_followups, task_execution_steps from hono-db to flow-runs-db
-- Keep only users and templates tables in hono-db

-- ==========================================================================
-- PART 1: Create tables in flow-runs-db (if they don't exist)
-- ==========================================================================

-- 1. tasks table (from hono-db)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','DONE')),
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for task selection: flow_id + status + order_index
CREATE INDEX IF NOT EXISTS idx_tasks_flow_status_order ON tasks(flow_id, status, order_index);

-- 2. flow_tasks table (from hono-db)
CREATE TABLE IF NOT EXISTS flow_tasks (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','DONE')),
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for flow_tasks
CREATE INDEX IF NOT EXISTS idx_flow_tasks_flow_status_order ON flow_tasks(flow_id, status, order_index);

-- 3. task_followups table (from hono-db)
CREATE TABLE IF NOT EXISTS task_followups (
  id TEXT PRIMARY KEY,
  parent_task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','DONE')),
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Index for followup selection: parent_task_id + status + order_index
CREATE INDEX IF NOT EXISTS idx_task_followups_parent_status_order ON task_followups(parent_task_id, status, order_index);

-- 4. task_execution_steps table (from hono-db)
CREATE TABLE IF NOT EXISTS task_execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','DONE')),
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for task_execution_steps
CREATE INDEX IF NOT EXISTS idx_task_execution_steps_execution_task ON task_execution_steps(execution_id, task_id);

-- ==========================================================================
-- PART 2: Update flow_steps table to ensure task_id and requires_task columns exist
-- ==========================================================================

-- Note: These columns should already exist based on previous migrations
-- but adding them here for safety

ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS requires_task BOOLEAN DEFAULT FALSE;

-- Create index for faster task lookups
CREATE INDEX IF NOT EXISTS idx_flow_steps_task_id ON flow_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_requires_task ON flow_steps(requires_task);

-- ==========================================================================
-- PART 3: Update wrangler.toml configuration
-- ==========================================================================
-- After this migration, update wrangler.toml to bind FLOW_RUNS_DB to flow-runs-db
-- and remove or update PROJECT_FACTS_DB binding as needed

-- Note: Actual data migration from hono-db to flow-runs-db needs to be done
-- via API calls or manual SQL since we cannot directly copy between databases
-- in a single migration file.