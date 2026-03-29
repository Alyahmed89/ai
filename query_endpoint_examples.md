# Unified Query Endpoint Documentation

## Endpoint
`POST /api/query`

## Overview
The unified query endpoint retrieves flows, steps, runs, and variables with filtering, sorting, and structured data organization.

## Request Parameters

### Body Parameters (JSON)
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `flow_id` | string | No | - | Filter by flow definition ID |
| `flow_run_id` | string | No | - | Filter by flow run ID |
| `step_id` | string | No | - | Filter by step ID |
| `type` | string | No | `full` | Response type: `full`, `flow`, `step`, `run`, `variable` |
| `sort_by` | string | No | `step_order` | Sort field: `step_order` or `created_at` |
| `order` | string | No | `asc` | Sort order: `asc` or `desc` |

### Notes:
- At least one filter parameter (`flow_id`, `flow_run_id`, `step_id`) is required when `type` is not `"full"`
- When `type` is `"full"`, no filter is required (returns all data)

## Response Structure

### Full Response (`type: "full"`)
```json
{
  "flow": { ... },           // Flow definition object or null
  "steps": [ ... ],          // Array of flow steps
  "step_runs": [ ... ],      // Array of step runs
  "variables": {
    "input": { ... },        // Input variables from flow_runs.input_payload
    "ai": { ... },           // AI output variables from step_runs.response
    "step": { ... },         // Step output variables from step_runs.output_payload
    "flow": { ... }          // Flow variables from variables table and flow_execution_data
  },
  "flow_run": { ... }        // Flow run data (if flow_run_id provided)
}
```

### Partial Responses
- `type: "flow"` - Returns only `flow` object
- `type: "step"` - Returns only `steps` array
- `type: "run"` - Returns only `step_runs` array
- `type: "variable"` - Returns only `variables` object

## Example Requests

### 1. Get All Data (Full Response)
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "full",
    "sort_by": "step_order",
    "order": "asc"
  }'
```

### 2. Get Data for Specific Flow
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_api_flow",
    "type": "full",
    "sort_by": "created_at",
    "order": "desc"
  }'
```

### 3. Get Data for Specific Flow Run
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_run_id": "flow_1774796688469_u3g5e68",
    "type": "full"
  }'
```

### 4. Get Only Steps for a Flow
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_api_flow",
    "type": "step",
    "sort_by": "step_order",
    "order": "asc"
  }'
```

### 5. Get Only Variables for a Flow Run
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_run_id": "flow_1774796688469_u3g5e68",
    "type": "variable"
  }'
```

## Example Response

### Full Response Example
```json
{
  "flow": {
    "id": "test_api_flow",
    "name": "Test API Flow",
    "description": "Flow for testing API endpoints",
    "created_at": "2024-12-17T05:30:00Z",
    "updated_at": "2024-12-17T05:30:00Z"
  },
  "steps": [
    {
      "id": "test_step_1",
      "flow_id": "test_api_flow",
      "step_key": "step1",
      "step_type": "default",
      "step_number": 1,
      "order_index": 0,
      "created_at": "2024-12-17T05:30:00Z"
    }
  ],
  "step_runs": [
    {
      "id": "step_1774796569633_ei5fp33",
      "flow_run_id": "flow_1774796556056_gzwvfjc",
      "step_id": "test_step_1",
      "iteration": 0,
      "attempt": 1,
      "prompt": "Execute step: Test API Step\n\nMake an API call to test_jsonplaceholder endpoint",
      "response": "I'll help you test the JSONPlaceholder API endpoint...",
      "input_payload": "{\"step_key\":\"step1\",\"step_type\":\"default\",\"requires_task\":false,\"task_id\":null,\"output_enabled\":false}",
      "output_payload": "{\"text\":\"I'll help you test the JSONPlaceholder API endpoint...\"}",
      "status": "completed",
      "created_at": 1774796569,
      "duration_ms": 0,
      "api_calls": "[]"
    }
  ],
  "variables": {
    "input": {},
    "ai": {
      "step_test_step_1_iteration_0_attempt_1": "I'll help you test the JSONPlaceholder API endpoint..."
    },
    "step": {
      "step_test_step_1_output": {
        "text": "I'll help you test the JSONPlaceholder API endpoint..."
      }
    },
    "flow": {
      "step_test_step_1_completed": "true",
      "issues_found": "true",
      "last_endpoint_status": "success"
    }
  },
  "flow_run": {
    "id": "flow_1774796556056_gzwvfjc",
    "flow_id": "test_api_flow",
    "status": "completed",
    "created_at": 1774796556056,
    "completed_at": 1774796569,
    "output_response": "I'll help you test the JSONPlaceholder API endpoint...",
    "step_count": 1,
    "last_step_at": 1774796569
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "At least one filter parameter (flow_id, flow_run_id, step_id) is required when type is not 'full'"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "Error message details"
}
```

## Implementation Details

The endpoint performs the following operations:

1. **Data Retrieval**: Queries multiple database tables in parallel:
   - `flow_definitions` - Flow metadata
   - `flow_steps` - Step definitions
   - `step_runs` - Step execution history
   - `variables` - Variable storage
   - `flow_execution_data` - Flow execution state

2. **Variable Organization**: Structures variables into four categories:
   - `input`: From `flow_runs.input_payload`
   - `ai`: From `step_runs.response`
   - `step`: From `step_runs.output_payload`
   - `flow`: From `variables` table and `flow_execution_data`

3. **Sorting Options**:
   - Steps can be sorted by `step_order` (COALESCE(step_number, order_index)) or `created_at`
   - Step runs are sorted by `iteration` and `attempt`
   - Variables are sorted by `created_at`

4. **Filtering Logic**:
   - Supports filtering by `flow_id`, `flow_run_id`, or `step_id`
   - Automatically infers relationships between entities
   - Returns appropriate data based on filter hierarchy