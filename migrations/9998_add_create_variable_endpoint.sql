-- Migration 9998: Add create_variable endpoint to registry
-- This allows AI agents to use [COMMAND:create_variable] to create variables

INSERT OR IGNORE INTO endpoint_registry (
  id, name, description, url, method, auth_type, auth_value,
  headers, timeout_ms, allowed_domains, require_https, log_level,
  created_at, updated_at, created_by, tags, parameter_schema
) VALUES 
(
  'endpoint_003',
  'create_variable',
  'Create a variable with key-value pair',
  'https://deepseek-agent.alghamdimo89.workers.dev/variables',
  'POST',
  'none',
  NULL,
  '{"Content-Type": "application/json"}',
  5000,
  '["deepseek-agent.alghamdimo89.workers.dev"]',
  TRUE,
  'info',
  CAST(strftime('%s', 'now') AS INTEGER),
  CAST(strftime('%s', 'now') AS INTEGER),
  'system',
  '["variable", "storage", "persistence"]',
  '{
    "key": {"type": "string", "required": true, "description": "Variable key/name"},
    "value": {"type": "string", "required": true, "description": "Variable value"},
    "source": {"type": "string", "required": false, "description": "Source of variable (agent, user, api)"},
    "variable_type": {"type": "string", "required": false, "description": "Type of variable (string, number, boolean, object)"},
    "flow_id": {"type": "string", "required": false, "description": "Flow ID"},
    "flow_run_id": {"type": "string", "required": false, "description": "Flow run ID"},
    "step_id": {"type": "string", "required": false, "description": "Step ID"},
    "step_run_id": {"type": "string", "required": false, "description": "Step run ID"}
  }'
);
