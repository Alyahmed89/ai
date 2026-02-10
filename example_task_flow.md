# EXAMPLE: Deterministic Task Flow Execution

## Scenario
When a payload contains `"flow": "etaflow"`, the system:
1. Selects the first PENDING task for that flow
2. Injects the task into the first prompt sent to DeepSeek
3. Executes the task via OpenHands
4. Task completion is determined externally (not by AI)

## Database Setup

### 1. Run Migration
```sql
-- Apply migration 0009
sqlite3 flow_runs.db < migrations/0009_deterministic_tasks.sql
```

### 2. Verify Tables Created
```sql
.tables
-- Should show: tasks, task_followups
```

### 3. Check Example Data
```sql
SELECT * FROM tasks WHERE flow_id = 'etaflow';
SELECT * FROM task_followups;
```

## API Usage

### Start Flow Execution
```bash
curl -X POST http://localhost:8787/start \
  -H "Content-Type: application/json" \
  -d '{
    "flow": "etaflow",
    "repository": "example/repo",
    "branch": "main",
    "max_iterations": 50
  }'
```

### Expected Response
```json
{
  "success": true,
  "conversation_id": "conversation_123",
  "flow_id": "etaflow",
  "state": "INIT",
  "message": "Flow execution initialized. First alarm scheduled.",
  "task": {
    "task_id": "task_eta_1",
    "title": "Initialize System",
    "description": "Set up environment and check dependencies",
    "task_type": "TASK"
  },
  "note": "Task-based execution: Task injected into first prompt"
}
```

## What Happens Internally

### 1. Task Selection
```sql
-- The system runs this query:
SELECT 
    t.id as task_id,
    t.title,
    t.description,
    'TASK' as task_type,
    NULL as parent_task_id
FROM tasks t
WHERE t.flow_id = 'etaflow' 
  AND t.status = 'PENDING'
ORDER BY t.order_index
LIMIT 1
```

### 2. Prompt Injection
```javascript
// MINIMAL injection only:
const taskPrompt = `Execute: ${task.title}`;
if (task.description) {
  taskPrompt += `\n${task.description}`;
}

// Result: "Execute: Initialize System\nSet up environment and check dependencies"
```

### 3. DeepSeek Request
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a flow execution assistant. Follow the flow steps precisely. Return structured JSON when asked."
    },
    {
      "role": "user",
      "content": "Execute: Initialize System\nSet up environment and check dependencies"
    }
  ]
}
```

## Task Completion (External)

### Status Update via API
```bash
# Mark task as DONE (external system)
curl -X POST http://localhost:8787/api/tasks/complete \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task_eta_1",
    "status": "DONE"
  }'
```

### Database Update
```sql
UPDATE tasks SET status = 'DONE' WHERE id = 'task_eta_1';
```

### Next Task Selection
After `task_eta_1` is marked DONE:
1. System checks for PENDING follow-ups where parent is DONE
2. If none, selects next PENDING task (`task_eta_2`)

## Flow Execution Sequence

```
START with flow="etaflow"
  ↓
Load next PENDING task: task_eta_1
  ↓
Inject: "Execute: Initialize System\nSet up environment..."
  ↓
Send to DeepSeek → OpenHands
  ↓
[External system marks task_eta_1 as DONE]
  ↓
Next iteration loads task_eta_2
  ↓
Inject: "Execute: Run Security Scan"
  ↓
Send to DeepSeek → OpenHands
  ↓
[External system marks task_eta_2 as DONE]
  ↓
...continues until no PENDING tasks
```

## Key Rules Enforced

1. **MINIMAL Injection**: Only task title + description
2. **External Completion**: AI doesn't mark tasks as DONE
3. **Deterministic Selection**: Always selects first PENDING task/follow-up
4. **Single Active Task**: Exactly ONE task/follow-up active at a time
5. **No Branching**: No dynamic logic, no AI decision-making

## Testing the Flow

```bash
# 1. Start flow execution
curl -X POST http://localhost:8787/start -H "Content-Type: application/json" -d '{"flow": "etaflow"}'

# 2. Check conversation status
curl http://localhost:8787/status/conversation_123

# 3. Mark task as complete (simulating external system)
curl -X POST http://localhost:8787/api/tasks/complete -H "Content-Type: application/json" -d '{"task_id": "task_eta_1", "status": "DONE"}'

# 4. Continue flow (next alarm will load next task)
```

## Notes

- Task completion status is managed EXTERNALLY (API/curl/frontend)
- The AI system only READS task status (PENDING/DONE)
- Follow-ups are only selected when parent task is DONE
- No validation, no branching, no conditional logic
- Simple, deterministic task execution