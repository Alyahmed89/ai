# FlowReact DAG Feature - Frontend Endpoints

## Overview
This document outlines the API endpoints needed to implement the DAG (Directed Acyclic Graph) feature in FlowReact frontend. The backend now supports edges between flow steps for branching/conditional flows.

## Core Endpoints

### 1. Bulk Update Flow Steps and Edges (Primary Endpoint)
**Endpoint:** `PUT /api/flows/:flowId/steps`

**Purpose:** Update all steps and edges for a flow in a single atomic operation. This is the main endpoint for FlowReact to sync its state with the backend.

**Request Body:**
```json
{
  "flow_id": "flow-123",
  "steps": [
    {
      "id": "step-1",
      "flow_id": "flow-123",
      "step_key": "start",
      "title": "Start Process",
      "instructions": "Begin the workflow",
      "step_type": "manual",
      "order_index": 0,
      "page_key": null,
      "blocking": true,
      "auto_fail_on_error": true,
      "retryable": false,
      "task_id": null,
      "output_keys": null,
      "output_url": null,
      "output_payload_template": null,
      "default_next_step": null,
      "output_auth_token": null,
      "input_keys": null,
      "output": false
    },
    {
      "id": "step-2",
      "flow_id": "flow-123",
      "step_key": "process",
      "title": "Process Data",
      "instructions": "Process the input data",
      "step_type": "ai",
      "order_index": 1,
      "page_key": null,
      "blocking": true,
      "auto_fail_on_error": true,
      "retryable": true,
      "task_id": null,
      "output_keys": null,
      "output_url": null,
      "output_payload_template": null,
      "default_next_step": null,
      "output_auth_token": null,
      "input_keys": null,
      "output": false
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "flow_id": "flow-123",
      "source_step_id": "step-1",
      "target_step_id": "step-2",
      "edge_type": "next",
      "condition": null,
      "route": null,
      "weight": 1.0,
      "metadata": null
    },
    {
      "id": "edge-2",
      "flow_id": "flow-123",
      "source_step_id": "step-2",
      "target_step_id": "step-3",
      "edge_type": "success",
      "condition": "status === 'success'",
      "route": "success_path",
      "weight": 1.0,
      "metadata": null
    },
    {
      "id": "edge-3",
      "flow_id": "flow-123",
      "source_step_id": "step-2",
      "target_step_id": "step-4",
      "edge_type": "error",
      "condition": "status === 'error'",
      "route": "error_path",
      "weight": 1.0,
      "metadata": null
    }
  ],
  "deleted_step_ids": ["step-5", "step-6"],
  "deleted_edge_ids": ["edge-4", "edge-5"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Flow steps and edges updated successfully",
    "steps_updated": 2,
    "edges_updated": 3,
    "steps_deleted": 2,
    "edges_deleted": 2
  }
}
```

**Features:**
- Atomic transaction (all or nothing)
- Orphan handling (deletes steps/edges not in payload)
- Automatic order_index recalculation based on edges
- Support for conditional branching (success/error/retry/fallback edges)

### 2. Get Flow Steps with Edges
**Endpoint:** `GET /api/flow-steps?flow_id=:flowId`

**Purpose:** Retrieve all steps for a flow. The frontend can use this to load the initial state.

**Response:**
```json
[
  {
    "id": "step-1",
    "flow_id": "flow-123",
    "step_key": "start",
    "title": "Start Process",
    "instructions": "Begin the workflow",
    "step_type": "manual",
    "order_index": 0,
    "page_key": null,
    "blocking": 1,
    "auto_fail_on_error": 1,
    "retryable": 0,
    "task_id": null,
    "output_keys": null,
    "output_url": null,
    "output_payload_template": null,
    "default_next_step": null,
    "output_auth_token": null,
    "input_keys": null,
    "output": 0,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

### 3. Get Flow Edges
**Endpoint:** `GET /api/flow-edges?flow_id=:flowId`

**Purpose:** Retrieve all edges for a flow. Can be combined with steps to reconstruct the DAG.

**Response:**
```json
[
  {
    "id": "edge-1",
    "flow_id": "flow-123",
    "source_step_id": "step-1",
    "target_step_id": "step-2",
    "edge_type": "next",
    "condition": null,
    "route": null,
    "weight": 1.0,
    "metadata": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

### 4. Individual Edge CRUD Operations (Optional)
For fine-grained control, these endpoints are also available:

- `GET /api/flow-edges/:id` - Get specific edge
- `POST /api/flow-edges` - Create new edge
- `PUT /api/flow-edges/:id` - Update edge
- `DELETE /api/flow-edges/:id` - Delete edge

## Edge Types
The system supports different edge types for various flow scenarios:

1. **`next`** - Default sequential flow
2. **`success`** - Branch on successful execution
3. **`error`** - Branch on error/failure
4. **`retry`** - Retry path
5. **`fallback`** - Fallback/alternative path
6. **`conditional`** - Custom conditional branching

## Conditional Branching
Edges can have conditions for dynamic routing:

```json
{
  "edge_type": "conditional",
  "condition": "data.status === 'approved' && data.amount > 1000",
  "route": "high_value_approval"
}
```

## Order Index Calculation
The backend automatically calculates `order_index` based on the DAG structure using topological sort:
- Steps are ordered based on their position in the graph
- Sources (steps with no incoming edges) get lowest order_index
- Order is recalculated after every bulk update
- Disconnected nodes or cycles get high order_index values

## Frontend Integration Example

```javascript
// 1. Load initial state
async function loadFlow(flowId) {
  const [steps, edges] = await Promise.all([
    fetch(`/api/flow-steps?flow_id=${flowId}`).then(r => r.json()),
    fetch(`/api/flow-edges?flow_id=${flowId}`).then(r => r.json())
  ]);
  
  return { steps, edges };
}

// 2. Save changes
async function saveFlow(flowId, steps, edges, deletedSteps = [], deletedEdges = []) {
  const response = await fetch(`/api/flows/${flowId}/steps`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      steps,
      edges,
      deleted_step_ids: deletedSteps,
      deleted_edge_ids: deletedEdges
    })
  });
  
  return response.json();
}

// 3. Handle conditional edges
function createConditionalEdge(sourceId, targetId, condition, route = null) {
  return {
    id: `edge-${Date.now()}`,
    flow_id: flowId,
    source_step_id: sourceId,
    target_step_id: targetId,
    edge_type: 'conditional',
    condition,
    route,
    weight: 1.0,
    metadata: null
  };
}
```

## Error Handling
- **Validation errors**: Return 400 with validation details
- **Database errors**: Return 500 with error message
- **Not found**: Return 404 for missing resources
- **Transaction rollback**: If any part fails, all changes are rolled back

## Migration Status
The `flow_edges` table has been created with the following schema:
- `id` TEXT PRIMARY KEY
- `flow_id` TEXT NOT NULL
- `source_step_id` TEXT NOT NULL
- `target_step_id` TEXT NOT NULL
- `edge_type` TEXT DEFAULT 'next'
- `condition` TEXT (optional)
- `route` TEXT (optional)
- `weight` REAL DEFAULT 1.0
- `metadata` TEXT (optional)
- `created_at` DATETIME
- `updated_at` DATETIME

The table includes foreign key constraints to `flow_steps` table with cascade delete.