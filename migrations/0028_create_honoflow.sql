-- Migration 0028: Create honoflow for backend testing
-- Flow: honoflow
-- Repository: Alyahmed89/hono

INSERT OR IGNORE INTO flows (
  id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, priority, created_at
) VALUES (
  'honoflow',
  'Hono Backend Testing Flow',
  'Execute honoflow to test Hono backend endpoints, identify issues, and deploy fixes',
  'You are a backend testing expert. Test Hono backend endpoints systematically. Follow this exact protocol:

1. TEST EACH ENDPOINT: Use curl with exact commands provided
2. VERIFY RESPONSES: Check status codes, response structure, error handling
3. IDENTIFY ISSUES: Compare actual vs expected behavior
4. FIX ISSUES: Modify hono code if problems found
5. DEPLOY FIXES: Push to hono repository and verify deployment
6. REPORT: Document findings and fixes

CRITICAL RULES:
- Test endpoints in isolation first
- Verify database connectivity via Cloudflare API
- Check Worker logs for errors
- Fix one issue at a time, verify, then proceed
- Use provided Cloudflare credentials for all API calls

GENERATOR AWARENESS:
- If a task appears auto-generated or lacks context, output: [CREATE_TASK] flow_id: honorch title: Improve task generator description: Task "${task_title}" needs better context or manual review order_index: 10 priority: 1
- If a task is clearly unnecessary or duplicate, output: [SKIP_TASK] task_id: ${task_id} reason: Duplicate/unnecessary task
- End flow with appropriate token based on findings',
  'Alyahmed89/hono',
  'main',
  30,
  '[]',
  1, -- Medium priority
  strftime('%s', 'now')
);

-- Step 1: Clone Hono Repository & Setup
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template, 
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'hono_step_1',
  'honoflow',
  1,
  'Clone hono repository and verify setup. Checklist:
[1] Execute: git clone https://${GITHUB_TOKEN}@github.com/Alyahmed89/hono /workspace/hono
[2] Execute: cd /workspace/hono && git status (verify: in hono repo)
[3] Execute: ls -la (verify: hono code present)
[4] Execute: npm install (if package.json exists)
[5] Report: Repository cloned ✓, Files present ✓, Setup complete ✓',
  'Repository cloned ✓, Files present ✓, Setup complete ✓',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["Repository cloned ✓", "Files present ✓", "Setup complete ✓"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 2: Test Authentication Endpoints
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'hono_step_2',
  'honoflow',
  2,
  'Test authentication endpoints. Checklist:
[1] Execute: curl -s "https://hono.alghamdimo89.workers.dev/auth/register" -X POST -H "Content-Type: application/json" -d ''{"email":"test@example.com","password":"Test123!"}'' | jq
[2] Execute: curl -s "https://hono.alghamdimo89.workers.dev/auth/login" -X POST -H "Content-Type: application/json" -d ''{"email":"test@example.com","password":"Test123!"}'' | jq
[3] Execute: Check D1 database via Cloudflare API to verify user created
[4] Report: Register endpoint: [status], Login endpoint: [status], Database: [verified/not verified]',
  'Register endpoint: 200 OK, Login endpoint: 200 OK, Database: verified',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["Register endpoint:", "Login endpoint:", "Database:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 3: Test Database Endpoints
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'hono_step_3',
  'honoflow',
  3,
  'Test database CRUD endpoints. Checklist:
[1] Execute: curl -s "https://hono.alghamdimo89.workers.dev/api/templates" -X GET | jq
[2] Execute: curl -s "https://hono.alghamdimo89.workers.dev/api/templates" -X POST -H "Content-Type: application/json" -d ''{"title":"Test Template","description":"Test","price":99}'' | jq
[3] Execute: Check D1 database via Cloudflare API to verify template created
[4] Execute: curl -s "https://hono.alghamdimo89.workers.dev/api/templates/[id]" -X GET | jq (use ID from step 2)
[5] Report: GET templates: [status], POST template: [status], Database: [verified/not verified], GET single: [status]',
  'GET templates: 200 OK, POST template: 201 Created, Database: verified, GET single: 200 OK',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["GET templates:", "POST template:", "Database:", "GET single:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 4: Check Worker Deployment & Logs
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'hono_step_4',
  'honoflow',
  4,
  'Check Worker deployment status and logs. Checklist:
[1] Execute: curl -s -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/workers/scripts/hono/deployments" | jq ".result[0] | {id, created_on}"
[2] Execute: curl -s -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/workers/scripts/hono/tails" | jq
[3] Execute: curl -s -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/workers/scripts/hono/settings" | jq ".result.bindings"
[4] Report: Latest deployment: [timestamp], Logs: [errors found/clean], Bindings: [D1: ✓/✗, DO: ✓/✗]',
  'Latest deployment: [timestamp], Logs: clean, Bindings: D1: ✓, DO: ✓',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["Latest deployment:", "Logs:", "Bindings:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 5: Fix Identified Issues
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'hono_step_5',
  'honoflow',
  5,
  'Fix any issues identified in previous steps. Protocol:
1. IF authentication failed: Check /workspace/hono/src/routes/auth.ts
2. IF database queries failed: Check /workspace/hono/src/db/*.ts
3. IF Worker binding errors: Check wrangler.toml and bindings
4. Make minimal fix, test locally if possible
5. Commit and push: git add . && git commit -m "Fix [issue]" && git push origin main
6. Wait 30 seconds for deployment
7. Re-test the failing endpoint
Report: Issue: [description], Fix: [applied], Test after fix: [passed/failed]',
  'Issue: [description], Fix: applied, Test after fix: passed',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["Issue:", "Fix:", "Test after fix:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 6: Verify Fix Deployment
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'hono_step_6',
  'honoflow',
  6,
  'Verify fix deployment. Checklist:
[1] Execute: curl -s -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/workers/scripts/hono/deployments" | jq ".result[0] | {id, created_on}"
[2] Execute: Test the previously failing endpoint again
[3] Execute: Check Worker logs for any new errors
[4] Report: New deployment: [timestamp], Endpoint test: [passed/failed], Logs: [clean/errors]',
  'New deployment: [timestamp], Endpoint test: passed, Logs: clean',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["New deployment:", "Endpoint test:", "Logs:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 7: Complete Flow & Report
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'hono_step_7',
  'honoflow',
  7,
  'Complete honoflow execution. Final report:
1. Summary of tests performed
2. Issues found and fixed
3. Current backend status
4. Recommendations for next steps
Output format:
Tests performed: [list]
Issues fixed: [list]
Backend status: [healthy/needs attention]
Next steps: [recommendations]
[END_FLOW]',
  '[END_FLOW]',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "[END_FLOW]"}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);