# Honoflow Chaining Analysis

## Database Configuration Analysis

### Flow Definitions (Critical: `next_flow_id` is the ONLY authority)
```
honoflow → honorch (priority: 0)
honorch → null (priority: 1)
etaflow → null (priority: 0)
steporch_honoflow → null
test_chain_1 → test_chain_2
test_chain_2 → null
```

### Flow Priority System
- **etaflow**: Priority 0 (highest), no next_flow
- **honoflow**: Priority 0 (highest), next_flow: honorch
- **honorch**: Priority 1, no next_flow

## What Happens After Honoflow Runs?

### 1. **Normal Completion Path**
```
honoflow (completes) → honorch (starts automatically)
```

**Reason:** `flow_definitions.next_flow_id = "honorch"` for honoflow

### 2. **Honorch's Role**
Honorch is an **orchestration flow** that:
1. Monitors all flow tasks (etaflow, honoflow, honorch)
2. Checks for generator issues
3. Prioritizes tasks across flows
4. Creates missing tasks
5. Determines next highest priority task

### 3. **Honorch's Decision Logic**
Honorch uses **true priority scheduling**:
```sql
SELECT 
  f.id as flow_id,
  f.name as flow_name,
  f.priority as flow_priority,
  t.id as task_id,
  t.title as task_title,
  t.priority as task_priority,
  t.numeric_priority as task_numeric_priority,
  t.created_at as task_created_at
FROM flow_definitions f
INNER JOIN tasks t ON f.id = t.flow_id AND t.status = "pending"
WHERE f.id IN ("etaflow", "honoflow", "honorch")
ORDER BY 
  f.priority ASC,           -- Lowest number = highest priority flow (0=highest)
  t.numeric_priority ASC,   -- Lowest number = highest priority task (0=critical)
  t.created_at ASC          -- Oldest first for same priority
LIMIT 1
```

### 4. **Possible Outcomes After Honorch**
1. **If tasks exist:** Honorch selects highest priority task and starts appropriate flow
2. **If no tasks:** System becomes idle
3. **If generator issues:** Creates improvement tasks

## Current Task Status (Pending Tasks for Honoflow)
```
1. Implement GET / handler
2. Add validation for GET /health  
3. Add validation for GET /auth/me
4. Add validation for GET /users/me/templates
5. Add validation for PUT /users/me
```

## Flow Step Conditions Analysis

### Key Finding: **NO `next_flow` conditions exist**
- All `flow_step_conditions` only have `next_step` (within same flow)
- No `next_flow` column in schema (database cleaned)
- **Flow transitions ONLY via `flow_definitions.next_flow_id`**

### Honoflow Step Conditions:
- Only control step-to-step transitions within honoflow
- No flow-to-flow transitions at step level
- Conditions based on: task_status, endpoint_status, task_type, auth_required, test_result

## System Architecture Validation

### ✅ **Invariant 1: Flow ID Immutability**
- Flow ID cannot change during execution
- Enforced by `updateConversationState()` method

### ✅ **Invariant 2: Error Isolation**
- Errors call `stopConversation()` with error reasons
- No fallback flows triggered on errors

### ✅ **Invariant 3: Idempotent Completion**
- `stopConversation()` checks if already `DONE`
- `handleFlowCompletion()` tracks `flow_completed` flag

### ✅ **Invariant 4: Concurrency Control**
- `startSpecificFlow()` checks for active flows before starting
- Prevents duplicate active flows

## What Needs to Be Done?

### **NOTHING - System is Correctly Configured**

The system already ensures that `next_flow_id` in `flow_definitions` is the **ONLY** authority for flow transitions:

1. ✅ **Database cleaned:** No `next_flow` conditions in `flow_step_conditions`
2. ✅ **Code enforced:** `handleFlowCompletion()` only reads `next_flow_id` from `flow_definitions`
3. ✅ **Architecture correct:** New Durable Objects created for new flows (not mutations)
4. ✅ **Deterministic chains:** `honoflow → honorch` is the only possible transition

### **Why You See "Strange Flow"**
If you're seeing unexpected behavior, check:

1. **Flow run status:** Are flows actually completing or getting stuck?
2. **Task generation:** Is the script creating unexpected tasks?
3. **Error handling:** Are errors being logged but not stopping flows?

### **Verification Commands**
```bash
# Check active flows
SELECT * FROM flow_runs WHERE status = 'active'

# Check flow definitions
SELECT id, name, next_flow_id FROM flow_definitions

# Check task priorities
SELECT flow_id, COUNT(*) as pending, 
       SUM(CASE WHEN numeric_priority = 0 THEN 1 ELSE 0 END) as critical
FROM tasks WHERE status = 'pending'
GROUP BY flow_id
```

## Conclusion

**The system is working as designed:**
1. `honoflow` → `honorch` (via `next_flow_id`)
2. `honorch` orchestrates next task based on priority
3. No mid-flow flow ID mutations possible
4. No implicit flow restarts on error
5. No concurrent flow runs competing

**If you're seeing unexpected flows, it's likely:**
- Task generation script creating new tasks
- Manual flow starts via API
- System recovering from previous failures

**Recommendation:** Monitor the `flow_runs` table for actual execution patterns rather than relying on perceived behavior.