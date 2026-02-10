-- TASK SELECTION LOGIC
-- SINGLE STEP EXECUTION - NO BRANCHING, NO AI DECISION-MAKING

-- Function: Get next task for a flow
-- Returns exactly ONE task or follow-up that should be executed next
-- NULL if no pending tasks/follow-ups

-- Logic implementation:
-- 1. Find first PENDING task for the flow (lowest order_index)
-- 2. If that task has PENDING follow-ups AND parent task is DONE:
--    - Return first PENDING follow-up (lowest order_index)
-- 3. Else:
--    - Return the parent task itself

-- SQL Query to select next task for a flow:

SELECT 
    COALESCE(
        -- Case 1: Parent task is DONE and has PENDING follow-ups
        (SELECT 
            tf.id as task_id,
            tf.title,
            tf.description,
            'FOLLOWUP' as task_type,
            tf.parent_task_id
        FROM task_followups tf
        INNER JOIN tasks t ON tf.parent_task_id = t.id
        WHERE t.flow_id = ? 
          AND t.status = 'DONE'
          AND tf.status = 'PENDING'
        ORDER BY tf.order_index
        LIMIT 1),
        
        -- Case 2: First PENDING task (no DONE parent with PENDING follow-ups)
        (SELECT 
            t.id as task_id,
            t.title,
            t.description,
            'TASK' as task_type,
            NULL as parent_task_id
        FROM tasks t
        WHERE t.flow_id = ? 
          AND t.status = 'PENDING'
        ORDER BY t.order_index
        LIMIT 1)
    ) as next_task;

-- Alternative: Two-step query for clarity:

-- Step 1: Check for PENDING follow-ups where parent is DONE
/*
SELECT 
    tf.id as task_id,
    tf.title,
    tf.description,
    'FOLLOWUP' as task_type,
    tf.parent_task_id
FROM task_followups tf
INNER JOIN tasks t ON tf.parent_task_id = t.id
WHERE t.flow_id = ? 
  AND t.status = 'DONE'
  AND tf.status = 'PENDING'
ORDER BY tf.order_index
LIMIT 1;
*/

-- Step 2: If no such follow-up, get first PENDING task
/*
SELECT 
    t.id as task_id,
    t.title,
    t.description,
    'TASK' as task_type,
    NULL as parent_task_id
FROM tasks t
WHERE t.flow_id = ? 
  AND t.status = 'PENDING'
ORDER BY t.order_index
LIMIT 1;
*/

-- Example usage with flow_id = 'etaflow':
-- Parameter: 'etaflow'
-- Returns: Either a follow-up (if parent DONE) or a task (if parent PENDING)
-- Exactly ONE result or NULL