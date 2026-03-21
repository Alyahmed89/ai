# WAIT/PAUSE State Primitive for Human-in-the-Loop Flows

## Overview
The WAIT/PAUSE state primitive enables interactive flows where execution can pause to wait for human input, then resume with the provided data. This supports human-in-the-loop workflows and multi-agent handoffs.

## Key Components

### 1. New Conversation State
```typescript
type ConversationState = 
  | 'INITIALIZING' 
  | 'SENDING_STEP' 
  | 'AWAITING_NEXT_ITERATION'
  | 'ITERATION_COMPLETE'
  | 'DONE'
  | 'WAITING_FOR_INPUT'  // NEW
```

### 2. New Step Type: `await_input`
Steps with `step_type: 'await_input'` will pause execution and wait for user input.

### 3. Execution Context Tracking
```typescript
// In ConversationData
waiting_for_input?: {
  name: string;
  params?: Record<string, any>;
  step_id: string;
  timestamp: number;
};

// In ExecutionContext
awaiting_input?: {
  name: string;
  params?: Record<string, any>;
};
```

### 4. Resume Endpoint
`POST /resume` - Inject user input and continue execution.

## Usage Example

### Step Definition
```json
{
  "title": "Wait for Approval",
  "description": "[input:approval] [params:{\"options\": [\"approved\", \"rejected\"]}]",
  "step_type": "await_input",
  "order_index": 2
}
```

### Flow Execution
1. Flow executes normally until `await_input` step
2. System pauses, sets state to `WAITING_FOR_INPUT`
3. Frontend shows input form based on `params`
4. User submits input via `POST /resume`
5. Flow continues with input available in `{{inputs.approval}}`

### Resume API Call
```bash
POST /resume
Content-Type: application/json

{
  "input": "approved"
}
```

## Implementation Details

### 1. Step Handling (`handleSendingStepState`)
- Detects `step_type === 'await_input'`
- Extracts input name and params from description
- Sets conversation to `WAITING_FOR_INPUT` state
- Stores waiting info in `conversation.waiting_for_input`
- Updates execution context with `awaiting_input`

### 2. Resume Handling (`handleResume`)
- Validates conversation is in `WAITING_FOR_INPUT` state
- Stores input in `execution_context.inputs[inputName]`
- Clears `awaiting_input` from execution context
- Updates step status to 'completed'
- Resumes execution by calling `handleSendingStepState`

### 3. Input Format in Step Description
- `[input:name]` - Required: specifies input variable name
- `[params:{...}]` - Optional: JSON parameters for UI guidance
- Example: `[input:approval] [params:{"options": ["yes", "no"]}]`

## Benefits

1. **Human-in-the-Loop**: Enables workflows requiring human approval/input
2. **Multi-Agent Handoffs**: Pause → Human → Resume patterns
3. **Conditional Routing**: Use inputs in step conditions: `{{inputs.approval}} === 'approved'`
4. **State Preservation**: Execution context preserved during pause
5. **Simple API**: Minimal endpoints for pause/resume

## Example Flow

```json
{
  "steps": [
    {
      "title": "Analyze Requirements",
      "step_type": "default",
      "order_index": 1
    },
    {
      "title": "Wait for Budget Approval",
      "description": "[input:budget_approved] [params:{\"type\": \"boolean\", \"label\": \"Approve $10,000 budget?\"}]",
      "step_type": "await_input", 
      "order_index": 2
    },
    {
      "title": "Route Based on Approval",
      "step_type": "default",
      "order_index": 3,
      "conditions": [
        {
          "condition": "{{inputs.budget_approved}} === true",
          "next_step_order_index": 4
        },
        {
          "condition": "{{inputs.budget_approved}} === false",
          "next_step_order_index": -1
        }
      ]
    }
  ]
}
```

## Integration Points

1. **Frontend**: Detect `WAITING_FOR_INPUT` state, show appropriate input UI
2. **Condition System**: Reference inputs via `{{inputs.*}}` syntax
3. **Step Execution**: Inputs available in subsequent steps
4. **Database**: Step status stored as 'paused' during wait

## Error Handling

- Resume endpoint validates conversation is in correct state
- Input validation based on params (frontend responsibility)
- Timeout handling for abandoned paused flows (future enhancement)
- Input sanitization before storing in execution context