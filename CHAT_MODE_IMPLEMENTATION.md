# Chat Mode Implementation

## Summary

I've implemented a chat mode interface for manual flow control with minimal changes to the existing codebase.

## Changes Made

### 1. Updated `src/crud-api.ts`:

**A. Enhanced GET `/api/flow-steps` endpoint:**
- Added `flow_id` query parameter support
- Now filters steps by flow: `GET /api/flow-steps?flow_id=my-flow`

**B. Added POST `/api/execute-step` endpoint:**
- Executes a step with optional user prompt
- Combines user prompt with step instructions when step_id provided
- Calls DeepSeek API (and optionally OpenHands)
- Returns structured response

## API Endpoints

### 1. Get Steps for a Flow
```bash
GET /api/flow-steps?flow_id={flow_id}
```

### 2. Execute Step with Prompt
```bash
POST /api/execute-step
{
  "flow_id": "my-flow",           // Required when step_id provided
  "step_id": "step-1",            // Optional
  "user_prompt": "Fix the bug",   // Required
  "include_step_instructions": true  // Default: true
}
```

## How It Works

1. **Frontend loads steps**: `GET /api/flow-steps?flow_id=my-flow`
2. **User selects step** from sidebar
3. **User types prompt** in chat input
4. **Frontend sends**: `POST /api/execute-step` with prompt + step
5. **Backend combines**: `user_prompt + "\n\n=== STEP: {title} ===\n{instructions}"`
6. **Calls DeepSeek** with combined prompt
7. **Returns response** to frontend
8. **Frontend displays** response in chat

## Example Flow

```javascript
// 1. Load steps
const steps = await fetch(`/api/flow-steps?flow_id=security-audit`);

// 2. User selects step "step-analyze" and types "Check for SQL injection"

// 3. Send to API
const response = await fetch('/api/execute-step', {
  method: 'POST',
  body: JSON.stringify({
    flow_id: 'security-audit',
    step_id: 'step-analyze',
    user_prompt: 'Check for SQL injection vulnerabilities'
  })
});

// 4. Display response
const result = await response.json();
console.log(result.data.deepseek_response);
```

## Minimal Design

- **No changes to existing flow execution** - doesn't break anything
- **Reuses existing services** (DeepSeek, OpenHands)
- **Stateless** - frontend manages chat history
- **Flexible** - can send prompts with or without steps

## Ready for Frontend Implementation

The backend is complete. You can now build a chat UI that:
1. Lists flow steps in a sidebar
2. Allows step selection
3. Sends prompts with step context
4. Displays responses in a chat interface

See `FLOW_ENDPOINTS.md` for complete API documentation.