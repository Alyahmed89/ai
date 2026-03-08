# Cloudflare D1 Database Setup Summary

## ✅ **Database Tables Created**

### **Knowledge Graph Tables:**
1. **`projects`** - Project management
   - `id`, `name`, `status`, `created_at`, `updated_at`, `metadata`
   - **Note**: Removed computed counters (node_count, flow_count, task_count, execution_count)

2. **`nodes`** - Knowledge nodes (NOT flows!)
   - `id`, `project_id`, `type`, `title`, `content`, `status`, `created_at`, `updated_at`, `metadata`
   - **Node types**: `task`, `doc`, `api`, `concept`, `rule`, `context`, `data`, `ui`, `system`

3. **`relationships`** - Connections between nodes
   - `id`, `source_node_id`, `target_node_id`, `relation_type`, `weight`, `created_at`, `metadata`
   - **Note**: Use `relation_type='depends_on'` for dependencies

4. **`node_hierarchy`** - Hierarchy/parent-child relationships (renamed from `levels`)
   - `id`, `parent_node_id`, `child_node_id`, `order_index`, `created_at`

5. **`tags`** - Tag definitions
   - `id`, `name`, `color`, `created_at`

6. **`node_tags`** - Junction table for node-tag relationships
   - `node_id`, `tag_id`, `created_at`

### **Process Graph Tables:**
1. **`process_flows`** - Workflow definitions (separate from nodes!)
   - `id`, `project_id`, `title`, `status`, `created_at`, `updated_at`, `metadata`

2. **`process_steps`** - Steps within a flow
   - `id`, `flow_id`, `title`, `type`, `tool`, `content`, `order_index`, `created_at`, `updated_at`, `metadata`
   - **Step types**: `ai`, `api`, `script`, `human`, `condition`, `tool`
   - **Tool examples**: `openai`, `repo_search`, `test_runner`, `code_writer`, `http_client`, `bash`

3. **`process_step_edges`** - Connections between steps with conditions
   - `id`, `source_step_id`, `target_step_id`, `edge_type`, `condition`, `weight`, `created_at`, `metadata`
   - **Edge types**: `next`, `success`, `error`, `retry`, `fallback`

4. **`process_flow_runs`** - Flow execution instances
   - `id`, `flow_id`, `status`, `current_step_id`, `started_at`, `finished_at`, `created_at`, `updated_at`, `metadata`
   - **Note**: Added `current_step_id` to track execution position

5. **`process_step_runs`** - Step execution instances
   - `id`, `flow_run_id`, `step_id`, `status`, `output`, `started_at`, `finished_at`, `created_at`, `updated_at`, `metadata`
   - **Constraint**: `UNIQUE(flow_run_id, step_id)` prevents duplicate executions

## ✅ **Sample Data Inserted**

### **Project:**
- `project-1`: "E-Commerce Platform" (active, 3 nodes, 1 flow)

### **Knowledge Nodes:**
1. `node-1`: "Product Catalog API" (type: `api`)
2. `node-2`: "Shopping Cart API" (type: `api`)
3. `node-3`: "Integrate Payment Gateway" (type: `task`)

### **Relationship:**
- `rel-1`: `node-1` → `node-2` (relation_type: `depends_on`, weight: 0.8)

### **Process Flow:**
- `flow-1`: "Checkout Flow" (project: `project-1`, status: `active`)

## 🔧 **Database Connection Details**

- **Cloudflare Account ID**: `e39371fc55a5c9ef7ed83e16660bd7bb`
- **Database ID**: `ce8f2a2c-6e4b-4398-b73e-ba8f204f609a`
- **API Token**: `H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL`

## 📋 **API Endpoints to Implement**

### **Knowledge Graph API (`/graph`):**
1. `GET /projects` - List projects
2. `POST /projects` - Create project
3. `GET /projects/{id}` - Get project details
4. `PATCH /projects/{id}` - Update project
5. `DELETE /projects/{id}` - Delete project
6. `GET /projects/{projectId}/nodes` - List nodes with filters
7. `POST /nodes` - Create node
8. `GET /nodes/{id}` - Get node with relationships
9. `PATCH /nodes/{id}` - Update node
10. `DELETE /nodes/{id}` - Delete node
11. `GET /nodes/{id}/relationships` - Get node relationships
12. `POST /relationships` - Create relationship
13. `DELETE /relationships/{id}` - Delete relationship
14. `GET /nodes/{id}/dependencies` - Get node dependencies
15. `POST /dependencies` - Create dependency
16. `DELETE /dependencies/{id}` - Delete dependency
17. `GET /tags` - List tags
18. `POST /tags` - Create tag
19. `POST /nodes/{id}/tags` - Add tag to node
20. `DELETE /nodes/{id}/tags/{tagId}` - Remove tag from node
21. `GET /nodes/{id}/children` - Get child nodes
22. `POST /levels` - Create hierarchy level
23. `DELETE /levels/{id}` - Delete hierarchy level

### **Process Graph API (`/graph`):**
1. `POST /process-flows` - Create process flow
2. `GET /projects/{projectId}/process-flows` - List process flows
3. `GET /process-flows/{id}` - Get flow with steps and edges
4. `PATCH /process-flows/{id}` - Update flow
5. `DELETE /process-flows/{id}` - Delete flow
6. `POST /process-steps` - Create step
7. `GET /process-flows/{flowId}/steps` - List steps for flow
8. `GET /process-steps/{id}` - Get step with edges
9. `PATCH /process-steps/{id}` - Update step
10. `DELETE /process-steps/{id}` - Delete step
11. `POST /process-step-edges` - Create step edge
12. `GET /process-steps/{id}/edges` - Get edges for step
13. `DELETE /process-step-edges/{id}` - Delete step edge
14. `POST /process-flow-runs` - Start flow execution
15. `GET /process-flows/{id}/runs` - List flow runs
16. `GET /process-flow-runs/{id}` - Get flow run with step runs
17. `PATCH /process-flow-runs/{id}` - Update flow run
18. `PATCH /process-step-runs/{id}` - Update step run

## 🚀 **Next Steps**

1. **Implement Graph API endpoints** in `src/graph-api.ts`
2. **Update validation schemas** to match new table names
3. **Test API endpoints** with sample requests
4. **Create frontend components** for graph visualization
5. **Add authentication and authorization**

## 📊 **Current Database State**

```sql
-- Check all tables
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Check project data
SELECT * FROM projects;

-- Check node data  
SELECT * FROM nodes;

-- Check relationship data
SELECT * FROM relationships;

-- Check process flow data
SELECT * FROM process_flows;
```

## 🔗 **Useful Cloudflare D1 API Commands**

```bash
# Query database
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM projects;"}'

# Execute multiple statements
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"sql": "INSERT INTO projects (id, name) VALUES (\"test\", \"Test Project\"); SELECT * FROM projects;"}'
```

## ⚠️ **Important Notes**

1. **Two-Graph Architecture**: Knowledge Graph (nodes, relationships) and Process Graph (flows, steps) are separate
2. **No `flow` node type**: Nodes cannot be flows - flows are separate entities in `process_flows` table
3. **Foreign key constraints**: All tables have proper foreign key relationships
4. **Count tracking**: Project table tracks counts of nodes, flows, tasks, executions
5. **Timestamps**: All tables use Unix timestamps (seconds since epoch) for consistency