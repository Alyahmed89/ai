# Event Context Enhancement Proposal

## Current Issue
DeepSeek only receives the latest OpenHands event, losing valuable context about:
- Tool calls and their results
- File operations
- Thought process
- Multiple steps in complex tasks

## Proposed Solution: Multi-Event Context

### 1. Fetch Multiple Events
```typescript
// Instead of: limit=1&reverse=true
// Use: limit=5&reverse=true&source=agent
const eventsUrl = `${apiUrl}/conversations/${conversationId}/events?limit=5&reverse=true`;
```

### 2. Process Events Intelligently
```typescript
function processEventsForDeepSeek(events: any[]): string {
  const relevantEvents = events.filter(event => 
    event.source === 'agent' && 
    (event.action === 'message' || 
     event.tool_call_metadata || 
     event.file_operations)
  );
  
  // Group by logical units (e.g., tool call + result)
  const grouped = groupEvents(relevantEvents);
  
  // Format for DeepSeek
  return formatEventsForContext(grouped);
}
```

### 3. Format for DeepSeek
Example output:
```
[OpenHands Context - Last 3 events]

1. TOOL CALL: execute_bash
   Command: node --version
   Result: v20.20.0

2. TOOL CALL: execute_bash  
   Command: npm --version
   Result: 10.8.2

3. MESSAGE: Node and npm versions verified. Ready for next task.
```

### 4. Configuration Options
```typescript
const EVENT_CONTEXT_CONFIG = {
  maxEvents: 5,           // How many events to fetch
  minEvents: 1,           // Minimum events to wait for
  timeoutMs: 3000,        // Wait for events to accumulate
  includeToolCalls: true, // Include tool call details
  includeFileOps: true,   // Include file operations
  format: 'concise'       // 'concise' | 'detailed' | 'summary'
};
```

## Implementation Approaches

### Approach A: Simple Multi-Event (Recommended)
- Fetch last 3-5 events
- Format them concisely
- Send immediately (no waiting)

### Approach B: Batched with Timeout  
- Wait 2-3 seconds for events to accumulate
- Send all events from that period
- Better for rapid tool calls

### Approach C: Smart Grouping
- Group related events (tool call + result)
- Send logical units together
- Most complex but most useful

## Recommended Implementation

Start with **Approach A (Simple Multi-Event)**:
1. Change `limit=1` to `limit=3`
2. Format events concisely
3. Include tool call results
4. Test and iterate

This gives DeepSeek better context without slowing down the feedback loop.

## Example Enhanced Output

Without context (current):
```
OpenHands: Node and npm versions verified. Ready for next task.
```

With context (proposed):
```
[Context: Verified environment]
- Checked node version: v20.20.0 ✓
- Checked npm version: 10.8.2 ✓
- All prerequisites met

[Current Message]
Node and npm versions verified. Ready for next task.
```