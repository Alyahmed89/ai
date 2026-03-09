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

### **1. GET `/graph/projects/{projectId}/nodes`** - List Nodes
**Filters Available**:
- `type` - Filter by node type (`task`, `doc`, `api`, `concept`, `rule`, `context`, `data`, `ui`, `system`)
- `tag` - Filter by tag name (exact match)
- `status` - Filter by status (`active`, `inactive`, `completed`, `failed`)
- `search` - Search in title and content (case-insensitive)

**Conditions**:
- Database must be configured (`FLOW_RUNS_DB`)
- Project must exist
- Returns empty array if no matches
- Supports soft delete filtering (only returns nodes where `deleted_at IS NULL`)

---

### **2. POST `/graph/nodes`** - Create Node
**Required Fields**:
- `project_id` - Must reference existing project
- `type` - Must be from allowed enum
- `title` - Minimum 1 character

**Optional Fields**:
- `id` - Auto-generated if not provided
- `content` - Node content/description
- `status` - Defaults to `active`
- `metadata` - JSON string for custom data

**Conditions**:
- Validates all inputs with Zod schema
- Auto-increments project's `node_count`
- Sets `created_at` and `updated_at` timestamps

**Request Body**:
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

---

### **3. GET `/graph/nodes/{id}`** - Get Node Details
**Returns Complete Node Graph**:
- Node details
- Tags assigned to node
- Relationships (where node is source)
- Dependencies (what this node depends on)
- Children nodes (hierarchy)
- Parent node (if exists)

**Conditions**:
- Node must exist and not be soft-deleted (returns 404 if not found)
- Includes all related data in single response

---

### **4. PATCH `/graph/nodes/{id}`** - Update Node
**Partial Updates Allowed**:
- Any combination of: `project_id`, `type`, `title`, `content`, `status`, `metadata`

**Conditions**:
- At least one field must be provided (besides `id`)
- `updated_at` automatically updated
- Returns 400 if no fields to update
- Returns 404 if node not found or soft-deleted

---

### **5. DELETE `/graph/nodes/{id}`** - Delete Node
**Soft Delete Implementation**:
- Sets `deleted_at` timestamp
- Decrements project's `node_count`
- Data preserved for recovery

**Conditions**:
- Node must exist and not already be soft-deleted (returns 404 if not found)
- Uses soft delete pattern

---

### **Node Type Validation**
```typescript
type NodeType = 'task' | 'doc' | 'api' | 'concept' | 'rule' | 'context' | 'data' | 'ui' | 'system'
```

### **Node Status Validation**
```typescript
type NodeStatus = 'active' | 'inactive' | 'completed' | 'failed'
```

### **Field Requirements**
| Field | Required | Min Length | Default | Notes |
|-------|----------|------------|---------|-------|
| `id` | No | 1 | Auto-generated | Format: `node-{timestamp}-{random}` |
| `project_id` | Yes | 1 | - | Must exist in projects table |
| `type` | Yes | - | - | Must be valid enum value |
| `title` | Yes | 1 | - | Cannot be empty |
| `content` | No | - | `null` | Can be null or empty |
| `status` | No | - | `active` | Must be valid enum value |
| `metadata` | No | - | `null` | JSON string, can be null |

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

1. **projects** - Enhanced with counts (`node_count`, `flow_count`, `task_count`, `execution_count`) and status
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