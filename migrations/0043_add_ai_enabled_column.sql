-- Migration 0043: Add ai_enabled column to endpoint_registry table
-- This column is referenced in the code but missing from the schema

-- Add ai_enabled column to endpoint_registry
ALTER TABLE endpoint_registry ADD COLUMN ai_enabled BOOLEAN DEFAULT FALSE;

-- Add sample_response column if not exists (for introspection)
ALTER TABLE endpoint_registry ADD COLUMN sample_response TEXT;

-- Update existing endpoints to have ai_enabled = false by default
UPDATE endpoint_registry SET ai_enabled = FALSE WHERE ai_enabled IS NULL;

-- Add sample responses for introspection testing
UPDATE endpoint_registry SET sample_response = '{"id": 1, "login": "octocat", "name": "The Octocat", "email": "octocat@github.com"}' WHERE name = 'github_user';
UPDATE endpoint_registry SET sample_response = '{"id": "task_001", "title": "Sample Task", "status": "pending", "description": "Test task description"}' WHERE name = 'internal_task';
UPDATE endpoint_registry SET sample_response = '{"location": {"name": "London"}, "current": {"temp_c": 15, "condition": {"text": "Partly cloudy"}}}' WHERE name = 'weather_api';