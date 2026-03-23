-- Migration: Test flow-to-flow communication with call_flow step type
-- Adds test flows to demonstrate flow-to-flow communication with response return

-- Create parent flow that calls child flow
INSERT INTO flow_definitions (
    id, flow_id, title, description, version, is_active, created_at, updated_at
) VALUES (
    'test_flow_to_flow_parent',
    'test_flow_to_flow_parent',
    'Test Flow-to-Flow Communication (Parent)',
    'Parent flow that calls child flow and waits for response',
    1,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    version = EXCLUDED.version + 1,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- Create child flow that processes data and returns result
INSERT INTO flow_definitions (
    id, flow_id, title, description, version, is_active, created_at, updated_at
) VALUES (
    'test_flow_to_flow_child',
    'test_flow_to_flow_child',
    'Test Flow-to-Flow Communication (Child)',
    'Child flow that processes data and returns result to parent',
    1,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    version = EXCLUDED.version + 1,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- Create steps for parent flow
INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_parent_step1',
    'test_flow_to_flow_parent',
    'start',
    'Start Flow',
    'Begin flow-to-flow communication test',
    0,
    'call_child',
    'standard',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_parent_step2',
    'test_flow_to_flow_parent',
    'call_child',
    'Call Child Flow',
    'Call child flow to process data [flow:test_flow_to_flow_child]',
    1,
    'process_response',
    'call_flow',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_parent_step3',
    'test_flow_to_flow_parent',
    'process_response',
    'Process Response',
    'Process the response from child flow: {{last_step_response}}',
    2,
    'complete',
    'standard',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_parent_step4',
    'test_flow_to_flow_parent',
    'complete',
    'Complete',
    'Flow-to-flow communication test completed successfully',
    3,
    NULL,
    'standard',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

-- Create steps for child flow
INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_child_step1',
    'test_flow_to_flow_child',
    'process_data',
    'Process Data',
    'Process the input data: {{user_input}} and return processed result',
    0,
    'return_result',
    'standard',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_child_step2',
    'test_flow_to_flow_child',
    'return_result',
    'Return Result',
    'Return processed result to parent flow',
    1,
    NULL,
    'standard',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

-- Create a looping test flow (calls itself until condition met)
INSERT INTO flow_definitions (
    id, flow_id, title, description, version, is_active, created_at, updated_at
) VALUES (
    'test_flow_loop',
    'test_flow_loop',
    'Test Flow Looping',
    'Flow that calls itself in a loop until condition is met',
    1,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    version = EXCLUDED.version + 1,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_loop_step1',
    'test_flow_loop',
    'check_condition',
    'Check Condition',
    'Check if count < 3. Current count: {{count|0}}',
    0,
    'increment',
    'standard',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_loop_step2',
    'test_flow_loop',
    'increment',
    'Increment Count',
    'Increment count and call again [flow:test_flow_loop]',
    1,
    'check_condition',
    'call_flow',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index,
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'test_loop_step3',
    'test_flow_loop',
    'complete',
    'Complete',
    'Loop completed. Final count: {{count}}',
    2,
    NULL,
    'standard',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    order_index = EXCLUDED.order_index,
    default_next_step = EXCLUDED.default_next_step,
    step_type = EXCLUDED.step_type,
    updated_at = CURRENT_TIMESTAMP;

-- Add flow_flow_conditions for the loop
INSERT INTO flow_flow_conditions (
    id, flow_id, step_key, condition_type, condition_value, target_flow_id, target_step_key,
    created_at, updated_at
) VALUES (
    'test_loop_condition1',
    'test_flow_loop',
    'check_condition',
    'expression',
    '{{count|0}} < 3',
    'test_flow_loop',
    'increment',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    condition_type = EXCLUDED.condition_type,
    condition_value = EXCLUDED.condition_value,
    target_flow_id = EXCLUDED.target_flow_id,
    target_step_key = EXCLUDED.target_step_key,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO flow_flow_conditions (
    id, flow_id, step_key, condition_type, condition_value, target_flow_id, target_step_key,
    created_at, updated_at
) VALUES (
    'test_loop_condition2',
    'test_flow_loop',
    'check_condition',
    'expression',
    '{{count|0}} >= 3',
    'test_flow_loop',
    'complete',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT(id) DO UPDATE SET
    flow_id = EXCLUDED.flow_id,
    step_key = EXCLUDED.step_key,
    condition_type = EXCLUDED.condition_type,
    condition_value = EXCLUDED.condition_value,
    target_flow_id = EXCLUDED.target_flow_id,
    target_step_key = EXCLUDED.target_step_key,
    updated_at = CURRENT_TIMESTAMP;

-- Update the migrations table
INSERT INTO _cf_KV (key, value) VALUES ('migration', '0047_test_flow_to_flow_communication');
UPDATE _cf_KV SET value = '0047_test_flow_to_flow_communication' WHERE key = 'migration';