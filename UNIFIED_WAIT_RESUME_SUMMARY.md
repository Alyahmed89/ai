# Unified Wait/Resume System - Architecture Fix

## Problem Identified
The original implementation introduced architecture drift:
1. **New step type** (`step_type: 'await_input'`) - split logic between DB and AI
2. **String parsing** (`[input:name]`) - not type-safe, breaks structured system

## Solution: Unified Action-Based System

### Core Principle
**ONE primitive: `await_input` action type** used everywhere:
- Human input collection
- Agent handoffs  
- Approvals
- Clarifications

### Two Sources, One Handling
1. **Step Config** (DB-driven):
```json
{
  "step_type": "default",
  "await_input": {
    "name": "budget_approved",
    "params": {"type": "boolean"}
  }
}
```

2. **AI Actions** (AI-driven):
```json
{
  "actions": [{
    "type": "await_input",
    "name": "approval",
    "params": {"options": ["yes", "no"]}
  }]
}
```

### Unified Engine Handling
```typescript
// StepExecutor processes both sources
if (action.type === 'await_input') {
  context.awaiting_input = { name: action.name, params: action.params };
}

// ConversationDO handles both the same way
private async checkAndPauseForInput(step: StepData): boolean {
  // Check step.await_input config
  // Check context.awaiting_input from AI
  // Same pause/resume flow for both
}
```

## Changes Made

### 1. Types Updated
- **`src/types.ts`**: Added `await_input?: {name: string, params?: any}` to `StepData`
- **`src/core/execution-context.ts`**: 
  - Added `Action` type with `'await_input'` as valid action type
  - Updated `ContextValue` to support metadata
  - `ExecutionContext.inputs` now stores `ContextValue` objects with metadata

### 2. StepExecutor Updated
- **`src/core/step-executor.ts`**: Added `await_input` action handling
- Processes AI actions, sets `context.awaiting_input` for pause signals

### 3. ConversationDO Refactored
- **REMOVED**: `step_type: 'await_input'` handling
- **REMOVED**: String parsing (`[input:name]`)
- **ADDED**: `checkAndPauseForInput()` method
  - Handles both step config and AI actions
  - Unified pause/resume flow

### 4. Condition Evaluator Updated
- **`src/core/condition-evaluator.ts`**: Handles `ContextValue` objects in inputs
- `{{inputs.budget_approved}}` extracts `.value` from metadata objects

### 5. Resume Endpoint Enhanced
- **`src/durable/ConversationDO.ts`**: `handleResume()` stores inputs with metadata:
```typescript
inputs[inputName] = {
  value: userInput,
  metadata: {
    source: 'user',
    timestamp: Date.now(),
    step_id: stepId,
    input_name: inputName
  }
}
```

## API Endpoints (UNCHANGED)

### POST /resume (NEW)
```json
Request: {"input": "approved"}
Response: {"success": true, "input_name": "approval", "step_id": "step_123"}
```

### POST /execute-step (UNCHANGED interface)
- Internal refactor only
- Same request/response format

## Frontend Changes Required

### 1. Monitor New State
```typescript
if (conversation.state === 'WAITING_FOR_INPUT') {
  const { name, params } = conversation.waiting_for_input;
  // Show input UI based on params
}
```

### 2. Submit Input
```javascript
POST /resume
{"input": userValue}
```

### 3. Support Step Config
- Flow editor: Add `await_input` field to step configuration
- UI: Render based on `params` (type, options, label, etc.)

## Benefits Achieved

1. **Architecture Clean**: One primitive, unified handling
2. **Type Safety**: Structured config, no string parsing
3. **Flexibility**: Both DB-driven and AI-driven wait points
4. **Audit Trail**: Inputs stored with full metadata
5. **Condition Support**: `{{inputs.*}}` works with metadata objects
6. **Future Proof**: Easy to add new action types

## Testing Points

1. **Step Config Wait**: Flow with `step.await_input` config
2. **AI Action Wait**: AI emits `await_input` action
3. **Resume Flow**: `/resume` endpoint with input injection
4. **Condition Routing**: `{{inputs.*}}` in step conditions
5. **Metadata Storage**: Verify input metadata preservation

## Migration Path
- Existing `step_type: 'await_input'` steps need migration to new format
- String parsing (`[input:name]`) replaced with structured config
- Backward compatibility layer possible if needed

## Final Architecture
```
Step
  ↓
[ AI output (actions) OR step config (await_input) ]
  ↓
Action: await_input detected
  ↓
Engine → pause (WAITING_FOR_INPUT state)
  ↓
Frontend shows input UI
  ↓
POST /resume with user input
  ↓
context.inputs[name] = {value, metadata}
  ↓
Engine continues with {{inputs.*}} available
```