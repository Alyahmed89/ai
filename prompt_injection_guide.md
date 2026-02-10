# PROMPT INJECTION GUIDE
# SINGLE STEP EXECUTION - MINIMAL INJECTION ONLY

## RULES
1. Inject ONLY task title and description (if exists)
2. Do NOT inject follow-up metadata
3. Do NOT inject status fields
4. Do NOT inject validators
5. Do NOT add any extra text or formatting

## IMPLEMENTATION

When building the first DeepSeek prompt for a flow:

### Step 1: Get next task
```sql
-- Use the query from task_selection_logic.sql
-- Returns: { task_id, title, description, task_type, parent_task_id }
```

### Step 2: Build prompt with MINIMAL injection
```javascript
// CORRECT - Minimal injection only
const taskPrompt = `Execute: ${task.title}${task.description ? '\n' + task.description : ''}`;

// Example result:
// "Execute: Initialize System
// Set up environment and check dependencies"
```

### Step 3: Send to DeepSeek
```javascript
const deepseekPrompt = {
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: taskPrompt } // INJECTED TASK ONLY
  ]
};
```

## FORBIDDEN INJECTIONS ❌

```javascript
// ❌ WRONG - Includes follow-up metadata
`Execute: ${task.title} (Follow-up of ${task.parent_task_id})`;

// ❌ WRONG - Includes status
`Execute: ${task.title} [Status: ${task.status}]`;

// ❌ WRONG - Includes validators
`Execute: ${task.title}. Validate with: /api/validate`;

// ❌ WRONG - Extra formatting
`=== TASK ===\n${task.title}\n============`;

// ❌ WRONG - Includes task_type
`Execute ${task.task_type}: ${task.title}`;
```

## CORRECT EXAMPLES ✅

### Example 1: Task with description
```sql
-- Database: { title: 'Initialize System', description: 'Set up environment and check dependencies' }
-- Prompt: "Execute: Initialize System\nSet up environment and check dependencies"
```

### Example 2: Task without description
```sql
-- Database: { title: 'Run Security Scan', description: null }
-- Prompt: "Execute: Run Security Scan"
```

### Example 3: Follow-up task
```sql
-- Database: { title: 'Verify Deployment', description: 'Check that deployment was successful', task_type: 'FOLLOWUP' }
-- Prompt: "Execute: Verify Deployment\nCheck that deployment was successful"
-- Note: task_type is NOT injected, only title/description
```

## COMPLETION RULE
- Task and follow-up completion is NOT handled here
- Status will be updated later by: API calls, curl, frontend, browser testing
- This step only supports reading status (PENDING/DONE)
- Do NOT implement any completion logic