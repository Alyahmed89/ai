#!/usr/bin/env node

/**
 * Simple migration script to convert requires_task steps to input_keys format
 * This script generates SQL that can be run manually
 */

console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║               Migration: requires_task → input_keys                  ║
╚══════════════════════════════════════════════════════════════════════╝

This script generates SQL to migrate steps with requires_task to use the new
input_keys system for dynamic API data fetching.

The migration will:
1. Add input_keys column to flow_steps table (if not exists)
2. Convert existing requires_task steps to use input_keys
3. Keep backward compatibility with requires_task column

Generated SQL can be run manually in your database.
`);

// Generate migration SQL
const migrationSQL = `-- ============================================================================
-- Migration: Convert requires_task to input_keys for dynamic API data fetching
-- Generated: ${new Date().toISOString()}
-- ============================================================================

-- PART 1: Add input_keys column (if not exists)
ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS input_keys TEXT;

-- PART 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_flow_steps_input_keys ON flow_steps(input_keys) WHERE input_keys IS NOT NULL;

-- PART 3: Convert existing requires_task steps to input_keys
-- This converts each requires_task step to use internal task lookup via input_keys
UPDATE flow_steps 
SET input_keys = json_array(
  json_object(
    'key', 'task_data',
    'url', 'internal://tasks/' || task_id,
    'method', 'GET',
    'auth_type', 'none',
    'timeout_ms', 5000,
    'response_path', 'description',
    'allowed_domains', json_array('internal'),
    'require_https', false,
    'log_level', 'info'
  )
)
WHERE requires_task = TRUE AND task_id IS NOT NULL AND input_keys IS NULL;

-- PART 4: Update step instructions to use variable syntax (optional)
-- You may want to update step instructions to use {* task_data.description *} syntax
-- Example: 
-- UPDATE flow_steps 
-- SET instructions = REPLACE(instructions, '{task_description}', '{* task_data.description *}')
-- WHERE input_keys LIKE '%task_data%';

-- PART 5: Verification query
SELECT 
  COUNT(*) as total_steps,
  COUNT(CASE WHEN requires_task = TRUE THEN 1 END) as requires_task_steps,
  COUNT(CASE WHEN input_keys IS NOT NULL THEN 1 END) as steps_with_input_keys,
  COUNT(CASE WHEN requires_task = TRUE AND input_keys IS NOT NULL THEN 1 END) as migrated_steps
FROM flow_steps;

-- PART 6: Example of new step with external API
-- INSERT INTO flow_steps (flow_id, step_key, title, instructions, step_type, order_index, input_keys)
-- VALUES (
--   'your_flow_id',
--   'fetch_user_data',
--   'Fetch User Data',
--   'Hello {* user.name *}, your email is {* user.email *}',
--   'action',
--   1,
--   json_array(
--     json_object(
--       'key', 'user',
--       'url', 'https://api.example.com/users/current',
--       'method', 'GET',
--       'auth_type', 'bearer',
--       'auth_value', 'env:API_TOKEN',
--       'timeout_ms', 10000,
--       'response_path', 'data.user',
--       'allowed_domains', json_array('api.example.com'),
--       'require_https', true
--     )
--   )
-- );

-- ============================================================================
-- SECURITY NOTES:
-- 1. External API URLs must use HTTPS unless explicitly allowed
-- 2. Domains must be in allowed_domains list
-- 3. Authentication tokens should use env: prefix for environment variables
-- 4. Consider implementing rate limiting and circuit breakers
-- ============================================================================`;

console.log(migrationSQL);

console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                            NEXT STEPS                                ║
╚══════════════════════════════════════════════════════════════════════╝

1. Run the generated SQL in your database
2. Test migrated steps in a staging environment
3. Update step instructions to use {* variable_name *} syntax
4. Monitor logs for API call errors
5. Consider adding more API configurations to input_keys

For more complex migrations or validation, use the full migration script:
  node scripts/migrate-requires-task.js --dry-run

Backward compatibility is maintained - requires_task column remains.
`);