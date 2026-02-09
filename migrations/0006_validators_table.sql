-- Migration 0006: Add validators table
-- Register validator APIs once (name, endpoint, truth_source)
-- Reference from flow_steps instead of raw URLs

CREATE TABLE IF NOT EXISTS validators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  truth_source TEXT NOT NULL, -- 'db', 'api', 'external', 'manual'
  description TEXT,
  request_schema TEXT, -- JSON schema for request payload
  response_schema TEXT, -- JSON schema for response
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(name),
  UNIQUE(endpoint)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_validators_name ON validators(name);
CREATE INDEX IF NOT EXISTS idx_validators_endpoint ON validators(endpoint);

-- Add validator_id column to flow_steps table
ALTER TABLE flow_steps ADD COLUMN validator_id TEXT;

-- Add foreign key constraint after populating data
-- First, insert default validators
INSERT OR IGNORE INTO validators (id, name, endpoint, truth_source, description, request_schema, response_schema, created_at, updated_at) VALUES
  ('validator_row_exists', 'row_exists', '/validate/row-exists', 'db', 'Validates if a row exists in the database', '{"type": "object", "properties": {"flow_id": {"type": "string"}, "key": {"type": "string"}}, "required": ["flow_id", "key"]}', '{"type": "object", "properties": {"validation_id": {"type": "string"}, "passed": {"type": "boolean"}}}', strftime('%s', 'now'), strftime('%s', 'now')),
  ('validator_response_contains', 'response_contains', '/validate/response-contains', 'api', 'Validates if response contains expected value', '{"type": "object", "properties": {"response": {"type": "string"}, "expected_value": {"type": "string"}}, "required": ["response", "expected_value"]}', '{"type": "object", "properties": {"validation_id": {"type": "string"}, "passed": {"type": "boolean"}}}', strftime('%s', 'now'), strftime('%s', 'now'));

-- Update flow_steps to reference validator_id instead of raw endpoint
UPDATE flow_steps 
SET validator_id = 'validator_row_exists' 
WHERE validator_api = '/validate/row-exists';

UPDATE flow_steps 
SET validator_id = 'validator_response_contains' 
WHERE validator_api = '/validate/response-contains';

-- Drop the old validator_api column (after migration)
-- Note: Keeping it temporarily for backward compatibility
-- ALTER TABLE flow_steps DROP COLUMN validator_api;