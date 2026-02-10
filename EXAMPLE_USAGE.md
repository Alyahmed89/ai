# EXAMPLE: Using the Deterministic Task System with Etaflow

## 📋 **PREREQUISITES**

### **Database Setup:**
```bash
# Apply migrations
sqlite3 flow_runs.db < migrations/0009_deterministic_tasks.sql
sqlite3 flow_runs.db < migrations/0010_task_execution_tracking.sql
sqlite3 flow_runs.db < migrations/0011_etaflow_tasks.sql

# Verify tasks inserted
sqlite3 flow_runs.db "SELECT COUNT(*) FROM tasks WHERE flow_id = 'etaflow';"
# Should return: 12

sqlite3 flow_runs.db "SELECT COUNT(*) FROM task_followups;"
# Should return: 11
```

## 🚀 **STEP 1: START ETAFLOW**

### **Request:**
```bash
curl -X POST https://hono.alghamdimo89.workers.dev/start \
  -H "Content-Type: application/json" \
  -d '{
    "flow": "etaflow",
    "repository": "Alyahmed89/eta",
    "branch": "fix-eta-template-syntax",
    "initial_user_prompt": "=== CONTEXT FOR DEEPSEEK ===\n[truncated for brevity]",
    "deepseek_system": "[truncated for brevity]",
    "max_iterations": 1000
  }'
```

### **Expected Response:**
```json
{
  "success": true,
  "conversation_id": "conversation_abc123",
  "flow_id": "etaflow",
  "task": {
    "task_id": "eta_task_1",
    "title": "Review Payload & Validate",
    "description": "Open /workspace/eta/seph6.json...",
    "task_type": "TASK"
  },
  "state": "INIT",
  "message": "Flow execution initialized. First alarm scheduled.",
  "note": "Task-based execution: Task injected into first prompt"
}
```

## 🔄 **STEP 2: AI EXECUTES TASK**

### **What Happens:**
1. ConversationDO loads `eta_task_1` from database
2. Injects task into prompt: `"Execute: Review Payload & Validate\nOpen /workspace/eta/seph6.json..."`
3. AI (DeepSeek) generates prompt for OpenHands
4. OpenHands executes the checklist
5. Task execution tracked in `task_execution_steps` table

## ✅ **STEP 3: MARK TASK COMPLETE**

### **Request:**
```bash
curl -X POST https://hono.alghamdimo89.workers.dev/tasks/eta_task_1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conversation_abc123"
  }'
```

### **Expected Response:**
```json
{
  "success": true,
  "task_id": "eta_task_1",
  "status": "DONE",
  "updated_at": "2026-02-09T20:30:00.000Z",
  "conversation_id": "conversation_abc123",
  "ping_sent": true,
  "ping_result": {
    "success": true,
    "message": "Next task loaded and execution scheduled",
    "flow_id": "etaflow",
    "task": {
      "task_id": "eta_task_2",
      "title": "Setup Environment",
      "description": "apt-get update && sleep 2...",
      "task_type": "TASK"
    },
    "state": "INIT",
    "note": "Task injected into prompt. Alarm scheduled for execution."
  },
  "note": "Task marked as DONE. This is the ONLY way tasks move to DONE."
}
```

## 📊 **STEP 4: MONITOR PROGRESS**

### **Check Current Task:**
```bash
curl https://hono.alghamdimo89.workers.dev/status/conversation_abc123
```

### **Check Task Execution History (SQL):**
```sql
SELECT 
  t.id as task_id,
  t.title,
  tes.started_at,
  tes.finished_at,
  tes.status as execution_status,
  t.status as task_status
FROM tasks t
LEFT JOIN task_execution_steps tes ON t.id = tes.task_id
WHERE t.flow_id = 'etaflow'
ORDER BY t.order_index, tes.started_at;
```

## 🏁 **STEP 5: FLOW TERMINATION**

### **When All Tasks Complete:**
After `eta_followup_final` is marked as DONE:

```json
{
  "success": true,
  "message": "Flow terminated - no more tasks",
  "flow_id": "etaflow",
  "flow_run_id": "flow_run_123",
  "state": "DONE",
  "note": "All tasks completed. Alarms cancelled. No further prompts."
}
```

## 🎯 **KEY POINTS**

### **Deterministic Behavior:**
1. **Exactly one task** active at any time
2. **No branching** - linear execution only
3. **No AI decisions** - AI just executes current task
4. **External completion** - Tasks move to DONE only via API
5. **Automatic progression** - Next task loaded automatically

### **For Etaflow Specifically:**
- **12 main tasks** cover all 7 priorities + setup
- **11 follow-ups** handle investigation/fixes
- **Follow-ups execute** immediately after parent task is DONE
- **Total: 23 execution steps** (12 + 11)

## 🔧 **TROUBLESHOOTING**

### **Task Stuck in PENDING:**
```bash
# Check if task exists and is PENDING
curl -X POST https://hono.alghamdimo89.workers.dev/tasks/eta_task_1/complete \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "conversation_abc123"}'
```

### **Check Database State:**
```sql
-- See all tasks and status
SELECT id, title, status, order_index 
FROM tasks 
WHERE flow_id = 'etaflow' 
ORDER BY order_index;

-- See follow-ups and their parent status
SELECT 
  tf.id as followup_id,
  tf.title,
  tf.status as followup_status,
  t.id as parent_id,
  t.title as parent_title,
  t.status as parent_status
FROM task_followups tf
INNER JOIN tasks t ON tf.parent_task_id = t.id
WHERE t.flow_id = 'etaflow'
ORDER BY tf.order_index;
```

## 📋 **TASK EXECUTION ORDER**

### **Complete Sequence:**
```
eta_task_1 → eta_task_2 → eta_task_3 → eta_task_4 → eta_task_5
→ eta_followup_investigate → eta_task_6 → eta_followup_browser_issue
→ eta_task_7 → eta_followup_payload → eta_task_8 → eta_followup_generated
→ eta_task_9 → eta_followup_template → eta_task_10 → eta_followup_backend
→ eta_task_11 → eta_followup_fix_template → eta_task_12 → eta_followup_recompile
→ eta_followup_verify → eta_followup_retest → eta_followup_final
→ [FLOW TERMINATION]
```

### **Priority Mapping:**
- Setup: eta_task_1-5
- Priority 1 (Homepage): eta_task_6
- Priority 2 (Signup): eta_task_7
- Priority 3 (Login): eta_task_8
- Priority 4 (Templates List): eta_task_9
- Priority 5 (Single Template): eta_task_10
- Priority 6 (Workspace): eta_task_11
- Priority 7 (Chat): eta_task_12