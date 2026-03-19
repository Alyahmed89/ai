# Strict Execution Engine

## Overview
A debug-oriented execution engine that exposes ALL failures without fallbacks, retries, or silent handling. Designed for transparency and debuggability.

## Core Principles

### 1. NO Fallbacks
- If a command fails, it fails immediately
- No alternative strategies or endpoint switching
- No command mapping (e.g., `rules_search` → `get_tasks`)

### 2. NO Silent Handling
- Every error is exposed with full details
- No error swallowing or generic error messages
- Complete stack traces and context

### 3. NO Retries
- Maximum attempts per command = 1
- No exponential backoff or retry logic
- Timeout failures are final

### 4. Strict Validation
- Parameter validation happens BEFORE execution
- Type checking, format validation, required field checks
- Conversation safety (ID format validation)

### 5. Sequential Execution
- Flow steps execute in strict order
- If any step fails → entire flow stops immediately
- No skipping failed steps

## Components

### 1. StrictCommandExecutor (`src/services/strictCommandExecutor.ts`)
- Validates parameters against schema
- Executes HTTP commands with timeout
- Captures FULL error details (status, response body, endpoint, params)
- Returns structured error results

### 2. StrictFlowExecutor (`src/services/strictFlowExecutor.ts`)
- Executes flow steps sequentially
- Stops entire flow on first failure
- Tracks execution state and logs
- No conditional branching or fallbacks

### 3. StrictConversationDO (`src/durable/StrictConversationDO.ts`)
- Durable Object implementation using strict executors
- Provides HTTP endpoints for testing
- Maintains execution state

## Error Reporting Format

### Validation Errors
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing or invalid parameters",
    "details": [
      {
        "field": "conversation_id",
        "error": "INVALID_CONVERSATION_ID",
        "message": "Conversation ID must be a valid string with minimum length 10"
      }
    ]
  },
  "meta": {
    "step": "Step 1",
    "attempt": 1,
    "validation_passed": false,
    "execution_attempted": false
  }
}
```

### HTTP Execution Errors
```json
{
  "success": false,
  "error": {
    "code": "REQUEST_FAILED",
    "message": "Endpoint request failed",
    "details": {
      "status": 530,
      "statusText": "Internal Server Error",
      "response": "Error details from server",
      "endpoint": "/api/rules/search/exact/:word",
      "url": "https://.../api/rules/search/exact/test",
      "params": { "word": "test" },
      "error_type": "http_error"
    }
  },
  "meta": {
    "step": "Step 2",
    "attempt": 1,
    "validation_passed": true,
    "execution_attempted": true
  }
}
```

## Execution State Tracking

The engine maintains detailed execution state:

```typescript
interface ExecutionState {
  current_step?: string;
  completed_steps: string[];
  failed_step?: {
    step: string;
    error: any;
    timestamp: number;
  };
  logs: Array<{
    timestamp: number;
    step: string;
    endpoint?: string;
    params_sent: any;
    validation_result: any;
    execution_result: any;
    error?: any;
  }>;
}
```

## Integration Points

### 1. Replace CommandExecutor
Replace the existing `CommandExecutor` with `StrictCommandExecutor` in:
- `ConversationDO.ts` - `handleCommand` method
- Any other command execution points

### 2. Update Flow Execution
Replace flow execution logic with `StrictFlowExecutor`:
- Sequential step execution
- Stop on first failure
- Detailed logging

### 3. Frontend Integration
Update frontend to display:
- Structured error details
- Execution state
- Step-by-step logs

## Testing

Run the test script:
```bash
node test-strict-execution.js
```

This demonstrates:
- Parameter validation failures
- Command not found errors
- Conversation safety checks
- Execution state tracking

## Benefits

### 1. Debuggability
- Every failure is visible and detailed
- No hidden retries or fallbacks
- Complete execution logs

### 2. Predictability
- Consistent behavior (fail fast, fail loud)
- No surprise recoveries
- Clear success/failure boundaries

### 3. Transparency
- Users see exactly what failed and why
- No guessing about what happened
- Full context for troubleshooting

### 4. Safety
- Validation before execution prevents invalid requests
- Conversation safety checks prevent invalid IDs
- Timeout protection

## Migration Path

1. **Phase 1**: Deploy strict executors alongside existing system
2. **Phase 2**: Route specific flows through strict execution
3. **Phase 3**: Gradually migrate all flows to strict execution
4. **Phase 4**: Remove old execution logic

## Example Flow Execution

```
Flow: Word Matching Flow
Steps: 5

Execution:
1. Step 1: Extract words from prompt ✓
2. Step 2: Search for exact matches ✗ (FAILED)
   - Error: HTTP 530 from rules_search_exact
   - Flow STOPPED immediately
   - Steps 3-5 NOT executed

Result:
- Success: false
- Completed: false
- Failed at: Step 2
- Error details: [full error shown]
```

## Comparison with Current System

| Aspect | Current System | Strict Engine |
|--------|----------------|---------------|
| Retries | 3 attempts with backoff | 1 attempt only |
| Fallbacks | Command mapping, alternative strategies | No fallbacks |
| Error Handling | Generic messages, some swallowing | Full details exposed |
| Flow Execution | Continues with alternatives | Stops on first failure |
| Validation | Basic type checking | Comprehensive validation |
| Logging | Basic console logs | Structured execution logs |

## Next Steps

1. Integrate with existing ConversationDO
2. Update frontend to display strict execution results
3. Create migration tool for existing flows
4. Add monitoring and alerting for strict execution failures
5. Document API changes for consumers