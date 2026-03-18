-- Migration 0042: Create test flow for unified endpoint system
-- Creates a test flow with step using use_endpoints and extra_step=true

-- Create test flow definition
INSERT OR IGNORE INTO flow_definitions (
  id, name, repository, branch, max_iterations, priority
) VALUES (
  'unified_endpoint_test',
  'Unified Endpoint Test Flow',
  'Alyahmed89/deepseek-agent',
  'main',
  5,
  1
);

-- Create test flow step with use_endpoints configuration
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_key, title, instructions, step_type, order_index,
  use_endpoints, extra_step, input_keys, output_keys
) VALUES (
  'unified_test_step1',
  'unified_endpoint_test',
  'test_unified_endpoint',
  'Test Unified Endpoint System',
  'Summarize user name from API. If missing, call again.
Return [DONE] when complete.

Available data from API:
User ID: {test_endpoint_1.id}
User Name: {test_endpoint_1.name}
User Email: {test_endpoint_1.email}

Instructions:
1. Check if user name is available from the API response
2. If name is missing or empty, output: [RETRY] Need to fetch user data again
3. If name is available, output: [DONE] User name is: {test_endpoint_1.name}
4. Also test command execution by including: /test_command message: hello',
  'ai_step',
  1,
  '[
    {
      "endpoint_id": "test_endpoint_1",
      "phase": "input",
      "map": {
        "user_id": "{variable}"
      }
    },
    {
      "endpoint_id": "test_command_1",
      "phase": "command",
      "map": {
        "message": "{message}"
      }
    }
  ]',
  1, -- extra_step = true
  '[]', -- empty input_keys for backward compatibility
  '["test_endpoint_1"]' -- output_keys for backward compatibility
);

-- Create a test task for the flow
INSERT OR IGNORE INTO tasks (
  id, flow_id, title, description, status, priority, order_index,
  endpoint_path, http_method, ai_context
) VALUES (
  'unified_test_task_1',
  'unified_endpoint_test',
  'Test Unified Endpoint System',
  'Test the unified endpoint system with input/output/command phases and extra_step loop',
  'pending',
  1,
  1,
  '/api/test-unified',
  'GET',
  '{"test": true, "unified_endpoint": true}'
);