-- Migration 0015: Task injection for flow steps
-- Add task_id column to flow_steps table to link steps to tasks
-- When a step has a task_id, fetch task data from tasks table and inject it

ALTER TABLE flow_steps ADD COLUMN task_id TEXT;

-- Create index for faster task lookups
CREATE INDEX IF NOT EXISTS idx_flow_steps_task_id ON flow_steps(task_id);

-- Add foreign key constraint (optional, for data integrity)
-- FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- Update existing flow steps to link to tasks (example for etaflow)
-- This is just an example - actual mapping would depend on your data
UPDATE flow_steps SET task_id = 'eta_task_1' WHERE flow_id = 'etaflow' AND step_number = 1;
UPDATE flow_steps SET task_id = 'eta_task_2' WHERE flow_id = 'etaflow' AND step_number = 2;
-- Add more mappings as needed

-- Note: In practice, you would need to map your existing flow steps to tasks
-- based on some logic (e.g., step_number matches order_index, or title matching)