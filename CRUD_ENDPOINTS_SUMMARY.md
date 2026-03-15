# CRUD Endpoints Summary

## Available CRUD Endpoints

### 1. **Flow Definitions** (`flows` table)
- `GET /api/flow-definitions` - List all flows
- `GET /api/flow-definitions/:id` - Get specific flow
- `POST /api/flow-definitions` - Create new flow
- `PUT /api/flow-definitions/:id` - Update flow
- `DELETE /api/flow-definitions/:id` - Delete flow

### 2. **Flow Steps** (`flow_steps` table)
- `GET /api/flow-steps` - List all steps
- `GET /api/flow-steps/:id` - Get specific step
- `POST /api/flow-steps` - Create new step
- `PUT /api/flow-steps/:id` - Update step
- `DELETE /api/flow-steps/:id` - Delete step
- `GET /api/flow-steps/:id/input` - Get step input schema

### 3. **Flow Step Conditions** (`flow_step_conditions` table)
- `GET /api/flow-steps/:id/conditions` - Get conditions for a step
- `POST /api/flow-step-conditions` - Create new condition
- `GET /api/flow-conditions` - List all conditions

### 4. **Flow Runs** (`flow_runs` table)
- `GET /api/flow-runs` - List all flow runs
- `GET /api/flow-runs/:id` - Get specific flow run
- `POST /api/flow-runs` - Create new flow run
- `PUT /api/flow-runs/:id` - Update flow run
- `DELETE /api/flow-runs/:id` - Delete flow run
- `GET /api/flow-runs/:flowRunId/iterations` - Get iterations
- `POST /api/flow-runs/:flowRunId/iterations` - Create iteration

### 5. **Step Runs** (`step_runs` table)
- `GET /api/step-runs` - List all step runs

### 6. **Tasks** (`tasks` table)
- `GET /api/tasks` - List all tasks
- `GET /api/tasks/:id` - Get specific task
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### 7. **Other Endpoints**
- `GET /api/steps` - List all steps (legacy/duplicate)
- `GET /api/steps/:id` - Get specific step (legacy/duplicate)
- `POST /api/steps` - Create new step (legacy/duplicate)
- `PUT /api/steps/:id` - Update step (legacy/duplicate)
- `DELETE /api/steps/:id` - Delete step (legacy/duplicate)
- `GET /api/conversations` - List conversations
- `POST /api/execute-step` - Execute step with prompt (new chat mode)
- `POST /api/test-request` - Test request
- `GET /api/health` - Health check

## Missing CRUD Endpoints (Based on Database Schema)

### 1. **Flow Step Conditions** - Incomplete
- ❌ `PUT /api/flow-step-conditions/:id` - Update condition
- ❌ `DELETE /api/flow-step-conditions/:id` - Delete condition

### 2. **Flow Conditions** (`flow_conditions` table) - Incomplete
- ✅ `GET /api/flow-conditions` - List all conditions
- ❌ `GET /api/flow-conditions/:id` - Get specific condition
- ❌ `POST /api/flow-conditions` - Create condition
- ❌ `PUT /api/flow-conditions/:id` - Update condition
- ❌ `DELETE /api/flow-conditions/:id` - Delete condition

### 3. **Step Inputs/Outputs** - Partial
- ✅ `GET /api/flow-steps/:id/input` - Get input schema
- ❌ `PUT /api/flow-steps/:id/input` - Update input schema
- ❌ `GET /api/flow-steps/:id/output` - Get output schema
- ❌ `PUT /api/flow-steps/:id/output` - Update output schema

### 4. **Other Tables Without Endpoints**
- `flow_variables` - No endpoints
- `flow_transitions` - No endpoints
- `flow_tasks` - No endpoints
- `flow_execution_data` - No endpoints
- `flow_test_data` - No endpoints
- `context_variables` - No endpoints
- `projects` - No endpoints
- `nodes` - No endpoints (graph API)
- `relationships` - No endpoints (graph API)
- `rules` - No endpoints
- `validators` - No endpoints

## Answer to Your Questions

### 1. **Edit Steps**
✅ **Available:** Use `PUT /api/flow-steps/:id`

```bash
curl -X PUT "https://your-worker.workers.dev/api/flow-steps/step-123" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Step Title",
    "instructions": "Updated instructions...",
    "step_type": "analysis",
    "order_index": 2
  }'
```

### 2. **CRUD for Input and Output**
⚠️ **Partial:**

**Input:**
- ✅ `GET /api/flow-steps/:id/input` - Get input schema
- ❌ No PUT endpoint to update input schema (must use `PUT /api/flow-steps/:id` with `input_keys` field)

**Output:**
- ❌ No dedicated output endpoints
- ⚠️ Output fields are part of step update: `output_keys`, `output_url`, `output_payload_template`, `output_auth_token`, `output`

### 3. **Conditions for Steps and Flows**
⚠️ **Partial:**

**Step Conditions:**
- ✅ `GET /api/flow-steps/:id/conditions` - Get conditions for a step
- ✅ `POST /api/flow-step-conditions` - Create new condition
- ❌ No PUT/DELETE for individual conditions

**Flow Conditions:**
- ✅ `GET /api/flow-conditions` - List all conditions
- ❌ No POST/PUT/DELETE for flow conditions

## Minimal Changes Needed

To complete the CRUD functionality, you would need:

1. **Add PUT/DELETE for flow-step-conditions:**
   - `PUT /api/flow-step-conditions/:id`
   - `DELETE /api/flow-step-conditions/:id`

2. **Add full CRUD for flow-conditions:**
   - `GET /api/flow-conditions/:id`
   - `POST /api/flow-conditions`
   - `PUT /api/flow-conditions/:id`
   - `DELETE /api/flow-conditions/:id`

3. **Add dedicated input/output endpoints (optional):**
   - `PUT /api/flow-steps/:id/input`
   - `GET /api/flow-steps/:id/output`
   - `PUT /api/flow-steps/:id/output`

## Current Workarounds

1. **Update step input/output:** Use `PUT /api/flow-steps/:id` with all fields
2. **Update conditions:** Delete and recreate (no direct update)
3. **Flow conditions:** Only read operations available

## Recommendations

For your chat mode implementation, you have:
- ✅ Full CRUD for flows and steps
- ✅ GET for step input schema
- ✅ GET/POST for step conditions
- ✅ New `POST /api/execute-step` for chat mode

The missing PUT/DELETE for conditions might be needed if you want to edit conditions in your chat UI.