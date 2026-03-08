# Remaining Endpoints Implementation Plan

## Overview
This document outlines the plan for implementing the remaining Graph API endpoints. We have already implemented 6 out of 19 categories, with database tables created for most of the remaining ones.

## Implementation Priority

### Priority 1: Core CRUD Operations
1. **Rules API** (#7) - High priority
2. **Rule Variables API** (#8) - High priority  
3. **Contexts API** (#15) - High priority
4. **Context Variables API** (#16) - High priority
5. **Executions API** (#14) - Medium priority (table exists)

### Priority 2: Specialized Endpoints
6. **Flow Transitions API** (#11) - Medium priority (table exists)
7. **Graph View API** (#17) - Medium priority
8. **Execution Trigger API** (#18) - Medium priority

### Priority 3: AI Integration
9. **AI Analysis API** (#19) - Low priority (requires AI integration)

## Detailed Implementation Plan

### 1. Rules API (#7)
**Endpoints to implement:**
- `GET /graph/projects/{projectId}/rules` - List rules for a project
- `POST /graph/rules` - Create rule
- `GET /graph/rules/{id}` - Get rule details
- `PATCH /graph/rules/{id}` - Update rule
- `DELETE /graph/rules/{id}` - Delete rule

**Database table already exists:** `rules`
**Schema:**
- `id` TEXT PRIMARY KEY
- `node_id` TEXT NOT NULL
- `rule_pattern` TEXT NOT NULL
- `execution_type` TEXT NOT NULL
- `engine` TEXT DEFAULT 'javascript'
- `created_at` INTEGER NOT NULL
- `updated_at` INTEGER NOT NULL
- `metadata` TEXT

### 2. Rule Variables API (#8)
**Endpoints to implement:**
- `GET /graph/rules/{id}/variables` - Get variables for a rule
- `POST /graph/rules/{id}/variables` - Create rule variable
- `DELETE /graph/rule-variables/{id}` - Delete rule variable

**Database table already exists:** `rule_variables`
**Schema:**
- `id` TEXT PRIMARY KEY
- `rule_id` TEXT NOT NULL
- `name` TEXT NOT NULL
- `type` TEXT NOT NULL
- `source` TEXT NOT NULL
- `default_value` TEXT
- `created_at` INTEGER NOT NULL

### 3. Contexts API (#15)
**Endpoints to implement:**
- `GET /graph/contexts/{id}` - Get context details
- `POST /graph/contexts` - Create context

**Database table already exists:** `contexts`
**Schema:**
- `id` TEXT PRIMARY KEY
- `entity_type` TEXT NOT NULL
- `entity_id` TEXT NOT NULL
- `created_at` INTEGER NOT NULL
- `updated_at` INTEGER NOT NULL
- `metadata` TEXT

### 4. Context Variables API (#16)
**Endpoints to implement:**
- `GET /graph/contexts/{id}/variables` - Get variables for a context
- `POST /graph/contexts/{id}/variables` - Create context variable
- `PATCH /graph/context-variables/{id}` - Update context variable
- `DELETE /graph/context-variables/{id}` - Delete context variable

**Database table already exists:** `context_variables`
**Schema:**
- `id` TEXT PRIMARY KEY
- `context_id` TEXT NOT NULL
- `name` TEXT NOT NULL
- `value` TEXT NOT NULL
- `created_at` INTEGER NOT NULL
- `updated_at` INTEGER NOT NULL

### 5. Executions API (#14)
**Endpoints to implement:**
- `GET /graph/projects/{projectId}/executions` - List executions for a project
- `POST /graph/executions` - Create execution
- `GET /graph/executions/{id}` - Get execution details

**Database table already exists:** `executions` (from migration 0007)
**Schema needs enhancement:** Add `context_id` and `engine` columns (already in migration 0034)

### 6. Flow Transitions API (#11)
**Endpoints to implement:**
- `GET /graph/flows/{id}/transitions` - Get transitions for a flow
- `POST /graph/flow-transitions` - Create flow transition
- `DELETE /graph/flow-transitions/{id}` - Delete flow transition

**Database table already exists:** `flow_transitions`
**Schema:**
- `id` TEXT PRIMARY KEY
- `from_step_id` TEXT NOT NULL
- `to_step_id` TEXT NOT NULL
- `condition_rule_id` TEXT
- `created_at` INTEGER NOT NULL
- `metadata` TEXT

### 7. Graph View API (#17)
**Endpoint to implement:**
- `GET /graph/projects/{projectId}/graph` - Get graph visualization data

**Implementation approach:**
1. Query all nodes for the project
2. Query all relationships, levels, and dependencies
3. Transform into nodes and edges format
4. Calculate positions for visualization (optional)
5. Return structured graph data

**Response format:**
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
    }
  ]
}
```

### 8. Execution Trigger API (#18)
**Endpoint to implement:**
- `POST /graph/executions/run` - Trigger execution

**Implementation approach:**
1. Validate node_id exists
2. Create execution record
3. Trigger execution logic (could be async)
4. Return execution_id and status

**Request body:**
```json
{
  "node_id": "node-1",
  "context_id": "ctx-1",
  "engine": "default"
}
```

**Response:**
```json
{
  "execution_id": "exec-123",
  "status": "started"
}
```

### 9. AI Analysis API (#19)
**Endpoint to implement:**
- `POST /graph/ai/analyze-node` - Analyze node with AI

**Implementation approach:**
1. Integrate with existing AI services (DeepSeek/OpenHands)
2. Analyze node content, relationships, dependencies
3. Generate suggestions, issues, tasks
4. Return structured analysis

**Request body:**
```json
{
  "node_id": "node-1",
  "context_id": "ctx-1",
  "goal": "Identify dependencies"
}
```

**Response:**
```json
{
  "variables": ["status", "priority"],
  "suggested_rules": ["if priority == 'high' then assign_to = 'senior'"],
  "issues": ["Missing dependency"],
  "tasks": ["Add dependency"]
}
```

## Implementation Steps

### Step 1: Extend graph-api.ts
Add the remaining endpoints to `/workspace/deepseek-agent/src/graph-api.ts`:
1. Add validation schemas for new entities
2. Implement CRUD endpoints for Rules, Rule Variables, Contexts, Context Variables
3. Implement specialized endpoints for Graph View, Execution Trigger, AI Analysis

### Step 2: Update Validation Schemas
Add Zod schemas for:
- Rule create/update
- Rule variable create
- Context create
- Context variable create/update
- Execution create
- Flow transition create
- AI analysis request

### Step 3: Implement Business Logic
For specialized endpoints:
- Graph View: Query and transform graph data
- Execution Trigger: Create and trigger executions
- AI Analysis: Integrate with AI services

### Step 4: Testing
1. Test each endpoint with sample data
2. Verify database operations work correctly
3. Test error handling and validation

### Step 5: Documentation Update
Update `GRAPH_API_DOCUMENTATION.md` with new endpoints.

## Estimated Effort

| Component | Estimated Time | Priority |
|-----------|----------------|----------|
| Rules API | 2 hours | High |
| Rule Variables API | 1 hour | High |
| Contexts API | 1 hour | High |
| Context Variables API | 1 hour | High |
| Executions API | 2 hours | Medium |
| Flow Transitions API | 1 hour | Medium |
| Graph View API | 3 hours | Medium |
| Execution Trigger API | 2 hours | Medium |
| AI Analysis API | 4 hours | Low |
| **Total** | **17 hours** | |

## Dependencies

1. **Database**: All tables already created in migration 0034
2. **Existing Code**: Build on existing patterns in graph-api.ts
3. **AI Integration**: Requires DeepSeek/OpenHands API integration for AI Analysis
4. **Testing**: Requires test data setup

## Success Criteria

1. All 19 API categories from specification are implemented
2. All endpoints return correct HTTP status codes
3. Data validation works for all inputs
4. Database operations are efficient and correct
5. Graph View returns properly formatted data for visualization
6. Execution Trigger properly creates and triggers executions
7. AI Analysis provides meaningful insights

## Next Actions

1. **Immediate**: Implement Rules, Rule Variables, Contexts, Context Variables APIs
2. **Short-term**: Implement Executions and Flow Transitions APIs
3. **Medium-term**: Implement Graph View and Execution Trigger
4. **Long-term**: Implement AI Analysis with proper AI integration