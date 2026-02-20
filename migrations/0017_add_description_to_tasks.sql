-- Migration 0017: Add description column to tasks table
-- Date: 2026-02-17
-- Description: 
-- 1. Add description column to tasks table
-- 2. Update existing tasks to copy payload to description if description is null
-- 3. Fix task injection logic to use title, description, and payload values

-- Add description column to tasks table
ALTER TABLE tasks ADD COLUMN description TEXT;

-- Update existing tasks: copy payload to description if description is null
UPDATE tasks SET description = payload WHERE description IS NULL;

-- Create index for faster task lookups by flow_id and status
CREATE INDEX IF NOT EXISTS idx_tasks_flow_id_status ON tasks(flow_id, status);

-- Update task injection example data
-- Example task for login flow
UPDATE tasks SET 
  description = 'Implement user login functionality with email/password authentication. Include form validation, error handling, and session management.',
  payload = '{"instructions": "Implement user login functionality with email/password authentication. Include form validation, error handling, and session management.", "requirements": ["Email validation", "Password hashing", "Session tokens", "Error messages"], "expected_output": "Working login form that authenticates users and creates sessions"}'
WHERE id = 'login' AND flow_id = 'etaflow';

-- Add example task if it doesn't exist
INSERT OR IGNORE INTO tasks (
  id, flow_id, title, description, payload, validation_type, validation_payload, expected_result, status, attempts, created_at, updated_at
) VALUES (
  'test_task_001',
  'etaflow',
  'Test API Integration',
  'Create API integration with external service. Handle authentication, rate limiting, and error recovery.',
  '{"instructions": "Create API integration with external service. Handle authentication, rate limiting, and error recovery.", "endpoint": "https://api.example.com/data", "auth_method": "Bearer token", "rate_limit": "100 requests/hour"}',
  'response_contains',
  '{"expected": "success"}',
  'API integration working with proper error handling',
  'pending',
  0,
  strftime('%s', 'now'),
  strftime('%s', 'now')
);