#!/bin/bash
# Example curl commands for testing flow DAG transitions

# 1. Create a step condition that transitions to honoflow on success
echo "=== 1. Creating step condition with next_flow_id ==="
curl -X POST http://localhost:3000/api/flow-step-conditions \
  -H "Content-Type: application/json" \
  -d '{
    "flow_step_id": "step_test_001_1",
    "condition_type": "response_contains",
    "condition_value": "status: success",
    "condition_operator": "contains",
    "next_flow_id": "honoflow",
    "next_step": -1,
    "next_step_id": "TERMINATE_FLOW"
  }'

echo -e "\n\n=== 2. Creating step condition that transitions to etaflow on error ==="
curl -X POST http://localhost:3000/api/flow-step-conditions \
  -H "Content-Type: application/json" \
  -d '{
    "flow_step_id": "step_test_001_1",
    "condition_type": "response_contains",
    "condition_value": "status: error",
    "condition_operator": "contains",
    "next_flow_id": "etaflow",
    "next_step": -1,
    "next_step_id": "TERMINATE_FLOW"
  }'

echo -e "\n\n=== 3. Check created conditions ==="
curl -X GET "http://localhost:3000/api/flow-step-conditions?flow_step_id=step_test_001_1"

echo -e "\n\n=== 4. Start a flow that will conditionally transition ==="
curl -X POST http://localhost:3000/api/flow-runs \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_flow_001",
    "input_prompt": "Execute test task - respond with status: success",
    "input_payload": {
      "test_value": "sample data"
    },
    "conversation_id": "conv-test-dag-1"
  }'

echo -e "\n\n=== 5. Start another flow with different expected response ==="
curl -X POST http://localhost:3000/api/flow-runs \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "test_flow_001",
    "input_prompt": "Execute test task - respond with status: error",
    "input_payload": {
      "test_value": "error data"
    },
    "conversation_id": "conv-test-dag-2"
  }'

echo -e "\n\n=== Summary ==="
echo "1. Created step conditions with next_flow_id"
echo "2. When step_test_001_1 responds with 'status: success' -> transitions to honoflow"
echo "3. When step_test_001_1 responds with 'status: error' -> transitions to etaflow"
echo "4. Flow DAG: test_flow_001 -> (condition) -> honoflow OR etaflow"