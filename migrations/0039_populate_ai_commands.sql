-- Migration 0039: Populate initial AI commands
-- Generated on: 2026-03-16 17:11:05

-- Disable all existing AI commands
UPDATE endpoint_registry SET ai_enabled = FALSE WHERE endpoint_type = 'internal_command';

-- Insert or update AI commands

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_001',
  'create_task',
  'Create a new task with title, description, and status',
  '/api/tasks',
  'POST',
  'none',
  TRUE,
  'internal_command',
  '{"type": "object", "properties": {"title": {"type": "string"}, "description": {"type": "string"}, "status": {"type": "string", "default": "pending"}, "flow_id": {"type": "string"}, "order_index": {"type": "integer", "default": 0}}, "required": ["title", "flow_id"]}',
  1773681065,
  1773681065,
  'ai_command_script',
  '["task", "crud", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_002',
  'get_tasks',
  'Get all tasks, optionally filtered by flow_id',
  '/api/tasks',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["task", "read", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_003',
  'get_task_by_id',
  'Get a specific task by its ID',
  '/api/tasks/:id',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["task", "read", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_004',
  'update_task',
  'Update an existing task',
  '/api/tasks/:id',
  'PUT',
  'none',
  TRUE,
  'internal_command',
  '{"type": "object", "properties": {"title": {"type": "string"}, "description": {"type": "string"}, "status": {"type": "string"}, "order_index": {"type": "integer"}}, "required": []}',
  1773681065,
  1773681065,
  'ai_command_script',
  '["task", "crud", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_005',
  'delete_task',
  'Delete a task by ID',
  '/api/tasks/:id',
  'DELETE',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["task", "crud", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_006',
  'create_flow_step',
  'Create a new flow step',
  '/api/flow-steps',
  'POST',
  'none',
  TRUE,
  'internal_command',
  '{"type": "object", "properties": {"flow_id": {"type": "string"}, "step_key": {"type": "string"}, "title": {"type": "string"}, "instructions": {"type": "string"}, "step_type": {"type": "string", "default": "manual"}, "order_index": {"type": "integer", "default": 0}}, "required": ["flow_id", "step_key", "title", "instructions"]}',
  1773681065,
  1773681065,
  'ai_command_script',
  '["flow", "step", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_007',
  'get_flow_steps',
  'Get all flow steps, optionally filtered by flow_id',
  '/api/flow-steps',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["flow", "step", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_008',
  'get_flow_step_by_id',
  'Get a specific flow step by ID',
  '/api/flow-steps/:id',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["flow", "step", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_009',
  'update_flow_step',
  'Update an existing flow step',
  '/api/flow-steps/:id',
  'PUT',
  'none',
  TRUE,
  'internal_command',
  '{"type": "object", "properties": {"flow_id": {"type": "string"}, "step_key": {"type": "string"}, "title": {"type": "string"}, "instructions": {"type": "string"}, "step_type": {"type": "string"}, "order_index": {"type": "integer"}}, "required": []}',
  1773681065,
  1773681065,
  'ai_command_script',
  '["flow", "step", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_010',
  'get_flow_definitions',
  'Get all flow definitions',
  '/api/flow-definitions',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["flow", "definition", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_011',
  'start_conversation',
  'Start a new conversation with a repository and initial prompt',
  '/start',
  'POST',
  'none',
  TRUE,
  'internal_command',
  '{"type": "object", "properties": {"repository": {"type": "string"}, "branch": {"type": "string", "default": "main"}, "initial_user_prompt": {"type": "string"}, "max_iterations": {"type": "integer", "default": 20}, "flow_id": {"type": "string"}}, "required": []}',
  1773681065,
  1773681065,
  'ai_command_script',
  '["conversation", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_012',
  'get_conversation_status',
  'Get the status of a conversation by ID',
  '/status/:id',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["conversation", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_013',
  'get_flow_runs',
  'Get all flow runs with optional filtering',
  '/api/flow-runs',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["flow", "run", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_014',
  'create_project',
  'Create a new project in the graph',
  '/graph/projects',
  'POST',
  'none',
  TRUE,
  'internal_command',
  '{"type": "object", "properties": {"name": {"type": "string"}, "description": {"type": "string"}, "metadata": {"type": "string"}}, "required": ["name"]}',
  1773681065,
  1773681065,
  'ai_command_script',
  '["graph", "project", "ai_command"]'
);

INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  'cmd_015',
  'get_projects',
  'Get all projects',
  '/graph/projects',
  'GET',
  'none',
  TRUE,
  'internal_command',
  NULL,
  1773681065,
  1773681065,
  'ai_command_script',
  '["graph", "project", "ai_command"]'
);

-- Count of AI-enabled commands
SELECT COUNT(*) as ai_command_count FROM endpoint_registry WHERE ai_enabled = TRUE AND endpoint_type = 'internal_command';