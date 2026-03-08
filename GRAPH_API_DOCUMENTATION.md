# Graph API Documentation

## Overview
This Graph API implements a comprehensive system for managing projects, nodes, relationships, dependencies, tags, and more. It follows the specification with 19 API categories.

## Base URL
- Graph API: `/graph`
- Existing CRUD API: `/api`

## 1. Projects

### GET `/graph/projects`
List all projects.

**Response:**
```json
[
  {
    "id": "project-1",
    "name": "DeepSeek Agent",
    "status": "active",
    "node_count": 5,
    "flow_count": 2,
    "task_count": 10,
    "execution_count": 3,
    "created_at": 1741468800,
    "updated_at": 1741468800,
    "metadata": "{\"description\": \"AI agent for code analysis\"}"
  }
]
```

### POST `/graph/projects`
Create a new project.

**Request Body:**
```json
{
  "id": "project-1", // optional
  "name": "DeepSeek Agent",
  "status": "active", // optional, default: "active"
  "metadata": "{\"description\": \"AI agent\"}" // optional
}
```

### GET `/graph/projects/{id}`
Get project details.

### PATCH `/graph/projects/{id}`
Update project.

### DELETE `/graph/projects/{id}`
Delete project.

## 2. Nodes

### GET `/graph/projects/{projectId}/nodes`
List nodes with filters.

**Query Parameters:**
- `type`: Filter by node type (task, flow, rule, context, data, api, ui, system)
- `tag`: Filter by tag name
- `status`: Filter by status (active, inactive, completed, failed)
- `search`: Search in title or content

### POST `/graph/nodes`
Create a new node.

**Request Body:**
```json
{
  "id": "node-1", // optional
  "project_id": "project-1",
  "type": "task",
  "title": "Implement API endpoints",
  "content": "{\"description\": \"Create all missing API endpoints\"}", // optional
  "status": "active", // optional, default: "active"
  "metadata": "{\"priority\": \"high\"}" // optional
}
```

### GET `/graph/nodes/{id}`
Get node details with full context.

**Response includes:**
- `node`: Node details
- `tags`: Array of tags
- `relationships`: Outgoing relationships
- `dependencies`: Dependencies on other nodes
- `children`: Child nodes (hierarchy)
- `parent`: Parent node (if any)

### PATCH `/graph/nodes/{id}`
Update node.

### DELETE `/graph/nodes/{id}`
Delete node.

## 3. Hierarchy (Levels)

### GET `/graph/nodes/{id}/children`
Get children of a node.

### POST `/graph/levels`
Create hierarchy relationship.

**Request Body:**
```json
{
  "id": "level-1", // optional
  "parent_node_id": "node-1",
  "child_node_id": "node-2",
  "order_index": 0 // optional, default: 0
}
```

### DELETE `/graph/levels/{id}`
Delete hierarchy relationship.

## 4. Relationships

### GET `/graph/nodes/{id}/relationships`
Get relationships for a node.

**Response includes:**
- `outgoing`: Relationships where node is source
- `incoming`: Relationships where node is target

### POST `/graph/relationships`
Create relationship.

**Request Body:**
```json
{
  "id": "rel-1", // optional
  "source_node_id": "node-1",
  "target_node_id": "node-2",
  "relation_type": "depends_on",
  "weight": 0.8, // optional, default: 1.0
  "metadata": "{\"description\": \"Task depends on flow\"}" // optional
}
```

### DELETE `/graph/relationships/{id}`
Delete relationship.

## 5. Dependencies

### GET `/graph/nodes/{id}/dependencies`
Get dependencies for a node.

**Response includes:**
- `depends_on`: Nodes this node depends on
- `depended_by`: Nodes that depend on this node

### POST `/graph/dependencies`
Create dependency.

**Request Body:**
```json
{
  "id": "dep-1", // optional
  "node_id": "node-1",
  "depends_on_node_id": "node-2",
  "dependency_type": "hard",
  "metadata": "{\"description\": \"Hard dependency\"}" // optional
}
```

### DELETE `/graph/dependencies/{id}`
Delete dependency.

## 6. Tags

### GET `/graph/tags`
List all tags.

### POST `/graph/tags`
Create tag.

**Request Body:**
```json
{
  "id": "tag-1", // optional
  "name": "api",
  "color": "#3498db" // optional
}
```

### POST `/graph/nodes/{id}/tags`
Add tag to node.

**Request Body:**
```json
{
  "tag_id": "tag-1"
}
```

### DELETE `/graph/nodes/{nodeId}/tags/{tagId}`
Remove tag from node.

## 7. Rules (To be implemented)

### GET `/graph/projects/{projectId}/rules`
List rules for a project.

### POST `/graph/rules`
Create rule.

### GET `/graph/rules/{id}`
Get rule details.

### PATCH `/graph/rules/{id}`
Update rule.

### DELETE `/graph/rules/{id}`
Delete rule.

## 8. Rule Variables (To be implemented)

### GET `/graph/rules/{id}/variables`
Get variables for a rule.

### POST `/graph/rules/{id}/variables`
Create rule variable.

### DELETE `/graph/rule-variables/{id}`
Delete rule variable.

## 9. Flow Transitions (To be implemented)

### GET `/graph/flows/{id}/transitions`
Get transitions for a flow.

### POST `/graph/flow-transitions`
Create flow transition.

### DELETE `/graph/flow-transitions/{id}`
Delete flow transition.

## 10. Contexts (To be implemented)

### GET `/graph/contexts/{id}`
Get context details.

### POST `/graph/contexts`
Create context.

## 11. Context Variables (To be implemented)

### GET `/graph/contexts/{id}/variables`
Get variables for a context.

### POST `/graph/contexts/{id}/variables`
Create context variable.

### PATCH `/graph/context-variables/{id}`
Update context variable.

### DELETE `/graph/context-variables/{id}`
Delete context variable.

## 12. Executions (Partially implemented - table exists)

### GET `/graph/projects/{projectId}/executions`
List executions for a project.

### POST `/graph/executions`
Create execution.

### GET `/graph/executions/{id}`
Get execution details.

## 13. Flow Runs (Already implemented in CRUD API)

### GET `/api/flow-runs`
List flow runs.

### POST `/api/flow-runs`
Create flow run.

### GET `/api/flow-runs/{id}`
Get flow run details.

## 14. Tasks (Already implemented in CRUD API)

### GET `/api/tasks`
List tasks.

### POST `/api/tasks`
Create task.

### GET `/api/tasks/{id}`
Get task details.

### PUT `/api/tasks/{id}`
Update task.

### DELETE `/api/tasks/{id}`
Delete task.

## 15. Flows (Already implemented in CRUD API)

### GET `/api/flows`
List flows.

### POST `/api/flows`
Create flow.

### GET `/api/flows/{id}`
Get flow details.

### PUT `/api/flows/{id}`
Update flow.

### DELETE `/api/flows/{id}`
Delete flow.

## 16. Flow Steps (Already implemented in CRUD API)

### GET `/api/flow-steps`
List flow steps.

### POST `/api/flow-steps`
Create flow step.

### GET `/api/flow-steps/{id}`
Get flow step details.

### PUT `/api/flow-steps/{id}`
Update flow step.

### DELETE `/api/flow-steps/{id}`
Delete flow step.

## 17. Graph View (To be implemented)

### GET `/graph/projects/{projectId}/graph`
Get graph visualization data.

**Response:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "task",
      "title": "Implement API",
      "status": "active",
      "position": { "x": 100, "y": 100 }
    }
  ],
  "edges": [
    {
      "id": "rel-1",
      "source": "node-1",
      "target": "node-2",
      "type": "relationship",
      "relation_type": "depends_on"
    },
    {
      "id": "level-1",
      "source": "node-1",
      "target": "node-3",
      "type": "hierarchy"
    },
    {
      "id": "dep-1",
      "source": "node-1",
      "target": "node-4",
      "type": "dependency"
    }
  ]
}
```

## 18. Execution Trigger (To be implemented)

### POST `/graph/executions/run`
Trigger execution.

**Request Body:**
```json
{
  "node_id": "node-1",
  "context_id": "ctx-1", // optional
  "engine": "default" // optional
}
```

**Response:**
```json
{
  "execution_id": "exec-123",
  "status": "started"
}
```

## 19. AI Analysis (To be implemented)

### POST `/graph/ai/analyze-node`
Analyze node with AI.

**Request Body:**
```json
{
  "node_id": "node-1",
  "context_id": "ctx-1", // optional
  "goal": "Identify dependencies and suggest improvements" // optional
}
```

**Response:**
```json
{
  "variables": ["status", "priority", "complexity"],
  "suggested_rules": ["if priority == 'high' then assign_to = 'senior_dev'"],
  "issues": ["Missing dependency on authentication service"],
  "tasks": ["Add authentication dependency", "Update documentation"]
}
```

## Database Schema

The following tables have been created:

1. **projects** - Enhanced with counts and status
2. **nodes** - Core entity with type, title, content, status
3. **levels** - Hierarchy/parent-child relationships
4. **relationships** - Graph edges between nodes
5. **dependencies** - Special type of relationship
6. **tags** - Categorization system
7. **node_tags** - Many-to-many relationship between nodes and tags
8. **rules** - Business logic and conditions
9. **rule_variables** - Variables used in rules
10. **flow_transitions** - Connections between flow steps
11. **contexts** - Execution contexts
12. **context_variables** - Variables in execution contexts

## Implementation Status

### ✅ Fully Implemented
- Projects (CRUD)
- Nodes (CRUD with filters)
- Hierarchy/Levels (CRUD)
- Relationships (CRUD)
- Dependencies (CRUD)
- Tags (CRUD with node associations)

### ⚠️ Partially Implemented
- Executions (table exists, API needs implementation)
- Flow Transitions (table exists, API needs implementation)

### ❌ Not Yet Implemented
- Rules (table exists, API needs implementation)
- Rule Variables (table exists, API needs implementation)
- Contexts (table exists, API needs implementation)
- Context Variables (table exists, API needs implementation)
- Graph View (needs implementation)
- Execution Trigger (needs implementation)
- AI Analysis (needs implementation)

### ✅ Already Existing (CRUD API)
- Flows
- Flow Steps
- Tasks
- Flow Runs
- Flow Definitions

## Next Steps

1. **Complete remaining endpoints**: Implement Rules, Rule Variables, Contexts, Context Variables APIs
2. **Implement Graph View**: Create endpoint for graph visualization data
3. **Implement Execution Trigger**: Add endpoint to trigger executions
4. **Implement AI Analysis**: Add AI-powered node analysis
5. **Testing**: Test all endpoints with sample data
6. **Documentation**: Create OpenAPI/Swagger documentation
7. **Frontend Integration**: Update frontend to use new Graph API

## Sample Data

Sample data has been inserted in the migration file for testing:
- 1 sample project ("DeepSeek Agent")
- 3 sample nodes (task, flow, rule)
- 3 sample tags (api, backend, priority-high)
- Sample relationships and dependencies
- Sample rule with variable
- Sample context with variable