-- SQL to create tables in Cloudflare D1 database
-- Run these queries in your Cloudflare D1 dashboard

-- Flow definitions
CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    first_prompt TEXT,
    deepseek_system TEXT,
    repo TEXT,
    branch TEXT,
    max_iterations INTEGER DEFAULT 5,
    steps TEXT, -- JSON string of steps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Steps within flows
CREATE TABLE IF NOT EXISTS flow_steps (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

-- Conditions for flow steps
CREATE TABLE IF NOT EXISTS flow_conditions (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    condition_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES flow_steps(id) ON DELETE CASCADE
);

-- Task management
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    flow_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE SET NULL
);

-- Flow execution history
CREATE TABLE IF NOT EXISTS flow_runs (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

-- Iteration tracking
CREATE TABLE IF NOT EXISTS iterations (
    id TEXT PRIMARY KEY,
    flow_run_id TEXT NOT NULL,
    iteration_number INTEGER NOT NULL,
    status TEXT DEFAULT 'running',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flow_run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
);

-- Insert sample data for testing
INSERT INTO flows (id, name, first_prompt, repo, branch, max_iterations) VALUES 
('flow-1', 'Code Review Flow', 'Review this code for bugs', 'example/repo', 'main', 3),
('flow-2', 'Documentation Flow', 'Generate documentation for this API', 'docs/repo', 'master', 5);

INSERT INTO tasks (id, flow_id, title, description, status, order_index) VALUES
('task-1', 'flow-1', 'Fix bug in login', 'User login fails with incorrect password', 'pending', 1),
('task-2', 'flow-1', 'Add validation', 'Add input validation to registration form', 'done', 2),
('task-3', 'flow-2', 'Write API docs', 'Document all endpoints with examples', 'pending', 1),
('task-4', NULL, 'General maintenance', 'Update dependencies and fix warnings', 'pending', 3);