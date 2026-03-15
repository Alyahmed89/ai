-- Migration 0037: Create endpoint_registry table for centralized endpoint management
-- This allows endpoints to be defined once and referenced by name in steps

-- Create endpoint_registry table
CREATE TABLE IF NOT EXISTS endpoint_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD')),
  auth_type TEXT CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key', 'custom')),
  auth_value TEXT, -- Can contain env: references
  headers TEXT, -- JSON object
  body_template TEXT, -- JSON string template
  query_params TEXT, -- JSON object
  response_path TEXT, -- JSON path to extract from response
  timeout_ms INTEGER DEFAULT 10000,
  max_retries INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 1000,
  cache_key TEXT,
  cache_ttl_seconds INTEGER,
  encrypt_cache BOOLEAN DEFAULT FALSE,
  response_validator TEXT, -- JSON schema or validation rules
  allowed_domains TEXT, -- JSON array
  require_https BOOLEAN DEFAULT TRUE,
  log_level TEXT DEFAULT 'info',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  tags TEXT -- JSON array for categorization
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_endpoint_registry_name ON endpoint_registry(name);
CREATE INDEX IF NOT EXISTS idx_endpoint_registry_tags ON endpoint_registry(tags);
CREATE INDEX IF NOT EXISTS idx_endpoint_registry_created_at ON endpoint_registry(created_at);

-- Insert example endpoints
INSERT OR IGNORE INTO endpoint_registry (
  id, name, description, url, method, auth_type, auth_value, 
  headers, timeout_ms, allowed_domains, require_https, log_level,
  created_at, updated_at, created_by, tags
) VALUES 
(
  'endpoint_001',
  'github_user',
  'Get GitHub user information',
  'https://api.github.com/users/{username}',
  'GET',
  'bearer',
  'env:GITHUB_TOKEN',
  '{"Accept": "application/vnd.github.v3+json", "User-Agent": "DeepSeek-Agent"}',
  10000,
  '["api.github.com"]',
  TRUE,
  'info',
  CAST(strftime('%s', 'now') AS INTEGER),
  CAST(strftime('%s', 'now') AS INTEGER),
  'system',
  '["github", "user", "api"]'
),
(
  'endpoint_002',
  'internal_task',
  'Get internal task data',
  'internal://tasks/{task_id}',
  'GET',
  'none',
  NULL,
  NULL,
  5000,
  '["internal"]',
  FALSE,
  'info',
  CAST(strftime('%s', 'now') AS INTEGER),
  CAST(strftime('%s', 'now') AS INTEGER),
  'system',
  '["internal", "task"]'
);