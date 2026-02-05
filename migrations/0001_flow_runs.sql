-- Migration 0001: Create flow_runs and iterations tables
CREATE TABLE IF NOT EXISTS flow_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  initial_prompt TEXT NOT NULL,
  deepseek_system TEXT,
  repository TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  max_iterations INTEGER DEFAULT 500,
  actual_iterations INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  stop_reason TEXT,
  prompts_and_responses TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER,
  next_flow_id TEXT,
  task_type TEXT,
  success_score REAL,
  quality_metrics TEXT,
  deployment_id TEXT,
  improvement_suggestions TEXT
);

CREATE TABLE IF NOT EXISTS iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flow_run_id TEXT NOT NULL,
  iteration_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  openhands_response TEXT,
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (flow_run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flow_runs_conversation_id ON flow_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_status ON flow_runs(status);
CREATE INDEX IF NOT EXISTS idx_flow_runs_created_at ON flow_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_iterations_flow_run_id ON iterations(flow_run_id);