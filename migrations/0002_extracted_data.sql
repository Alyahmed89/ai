-- Migration 0002: Create tables for extracted data from OpenHands responses
-- Supports flexible data extraction for any project, API, payload structure, and retrieval filters

-- Projects table (repositories)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata about the project
  UNIQUE(repository, branch)
);

-- Data types for categorization
CREATE TABLE IF NOT EXISTS data_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  schema_template TEXT, -- JSON schema template for this data type (optional)
  created_at INTEGER NOT NULL,
  UNIQUE(name)
);

-- Extracted data table (generic storage for any extracted data)
CREATE TABLE IF NOT EXISTS extracted_data (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  data_type_id TEXT NOT NULL,
  conversation_id TEXT, -- Link to conversation if available
  flow_run_id TEXT, -- Link to flow run if available
  iteration_number INTEGER, -- Which iteration this data came from
  
  -- Core data fields
  key TEXT NOT NULL, -- Primary key for retrieval (e.g., "task", "error", "test_checklist")
  value TEXT NOT NULL, -- The extracted data (JSON string)
  source TEXT NOT NULL, -- Source of data: 'openhands_response', 'deepseek_response', 'event', 'manual'
  
  -- Metadata for filtering and retrieval
  tags TEXT, -- JSON array of tags for categorization
  priority INTEGER DEFAULT 0, -- Priority for retrieval (higher = more important)
  confidence REAL DEFAULT 1.0, -- Confidence score for extraction accuracy (0.0-1.0)
  
  -- Context and relationships
  parent_id TEXT, -- Parent data item ID for hierarchical data
  related_ids TEXT, -- JSON array of related data item IDs
  
  -- Timestamps
  extracted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  -- Foreign keys
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (data_type_id) REFERENCES data_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (parent_id) REFERENCES extracted_data(id) ON DELETE SET NULL
);

-- Test checklists table (specialized for validation data)
CREATE TABLE IF NOT EXISTS test_checklists (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  extracted_data_id TEXT NOT NULL, -- Link to the extracted data record
  checklist_name TEXT NOT NULL,
  checklist_data TEXT NOT NULL, -- JSON structure of the checklist
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (extracted_data_id) REFERENCES extracted_data(id) ON DELETE CASCADE
);

-- Errors tracking table
CREATE TABLE IF NOT EXISTS error_tracking (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  extracted_data_id TEXT NOT NULL, -- Link to the extracted data record
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_context TEXT, -- JSON context where error occurred
  resolution TEXT, -- How error was resolved
  status TEXT DEFAULT 'open', -- open, investigating, resolved, ignored
  resolved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (extracted_data_id) REFERENCES extracted_data(id) ON DELETE CASCADE
);

-- Conversation insights table (per-conversation extracted data)
CREATE TABLE IF NOT EXISTS conversation_insights (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  insight_type TEXT NOT NULL, -- e.g., 'progress_summary', 'blockers', 'next_steps'
  insight_data TEXT NOT NULL, -- JSON insight data
  iteration_range TEXT, -- e.g., "1-5" or "all"
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, insight_type, iteration_range)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_extracted_data_project_id ON extracted_data(project_id);
CREATE INDEX IF NOT EXISTS idx_extracted_data_data_type_id ON extracted_data(data_type_id);
CREATE INDEX IF NOT EXISTS idx_extracted_data_key ON extracted_data(key);
CREATE INDEX IF NOT EXISTS idx_extracted_data_source ON extracted_data(source);
CREATE INDEX IF NOT EXISTS idx_extracted_data_tags ON extracted_data(tags);
CREATE INDEX IF NOT EXISTS idx_extracted_data_priority ON extracted_data(priority);
CREATE INDEX IF NOT EXISTS idx_extracted_data_extracted_at ON extracted_data(extracted_at);
CREATE INDEX IF NOT EXISTS idx_extracted_data_conversation_id ON extracted_data(conversation_id);

CREATE INDEX IF NOT EXISTS idx_test_checklists_project_id ON test_checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_test_checklists_status ON test_checklists(status);

CREATE INDEX IF NOT EXISTS idx_error_tracking_project_id ON error_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_error_tracking_status ON error_tracking(status);
CREATE INDEX IF NOT EXISTS idx_error_tracking_error_type ON error_tracking(error_type);

CREATE INDEX IF NOT EXISTS idx_conversation_insights_conversation_id ON conversation_insights(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_insight_type ON conversation_insights(insight_type);

-- Insert default data types
INSERT OR IGNORE INTO data_types (id, name, description, created_at) VALUES
  ('task', 'Task', 'Extracted task or action item', strftime('%s', 'now')),
  ('error', 'Error', 'Error or exception information', strftime('%s', 'now')),
  ('test_checklist', 'Test Checklist', 'Testing and validation checklist', strftime('%s', 'now')),
  ('conversation_insight', 'Conversation Insight', 'Insight extracted from conversation flow', strftime('%s', 'now')),
  ('code_snippet', 'Code Snippet', 'Extracted code snippet or example', strftime('%s', 'now')),
  ('configuration', 'Configuration', 'Configuration or setup information', strftime('%s', 'now')),
  ('dependency', 'Dependency', 'Dependency or library information', strftime('%s', 'now')),
  ('api_spec', 'API Specification', 'API endpoint or specification', strftime('%s', 'now')),
  ('documentation', 'Documentation', 'Documentation or explanation', strftime('%s', 'now')),
  ('performance_metric', 'Performance Metric', 'Performance measurement or metric', strftime('%s', 'now'));