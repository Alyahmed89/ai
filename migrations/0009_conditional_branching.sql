-- Migration 0009: Add conditional branching support for etaflow
-- Date: 2026-02-14
-- Description: 
-- 1. Add default_next_step column to flow_steps table
-- 2. Create flow_step_conditions table for conditional branching
-- 3. Add index for faster condition lookups
-- 4. Update etaflow steps with conditional branching logic

-- Add default_next_step column to flow_steps table
ALTER TABLE flow_steps ADD COLUMN default_next_step INTEGER;

-- Create flow_step_conditions table
CREATE TABLE IF NOT EXISTS flow_step_conditions (
    id TEXT PRIMARY KEY,
    flow_step_id TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    condition_value TEXT NOT NULL,
    condition_operator TEXT DEFAULT 'contains',
    next_step INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (flow_step_id) REFERENCES flow_steps(id)
);

-- Create index for faster condition lookups
CREATE INDEX IF NOT EXISTS idx_flow_step_conditions_flow_step_id ON flow_step_conditions(flow_step_id);

-- Update etaflow steps with default_next_step values
-- Step1: Check Deployment Status D1 → default: Step2
UPDATE flow_steps SET default_next_step = 2 WHERE id = 'step1' AND flow_id = 'etaflow';
-- Step2: Get Deployment Errors → default: Step5
UPDATE flow_steps SET default_next_step = 5 WHERE id = 'step2' AND flow_id = 'etaflow';
-- Step3: Browse Current State & Test → default: Step19
UPDATE flow_steps SET default_next_step = 19 WHERE id = 'step3' AND flow_id = 'etaflow';
-- Step4: Fetch Main Task → default: Step3
UPDATE flow_steps SET default_next_step = 3 WHERE id = 'step4' AND flow_id = 'etaflow';
-- Step5: Search Generated Code → default: Step6
UPDATE flow_steps SET default_next_step = 6 WHERE id = 'step5' AND flow_id = 'etaflow';
-- Step6: View Template → default: Step24
UPDATE flow_steps SET default_next_step = 24 WHERE id = 'step6' AND flow_id = 'etaflow';
-- Step7: Gap Analysis → default: Step5
UPDATE flow_steps SET default_next_step = 5 WHERE id = 'step7' AND flow_id = 'etaflow';
-- Step8: Edit .eta Template → default: Step9
UPDATE flow_steps SET default_next_step = 9 WHERE id = 'step8' AND flow_id = 'etaflow';
-- Step9: Recompile Templates → default: Step10
UPDATE flow_steps SET default_next_step = 10 WHERE id = 'step9' AND flow_id = 'etaflow';
-- Step10: Regenerate + Copy Code → default: Step11
UPDATE flow_steps SET default_next_step = 11 WHERE id = 'step10' AND flow_id = 'etaflow';
-- Step11: Commit → D1 repo → default: Step12
UPDATE flow_steps SET default_next_step = 12 WHERE id = 'step11' AND flow_id = 'etaflow';
-- Step12: Wait Deployment → default: Step1
UPDATE flow_steps SET default_next_step = 1 WHERE id = 'step12' AND flow_id = 'etaflow';
-- Step13: Get ETA Deployment Errors → default: Step14
UPDATE flow_steps SET default_next_step = 14 WHERE id = 'step13' AND flow_id = 'etaflow';
-- Step14: Search ETA Code for Issues → default: Step22
UPDATE flow_steps SET default_next_step = 22 WHERE id = 'step14' AND flow_id = 'etaflow';
-- Step15: Search Backend Code → default: Step16
UPDATE flow_steps SET default_next_step = 16 WHERE id = 'step15' AND flow_id = 'etaflow';
-- Step16: Fix Backend Code → default: Step17
UPDATE flow_steps SET default_next_step = 17 WHERE id = 'step16' AND flow_id = 'etaflow';
-- Step17: Commit → Hono Repo → default: Step26
UPDATE flow_steps SET default_next_step = 26 WHERE id = 'step17' AND flow_id = 'etaflow';
-- Step19: Mark Task Complete → default: Step20
UPDATE flow_steps SET default_next_step = 20 WHERE id = 'step19' AND flow_id = 'etaflow';
-- Step20: Commit to ETA Repo → default: Step22
UPDATE flow_steps SET default_next_step = 22 WHERE id = 'step20' AND flow_id = 'etaflow';
-- Step22: Verify ETA Worker Deployment → default: Step23
UPDATE flow_steps SET default_next_step = 23 WHERE id = 'step22' AND flow_id = 'etaflow';
-- Step23: Start New Flow → default: Step30
UPDATE flow_steps SET default_next_step = 30 WHERE id = 'step23' AND flow_id = 'etaflow';
-- Step24: Check/Edit Payload → default: Step25
UPDATE flow_steps SET default_next_step = 25 WHERE id = 'step24' AND flow_id = 'etaflow';
-- Step25: Add/Edit Payload → default: Step10
UPDATE flow_steps SET default_next_step = 10 WHERE id = 'step25' AND flow_id = 'etaflow';
-- Step26: Verify Hono Deployment → default: Step27
UPDATE flow_steps SET default_next_step = 27 WHERE id = 'step26' AND flow_id = 'etaflow';
-- Step27: Test Hono Endpoint → default: Step29
UPDATE flow_steps SET default_next_step = 29 WHERE id = 'step27' AND flow_id = 'etaflow';
-- Step28: Get Hono Deployment Errors → default: Step15
UPDATE flow_steps SET default_next_step = 15 WHERE id = 'step28' AND flow_id = 'etaflow';
-- Step29: Verify Data Flow via CF API → default: Step3
UPDATE flow_steps SET default_next_step = 3 WHERE id = 'step29' AND flow_id = 'etaflow';

-- Create step30: Close OpenHands Conversation
INSERT INTO flow_steps (
    id, flow_id, step_key, title, instructions, order_index, 
    default_next_step, step_type, created_at, updated_at
) VALUES (
    'step30', 'etaflow', 'close_openhands_conversation', 
    'Close OpenHands Conversation', 
    '1. Close current OpenHands conversation using OpenHands endpoint.
2. Confirm conversation is closed.
3. IMPORTANT: All visible content must come from payload customization, NOT from hardcoded content in eta repo or hono repo.',
    30, NULL,
    'standard', strftime('%s', 'now'), strftime('%s', 'now')
);

-- Add conditional branching rules
-- Step1 conditions
INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step1_failed', 'step1', 'response_contains', 'Status: Failed', 'contains', 2, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step1_success', 'step1', 'response_contains', 'Status: Success', 'contains', 4, strftime('%s', 'now'), strftime('%s', 'now'));

-- Step3 conditions
INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step3_passed', 'step3', 'response_contains', 'Test: Passed', 'contains', 19, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step3_not_passed', 'step3', 'response_contains', 'Test: Not Passed', 'contains', 7, strftime('%s', 'now'), strftime('%s', 'now'));

-- Step6 conditions
INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step6_yes', 'step6', 'response_contains', 'Needs editing: Yes', 'contains', 8, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step6_no', 'step6', 'response_contains', 'Needs editing: No', 'contains', 24, strftime('%s', 'now'), strftime('%s', 'now'));

-- Step7 conditions (gap analysis)
INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step7_frontend', 'step7', 'response_contains', 'Issue: Frontend', 'contains', 5, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step7_backend', 'step7', 'response_contains', 'Issue: Backend', 'contains', 15, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step7_data_flow', 'step7', 'response_contains', 'Issue: Data Flow', 'contains', 26, strftime('%s', 'now'), strftime('%s', 'now'));

-- Step22 conditions
INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step22_success', 'step22', 'response_contains', 'Status: Success', 'contains', 23, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step22_failed', 'step22', 'response_contains', 'Status: Failed', 'contains', 13, strftime('%s', 'now'), strftime('%s', 'now'));

-- Step26 conditions
INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step26_success', 'step26', 'response_contains', 'Status: Success', 'contains', 27, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO flow_step_conditions (id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at)
VALUES ('cond_step26_failed', 'step26', 'response_contains', 'Status: Failed', 'contains', 28, strftime('%s', 'now'), strftime('%s', 'now'));