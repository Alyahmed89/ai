-- Migration 0038: Add AI command fields to endpoint_registry
-- This enables AI agents to discover and execute backend commands

-- Add AI-specific fields to endpoint_registry
ALTER TABLE endpoint_registry ADD COLUMN ai_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE endpoint_registry ADD COLUMN parameter_schema TEXT; -- JSON schema for AI parameter validation
ALTER TABLE endpoint_registry ADD COLUMN endpoint_type TEXT DEFAULT 'external_api'; -- 'external_api' or 'internal_command'

-- Create index for faster AI command queries
CREATE INDEX IF NOT EXISTS idx_endpoint_registry_ai_enabled ON endpoint_registry(ai_enabled);
CREATE INDEX IF NOT EXISTS idx_endpoint_registry_endpoint_type ON endpoint_registry(endpoint_type);

-- Update existing example endpoints to be external_api type (they already are)
UPDATE endpoint_registry SET endpoint_type = 'external_api' WHERE endpoint_type IS NULL;

-- Insert initial AI commands (internal endpoints that AI can use)
-- These will be populated more fully by the population script
INSERT OR IGNORE INTO endpoint_registry (
  id, name, description, url, method, auth_type, 
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES 
(
  'cmd_001',
  'create_task',
  'Create a new task with title, description, and status',
  '/api/tasks',
  'POST',
  'none',
  TRUE,
  'internal_command',
  '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"status":{"type":"string","default":"pending"},"flow_id":{"type":"string"},"order_index":{"type":"integer"}},"required":["title","flow_id"]}',
  CAST(strftime('%s', 'now') AS INTEGER),
  CAST(strftime('%s', 'now') AS INTEGER),
  'system',
  '["task", "crud", "ai_command"]'
),
(
  'cmd_002',
  'get_tasks',
  'Get all tasks, optionally filtered by flow_id',
  '/api/tasks',
  'GET',
  'none',
  TRUE,
  'internal_command',
  '{"type":"object","properties":{"flowId":{"type":"string"}},"required":[]}',
  CAST(strftime('%s', 'now') AS INTEGER),
  CAST(strftime('%s', 'now') AS INTEGER),
  'system',
  '["task", "read", "ai_command"]'
),
(
  'cmd_003',
  'get_task_by_id',
  'Get a specific task by its ID',
  '/api/tasks/:id',
  'GET',
  'none',
  TRUE,
  'internal_command',
  '{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}',
  CAST(strftime('%s', 'now') AS INTEGER),
  CAST(strftime('%s', 'now') AS INTEGER),
  'system',
  '["task", "read", "ai_command"]'
);