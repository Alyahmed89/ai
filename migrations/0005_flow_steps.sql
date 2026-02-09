-- Migration 0005: Add flow_steps table
-- One row per step, ordered, with prompt, expected_response, validator_api

CREATE TABLE IF NOT EXISTS flow_steps (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  expected_response TEXT,
  validator_api TEXT NOT NULL, -- API endpoint to call for validation
  validator_payload_template TEXT, -- JSON template for validator API payload
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  UNIQUE(flow_id, step_number)
);

-- Create index for faster step lookups
CREATE INDEX IF NOT EXISTS idx_flow_steps_flow_id ON flow_steps(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_step_number ON flow_steps(step_number);

-- Migrate existing test flow steps from JSON in flows table to flow_steps table
-- Step 1 for test_flow_001
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template, created_at, updated_at
) VALUES (
  'step_test_001_1',
  'test_flow_001',
  1,
  'Store test data with key "test_key" and value: {{test_value}}',
  'DATA_READY',
  '/validate/row-exists',
  '{"flow_id": "{{flow_id}}", "key": "test_key"}',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 2 for test_flow_001
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template, created_at, updated_at
) VALUES (
  'step_test_001_2',
  'test_flow_001',
  2,
  'Echo back retrieved data',
  NULL, -- No expected response for step 2
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "{{retrieved_value}}"}',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Update flows table to remove steps JSON (optional cleanup)
-- Note: Keeping steps column for backward compatibility, but flow_steps is now canonical