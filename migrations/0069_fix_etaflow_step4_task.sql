-- Migration 0018: Fix etaflow step 4 task injection
-- Date: 2026-02-19
-- Description: 
-- Fix step 4 of etaflow to use static task_id instead of dynamic task fetching
-- Step 4 had task_id = "" (empty string) and requires_task = 1
-- This caused dynamic task fetching to fail
-- Now set task_id = "login" and requires_task = 0

-- Fix step 4: Implementation step
UPDATE flow_steps 
SET task_id = 'login', 
    requires_task = 0
WHERE id = 'step4' 
  AND flow_id = 'etaflow'
  AND (task_id = '' OR task_id IS NULL OR requires_task = 1);

-- Verify the fix
SELECT 'Step 4 fixed: task_id=' || task_id || ', requires_task=' || requires_task 
FROM flow_steps 
WHERE id = 'step4' AND flow_id = 'etaflow';