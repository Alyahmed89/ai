# Frontend Testing Instructions

## Summary of Backend Fixes

### 1. **Fixed: Dual-Agent Issue**
- **Problem**: `/execute-step` endpoint was calling both DeepSeek and OpenHands when `OPENHANDS_API_URL` was configured
- **Solution**: Now respects `agent` field from flow definition:
  - `agent='deepseek'` → Only calls DeepSeek
  - `agent='openhands'` → Only calls OpenHands (if configured)
  - `agent='both'` → Calls both (dual-agent mode)
  - Default: `'deepseek'` if flow definition not found (changed from openhands)

### 2. **Added: Command Instructions to AI**
- **Problem**: AI didn't know about available backend commands
- **Solution**: Added system message to `/execute-step` endpoint telling AI:
  - About `/api/commands` endpoint
  - How to discover and execute commands
  - Examples of common commands

### 3. **Verified: Variable Interpolation**
- **Status**: Working correctly via `SecureVariableResolver`
- **Requires**: `input_keys` configuration in flow steps
- **Syntax**: `{variable_name.field}` in step instructions

## Testing Steps

### **Test 1: Agent Selection Fix**

#### **1.1 Test with DeepSeek-only flow**
```bash
# 1. Create a flow definition with agent='deepseek'
curl -X POST "http://localhost:8787/api/flow-definitions" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_deepseek_flow",
    "name": "Test DeepSeek Flow",
    "agent": "deepseek"
  }'

# 2. Execute a step
curl -X POST "http://localhost:8787/execute-step" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_deepseek_flow",
    "user_prompt": "Hello, test the agent selection"
  }'

# Expected response: Only deepseek_response, no openhands_response
# Response includes: "agent_used": "deepseek"
```

#### **1.2 Test with OpenHands-only flow**
```bash
# 1. Create a flow definition with agent='openhands'
curl -X POST "http://localhost:8787/api/flow-definitions" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_openhands_flow",
    "name": "Test OpenHands Flow",
    "agent": "openhands"
  }'

# 2. Execute a step
curl -X POST "http://localhost:8787/execute-step" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_openhands_flow",
    "user_prompt": "Hello, test OpenHands agent"
  }'

# Expected: Only openhands_response (if OPENHANDS_API_URL configured)
# If OPENHANDS_API_URL not configured: 400 error
```

#### **1.3 Test with dual-agent flow**
```bash
# 1. Create a flow definition with agent='both'
curl -X POST "http://localhost:8787/api/flow-definitions" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_both_flow",
    "name": "Test Dual-Agent Flow",
    "agent": "both"
  }'

# 2. Execute a step
curl -X POST "http://localhost:8787/execute-step" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_both_flow",
    "user_prompt": "Hello, test both agents"
  }'

# Expected: Both deepseek_response and openhands_response
# Response includes: "agent_used": "both"
```

### **Test 2: Command Discovery**

#### **2.1 Discover available commands**
```bash
# Get all AI-enabled commands
curl "http://localhost:8787/api/commands"

# Expected: Array of 15 commands with name, description, endpoint
# Example response:
# {
#   "commands": [
#     {
#       "name": "create_task",
#       "description": "Create a new task...",
#       "url": "/api/tasks",
#       "method": "POST"
#     },
#     ...
#   ]
# }
```

#### **2.2 Get command schema**
```bash
# Get parameter schema for a specific command
curl "http://localhost:8787/api/commands/create_task"

# Expected: JSON Schema for parameters
# Example:
# {
#   "type": "object",
#   "properties": {
#     "title": {"type": "string"},
#     "description": {"type": "string"},
#     ...
#   },
#   "required": ["title", "flow_id"]
# }
```

#### **2.3 Test AI command usage**
```bash
# Execute a step that should use commands
curl -X POST "http://localhost:8787/execute-step" \
  -H "Content-Type: application/json" \
  -d '{
    "user_prompt": "Please create a new task called Test Task with description Testing command system"
  }'

# Check logs for system message about commands
# AI should be aware of /api/commands endpoint
```

### **Test 3: Variable Interpolation**

#### **3.1 Setup test data**
```sql
-- Run this SQL in your database
-- Creates test flow with input_keys configuration

-- 1. Create test flow definition
INSERT INTO flow_definitions (id, name, agent) 
VALUES ('test_var_flow', 'Test Variable Flow', 'deepseek');

-- 2. Create test task
INSERT INTO tasks (id, flow_id, title, description, status)
VALUES ('test_task_123', 'test_var_flow', 'Test Task', 'This is a test task for variables', 'pending');

-- 3. Create flow step with input_keys
INSERT INTO flow_steps (id, flow_id, step_key, title, instructions, input_keys)
VALUES (
  'test_step_1',
  'test_var_flow',
  'test_variables',
  'Test Variable Step',
  'Please analyze: Task: {task_data.title}, Description: {task_data.description}, Status: {task_data.status}',
  '[
    {
      "key": "task_data",
      "url": "internal://tasks/test_task_123",
      "method": "GET",
      "response_path": "$"
    }
  ]'
);
```

#### **3.2 Test variable resolution**
```bash
# Execute the step with variables
curl -X POST "http://localhost:8787/execute-step" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_var_flow",
    "step_id": "test_step_1",
    "user_prompt": "Analyze this task"
  }'

# Expected: Variables should be resolved before sending to AI
# Check prompt_sent in response - should have actual values:
# "Task: Test Task, Description: This is a test task..., Status: pending"
```

#### **3.3 Test without input_keys (should fail)**
```bash
# Create step without input_keys
INSERT INTO flow_steps (id, flow_id, step_key, title, instructions)
VALUES (
  'test_step_2',
  'test_var_flow',
  'test_no_vars',
  'Test No Variables',
  'Task: {task_data.title} will not be resolved'
);

# Execute step
curl -X POST "http://localhost:8787/execute-step" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_var_flow",
    "step_id": "test_step_2",
    "user_prompt": "Test"
  }'

# Expected: Variables remain as placeholders {task_data.title}
```

## Expected Results

### **Successful Tests Should Show:**

1. **Agent Selection**:
   - `agent_used` field in response matches flow definition
   - Only requested agent(s) respond
   - Default agent is 'deepseek' when no flow_id provided (changed from openhands)

2. **Command System**:
   - `/api/commands` returns 15 AI-enabled commands
   - `/api/commands/:name` returns parameter schema
   - AI receives system message about available commands

3. **Variable Interpolation**:
   - With `input_keys`: Variables resolved to actual values
   - Without `input_keys`: Variables remain as placeholders
   - API errors handled gracefully

### **Common Issues to Check:**

1. **Dual-agent still running**:
   - Check if `OPENHANDS_API_URL` environment variable is set
   - Verify flow definition has correct `agent` field
   - Check database for flow definition agent value

2. **Variables not resolving**:
   - Verify `input_keys` is valid JSON array in flow_steps
   - Check API endpoints in `input_keys` are accessible
   - Ensure variable syntax is `{object.property}`

3. **AI not using commands**:
   - Check system message is included in `/execute-step`
   - Verify AI has access to make HTTP requests
   - Test if AI can call `/api/commands` endpoint

## Debugging Tips

### **Check Logs**:
```bash
# Look for these log messages:
# [execute-step] Using agent: deepseek for flow: test_flow
# [DeepSeek] Starting API call...
# [DeepSeek] Success! Response length: ...
```

### **Verify Database**:
```sql
-- Check flow definition agent
SELECT id, name, agent FROM flow_definitions WHERE id = 'your_flow_id';

-- Check flow step input_keys
SELECT id, step_key, input_keys FROM flow_steps WHERE flow_id = 'your_flow_id';

-- Check endpoint_registry for AI commands
SELECT name, endpoint_type, ai_enabled FROM endpoint_registry WHERE ai_enabled = TRUE;
```

### **Test Direct API Calls**:
```bash
# Test command endpoint directly
curl "http://localhost:8787/api/commands" | jq .

# Test variable resolver manually
curl -X POST "http://localhost:8787/api/test-variables" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "Test {variable.field}",
    "variables": {"variable": {"field": "value"}}
  }'
```

## Next Steps After Testing

1. **If tests pass**: Update frontend to:
   - Set `agent` field when creating flow definitions
   - Use `input_keys` for variable interpolation
   - Consider showing available commands in UI

2. **If tests fail**: Provide error details:
   - Exact error messages
   - Request/response payloads
   - Database state
   - Environment configuration

3. **Additional features to consider**:
   - UI for managing AI commands
   - Variable preview in step editor
   - Agent selection dropdown in flow editor