-- Migration 0021: Add input_keys column for dynamic API data fetching
-- Date: 2026-02-22
-- Description: 
-- 1. Add input_keys column to flow_steps table for dynamic API configurations
-- 2. Create index for efficient querying
-- 3. Add backward compatibility note for requires_task and task_id columns

-- ==========================================================================
-- PART 1: Add input_keys column to flow_steps table
-- ==========================================================================

-- Add input_keys column (nullable JSON text)
ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS input_keys TEXT;

-- Create index for faster queries on input_keys
CREATE INDEX IF NOT EXISTS idx_flow_steps_input_keys ON flow_steps(input_keys) WHERE input_keys IS NOT NULL;

-- ==========================================================================
-- PART 2: Update existing queries to include input_keys
-- ==========================================================================

-- Note: The following queries in the codebase should be updated:
-- 1. getFlowSteps() in database.ts - Add input_keys to SELECT
-- 2. getStepWithTaskData() in database.ts - Add input_keys to SELECT
-- 3. Any other queries that select from flow_steps

-- Example of updated getFlowSteps query:
-- SELECT 
--   fs.id as step_id,
--   fs.step_key,
--   fs.title,
--   fs.instructions as description,
--   fs.step_type,
--   fs.order_index,
--   fs.page_key,
--   fs.blocking,
--   fs.auto_fail_on_error,
--   fs.retryable,
--   fs.task_id,
--   fs.requires_task,
--   fs.input_keys,  -- NEW COLUMN
--   CASE WHEN fs.output_url IS NOT NULL AND fs.output_url != '' THEN 1 ELSE 0 END as output,
--   fs.output_url,
--   fs.output_auth_token
-- FROM flow_steps fs
-- WHERE fs.flow_id = ?
-- ORDER BY fs.order_index

-- ==========================================================================
-- PART 3: Backward compatibility and migration notes
-- ==========================================================================

-- IMPORTANT: requires_task and task_id columns are now DEPRECATED
-- but will be kept for backward compatibility during migration period

-- Migration strategy:
-- 1. New steps should use input_keys for dynamic API data fetching
-- 2. Existing steps with requires_task can be migrated using SecureMigration class
-- 3. During transition, system should support both old and new approaches

-- Example migration of requires_task steps to input_keys:
-- UPDATE flow_steps 
-- SET input_keys = json_array(
--   json_object(
--     'key', 'task_data',
--     'url', 'internal://tasks/' || task_id,
--     'method', 'GET',
--     'auth_type', 'none',
--     'timeout_ms', 5000,
--     'response_path', 'description',
--     'allowed_domains', json_array('internal'),
--     'require_https', false
--   )
-- )
-- WHERE requires_task = TRUE AND task_id IS NOT NULL;

-- ==========================================================================
-- PART 4: Security considerations
-- ==========================================================================

-- Security notes for input_keys configuration:
-- 1. External URLs must use HTTPS unless explicitly allowed
-- 2. Domains must be in allowed_domains list
-- 3. Authentication tokens should use env: prefix for environment variables
-- 4. Response validation should be implemented where possible
-- 5. Circuit breaker and rate limiting should be enforced

-- Example secure input_keys configuration:
-- [
--   {
--     "key": "user_data",
--     "url": "https://api.example.com/users/current",
--     "method": "GET",
--     "auth_type": "bearer",
--     "auth_value": "env:API_TOKEN",
--     "timeout_ms": 10000,
--     "response_path": "data.user",
--     "allowed_domains": ["api.example.com"],
--     "require_https": true,
--     "circuit_breaker": {
--       "failure_threshold": 5,
--       "reset_timeout_ms": 60000
--     }
--   }
-- ]

-- ==========================================================================
-- PART 5: Variable substitution syntax
-- ==========================================================================

-- Step instructions can now include variable references:
-- Original: "Complete the task: Implement login functionality"
-- With variables: "Complete the task: {* task_data.description *}"

-- Variable resolution process:
-- 1. Parse input_keys JSON array
-- 2. Execute API calls in dependency order
-- 3. Extract data using response_path
-- 4. Substitute variables in instructions using {* variable_name *} syntax
-- 5. Use resolved instructions for step execution

-- Multiple variables example:
-- "User {* user.name *} has {* project.count *} projects. Status: {* status.message *}"

-- ==========================================================================
-- PART 6: Testing the migration
-- ==========================================================================

-- Test query to verify migration:
-- SELECT 
--   COUNT(*) as total_steps,
--   COUNT(CASE WHEN input_keys IS NOT NULL THEN 1 END) as steps_with_input_keys,
--   COUNT(CASE WHEN requires_task = TRUE THEN 1 END) as steps_with_requires_task,
--   COUNT(CASE WHEN requires_task = TRUE AND input_keys IS NOT NULL THEN 1 END) as migrated_steps
-- FROM flow_steps;

-- Expected result after migration:
-- total_steps | steps_with_input_keys | steps_with_requires_task | migrated_steps
-- ------------+-----------------------+--------------------------+---------------
-- All steps with requires_task should also have input_keys after migration

-- ==========================================================================
-- PART 7: Cleanup (optional, for future)
-- ==========================================================================

-- After sufficient migration period and testing, consider:
-- 1. Removing requires_task column (if all steps migrated)
-- 2. Removing task_id column (if no longer needed)
-- 3. Updating all queries to use input_keys exclusively

-- WARNING: Do not remove columns until backward compatibility is no longer needed
-- Recommended timeline: Keep deprecated columns for at least 3 months