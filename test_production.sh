#!/bin/bash

# Test script for unified endpoint system on production
PRODUCTION_URL="https://deepseek-agent.alghamdimo89.workers.dev"

echo "=== Testing Unified Endpoint System on Production ==="
echo "URL: $PRODUCTION_URL"
echo

# 1. Test endpoint introspection
echo "1. Testing endpoint introspection..."
curl -s -X GET "$PRODUCTION_URL/api/endpoints/introspect?endpoint_id=test_endpoint_1" | jq .
echo

# 2. Check if test endpoint exists
echo "2. Checking test endpoint..."
curl -s -X GET "$PRODUCTION_URL/api/endpoints/test_endpoint_1" | jq .
echo

# 3. Start the test flow
echo "3. Starting test flow..."
FLOW_RESPONSE=$(curl -s -X POST "$PRODUCTION_URL/api/flows/start" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "unified_endpoint_test",
    "repository": "Alyahmed89/deepseek-agent",
    "branch": "main",
    "initial_user_prompt": "Execute the unified endpoint test flow",
    "max_iterations": 3
  }')
echo "$FLOW_RESPONSE" | jq .
echo

# Extract flow run ID if available
FLOW_RUN_ID=$(echo "$FLOW_RESPONSE" | jq -r '.data.id // empty')
if [ -n "$FLOW_RUN_ID" ]; then
  echo "Flow run ID: $FLOW_RUN_ID"
  
  # 4. Check flow run status
  echo "4. Checking flow run status..."
  sleep 5
  curl -s -X GET "$PRODUCTION_URL/api/flow-runs/$FLOW_RUN_ID" | jq .
  echo
  
  # 5. Check step runs for api_calls
  echo "5. Checking step runs for api_calls..."
  curl -s -X GET "$PRODUCTION_URL/api/step-runs?flow_run_id=$FLOW_RUN_ID" | jq .
  echo
fi

# 6. Test endpoint introspection with sample endpoint
echo "6. Testing endpoint introspection with jsonplaceholder_user..."
curl -s -X GET "$PRODUCTION_URL/api/endpoints/introspect?endpoint_id=jsonplaceholder_user" | jq .
echo

echo "=== Test Complete ==="
echo "Check for:"
echo "1. ✅ Endpoint introspection works"
echo "2. ✅ Input injection works"
echo "3. ✅ Command triggers"
echo "4. ✅ api_calls saved"
echo "5. ✅ extra_step loops at least once"
echo "6. ✅ AI stops with [DONE]"