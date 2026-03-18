-- Migration 0041: Add unified endpoint fields for flow_steps and step_runs
-- Adds support for use_endpoints, extra_step, and api_calls

-- Add use_endpoints column to flow_steps (JSON array of endpoint configurations)
ALTER TABLE flow_steps ADD COLUMN use_endpoints TEXT;

-- Add extra_step column to flow_steps (boolean for extra step loop)
ALTER TABLE flow_steps ADD COLUMN extra_step BOOLEAN DEFAULT FALSE;

-- Add api_calls column to step_runs (JSON array of API call history)
ALTER TABLE step_runs ADD COLUMN api_calls TEXT;

-- Add sample_response column to endpoint_registry for introspection
ALTER TABLE endpoint_registry ADD COLUMN sample_response TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_steps_use_endpoints ON flow_steps(flow_id) WHERE use_endpoints IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_step_runs_api_calls ON step_runs(flow_run_id) WHERE api_calls IS NOT NULL;

-- Update existing steps to have empty use_endpoints array for backward compatibility
UPDATE flow_steps SET use_endpoints = '[]' WHERE use_endpoints IS NULL;

-- Update existing step_runs to have empty api_calls array
UPDATE step_runs SET api_calls = '[]' WHERE api_calls IS NULL;

-- Insert a test endpoint for unified endpoint testing
INSERT OR IGNORE INTO endpoint_registry (
  id, name, description, url, method, auth_type, auth_value,
  headers, body_template, query_params, response_path,
  timeout_ms, max_retries, retry_delay_ms, cache_key,
  cache_ttl_seconds, encrypt_cache, response_validator,
  allowed_domains, require_https, log_level,
  created_at, updated_at, created_by, tags,
  sample_response
) VALUES (
  'test_endpoint_1',
  'jsonplaceholder_user',
  'Get sample user data from JSONPlaceholder API',
  'https://jsonplaceholder.typicode.com/users/1',
  'GET',
  'none',
  NULL,
  '{"Accept": "application/json", "User-Agent": "DeepSeek-Agent"}',
  NULL,
  NULL,
  NULL,
  10000,
  3,
  1000,
  NULL,
  NULL,
  0,
  NULL,
  '["jsonplaceholder.typicode.com"]',
  1,
  'info',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  'unified_endpoint_migration',
  '["test", "jsonplaceholder", "sample"]',
  '{"id": 1, "name": "Leanne Graham", "username": "Bret", "email": "Sincere@april.biz", "address": {"street": "Kulas Light", "suite": "Apt. 556", "city": "Gwenborough", "zipcode": "92998-3874", "geo": {"lat": "-37.3159", "lng": "81.1496"}}, "phone": "1-770-736-8031 x56442", "website": "hildegard.org", "company": {"name": "Romaguera-Crona", "catchPhrase": "Multi-layered client-server neural-net", "bs": "harness real-time e-markets"}}'
);

-- Insert a test command endpoint
INSERT OR IGNORE INTO endpoint_registry (
  id, name, description, url, method, auth_type, auth_value,
  headers, body_template, query_params, response_path,
  timeout_ms, max_retries, retry_delay_ms, cache_key,
  cache_ttl_seconds, encrypt_cache, response_validator,
  allowed_domains, require_https, log_level,
  created_at, updated_at, created_by, tags,
  ai_enabled, endpoint_type, parameter_schema
) VALUES (
  'test_command_1',
  'test_command',
  'Test command for unified endpoint system',
  '/api/test-command',
  'POST',
  'none',
  NULL,
  '{"Content-Type": "application/json"}',
  '{"message": "{message}"}',
  NULL,
  NULL,
  5000,
  2,
  500,
  NULL,
  NULL,
  0,
  NULL,
  '["localhost", "127.0.0.1"]',
  0,
  'info',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  'unified_endpoint_migration',
  '["test", "command", "ai_command"]',
  1,
  'internal_command',
  '{"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]}'
);