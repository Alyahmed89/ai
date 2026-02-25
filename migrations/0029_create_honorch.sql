-- Migration 0029: Create honorch orchestration flow
-- Flow: honorch
-- Repository: Alyahmed89/deepseek-agent

INSERT OR IGNORE INTO flows (
  id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, priority, created_at
) VALUES (
  'honorch',
  'Hono Orchestration Flow',
  'Monitor all flows, prioritize tasks, and coordinate work across the system',
  'You are a flow orchestrator. Your responsibilities:

1. MONITOR ALL FLOWS: Check status of etaflow, honoflow, and other flows
2. PRIORITIZE TASKS: Determine which flow needs attention most urgently
3. CREATE TASKS: Add tasks to appropriate flows when needed
4. FIX GENERATOR ISSUES: Identify and resolve template generation problems
5. COORDINATE WORK: Ensure flows don''t conflict and resources are used efficiently

CRITICAL RULES:
- Check task status across all flows every iteration
- Prioritize based on: blocking issues, deployment failures, user impact
- Create tasks with clear descriptions and priorities
- Use [CREATE_TASK] output format to add tasks to other flows
- Use [SKIP_TASK] if a task is unnecessary or already completed
- End flow with [END_FLOW] when orchestration complete

TASK PRIORITY LEVELS:
- 0: Normal (default)
- 1: High (blocking other work)
- 2: Critical (system down, deployment failed)

OUTPUT FORMATS:
[CREATE_TASK] flow_id: <flow> title: <title> description: <desc> order_index: <num> priority: <0-2>
[SKIP_TASK] task_id: <id> reason: <reason>
[END_FLOW]',
  'Alyahmed89/deepseek-agent',
  'main',
  50,
  '[]',
  2, -- High priority (orchestrator)
  strftime('%s', 'now')
);

-- Step 1: Monitor All Flow Tasks
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'honorch_step_1',
  'honorch',
  1,
  'Monitor all flow tasks. Execute SQL query:
SELECT flow_id, COUNT(*) as pending_tasks, 
       SUM(CASE WHEN priority = 2 THEN 1 ELSE 0 END) as critical_tasks,
       SUM(CASE WHEN priority = 1 THEN 1 ELSE 0 END) as high_tasks
FROM tasks 
WHERE status = "pending" 
  AND flow_id IN ("etaflow", "honoflow", "honorch")
GROUP BY flow_id
ORDER BY critical_tasks DESC, high_tasks DESC, pending_tasks DESC

Report format:
etaflow: [pending] tasks ([critical] critical, [high] high)
honoflow: [pending] tasks ([critical] critical, [high] high)
honorch: [pending] tasks ([critical] critical, [high] high)
Most urgent flow: [flow_id]',
  'Most urgent flow:',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["etaflow:", "honoflow:", "honorch:", "Most urgent flow:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 2: Check Generator Issues
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'honorch_step_2',
  'honorch',
  2,
  'Check for generator issues. Execute SQL query:
SELECT DISTINCT flow_id, title 
FROM tasks 
WHERE status = "pending" 
  AND (title LIKE "%auto-generated%" OR title LIKE "%lacks context%" OR description LIKE "%needs better context%")
ORDER BY priority DESC, created_at ASC

If generator issues found, create improvement tasks:
[CREATE_TASK] flow_id: honorch title: Improve task generator description: Review and fix auto-generated tasks order_index: 5 priority: 1
[CREATE_TASK] flow_id: etaflow title: Manual template review description: Review templates flagged as auto-generated order_index: 15 priority: 1

Report: Generator issues found: [count], Actions taken: [created tasks/skipped]',
  'Generator issues found:',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["Generator issues found:", "Actions taken:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 3: Prioritize Tasks Across Flows
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'honorch_step_3',
  'honorch',
  3,
  'Prioritize tasks across flows. Execute SQL to update priorities:
UPDATE tasks SET priority = 
  CASE 
    WHEN title LIKE "%deployment failed%" OR title LIKE "%system down%" THEN 2
    WHEN title LIKE "%blocking%" OR title LIKE "%critical%" THEN 1
    ELSE 0
  END
WHERE status = "pending" AND priority = 0

Then check updated priorities:
SELECT flow_id, 
       SUM(CASE WHEN priority = 2 THEN 1 ELSE 0 END) as critical,
       SUM(CASE WHEN priority = 1 THEN 1 ELSE 0 END) as high,
       SUM(CASE WHEN priority = 0 THEN 1 ELSE 0 END) as normal
FROM tasks WHERE status = "pending"
GROUP BY flow_id

Report: Priority updates applied. Current status:
etaflow: [critical] critical, [high] high, [normal] normal
honoflow: [critical] critical, [high] high, [normal] normal
honorch: [critical] critical, [high] high, [normal] normal',
  'Priority updates applied.',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["Priority updates applied.", "etaflow:", "honoflow:", "honorch:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 4: Create Missing Tasks
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'honorch_step_4',
  'honorch',
  4,
  'Create missing tasks based on system state. Check:
1. If honoflow has no pending tasks but backend issues reported: [CREATE_TASK] flow_id: honoflow title: Investigate backend issues description: Check Worker logs and D1 database order_index: 1 priority: 1
2. If etaflow has no pending tasks but template issues reported: [CREATE_TASK] flow_id: etaflow title: Fix template generation description: Review .eta templates and payload order_index: 1 priority: 1
3. If any flow has been idle > 1 hour: [CREATE_TASK] flow_id: [flow] title: Resume flow execution description: Flow has been idle, check status order_index: 1 priority: 0

Execute SQL to check flow activity:
SELECT flow_id, MAX(created_at) as last_task, COUNT(*) as pending
FROM tasks 
WHERE status = "pending"
GROUP BY flow_id

Report: Missing tasks identified: [count], Created: [tasks created]',
  'Missing tasks identified:',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_values": ["Missing tasks identified:", "Created:"]}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

-- Step 5: Complete Orchestration & Determine Next Flow
INSERT OR IGNORE INTO flow_steps (
  id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template,
  output, output_url, output_auth_token, created_at, updated_at
) VALUES (
  'honorch_step_5',
  'honorch',
  5,
  'Complete orchestration cycle. Determine next flow based on priority:
Execute SQL to find highest priority flow:
SELECT flow_id, 
       MAX(priority) as max_priority,
       COUNT(*) as pending_tasks
FROM tasks 
WHERE status = "pending"
  AND flow_id != "honorch" -- Don''t select self
GROUP BY flow_id
ORDER BY max_priority DESC, pending_tasks DESC
LIMIT 1

If next flow determined, output:
Next flow: [flow_id] (priority: [max_priority], tasks: [pending_tasks])
[END_FLOW] prompt: Execute [flow_id] with priority attention deepseek_system: Continue flow execution branch: main

If no next flow (all tasks done), output:
All flows complete. System idle.
[END_FLOW_EARLY] reason: No pending tasks across flows',
  '[END_FLOW]',
  '/validate/response-contains',
  '{"response": "{{deepseek_response}}", "expected_value": "[END_FLOW]"}',
  1,
  'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/ce8f2a2c-6e4b-4398-b73e-ba8f204f609a/query',
  'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);