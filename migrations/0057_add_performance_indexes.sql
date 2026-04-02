-- Migration: Add performance indexes for flow_runs and step_runs tables
-- Date: 2026-03-11
-- Description: Add critical indexes to ensure fast queries as system scales

-- ============================================================================
-- 1. INDEXES FOR FLOW_RUNS TABLE
-- ============================================================================

-- Index for filtering by flow_id (used in GET /api/flow-runs?flow_id=...)
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id 
ON flow_runs(flow_id);

-- Index for filtering by status (used in GET /api/flow-runs?status=...)
CREATE INDEX IF NOT EXISTS idx_flow_runs_status 
ON flow_runs(status);

-- Index for ordering by creation time (default ordering)
CREATE INDEX IF NOT EXISTS idx_flow_runs_created_at 
ON flow_runs(created_at DESC);

-- ============================================================================
-- 2. INDEXES FOR STEP_RUNS TABLE
-- ============================================================================

-- Index for filtering by flow_run_id (most common query)
CREATE INDEX IF NOT EXISTS idx_step_runs_flow_run_id 
ON step_runs(flow_run_id);

-- Index for ordering steps within a flow run (iteration, attempt)
CREATE INDEX IF NOT EXISTS idx_step_runs_order 
ON step_runs(flow_run_id, iteration, attempt);

-- Index for filtering by step_id (if needed for analytics)
CREATE INDEX IF NOT EXISTS idx_step_runs_step_id 
ON step_runs(step_id);

-- Index for filtering by status (if needed for monitoring)
CREATE INDEX IF NOT EXISTS idx_step_runs_status 
ON step_runs(status);

-- Index for ordering by creation time
CREATE INDEX IF NOT EXISTS idx_step_runs_created_at 
ON step_runs(created_at DESC);

-- ============================================================================
-- 3. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Composite index for status + created_at queries (dashboard views)
CREATE INDEX IF NOT EXISTS idx_flow_runs_status_created 
ON flow_runs(status, created_at DESC);

-- Composite index for flow_id + status + created_at (filtered dashboards)
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_status_created 
ON flow_runs(flow_id, status, created_at DESC);