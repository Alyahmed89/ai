-- Migration 0027: Add priority column to tasks table
-- Enables task-level prioritization across flows

ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);