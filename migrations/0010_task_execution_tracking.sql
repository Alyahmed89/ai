-- Migration 0010: Task execution tracking (minimal, hard facts only)
-- One row per task execution in execution_steps:
--   execution_id, task_id, started_at, finished_at, status
-- NO AI output analysis, NO inferred success, Only timestamps + DONE/PENDING

-- Create task_execution_steps table (separate from existing execution_steps)
CREATE TABLE IF NOT EXISTS task_execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  task_id TEXT NOT NULL, -- References tasks.id or task_followups.id
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'DONE')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_task_execution_steps_execution_id ON task_execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_task_execution_steps_task_id ON task_execution_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_execution_steps_status ON task_execution_steps(status);
CREATE INDEX IF NOT EXISTS idx_task_execution_steps_started_at ON task_execution_steps(started_at);

-- Insert example data for testing
INSERT OR IGNORE INTO task_execution_steps (
  id, execution_id, task_id, started_at, finished_at, status, created_at, updated_at
) VALUES 
  (
    'task_exec_001',
    'test_execution_001',
    'task_eta_1',
    strftime('%s', 'now') - 3600,
    strftime('%s', 'now') - 3500,
    'DONE',
    strftime('%s', 'now'),
    strftime('%s', 'now')
  ),
  (
    'task_exec_002',
    'test_execution_001',
    'task_eta_2',
    strftime('%s', 'now') - 3500,
    NULL,
    'PENDING',
    strftime('%s', 'now'),
    strftime('%s', 'now')
  );