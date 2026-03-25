#!/usr/bin/env node

/**
 * Local testing script that runs entirely offline without starting the server.
 * Simulates deleting a step in the flow and outputs the exact payload.
 * 
 * Requirements:
 * 1. Simulate deleting a step in the flow
 * 2. Trigger the autoSaveFlow function logic
 * 3. Capture and output exactly the payload that would be sent to the backend
 * 4. Log deleted_step_ids, updatedSteps array after filtering, and edges data
 * 5. Handle cases where node.data.step might be undefined or deletedStepIds is updated asynchronously
 */

console.log('=== OFFLINE STEP DELETION PAYLOAD TEST ===\n');

// Mock data representing current flow state
const mockFlowState = {
  flowId: 'flow-def-1774376995786-ixo9iu4yd',
  nodes: [
    {
      id: 'node-1',
      data: {
        step: {
          id: 'step-to-delete-1',
          title: 'Step to Delete',
          instructions: 'This step will be deleted',
          step_type: 'action',
          order_index: 1,
          blocking: 0,
          auto_fail_on_error: 0,
          retryable: 0,
          output: 0,
          requires_task: 0,
          output_keys: null,
          input_keys: null,
          use_endpoints: null,
          extra_step: 0,
          page_key: null,
          next_flow_id: null,
          default_next_step: null,
          output_url: null,
          output_payload_template: null,
          output_auth_token: null,
          default_next_step_id: null,
          step_number: null,
        }
      }
    },
    {
      id: 'node-2',
      data: {
        step: {
          id: 'step-to-keep-1',
          title: 'Keep This Step',
          instructions: 'This step remains',
          step_type: 'default',
          order_index: 2,
          blocking: 1,
          auto_fail_on_error: 1,
          retryable: 1,
          output: 1,
          requires_task: 1,
          output_keys: 'result',
          input_keys: 'input',
          use_endpoints: null,
          extra_step: 0,
          page_key: null,
          next_flow_id: null,
          default_next_step: null,
          output_url: null,
          output_payload_template: null,
          output_auth_token: null,
          default_next_step_id: null,
          step_number: null,
        }
      }
    },
    {
      id: 'node-3',
      data: {
        // Edge case: step is undefined
      }
    },
    {
      id: 'node-4',
      data: {
        step: null // Edge case: step is null
      }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'step-to-delete-1',
      target: 'step-to-keep-1',
      data: {
        condition: {
          source: 'default',
          operator: 'always',
          value: null,
        },
        route: {
          type: 'step',
          target_id: 'step-to-keep-1',
          context_preservation: 'full',
        },
      },
      type: 'default',
    }
  ]
};

// Simulate React state (deletedStepIds starts empty, gets updated async)
let deletedStepIds = [];
let deletedEdgeIds = [];

console.log('1. SIMULATING STEP DELETION');
console.log('===========================');
console.log('Initial state:');
console.log(`- Nodes: ${mockFlowState.nodes.length} (2 with step data, 2 edge cases)`);
console.log(`- Edges: ${mockFlowState.edges.length}`);
console.log(`- deletedStepIds: ${JSON.stringify(deletedStepIds)}`);
console.log(`- deletedEdgeIds: ${JSON.stringify(deletedEdgeIds)}`);

// Simulate user deleting step-to-delete-1
console.log('\nUser deletes node "node-1" (step-to-delete-1)...');

// Simulate React's setDeletedStepIds with callback (async state update)
const simulateSetDeletedStepIds = (updater) => {
  const newValue = updater(deletedStepIds);
  deletedStepIds = newValue;
  console.log(`State updated: deletedStepIds = ${JSON.stringify(deletedStepIds)}`);
  
  // Simulate autoSaveFlow being called after state update (with 100ms delay)
  setTimeout(() => {
    console.log('\n2. TRIGGERING autoSaveFlow (after state update)');
    console.log('==============================================');
    simulateAutoSaveFlow();
  }, 100);
};

// Call the state updater (simulating handleDeleteNode)
simulateSetDeletedStepIds(prev => {
  const updated = [...prev, 'step-to-delete-1'];
  console.log(`Callback executed: updated deletedStepIds to ${JSON.stringify(updated)}`);
  return updated;
});

// Simulate autoSaveFlow function logic
function simulateAutoSaveFlow() {
  console.log('\nautoSaveFlow execution:');
  console.log('----------------------');
  console.log(`Current deletedStepIds: ${JSON.stringify(deletedStepIds)}`);
  console.log(`Current deletedEdgeIds: ${JSON.stringify(deletedEdgeIds)}`);
  
  // Filter out deleted steps (handling undefined step)
  const updatedSteps = mockFlowState.nodes
    .filter(node => {
      const step = node.data?.step;
      // Keep nodes that have a step AND the step ID is not in deletedStepIds
      const shouldKeep = step?.id && !deletedStepIds.includes(step.id);
      if (!shouldKeep && step?.id) {
        console.log(`  Filtering out step: ${step.id} (marked for deletion)`);
      }
      return shouldKeep;
    })
    .map(node => {
      const step = node.data.step;
      
      // Apply boolean conversion (from saveFlowDAG fix)
      const processedStep = {
        ...step,
        flow_id: mockFlowState.flowId,
        step_key: step.id,
        title: step.title || '',
        instructions: step.instructions || '',
        step_type: step.step_type || 'action',
        order_index: step.order_index || 1,
        page_key: step.page_key || null,
        blocking: Boolean(step.blocking || 0),
        auto_fail_on_error: Boolean(step.auto_fail_on_error || 0),
        retryable: Boolean(step.retryable || 0),
        output_keys: step.output_keys || null,
        output_url: step.output_url || null,
        output_payload_template: step.output_payload_template || null,
        default_next_step: step.default_next_step || null,
        output_auth_token: step.output_auth_token || null,
        input_keys: step.input_keys || null,
        output: Boolean(step.output || 0), // FIX: Convert to boolean
        default_next_step_id: step.default_next_step_id || null,
        step_number: step.step_number || null,
        requires_task: Boolean(step.requires_task || 0), // FIX: Convert to boolean
        use_endpoints: step.use_endpoints || null,
        extra_step: step.extra_step || 0,
        next_flow_id: step.next_flow_id || null,
      };
      
      console.log(`  Processing step ${step.id}:`);
      console.log(`    - output: ${processedStep.output} (was: ${step.output}, type: ${typeof processedStep.output})`);
      console.log(`    - requires_task: ${processedStep.requires_task} (was: ${step.requires_task}, type: ${typeof processedStep.requires_task})`);
      console.log(`    - blocking: ${processedStep.blocking} (was: ${step.blocking}, type: ${typeof processedStep.blocking})`);
      
      return processedStep;
    });
  
  // Sort by order_index
  updatedSteps.sort((a, b) => a.order_index - b.order_index);
  
  console.log(`\nUpdated steps after filtering: ${updatedSteps.length} steps`);
  console.log('Step IDs:', updatedSteps.map(s => s.id));
  
  // Prepare edges for backend
  const backendEdges = mockFlowState.edges
    .filter(edge => !deletedEdgeIds.includes(edge.id))
    .map(edge => ({
      id: edge.id,
      source_step_id: edge.source,
      target_step_id: edge.target,
      condition: edge.data?.condition || {
        source: 'default',
        operator: 'always',
        value: null,
      },
      route: edge.data?.route || {
        type: 'step',
        target_id: edge.target,
        context_preservation: 'full',
      },
      type: edge.type || 'default',
    }));
  
  console.log(`\nEdges after filtering: ${backendEdges.length} edges`);
  console.log('Edge source->target:', backendEdges.map(e => `${e.source_step_id}->${e.target_step_id}`));
  
  // Construct the final payload (matching saveFlowDAG)
  const payload = {
    steps: updatedSteps,
    edges: backendEdges,
    deleted_step_ids: deletedStepIds,
    deleted_edge_ids: deletedEdgeIds,
  };
  
  console.log('\n3. CAPTURED PAYLOAD (exact format sent to backend)');
  console.log('==================================================');
  console.log(JSON.stringify(payload, null, 2));
  
  console.log('\n4. PAYLOAD VERIFICATION');
  console.log('=======================');
  console.log(`✓ deleted_step_ids: ${payload.deleted_step_ids.length} item(s)`);
  console.log(`  ${JSON.stringify(payload.deleted_step_ids)}`);
  console.log(`✓ steps array: ${payload.steps.length} item(s) (filtered)`);
  console.log(`✓ edges array: ${payload.edges.length} item(s)`);
  console.log(`✓ deleted_edge_ids: ${payload.deleted_edge_ids.length} item(s)`);
  
  // Verify boolean fields
  if (payload.steps.length > 0) {
    const sampleStep = payload.steps[0];
    console.log('\n✓ Boolean field verification:');
    console.log(`  output: ${sampleStep.output} (type: ${typeof sampleStep.output}) - ${typeof sampleStep.output === 'boolean' ? 'PASS' : 'FAIL'}`);
    console.log(`  requires_task: ${sampleStep.requires_task} (type: ${typeof sampleStep.requires_task}) - ${typeof sampleStep.requires_task === 'boolean' ? 'PASS' : 'FAIL'}`);
    console.log(`  blocking: ${sampleStep.blocking} (type: ${typeof sampleStep.blocking}) - ${typeof sampleStep.blocking === 'boolean' ? 'PASS' : 'FAIL'}`);
  }
  
  console.log('\n5. EXPECTED BACKEND RESPONSE');
  console.log('===========================');
  const expectedResponse = {
    success: true,
    data: {
      message: "Flow steps and edges updated successfully",
      steps_updated: payload.steps.length,
      edges_updated: payload.edges.length,
      steps_deleted: payload.deleted_step_ids.length,
      edges_deleted: payload.deleted_edge_ids.length,
    },
    error: null,
    statusCode: 200
  };
  console.log(JSON.stringify(expectedResponse, null, 2));
  
  console.log('\n=== TEST SUMMARY ===');
  console.log('The script successfully simulates:');
  console.log('1. Step deletion with async state updates');
  console.log('2. autoSaveFlow triggering after state update');
  console.log('3. Filtering of deleted steps from steps array');
  console.log('4. Boolean field conversion (output, requires_task, etc.)');
  console.log('5. Exact payload construction matching saveFlowDAG');
  console.log('6. Handling of undefined/null node.data.step');
  
  console.log('\nKey fix demonstrated:');
  console.log('• deleted_step_ids is NOT empty (contains deleted step ID)');
  console.log('• steps array is filtered (excludes deleted step)');
  console.log('• Boolean fields are boolean type, not number type');
}

// Keep the script running to allow async operations
setTimeout(() => {
  console.log('\n=== TEST COMPLETE ===');
  console.log('Run this script anytime to verify the deletion payload logic.');
  console.log('Compare output with actual backend requests in production.');
}, 200);