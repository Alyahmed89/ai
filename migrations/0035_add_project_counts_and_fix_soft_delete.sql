-- Migration 0035: Add missing count columns to projects table and fix soft delete implementation
-- This aligns the implementation with the Node Endpoints Documentation

-- ============================================================================
-- 1. Add missing count columns to projects table
-- ============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS node_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS flow_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS task_count INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0;

-- ============================================================================
-- 2. Update sample project data to have correct counts
-- ============================================================================
-- Update the sample project with approximate counts based on sample data
UPDATE projects SET 
  node_count = (SELECT COUNT(*) FROM nodes WHERE project_id = 'project-1' AND deleted_at IS NULL),
  flow_count = (SELECT COUNT(*) FROM flows WHERE project_id = 'project-1' AND deleted_at IS NULL),
  task_count = (SELECT COUNT(*) FROM tasks WHERE project_id = 'project-1'),
  execution_count = (SELECT COUNT(*) FROM executions WHERE project_id = 'project-1')
WHERE id = 'project-1';

-- ============================================================================
-- 3. Create indexes for better performance on the new columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_node_count ON projects(node_count);
CREATE INDEX IF NOT EXISTS idx_projects_flow_count ON projects(flow_count);
CREATE INDEX IF NOT EXISTS idx_projects_task_count ON projects(task_count);
CREATE INDEX IF NOT EXISTS idx_projects_execution_count ON projects(execution_count);

-- ============================================================================
-- 4. Note: Soft delete fixes for API endpoints will be handled in code
-- ============================================================================
-- The following changes need to be made in src/graph-api.ts:
-- 1. UPDATE DELETE /nodes/{id} to use soft delete (SET deleted_at = ?) instead of hard delete
-- 2. UPDATE all SELECT queries for nodes to include "AND deleted_at IS NULL"
-- 3. UPDATE DELETE /projects/{id} to use soft delete if not already implemented
-- 4. UPDATE all SELECT queries for projects to include "AND deleted_at IS NULL"