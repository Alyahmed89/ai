# Flow Management Endpoints

## ✅ NEW: POST /api/flow-step-conditions
**Create flow step conditions with next_flow_id support**

### Request Body:
```json
{
  "flow_step_id": "step-id",
  "condition_type": "response_contains",
  "condition_value": "status=success",
  "condition_operator": "equals",  // Optional, default: "equals"
  "next_step": 2,                  // Optional: Next step number within current flow
  "next_step_id": "step-2-id",     // Optional: Next step ID within current flow
  "next_flow_id": "flow-fix"       // Optional: Next flow ID (triggers flow transition)
}
```

### Rules:
1. **At least one transition target required**: Must provide `next_step`, `next_step_id`, or `next_flow_id`
2. **Flow transition behavior**: When `next_flow_id` is provided:
   - `next_step` is automatically set to `-1` (terminate current flow)
   - `next_step_id` is set to `"TERMINATE_FLOW"`
   - Flow transition happens when condition is met AND current flow completes
3. **Condition types supported**: `response_contains`, `response_matches`, `response_starts_with`, `response_ends_with`

### Example: Create condition for flow transition
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-step-conditions" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_step_id": "step-1-id",
    "condition_type": "response_contains",
    "condition_value": "status=clean",
    "next_flow_id": "flow-validate"
  }'
```

## Existing Endpoints

### 1. Flow Definitions
**GET /api/flow-definitions** - List all flows
**GET /api/flow-definitions/:id** - Get specific flow
**POST /api/flow-definitions** - Create new flow
**PUT /api/flow-definitions/:id** - Update flow
**DELETE /api/flow-definitions/:id** - Delete flow

#### POST Example:
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-definitions" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Security Hardening",
    "description": "Run security scripts",
    "repository": "Alyahmed89/eta",
    "branch": "main",
    "max_iterations": 100,
    "next_flow_id": "flow-fix",
    "priority": 1
  }'
```

### 2. Flow Steps
**GET /api/flow-steps** - List all steps
**GET /api/flow-steps/:id** - Get specific step
**POST /api/flow-steps** - Create new step
**PUT /api/flow-steps/:id** - Update step
**DELETE /api/flow-steps/:id** - Delete step

#### POST Example:
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-steps" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-run-scripts",
    "step_key": "fetch_scripts",
    "title": "Fetch Security Scripts",
    "instructions": "Find all security scripts",
    "step_type": "reception",
    "order_index": 1,
    "blocking": true,
    "output": true
  }'
```

### 3. Flow Step Conditions (NEW!)
**GET /api/flow-steps/:id/conditions** - Get conditions for a step
**POST /api/flow-step-conditions** - Create new condition ✅ NEW
**GET /api/flow-conditions** - List all conditions

## Complete Three-Flow Chain Example

### Step 1: Create Flow Definitions
```bash
# 1. flow-run-scripts
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-definitions" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "flow-run-scripts",
    "name": "Run Security Scripts",
    "repository": "Alyahmed89/eta",
    "branch": "main",
    "next_flow_id": "flow-fix"
  }'

# 2. flow-fix
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-definitions" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "flow-fix",
    "name": "Apply Fixes",
    "repository": "Alyahmed89/eta",
    "branch": "main",
    "next_flow_id": "flow-validate"
  }'

# 3. flow-validate
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-definitions" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "flow-validate",
    "name": "Validate Fixes",
    "repository": "Alyahmed89/eta",
    "branch": "main",
    "next_flow_id": "flow-run-scripts"
  }'
```

### Step 2: Create Flow Steps
```bash
# For flow-run-scripts
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-steps" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-run-scripts",
    "step_key": "fetch_pending_scripts",
    "title": "Fetch Pending Scripts",
    "instructions": "Find all non-COMPLETE scripts. Respond with: status=found, count=X",
    "step_type": "reception",
    "order_index": 1,
    "default_next_step": 2
  }'
```

### Step 3: Create Conditions with Flow Transitions
```bash
# Create condition that triggers flow-fix when issues found
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-step-conditions" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_step_id": "step-1-id",
    "condition_type": "response_contains",
    "condition_value": "status=issues_found",
    "next_flow_id": "flow-fix"
  }'

# Create condition that continues to next step when clean
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-step-conditions" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_step_id": "step-1-id",
    "condition_type": "response_contains",
    "condition_value": "status=clean",
    "next_step": 2
  }'
```

## How Flow Transitions Work

### 1. **Step-Level Conditions** (NEW)
- Conditions can now specify `next_flow_id`
- When condition is met AND step completes:
  - Current flow terminates (`next_step = -1`)
  - Next flow starts automatically
- Example: `"status=issues_found"` → `"flow-fix"`

### 2. **Flow Completion Logic**
1. Flow runs until `next_step = -1` (termination)
2. System checks `getNextFlowBasedOnConditions()`:
   - Checks `flow_step_conditions.next_flow_id` (NEW)
   - Checks `flow_flow_conditions.next_flow_id` (existing)
   - Falls back to `flow_definitions.next_flow_id` (static)
3. Starts next flow if any `next_flow_id` found

### 3. **Database Schema Updates**
```sql
-- Added column to flow_step_conditions
ALTER TABLE flow_step_conditions ADD COLUMN next_flow_id TEXT;
```

## Testing Your Flows

### 1. Start a Flow
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/start" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-run-scripts",
    "initial_prompt": "Start security hardening"
  }'
```

### 2. Check Status
```bash
curl "https://deepseek-agent.alghamdimo89.workers.dev/status/{conversation_id}"
```

### 3. Verify Conditions
```bash
# Check step conditions
curl "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-steps/{step-id}/conditions"

# Check all conditions
curl "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-conditions"
```

## Error Handling

### Common Errors:
1. **400 Bad Request**: Missing required fields
2. **404 Not Found**: Flow/step not found
3. **500 Server Error**: Database issues

### Validation Rules:
- `flow_step_id` must exist
- `condition_type` must be valid
- At least one of `next_step`, `next_step_id`, or `next_flow_id` required
- `next_flow_id` must reference existing flow

## Migration from SQL to API

### Old Way (Direct SQL):
```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "INSERT INTO flow_step_conditions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    "params": ["cond-1", "step-1", "response_contains", "status=success", "equals", 2, 1773590000, 1773590000]
  }'
```

### New Way (API Endpoint):
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/api/flow-step-conditions" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_step_id": "step-1",
    "condition_type": "response_contains",
    "condition_value": "status=success",
    "next_step": 2
  }'
```

## Summary

✅ **NEW**: `POST /api/flow-step-conditions` endpoint created
✅ **NEW**: `next_flow_id` support in step conditions
✅ **NEW**: Conditional flow transitions at step level
✅ **EXISTING**: Full CRUD API for flows and steps
✅ **EXISTING**: Flow chaining via `flow_definitions.next_flow_id`

Now you can create complete flow chains programmatically using the API endpoints!