# Flow Auto-Restart Test Documentation

## Implementation Summary

The flow auto-restart feature has been implemented in `src/durable/ConversationDO.ts`. When a flow completes all steps, it will:

1. **Restart the flow** with the same payload (via `restartFlow()` method)
2. **Close the current conversation** (via `stopConversation('flow_completed')`)

## Changes Made

### 1. Added `restartFlow()` method (lines 3236-3286)
```typescript
private async restartFlow(): Promise<void> {
  if (!this.conversation?.flow_id) {
    console.log(`[DO:${this.state.id}] Cannot restart flow: no flow_id in conversation`);
    return;
  }

  console.log(`[DO:${this.state.id}] Restarting flow: ${this.conversation.flow_id}`);
  
  // Prepare the request body for the new flow (same as original)
  const requestBody = {
    flow_id: this.conversation.flow_id,
    repository: this.conversation.repository,
    branch: this.conversation.branch || 'main',
    initial_user_prompt: this.conversation.initial_user_prompt,
    max_iterations: this.conversation.max_iterations,
    deepseek_system: this.conversation.deepseek_system
  };

  try {
    // Create a new Durable Object for the restarted flow
    const newConversationIdObj = this.env.CONVERSATIONS.newUniqueId();
    const newConversationStub = this.env.CONVERSATIONS.get(newConversationIdObj);

    // Initialize the new Durable Object for flow execution
    const initResponse = await newConversationStub.fetch('http://placeholder/initialize-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error(`[DO:${this.state.id}] Failed to restart flow: ${initResponse.status} - ${errorText}`);
      return;
    }

    console.log(`[DO:${this.state.id}] Flow restarted with ID: ${newConversationIdObj.toString()}`);
    
    // Update current flow run with next_flow_id if database is available
    if (this.env.FLOW_RUNS_DB && this.flowRunId) {
      await this.env.FLOW_RUNS_DB.prepare(
        'UPDATE flow_runs SET next_flow_id = ? WHERE id = ?'
      ).bind(newConversationIdObj.toString(), this.flowRunId).run();
    }
  } catch (error) {
    console.error(`[DO:${this.state.id}] Failed to restart flow:`, error);
  }
}
```

### 2. Updated flow completion points to call `restartFlow()`

#### a. `handleOpenHandsResponse()` (lines 255-275)
When all steps are completed via webhook response.

#### b. `handleSendingStepState()` (lines 2887-2893)
When `getNextStep()` returns null (no more steps).

#### c. `handleTriggerNextIteration()` (lines 1300-1338)
When no more steps during iteration triggering.

#### d. `handleIterationCompleteState()` (lines 2292-2298)
When no more steps after iteration completion.

## Test Flow

There's a test flow `test_flow_001` with 2 steps in the database:

1. **Step 1**: "Store test data with key 'test_key' and value: {{test_value}}"
2. **Step 2**: "Echo back retrieved data"

## API Endpoints for Testing

### Start a flow:
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/start" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_flow_001",
    "repository": "Alyahmed89/deepseek-agent",
    "branch": "flow",
    "initial_user_prompt": "Execute test flow with database-driven context",
    "max_iterations": 20,
    "deepseek_system": "You are a test execution assistant."
  }'
```

### Check status:
```bash
curl "https://deepseek-agent.alghamdimo89.workers.dev/status/{conversation_id}"
```

### Stop a conversation:
```bash
curl -X POST "https://deepseek-agent.alghamdimo89.workers.dev/stop/{conversation_id}"
```

## How Auto-Restart Works

1. When flow completes all steps, `restartFlow()` is called
2. It creates a new Durable Object with `newUniqueId()`
3. It calls `/initialize-flow` on the new Durable Object with the same payload
4. The current conversation is stopped via `stopConversation('flow_completed')`
5. The new flow starts execution

## Database Tracking

If `FLOW_RUNS_DB` is available, the flow run is updated with `next_flow_id` pointing to the restarted flow's conversation ID.

## Notes

- The OpenHands API doesn't have a DELETE/stop endpoint, so we use our internal `stopConversation()` method
- The auto-restart happens before stopping the current conversation to ensure parameters are preserved
- All flow completion paths now trigger auto-restart for consistency