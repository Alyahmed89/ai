-- Migration 10005: Add resume_step column to flow_definitions table
-- This column stores the step ID to resume from when user calls /resume endpoint
-- If empty/null, resume uses default behavior
-- If user specifies a different step ID, user's choice takes precedence

ALTER TABLE flow_definitions ADD COLUMN resume_step TEXT;