-- Migration 10002: Add performance indexes to step_runs table
-- Create indexes for common query patterns to improve performance

-- Index for querying step runs by flow_run_id (most common query)
CREATE INDEX IF NOT EXISTS idx_step_runs_flow_run_id ON step_runs(flow_run_id);

-- Index for querying step runs by step_id 
CREATE INDEX IF NOT EXISTS idx_step_runs_step_id ON step_runs(step_id);

-- Index for querying step runs by status (e.g., 'completed', 'failed')
CREATE INDEX IF NOT EXISTS idx_step_runs_status ON step_runs(status);

-- Composite index for common query patterns: flow_run_id + status
CREATE INDEX IF NOT EXISTS idx_step_runs_flow_run_id_status ON step_runs(flow_run_id, status);

-- Composite index for flow_run_id + step_id queries
CREATE INDEX IF NOT EXISTS idx_step_runs_flow_run_id_step_id ON step_runs(flow_run_id, step_id);

-- Index for ordering by created_at (for getting latest step runs)
CREATE INDEX IF NOT EXISTS idx_step_runs_created_at ON step_runs(created_at DESC);

-- Note: These indexes will significantly improve performance for:
-- 1. Getting all step runs for a flow run
-- 2. Getting step runs by status
-- 3. Getting the latest step run for a flow
-- 4. Finding specific step runs by flow_run_id and step_id