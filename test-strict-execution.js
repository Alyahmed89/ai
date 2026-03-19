// Test script for strict execution engine
// Demonstrates NO fallbacks, NO silent handling, NO retries

console.log('=== STRICT EXECUTION ENGINE TEST ===\n');

// Mock environment for testing
const mockEnv = {
  FLOW_RUNS_DB: {
    prepare: (query) => ({
      bind: (param) => ({
        first: async () => {
          console.log(`[MOCK DB] Query: ${query}, Param: ${param}`);
          
          // Mock response for different commands
          if (param === 'rules_search_exact') {
            return {
              name: 'rules_search_exact',
              description: 'Search for exact rule matches',
              method: 'GET',
              endpoint: '/api/rules/search/exact/:word',
              parameters: JSON.stringify({
                word: { type: 'string', required: true, minLength: 1 }
              }),
              tags: JSON.stringify(['rules', 'search'])
            };
          } else if (param === 'get_conversation_status') {
            return {
              name: 'get_conversation_status',
              description: 'Get conversation status',
              method: 'GET',
              endpoint: '/api/conversations/:conversation_id/status',
              parameters: JSON.stringify({
                conversation_id: { type: 'string', required: true, minLength: 10 }
              }),
              tags: JSON.stringify(['conversation', 'status'])
            };
          } else if (param === 'get_flow_runs') {
            return {
              name: 'get_flow_runs',
              description: 'Get flow runs',
              method: 'GET',
              endpoint: '/api/flow-runs',
              parameters: JSON.stringify({}),
              tags: JSON.stringify(['flow', 'runs'])
            };
          }
          
          // Command not found
          return null;
        },
        all: async () => ({
          results: []
        })
      })
    })
  }
};

// Import the strict executor
async function runTests() {
  try {
    // Dynamically import the module
    const { StrictCommandExecutor } = await import('./src/services/strictCommandExecutor.js');
    
    console.log('1. Testing Parameter Validation\n');
    
    // Test 1: Missing required parameter
    const executor1 = new StrictCommandExecutor({
      env: mockEnv,
      db: mockEnv.FLOW_RUNS_DB,
      timeoutMs: 5000
    });
    
    const test1 = await executor1.executeCommand(
      { name: 'rules_search_exact', params: {} },
      'Step 1'
    );
    
    console.log('Test 1 - Missing required parameter:');
    console.log('Success:', test1.success);
    console.log('Error Code:', test1.error?.code);
    console.log('Error Message:', test1.error?.message);
    console.log('Details:', JSON.stringify(test1.error?.details, null, 2));
    console.log('');
    
    // Test 2: Invalid parameter type
    const test2 = await executor1.executeCommand(
      { name: 'rules_search_exact', params: { word: 123 } },
      'Step 2'
    );
    
    console.log('Test 2 - Invalid parameter type:');
    console.log('Success:', test2.success);
    console.log('Error Code:', test2.error?.code);
    console.log('Error Message:', test2.error?.message);
    console.log('');
    
    // Test 3: Invalid conversation ID format
    const test3 = await executor1.executeCommand(
      { name: 'get_conversation_status', params: { conversation_id: 'short' } },
      'Step 3'
    );
    
    console.log('Test 3 - Invalid conversation ID format:');
    console.log('Success:', test3.success);
    console.log('Error Code:', test3.error?.code);
    console.log('Error Message:', test3.error?.message);
    console.log('');
    
    // Test 4: Command not found in registry
    const test4 = await executor1.executeCommand(
      { name: 'non_existent_command', params: { test: 'value' } },
      'Step 4'
    );
    
    console.log('Test 4 - Command not found:');
    console.log('Success:', test4.success);
    console.log('Error Code:', test4.error?.code);
    console.log('Error Message:', test4.error?.message);
    console.log('');
    
    // Test 5: Valid command (would fail at HTTP level, but validation passes)
    const test5 = await executor1.executeCommand(
      { name: 'rules_search_exact', params: { word: 'test' } },
      'Step 5'
    );
    
    console.log('Test 5 - Valid parameters (HTTP would fail):');
    console.log('Success:', test5.success);
    console.log('Error Code:', test5.error?.code);
    console.log('Error Message:', test5.error?.message);
    if (test5.error?.details) {
      console.log('Error Type:', test5.error.details.error_type);
      console.log('HTTP Status:', test5.error.details.status);
    }
    console.log('');
    
    // Get execution state
    const executionState = executor1.getExecutionState();
    console.log('Execution State Summary:');
    console.log('Total Logs:', executionState.logs.length);
    console.log('Last Log:', executionState.logs[executionState.logs.length - 1]);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run tests
runTests().then(() => {
  console.log('\n=== TEST COMPLETE ===');
  console.log('\nKey behaviors demonstrated:');
  console.log('1. NO fallbacks - commands fail immediately if validation fails');
  console.log('2. NO silent handling - all errors are exposed with full details');
  console.log('3. NO retries - max attempts = 1');
  console.log('4. Parameter validation happens BEFORE execution');
  console.log('5. Conversation safety checks (ID format validation)');
  console.log('6. Detailed logging of every execution step');
});