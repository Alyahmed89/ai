-- Migration 10003: Update api_calls table schema
-- Add missing columns for better API call tracking

-- Add http_method column for actual HTTP method (GET/POST/PUT/DELETE)
ALTER TABLE api_calls ADD COLUMN http_method TEXT;

-- Add status_code column for HTTP status code
ALTER TABLE api_calls ADD COLUMN status_code INTEGER;

-- Add duration_ms column for request duration
ALTER TABLE api_calls ADD COLUMN duration_ms INTEGER;

-- Add error column for error messages if request failed
ALTER TABLE api_calls ADD COLUMN error TEXT;

-- Create indexes for better query performance (if they don't exist)
-- Note: idx_api_calls_flow_run_id and idx_api_calls_created_at already exist from migration 0053
-- Adding IF NOT EXISTS to be safe
CREATE INDEX IF NOT EXISTS idx_api_calls_endpoint_name ON api_calls(endpoint_name);
CREATE INDEX IF NOT EXISTS idx_api_calls_flow_run_id ON api_calls(flow_run_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_created_at ON api_calls(created_at);

-- Note: method column already exists and stores type: input/output/command
-- http_method column is for actual HTTP method (GET/POST/PUT/DELETE)
