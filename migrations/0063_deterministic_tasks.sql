-- Migration 0009: Deterministic Task System
-- SINGLE STEP EXECUTION - NO BRANCHING, NO AI DECISION-MAKING

-- 1. tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','done')),
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for task selection: flow_id + status + order_index
CREATE INDEX IF NOT EXISTS idx_tasks_flow_status_order ON tasks(flow_id, status, order_index);

-- 2. task_followups table
CREATE TABLE IF NOT EXISTS task_followups (
  id TEXT PRIMARY KEY,
  parent_task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','done')),
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Index for followup selection: parent_task_id + status + order_index
CREATE INDEX IF NOT EXISTS idx_task_followups_parent_status_order ON task_followups(parent_task_id, status, order_index);

-- Insert example tasks for testing
-- Flow: etaflow
INSERT OR IGNORE INTO tasks (id, flow_id, title, description, status, order_index, created_at) VALUES
  ('task_eta_1', 'etaflow', 'Initialize System', 'Set up environment and check dependencies', 'pending', 1, CURRENT_TIMESTAMP),
  ('task_eta_2', 'etaflow', 'Run Security Scan', 'Perform security vulnerability assessment', 'pending', 2, CURRENT_TIMESTAMP),
  ('task_eta_3', 'etaflow', 'Deploy to Production', 'Deploy verified changes to production', 'pending', 3, CURRENT_TIMESTAMP);

-- Insert example follow-ups (parent task is DONE in this example)
INSERT OR IGNORE INTO tasks (id, flow_id, title, description, status, order_index, created_at) VALUES
  ('task_eta_completed', 'etaflow', 'Completed Task Example', 'This task is already done', 'done', 0, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO task_followups (id, parent_task_id, title, description, status, order_index, created_at) VALUES
  ('followup_1', 'task_eta_completed', 'Verify Deployment', 'Check that deployment was successful', 'pending', 1, CURRENT_TIMESTAMP),
  ('followup_2', 'task_eta_completed', 'Update Documentation', 'Update project documentation', 'pending', 2, CURRENT_TIMESTAMP);