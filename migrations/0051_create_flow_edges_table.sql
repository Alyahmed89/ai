-- Migration 0051: Create flow_edges table for FlowReact DAG support
-- This table stores edges between flow steps for branching/conditional flows

CREATE TABLE IF NOT EXISTS flow_edges (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  source_step_id TEXT NOT NULL,
  target_step_id TEXT NOT NULL,
  edge_type TEXT DEFAULT 'next', -- 'next', 'success', 'error', 'retry', 'fallback', 'conditional'
  condition TEXT, -- Condition expression (e.g., "status === 'success'", "data.value > 10")
  route TEXT, -- Route identifier for conditional branching (e.g., "success_path", "error_path")
  weight REAL DEFAULT 1.0, -- Weight for probabilistic branching
  metadata TEXT, -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flow_id) REFERENCES flow_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_step_id) REFERENCES flow_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (target_step_id) REFERENCES flow_steps(id) ON DELETE CASCADE,
  UNIQUE(flow_id, source_step_id, target_step_id, edge_type, condition)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_flow_edges_flow_id ON flow_edges(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_edges_source ON flow_edges(source_step_id);
CREATE INDEX IF NOT EXISTS idx_flow_edges_target ON flow_edges(target_step_id);
CREATE INDEX IF NOT EXISTS idx_flow_edges_type ON flow_edges(edge_type);

-- Add edge_count column to flow_steps for easier querying
ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS edge_count INTEGER DEFAULT 0;

-- Create a view for step connectivity
CREATE VIEW IF NOT EXISTS flow_step_connectivity AS
SELECT 
  fs.id as step_id,
  fs.flow_id,
  fs.step_key,
  fs.title,
  fs.order_index,
  COUNT(DISTINCT fe_source.id) as outgoing_edges,
  COUNT(DISTINCT fe_target.id) as incoming_edges,
  GROUP_CONCAT(DISTINCT fe_source.target_step_id) as next_steps,
  GROUP_CONCAT(DISTINCT fe_target.source_step_id) as previous_steps
FROM flow_steps fs
LEFT JOIN flow_edges fe_source ON fs.id = fe_source.source_step_id
LEFT JOIN flow_edges fe_target ON fs.id = fe_target.target_step_id
GROUP BY fs.id, fs.flow_id, fs.step_key, fs.title, fs.order_index;

-- Create trigger to update edge_count when edges change
CREATE TRIGGER IF NOT EXISTS update_step_edge_count
AFTER INSERT OR DELETE OR UPDATE ON flow_edges
FOR EACH ROW
BEGIN
  -- Update source step edge count
  UPDATE flow_steps 
  SET edge_count = (
    SELECT COUNT(*) 
    FROM flow_edges 
    WHERE source_step_id = NEW.source_step_id OR target_step_id = NEW.source_step_id
  )
  WHERE id = NEW.source_step_id;
  
  -- Update target step edge count
  UPDATE flow_steps 
  SET edge_count = (
    SELECT COUNT(*) 
    FROM flow_edges 
    WHERE source_step_id = NEW.target_step_id OR target_step_id = NEW.target_step_id
  )
  WHERE id = NEW.target_step_id;
END;