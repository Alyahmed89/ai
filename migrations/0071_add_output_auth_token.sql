-- Migration 0020: Add output_auth_token column to flow_steps table
-- Date: 2026-02-20
-- Description: 
-- 1. Add output_auth_token column (TEXT) to store API token for output_url authentication
-- 2. This allows the system to send Authorization header when posting to output_url endpoints
-- 3. Token is stored encrypted or as plain text (depending on security requirements)

-- Add output_auth_token column to flow_steps table
ALTER TABLE flow_steps ADD COLUMN output_auth_token TEXT;

-- Create index for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_flow_steps_output_auth_token ON flow_steps(output_auth_token) WHERE output_auth_token IS NOT NULL;

-- Note: Existing rows will have NULL value for output_auth_token
-- This maintains backward compatibility - endpoints without token requirements will continue to work