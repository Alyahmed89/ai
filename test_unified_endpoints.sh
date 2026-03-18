#!/bin/bash

# Test script for unified endpoint system
# This script tests the minimal vertical slice implementation

echo "=== Testing Unified Endpoint System ==="
echo

# 1. Test endpoint introspection
echo "1. Testing endpoint introspection..."
curl -s -X GET "http://localhost:40243/api/endpoints/introspect?endpoint_id=test_endpoint_1" | jq .
echo

# 2. Create a test endpoint (if not already created by migration)
echo "2. Creating test endpoint..."
curl -s -X POST "http://localhost:40243/api/endpoints" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_unified_endpoint",
    "description": "Test endpoint for unified endpoint system",
    "url": "https://jsonplaceholder.typicode.com/users/2",
    "method": "GET",
    "auth_type": "none",
    "headers": {"Accept": "application/json"},
    "tags": ["test", "unified"]
  }' | jq .
echo

# 3. Create a test flow step with use_endpoints
echo "3. Creating test flow step with use_endpoints..."
curl -s -X POST "http://localhost:40243/api/flow-steps" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "unified_endpoint_test",
    "step_key": "manual_test_step",
    "title": "Manual Test Step",
    "instructions": "Test unified endpoint system with extra_step loop. Check API response and return [DONE] when complete.",
    "step_type": "ai_step",
    "order_index": 2,
    "use_endpoints": "[{\"endpoint_id\": \"test_endpoint_1\", \"phase\": \"input\"}]",
    "extra_step": true,
    "input_keys": "[]",
    "output_keys": "[]"
  }' | jq .
echo

# 4. Start the test flow
echo "4. Starting test flow..."
curl -s -X POST "http://localhost:40243/api/flows/start" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "unified_endpoint_test",
    "repository": "Alyahmed89/deepseek-agent",
    "branch": "main",
    "initial_user_prompt": "Execute the unified endpoint test flow",
    "max_iterations": 3
  }' | jq .
echo

# 5. Check flow runs
echo "5. Checking flow runs..."
curl -s -X GET "http://localhost:40243/api/flow-runs?flow_id=unified_endpoint_test" | jq .
echo

echo "=== Test Complete ==="
echo "Check the logs for:"
echo "1. API calls saved in step_runs.api_calls"
echo "2. extra_step loop triggered"
echo "3. Command execution (if implemented)"