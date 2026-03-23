-- Migration 0050: Add next_flow_ids column to flow_definitions table for multiple next flows support
-- Adds next_flow_ids column (JSON array of strings) alongside existing next_flow_id column

-- Add next_flow_ids column to flow_definitions (JSON array, nullable)
ALTER TABLE flow_definitions ADD COLUMN next_flow_ids TEXT;

-- Note: Keep existing next_flow_id column for backward compatibility
-- The application will use next_flow_ids if available, falling back to next_flow_id