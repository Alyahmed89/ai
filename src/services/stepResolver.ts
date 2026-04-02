// Step Resolver for Dynamic API Data Fetching
// ============================================================================

import { SecureVariableResolver } from './secureVariableResolver';
import { getTaskData, saveVariable } from './database';
import { StepData } from '../types';

// Backward compatibility wrapper for step instructions
export async function resolveStepInstructions(
  step: StepData,
  db: D1Database | null,
  env: Record<string, string>,
  context: {
    flow_id?: string;
    execution_id?: string;
    step_id?: string;
    previous_step_responses?: Record<string, any>; // NEW: Previous step responses for variable substitution
    inputs?: Record<string, any>; // NEW: Input values for [input:name] placeholders
  }
): Promise<{
  instructions: string;
  variables?: Record<string, any>;
  api_responses?: Record<string, any>;
  task_data?: {
    title?: string;
    description?: string;
    payload?: any;
  };
}> {
  
  // Load task data if task_id is provided (for both old and new systems)
  let taskData = null;
  
  if (step.task_id && db) {
    try {
      const task = await getTaskData(db, step.task_id);
      if (task) {
        taskData = {
          title: task.title,
          description: task.description,
          payload: task.payload ? JSON.parse(task.payload) : null
        };
      }
    } catch (error) {
      console.error(`[StepResolver] Error loading task data for step ${step.step_id}:`, error);
    }
  }
  
  // If no task_id but we have flow_id and db, try to get latest task for this flow
  if (!taskData && context.flow_id && db) {
    try {
      const { getLatestTaskForFlow } = await import('./database');
      const latestTask = await getLatestTaskForFlow(db, context.flow_id);
      if (latestTask) {
        taskData = {
          title: latestTask.title,
          description: latestTask.description,
          payload: latestTask.payload ? JSON.parse(latestTask.payload) : null
        };
        console.log(`[StepResolver] Loaded latest task for flow ${context.flow_id}: ${latestTask.title}`);
      }
    } catch (error) {
      console.error(`[StepResolver] Error loading latest task for flow ${context.flow_id}:`, error);
    }
  }
  
  // STEP 1: Unified endpoint system is source of truth when present
  if (step.use_endpoints && step.use_endpoints.trim() !== '') {
    try {
      console.log(`[StepResolver] Using unified endpoint system for step ${step.step_id}`);
      
      // Execute unified endpoints (input/command/output phases)
      const unifiedResult = await executeUnifiedEndpoints(step, db, env, {
        flow_id: context.flow_id,
        execution_id: context.execution_id,
        step_id: step.step_id,
        previous_step_responses: context.previous_step_responses
      });
      
      let instructions = step.instructions || step.description || step.title || '';
      
      // Inject task data if available
      if (taskData) {
        instructions = injectTaskData(instructions, taskData, step.task_id);
      }
      
      // Inject input values if available
      if (context.inputs && Object.keys(context.inputs).length > 0) {
        instructions = injectInputValues(instructions, context.inputs);
      }
      
      // Inject API responses into instructions
      instructions = injectApiResponses(instructions, unifiedResult.api_calls, unifiedResult.variables);
      
      // Combine all available variables for {variable} substitution
      const allVariables: Record<string, any> = {};
      
      // Add context.inputs
      if (context.inputs) {
        Object.assign(allVariables, context.inputs);
      }
      
      // Add previous step responses
      if (context.previous_step_responses) {
        Object.assign(allVariables, context.previous_step_responses);
      }
      
      // Add unified result variables
      if (unifiedResult.variables) {
        Object.assign(allVariables, unifiedResult.variables);
      }
      
      // Add task data if available
      if (taskData) {
        allVariables.task_data = taskData;
        allVariables.task_title = taskData.title;
        allVariables.task_description = taskData.description;
      }
      
      console.log(`[StepResolver:unified] Combined variables for {variable} substitution: ${Object.keys(allVariables).join(', ')}`);
      
      // Apply {variable} substitution
      if (Object.keys(allVariables).length > 0) {
        instructions = substituteVariables(instructions, allVariables, 'unified_system');
      }
      
      // Add command format instructions if step has command endpoints
      instructions = addCommandFormatInstructions(instructions, step);
      
      return {
        instructions,
        variables: unifiedResult.variables,
        api_calls: unifiedResult.api_calls, // Return full API calls array for database storage
        api_responses: unifiedResult.api_calls.reduce((acc: Record<string, any>, call) => {
          acc[call.endpoint_id] = call.response.data;
          return acc;
        }, {}),
        task_data: taskData
      };
      
    } catch (error) {
      console.error(`[StepResolver] Error executing unified endpoints for step ${step.step_id}:`, error);
      
      // Fall back to input_keys system if unified system fails
      if (step.auto_fail_on_error) {
        throw error;
      }
    }
  }
  
  // Legacy system: input_keys for dynamic API data fetching
  if (step.input_keys) {
    try {
      const resolver = new SecureVariableResolver(env);
      
      // Create initial variables with task data if available
      const initialVariables: Record<string, any> = {};
      if (taskData) {
        initialVariables.task_data = taskData;
      }
      
      // Add context.inputs to initial variables for {variable} substitution
      if (context.inputs && Object.keys(context.inputs).length > 0) {
        Object.assign(initialVariables, context.inputs);
      }
      
      console.log(`[StepResolver:legacy] Initial variables for resolver: ${Object.keys(initialVariables).join(', ')}`);
      
      // DEBUG: Log previous_step_responses and inputs
      console.log(`[StepResolver:legacy] DEBUG - previous_step_responses:`, JSON.stringify(context.previous_step_responses, null, 2));
      console.log(`[StepResolver:legacy] DEBUG - context.inputs:`, JSON.stringify(context.inputs, null, 2));
      console.log(`[StepResolver:legacy] DEBUG - task_data:`, JSON.stringify(taskData, null, 2));
      
      // We need to modify SecureVariableResolver to accept initial variables
      // For now, we'll use a workaround by injecting task data into the instructions
      let instructionsWithTaskData = step.instructions || step.description || step.title || '';
      
      if (taskData) {
        instructionsWithTaskData = injectTaskData(instructionsWithTaskData, taskData, step.task_id);
      }
      
      // Inject input values if available (legacy [input:name] syntax)
      if (context.inputs && Object.keys(context.inputs).length > 0) {
        instructionsWithTaskData = injectInputValues(instructionsWithTaskData, context.inputs);
      }
      
      const resolved = await resolver.resolveStepVariables(
        {
          step_id: step.step_id,
          instructions: instructionsWithTaskData,
          input_keys: step.input_keys,
          auto_fail_on_error: step.auto_fail_on_error || false
        },
        {
          env,
          step: {
            step_id: step.step_id,
            instructions: instructionsWithTaskData,
            input_keys: step.input_keys,
            auto_fail_on_error: step.auto_fail_on_error || false
          },
          flow_id: context.flow_id,
          execution_id: context.execution_id,
          // Pass task data in context for SecureVariableResolver to use
          task_data: taskData,
          // Pass previous step responses for variable substitution
          previous_step_responses: context.previous_step_responses,
          // Pass context inputs for {variable} substitution
          inputs: context.inputs,
          // Pass database for endpoint registry lookups
          db: db
        }
      );
      
      return {
        instructions: resolved.instructions,
        variables: resolved.variables,
        api_responses: resolved.api_responses,
        task_data: taskData
      };
      
    } catch (error) {
      console.error(`[StepResolver] Error resolving input_keys for step ${step.step_id}:`, error);
      
      // Fall back to old system if new system fails
      if (step.auto_fail_on_error) {
        throw error;
      }
    }
  }
  
  // Old system: requires_task with task_id (no input_keys)
  // Build instructions with task data if available
  let instructions = step.instructions || step.description || step.title || '';
  
  if (taskData) {
    instructions = injectTaskData(instructions, taskData, step.task_id);
  }
  
  // Inject input values if available
  if (context.inputs && Object.keys(context.inputs).length > 0) {
    instructions = injectInputValues(instructions, context.inputs);
  }
  
  // Combine all available variables for {variable} substitution
  const allVariables: Record<string, any> = {};
  
  // Add context.inputs
  if (context.inputs) {
    Object.assign(allVariables, context.inputs);
  }
  
  // Add previous step responses
  if (context.previous_step_responses) {
    Object.assign(allVariables, context.previous_step_responses);
  }
  
  // Add task data if available
  if (taskData) {
    allVariables.task_data = taskData;
    allVariables.task_title = taskData.title;
    allVariables.task_description = taskData.description;
  }
  
  console.log(`[StepResolver] Combined variables for {variable} substitution: ${Object.keys(allVariables).join(', ')}`);
  
  // Apply {variable} substitution
  if (Object.keys(allVariables).length > 0) {
    instructions = substituteVariables(instructions, allVariables, 'old_system');
  }
  
  return {
    instructions,
    task_data: taskData
  };
}

// Helper to inject task data into instructions (backward compatibility)
function injectTaskData(
  instructions: string,
  taskData: { title?: string; description?: string; payload?: any },
  taskId?: string
): string {
  let result = instructions;
  
  if (taskData.title) {
    // Handle both {task_title} and { task_title } (with optional spaces)
    result = result.replace(/\{\s*task_title\s*\}/g, taskData.title);
  }
  
  if (taskData.description) {
    // Handle both {task_description} and { task_description } (with optional spaces)
    result = result.replace(/\{\s*task_description\s*\}/g, taskData.description);
  }
  
  // Add task metadata section if not already present
  if (!result.includes('=== TASK ===')) {
    const taskSection = `\n\n=== TASK ===${taskId ? `\nTask ID: ${taskId}` : ''}${taskData.title ? `\nTitle: ${taskData.title}` : ''}${taskData.description ? `\nDescription: ${taskData.description}` : ''}\n=== END TASK ===\n`;
    result = taskSection + result;
  }
  
  return result;
}

// Add command format instructions to step instructions
function addCommandFormatInstructions(instructions: string, step: StepData): string {
  if (!step.use_endpoints || step.use_endpoints.trim() === '') {
    return instructions;
  }
  
  try {
    const useEndpoints = JSON.parse(step.use_endpoints);
    
    if (!Array.isArray(useEndpoints)) {
      return instructions;
    }
    
    // Handle both formats:
    // 1. Array of strings: ["rules_search_exact", "rules_search_partial"]
    // 2. Array of objects: [{"endpoint_id": "rules_search_exact", "phase": "command"}, ...]
    
    let commandEndpoints: string[] = [];
    
    if (useEndpoints.length > 0) {
      if (typeof useEndpoints[0] === 'string') {
        // Format 1: Array of strings - assume all are command endpoints
        commandEndpoints = useEndpoints;
      } else if (typeof useEndpoints[0] === 'object' && useEndpoints[0] !== null) {
        // Format 2: Array of objects - filter by phase "command"
        const hasCommandEndpoints = useEndpoints.some((ep: any) => ep.phase === 'command');
        
        if (!hasCommandEndpoints) {
          return instructions;
        }
        
        commandEndpoints = useEndpoints
          .filter((ep: any) => ep.phase === 'command')
          .map((ep: any) => ep.endpoint_id || ep.endpoint_name || ep.name || ep.id);
      }
    }
    
    if (commandEndpoints.length === 0) {
      return instructions;
    }
    
    // Add command format instructions
    const commandInstructions = `

=== COMMAND EXECUTION INSTRUCTIONS ===
To execute commands, use the format: [COMMAND:endpoint_name] params: {JSON_parameters}

Available command endpoints: ${commandEndpoints.join(', ')}

Examples:
- [COMMAND:${commandEndpoints[0]}] params: {"param1": "value1", "param2": "value2"}
- [COMMAND:${commandEndpoints[0]}] params: {"userWord": "example"}

The system will execute the command and return the results.
=== END COMMAND INSTRUCTIONS ===
`;
    
    return instructions + commandInstructions;
    
  } catch (error) {
    console.error('[addCommandFormatInstructions] Error parsing use_endpoints:', error);
    return instructions;
  }
}

// Generate example input_keys configuration for a step
export function generateExampleInputKeys(step: StepData): string {
  const examples = [];
  
  // Example 1: Internal task lookup (backward compatibility)
  if (step.task_id) {
    examples.push({
      key: 'task_data',
      url: `internal://tasks/${step.task_id}`,
      method: 'GET',
      auth_type: 'none',
      timeout_ms: 5000,
      response_path: 'description',
      allowed_domains: ['internal'],
      require_https: false,
      log_level: 'info'
    });
  }
  
  // Example 2: External API call
  examples.push({
    key: 'user_data',
    url: 'https://api.example.com/users/current',
    method: 'GET',
    auth_type: 'bearer',
    auth_value: 'env:API_TOKEN',
    timeout_ms: 10000,
    response_path: 'data.user',
    allowed_domains: ['api.example.com'],
    require_https: true,
    log_level: 'info'
  });
  
  // Example 3: Dependent API calls
  examples.push({
    key: 'project_data',
    url: 'https://api.example.com/projects/{user_data.id}',
    method: 'GET',
    depends_on: ['user_data'],
    auth_type: 'bearer',
    auth_value: 'env:API_TOKEN',
    timeout_ms: 10000,
    response_path: 'data.project',
    allowed_domains: ['api.example.com'],
    require_https: true,
    log_level: 'info'
  });
  
  return JSON.stringify(examples, null, 2);
}

// Validate step configuration
export function validateStepConfiguration(step: StepData): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const result = { valid: true, errors: [], warnings: [] };
  
  // Check for deprecated fields
  if (step.requires_task) {
    result.warnings.push('requires_task is deprecated. Use input_keys for dynamic API data fetching.');
  }
  
  if (step.task_id && !step.input_keys) {
    result.warnings.push('task_id without input_keys uses deprecated task injection system.');
  }
  
  // Validate input_keys if present
  if (step.input_keys) {
    try {
      const configs = JSON.parse(step.input_keys);
      
      if (!Array.isArray(configs)) {
        result.errors.push('input_keys must be a JSON array');
        result.valid = false;
      } else {
        // Basic validation of each config
        for (let i = 0; i < configs.length; i++) {
          const config = configs[i];
          
          if (!config.key || typeof config.key !== 'string') {
            result.errors.push(`Config at index ${i} missing or invalid 'key' property`);
            result.valid = false;
          }
          
          if (!config.url || typeof config.url !== 'string') {
            result.errors.push(`Config at index ${i} missing or invalid 'url' property`);
            result.valid = false;
          }
          
          if (!config.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].includes(config.method)) {
            result.errors.push(`Config at index ${i} missing or invalid 'method' property`);
            result.valid = false;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Invalid input_keys JSON: ${error.message}`);
      result.valid = false;
    }
  }
  
  return result;
}

// Migration helper: Convert requires_task to input_keys
export function convertRequiresTaskToInputKeys(
  step: StepData,
  taskData?: { id: string; title: string; description: string; payload?: any }
): string {
  if (!step.requires_task || !taskData) {
    return step.input_keys || '[]';
  }
  
  const config = {
    key: 'task_data',
    url: `internal://tasks/${taskData.id}`,
    method: 'GET',
    auth_type: 'none',
    timeout_ms: 5000,
    response_path: 'description',
    allowed_domains: ['internal'],
    require_https: false,
    log_level: 'info'
  };
  
  return JSON.stringify([config]);
}

// Unified endpoint execution for use_endpoints field - INPUT PHASE ONLY
export async function executeUnifiedEndpoints(
  step: StepData,
  db: D1Database | null,
  env: Record<string, string>,
  context: {
    flow_id?: string;
    execution_id?: string;
    step_id?: string;
    step_run_id?: string; // NEW: Required for saving to step_runs.api_calls
    previous_step_responses?: Record<string, any>;
  }
): Promise<{
  api_calls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
    timestamp: string;
  }>;
  variables: {
    api: Record<string, { response: any }>;
    env: Record<string, string>;
    previous_step: Record<string, any>;
  };
}> {
  const apiCalls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
    timestamp: string;
  }> = [];
  
  // Initialize variables structure
  const variables = {
    api: {} as Record<string, { response: any }>,
    env: { ...env },
    previous_step: context.previous_step_responses || {}
  };
  
  if (!step.use_endpoints || !db || !context.step_run_id) {
    return { api_calls: apiCalls, variables };
  }
  
  try {
    const useEndpoints = JSON.parse(step.use_endpoints);
    
    if (!Array.isArray(useEndpoints)) {
      console.error('[executeUnifiedEndpoints] use_endpoints must be a JSON array');
      return { api_calls: apiCalls, variables };
    }
    
    // Normalize endpoints to object format with phase property
    const normalizedEndpoints = useEndpoints.map((ep: any) => {
      if (typeof ep === 'string') {
        // String format: assume it's a command endpoint
        return { endpoint_id: ep, endpoint_name: ep, phase: 'command' };
      } else if (typeof ep === 'object' && ep !== null) {
        // Object format: ensure it has required properties
        return {
          endpoint_id: ep.endpoint_id || ep.endpoint_name || ep.name || ep.id,
          endpoint_name: ep.endpoint_name || ep.name || ep.endpoint_id || ep.id,
          phase: ep.phase || 'command', // Default to command if not specified
          save_to_db: ep.save_to_db !== false, // Default to true
          validation_schema: ep.validation_schema
        };
      }
      return ep;
    });
    
    // Execute input phase endpoints ONLY
    const inputEndpoints = normalizedEndpoints.filter((ep: any) => ep.phase === 'input');
    
    for (const endpointConfig of inputEndpoints) {
      try {
        // Get endpoint details from registry
        const endpointSql = `
          SELECT id, name, url, method, auth_type, auth_value,
                 headers, body_template, query_params, response_path,
                 timeout_ms, max_retries, retry_delay_ms,
                 parameter_schema, sample_response, save_to_db
          FROM endpoint_registry
          WHERE id = ? OR name = ?
        `;
        
        const endpoint = await db.prepare(endpointSql)
          .bind(endpointConfig.endpoint_id, endpointConfig.endpoint_name)
          .first();
        
        if (!endpoint) {
          console.error(`[executeUnifiedEndpoints] Endpoint not found: ${endpointConfig.endpoint_id}`);
          continue;
        }
        
        // Build request (no variable substitution for inputs - isolated execution)
        const request = await buildEndpointRequest(endpoint, endpointConfig, {}, env);
        
        // Execute request
        const response = await executeEndpointRequest(request, endpoint);
        
        // Create API call record
        const apiCall = {
          endpoint_id: endpointConfig.endpoint_id,
          endpoint_name: endpoint.name,
          phase: 'input',
          request,
          response,
          timestamp: new Date().toISOString()
        };
        
        apiCalls.push(apiCall);
        
        // Add to variables.api for {variable} substitution
        variables.api[endpointConfig.endpoint_id] = { response: response.data };
        
        // Save to step_runs.api_calls via saveApiCall if endpoint.save_to_db is true
        if (endpoint.save_to_db !== false && endpointConfig.save_to_db !== false) {
          const { saveApiCall, generateId } = await import('./database');
          await saveApiCall(db, {
            id: generateId(),
            flow_id: context.flow_id,
            step_id: context.step_id,
            step_run_id: context.step_run_id,
            endpoint_id: endpointConfig.endpoint_id,
            endpoint_name: endpoint.name,
            method: endpoint.method,
            request: request,
            response: response.data,
            phase: 'input',
            timestamp: apiCall.timestamp
          });
        }
        
        // API results are stored in api_calls table, not as variables
        // Variables are optional queries on stored data, not wrappers for API calls
        // The API call has been saved to step_runs.api_calls via saveApiCall above
        
      } catch (error) {
        console.error(`[executeUnifiedEndpoints] Error executing input endpoint ${endpointConfig.endpoint_id}:`, error);
      }
    }
    
    // Save environment variables to variables table
    if (context.flow_id && context.step_run_id && db) {
      const { generateId } = await import('./database');
      for (const [key, value] of Object.entries(variables.env)) {
        await saveVariable(db, {
          id: generateId(),
          flow_id: context.flow_id,
          flow_run_id: context.execution_id,
          step_id: context.step_id,
          step_run_id: context.step_run_id,
          key: `env.${key}`,
          value: value,
          source: 'env'
        });
      }
      
      // Save previous step variables
      for (const [key, value] of Object.entries(variables.previous_step)) {
        await saveVariable(db, {
          id: generateId(),
          flow_id: context.flow_id,
          flow_run_id: context.execution_id,
          step_id: context.step_id,
          step_run_id: context.step_run_id,
          key: `previous_step.${key}`,
          value: value,
          source: 'previous_step'
        });
      }
    }
    
    return { api_calls: apiCalls, variables };
    
  } catch (error) {
    console.error('[executeUnifiedEndpoints] Error parsing use_endpoints:', error);
    return { api_calls: apiCalls, variables };
  }
}

// Unified command execution - COMMAND PHASE ONLY
export async function executeUnifiedCommands(
  step: StepData,
  db: D1Database | null,
  env: Record<string, string>,
  aiResponse: string,
  context: {
    flow_id?: string;
    execution_id?: string;
    step_id?: string;
    step_run_id?: string; // NEW: Required for saving to step_runs.api_calls
    previous_step_responses?: Record<string, any>;
  }
): Promise<{
  api_calls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
    timestamp: string;
  }>;
  variables: {
    api: Record<string, { response: any }>;
    env: Record<string, string>;
    previous_step: Record<string, any>;
  };
}> {
  const apiCalls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
    timestamp: string;
  }> = [];
  
  // Initialize variables structure
  const variables = {
    api: {} as Record<string, { response: any }>,
    env: { ...env },
    previous_step: context.previous_step_responses || {}
  };
  
  if (!step.use_endpoints || !db || !context.step_run_id) {
    return { api_calls: apiCalls, variables };
  }
  
  try {
    const useEndpoints = JSON.parse(step.use_endpoints);
    
    if (!Array.isArray(useEndpoints)) {
      console.error('[executeUnifiedCommands] use_endpoints must be a JSON array');
      return { api_calls: apiCalls, variables };
    }
    
    // Normalize endpoints to object format with phase property
    const normalizedEndpoints = useEndpoints.map((ep: any) => {
      if (typeof ep === 'string') {
        // String format: assume it's a command endpoint
        return { endpoint_id: ep, endpoint_name: ep, phase: 'command' };
      } else if (typeof ep === 'object' && ep !== null) {
        // Object format: ensure it has required properties
        return {
          endpoint_id: ep.endpoint_id || ep.endpoint_name || ep.name || ep.id,
          endpoint_name: ep.endpoint_name || ep.name || ep.endpoint_id || ep.id,
          phase: ep.phase || 'command', // Default to command if not specified
          save_to_db: ep.save_to_db !== false, // Default to true
          validation_schema: ep.validation_schema
        };
      }
      return ep;
    });
    
    // Get command phase endpoints
    const commandEndpoints = normalizedEndpoints.filter((ep: any) => ep.phase === 'command');
    
    // Parse commands from AI response
    const commands = parseCommandsFromAIResponse(aiResponse);
    
    // Execute each command against matching command endpoints
    for (const command of commands) {
      const matchingEndpoint = commandEndpoints.find((ep: any) => 
        ep.endpoint_name === command.name || ep.endpoint_id === command.name
      );
      
      if (!matchingEndpoint) {
        console.warn(`[executeUnifiedCommands] No matching command endpoint for: ${command.name}`);
        continue;
      }
      
      try {
        // Get endpoint details from registry
        const endpointSql = `
          SELECT id, name, url, method, auth_type, auth_value,
                 headers, body_template, query_params, response_path,
                 timeout_ms, max_retries, retry_delay_ms,
                 parameter_schema, sample_response, save_to_db
          FROM endpoint_registry
          WHERE id = ? OR name = ?
        `;
        
        const endpoint = await db.prepare(endpointSql)
          .bind(matchingEndpoint.endpoint_id, command.name)
          .first();
        
        if (!endpoint) {
          console.error(`[executeUnifiedCommands] Endpoint not found: ${matchingEndpoint.endpoint_id} or ${command.name}`);
          continue;
        }
        
        // Build request with command parameters (no variable substitution - isolated execution)
        const request = await buildCommandRequest(endpoint, command.params);
        
        // Execute command
        const response = await executeEndpointRequest(request, endpoint);
        
        // Create API call record
        const apiCall = {
          endpoint_id: endpoint.id,
          endpoint_name: endpoint.name,
          phase: 'command',
          request,
          response,
          timestamp: new Date().toISOString()
        };
        
        apiCalls.push(apiCall);
        
        // Add to variables.api for {variable} substitution
        variables.api[endpoint.id] = { response: response.data };
        
        // Save to step_runs.api_calls via saveApiCall if endpoint.save_to_db is true
        if (endpoint.save_to_db !== false && matchingEndpoint.save_to_db !== false) {
          const { saveApiCall, generateId } = await import('./database');
          await saveApiCall(db, {
            id: generateId(),
            flow_id: context.flow_id,
            step_id: context.step_id,
            step_run_id: context.step_run_id,
            endpoint_id: endpoint.id,
            endpoint_name: endpoint.name,
            method: endpoint.method,
            request: request,
            response: response.data,
            phase: 'command',
            timestamp: apiCall.timestamp
          });
        }
        
      } catch (error: any) {
        console.error(`[executeUnifiedCommands] Error executing command ${command.name}:`, error);
        
        // Save error response to step_runs.api_calls
        const { saveApiCall, generateId } = await import('./database');
        await saveApiCall(db, {
          id: generateId(),
          flow_id: context.flow_id,
          step_id: context.step_id,
          step_run_id: context.step_run_id,
          endpoint_id: matchingEndpoint.endpoint_id,
          endpoint_name: command.name,
          method: 'POST',
          request: { command: command.name, params: command.params },
          response: { error: error.message, success: false },
          phase: 'command',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return { api_calls: apiCalls, variables };
    
  } catch (error) {
    console.error('[executeUnifiedCommands] Error parsing use_endpoints:', error);
    return { api_calls: apiCalls, variables };
  }
}

// Helper to parse commands from AI response
function parseCommandsFromAIResponse(aiResponse: string): Array<{name: string; params: Record<string, any>}> {
  const commands: Array<{name: string; params: Record<string, any>}> = [];
  
  // Command parsing - look for [COMMAND:endpoint_name] pattern
  const commandPattern = /\[COMMAND:(\w+)\](.*?)(?=\[COMMAND:\w+\]|$)/gs;
  let match;
  
  while ((match = commandPattern.exec(aiResponse)) !== null) {
    const commandName = match[1];
    const commandContent = match[2].trim();
    
    // Parse parameters - look for JSON after "params:"
    const params: Record<string, any> = {};
    
    // Try to extract JSON parameters
    const paramsMatch = commandContent.match(/params:\s*(\{.*\}|\[.*\])/s);
    if (paramsMatch) {
      try {
        const jsonParams = JSON.parse(paramsMatch[1]);
        Object.assign(params, jsonParams);
      } catch (e) {
        console.error(`[parseCommandsFromAIResponse] Failed to parse JSON params for ${commandName}:`, e);
        // Fall back to simple key-value parsing
        const paramPattern = /(\w+):\s*([^\n]+)/g;
        let paramMatch;
        
        while ((paramMatch = paramPattern.exec(commandContent)) !== null) {
          const key = paramMatch[1];
          let value = paramMatch[2].trim();
          
          // Try to parse JSON values
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              value = JSON.parse(value);
            } else if (value === 'true' || value === 'false') {
              value = value === 'true';
            } else if (!isNaN(Number(value)) && value !== '') {
              value = Number(value);
            }
          } catch (e) {
            // Keep as string if parsing fails
          }
          
          params[key] = value;
        }
      }
    } else {
      // Fall back to simple key-value parsing if no JSON params found
      const paramPattern = /(\w+):\s*([^\n]+)/g;
      let paramMatch;
      
      while ((paramMatch = paramPattern.exec(commandContent)) !== null) {
        const key = paramMatch[1];
        let value = paramMatch[2].trim();
        
        // Try to parse JSON values
        try {
          if (value.startsWith('{') || value.startsWith('[')) {
            value = JSON.parse(value);
          } else if (value === 'true' || value === 'false') {
            value = value === 'true';
          } else if (!isNaN(Number(value)) && value !== '') {
            value = Number(value);
          }
        } catch (e) {
          // Keep as string if parsing fails
        }
        
        params[key] = value;
      }
    }
    
    commands.push({ name: commandName, params });
  }
  
  return commands;
}

// Unified output execution - OUTPUT PHASE ONLY
export async function executeUnifiedOutputs(
  step: StepData,
  db: D1Database | null,
  env: Record<string, string>,
  aiResponse: string,
  context: {
    flow_id?: string;
    execution_id?: string;
    step_id?: string;
    step_run_id?: string; // NEW: Required for saving to step_runs.api_calls
    previous_step_responses?: Record<string, any>;
  }
): Promise<{
  api_calls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
    timestamp: string;
  }>;
  variables: {
    api: Record<string, { response: any }>;
    env: Record<string, string>;
    previous_step: Record<string, any>;
  };
}> {
  const apiCalls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
    timestamp: string;
  }> = [];
  
  // Initialize variables structure
  const variables = {
    api: {} as Record<string, { response: any }>,
    env: { ...env },
    previous_step: context.previous_step_responses || {}
  };
  
  if (!step.use_endpoints || !db || !context.step_run_id) {
    return { api_calls: apiCalls, variables };
  }
  
  try {
    const useEndpoints = JSON.parse(step.use_endpoints);
    
    if (!Array.isArray(useEndpoints)) {
      console.error('[executeUnifiedOutputs] use_endpoints must be a JSON array');
      return { api_calls: apiCalls, variables };
    }
    
    // Normalize endpoints to object format with phase property
    const normalizedEndpoints = useEndpoints.map((ep: any) => {
      if (typeof ep === 'string') {
        // String format: assume it's a command endpoint
        return { endpoint_id: ep, endpoint_name: ep, phase: 'command' };
      } else if (typeof ep === 'object' && ep !== null) {
        // Object format: ensure it has required properties
        return {
          endpoint_id: ep.endpoint_id || ep.endpoint_name || ep.name || ep.id,
          endpoint_name: ep.endpoint_name || ep.name || ep.endpoint_id || ep.id,
          phase: ep.phase || 'command', // Default to command if not specified
          save_to_db: ep.save_to_db !== false, // Default to true
          validation_schema: ep.validation_schema
        };
      }
      return ep;
    });
    
    // Get output phase endpoints
    const outputEndpoints = normalizedEndpoints.filter((ep: any) => ep.phase === 'output');
    
    // Parse AI response for output data (nested JSON, key/value, arrays)
    const outputData = parseAIResponseForOutput(aiResponse);
    
    // Execute each output endpoint
    for (const endpointConfig of outputEndpoints) {
      try {
        // Get endpoint details from registry
        const endpointSql = `
          SELECT id, name, url, method, auth_type, auth_value,
                 headers, body_template, query_params, response_path,
                 timeout_ms, max_retries, retry_delay_ms,
                 parameter_schema, sample_response, save_to_db
          FROM endpoint_registry
          WHERE id = ? OR name = ?
        `;
        
        const endpoint = await db.prepare(endpointSql)
          .bind(endpointConfig.endpoint_id, endpointConfig.endpoint_name)
          .first();
        
        if (!endpoint) {
          console.error(`[executeUnifiedOutputs] Endpoint not found: ${endpointConfig.endpoint_id}`);
          continue;
        }
        
        // Validate output data against schema if provided
        if (endpoint.validation_schema && endpointConfig.validation_schema) {
          const validationResult = validateOutputData(outputData, endpoint.validation_schema);
          if (!validationResult.valid) {
            console.error(`[executeUnifiedOutputs] Output validation failed for ${endpoint.name}:`, validationResult.errors);
            continue;
          }
        }
        
        // Build request with output data
        const request = await buildOutputRequest(endpoint, outputData);
        
        // Execute request
        const response = await executeEndpointRequest(request, endpoint);
        
        // Create API call record
        const apiCall = {
          endpoint_id: endpointConfig.endpoint_id,
          endpoint_name: endpoint.name,
          phase: 'output',
          request,
          response,
          timestamp: new Date().toISOString()
        };
        
        apiCalls.push(apiCall);
        
        // Add to variables.api for {variable} substitution
        variables.api[endpointConfig.endpoint_id] = { response: response.data };
        
        // Save to step_runs.api_calls via saveApiCall if endpoint.save_to_db is true
        if (endpoint.save_to_db !== false && endpointConfig.save_to_db !== false) {
          const { saveApiCall, generateId } = await import('./database');
          await saveApiCall(db, {
            id: generateId(),
            flow_id: context.flow_id,
            step_id: context.step_id,
            step_run_id: context.step_run_id,
            endpoint_id: endpointConfig.endpoint_id,
            endpoint_name: endpoint.name,
            method: endpoint.method,
            request: request,
            response: response.data,
            phase: 'output',
            timestamp: apiCall.timestamp
          });
        }
        
      } catch (error) {
        console.error(`[executeUnifiedOutputs] Error executing output endpoint ${endpointConfig.endpoint_id}:`, error);
      }
    }
    
    return { api_calls: apiCalls, variables };
    
  } catch (error) {
    console.error('[executeUnifiedOutputs] Error parsing use_endpoints:', error);
    return { api_calls: apiCalls, variables };
  }
}

// Helper to parse AI response for output data
function parseAIResponseForOutput(aiResponse: string): any {
  // Try to extract JSON from the response
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // If JSON parsing fails, fall back to key-value parsing
    }
  }
  
  // Fall back to key-value parsing
  const result: Record<string, any> = {};
  const lines = aiResponse.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      
      // Try to parse JSON values
      try {
        if (value.startsWith('{') || value.startsWith('[')) {
          value = JSON.parse(value);
        } else if (value === 'true' || value === 'false') {
          value = value === 'true';
        } else if (!isNaN(Number(value)) && value !== '') {
          value = Number(value);
        }
      } catch (e) {
        // Keep as string if parsing fails
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

// Helper to validate output data against schema
function validateOutputData(data: any, schema: string): { valid: boolean; errors: string[] } {
  try {
    const schemaObj = JSON.parse(schema);
    const errors: string[] = [];
    
    // Simple validation - check required fields
    if (schemaObj.required && Array.isArray(schemaObj.required)) {
      for (const field of schemaObj.required) {
        if (data[field] === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    // Type validation if schema has properties
    if (schemaObj.properties && typeof schemaObj.properties === 'object') {
      for (const [field, fieldSchema] of Object.entries(schemaObj.properties)) {
        if (data[field] !== undefined) {
          const fieldSchemaObj = fieldSchema as any;
          if (fieldSchemaObj.type) {
            const expectedType = fieldSchemaObj.type;
            const actualType = typeof data[field];
            
            if (expectedType === 'number' && isNaN(Number(data[field]))) {
              errors.push(`Field ${field} should be a number, got: ${actualType}`);
            } else if (expectedType === 'boolean' && typeof data[field] !== 'boolean') {
              errors.push(`Field ${field} should be a boolean, got: ${actualType}`);
            } else if (expectedType === 'string' && typeof data[field] !== 'string') {
              errors.push(`Field ${field} should be a string, got: ${actualType}`);
            } else if (expectedType === 'object' && (typeof data[field] !== 'object' || data[field] === null)) {
              errors.push(`Field ${field} should be an object, got: ${actualType}`);
            } else if (expectedType === 'array' && !Array.isArray(data[field])) {
              errors.push(`Field ${field} should be an array, got: ${actualType}`);
            }
          }
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  } catch (e) {
    return { valid: false, errors: [`Invalid schema: ${e}`] };
  }
}

// Helper to build output request
async function buildOutputRequest(endpoint: any, outputData: any): Promise<any> {
  let url = endpoint.url;
  let body = endpoint.body_template ? JSON.parse(endpoint.body_template) : null;
  const headers = endpoint.headers ? JSON.parse(endpoint.headers) : {};
  const queryParams = endpoint.query_params ? JSON.parse(endpoint.query_params) : null;
  
  // Apply output data to URL, body, and query params
  if (outputData && typeof outputData === 'object') {
    for (const [key, value] of Object.entries(outputData)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const stringValue = String(value);
        
        // Replace in URL
        url = url.replace(`{${key}}`, encodeURIComponent(stringValue));
        
        // Replace in body
        if (body && typeof body === 'string') {
          body = body.replace(`{${key}}`, stringValue);
        } else if (body && typeof body === 'object') {
          // Deep replace in object
          body = JSON.parse(JSON.stringify(body).replace(new RegExp(`\\{${key}\\}`, 'g'), stringValue));
        }
        
        // Replace in query params
        if (queryParams && typeof queryParams === 'object') {
          for (const [qpKey, qpValue] of Object.entries(queryParams)) {
            if (typeof qpValue === 'string' && qpValue.includes(`{${key}}`)) {
              queryParams[qpKey] = qpValue.replace(`{${key}}`, stringValue);
            }
          }
        }
      }
    }
  }
  
  return {
    url,
    method: endpoint.method,
    headers,
    body,
    query_params: queryParams
  };
}

// Helper to build command request
async function buildCommandRequest(
  endpoint: any,
  params: Record<string, any>
): Promise<any> {
  let url = endpoint.url;
  let body = endpoint.body_template ? JSON.parse(endpoint.body_template) : null;
  const headers = endpoint.headers ? JSON.parse(endpoint.headers) : {};
  const queryParams = endpoint.query_params ? JSON.parse(endpoint.query_params) : null;
  
  // Apply parameters to URL, body, and query params
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const stringValue = String(value);
        
        // Replace in URL
        url = url.replace(`{${key}}`, encodeURIComponent(stringValue));
        
        // Replace in body
        if (body && typeof body === 'string') {
          body = body.replace(`{${key}}`, stringValue);
        } else if (body && typeof body === 'object') {
          // Deep replace in object
          body = JSON.parse(JSON.stringify(body).replace(new RegExp(`\\{${key}\\}`, 'g'), stringValue));
        }
        
        // Replace in query params
        if (queryParams && typeof queryParams === 'object') {
          for (const [qpKey, qpValue] of Object.entries(queryParams)) {
            if (typeof qpValue === 'string' && qpValue.includes(`{${key}}`)) {
              queryParams[qpKey] = qpValue.replace(`{${key}}`, stringValue);
            }
          }
        }
      }
    }
  }
  
  return {
    url,
    method: endpoint.method,
    headers,
    body,
    query_params: queryParams
  };
}

// Helper to build endpoint request with variable substitution
async function buildEndpointRequest(
  endpoint: any,
  endpointConfig: any,
  variables: Record<string, any>,
  env: Record<string, string>
): Promise<any> {
  let url = endpoint.url;
  let body = endpoint.body_template ? JSON.parse(endpoint.body_template) : null;
  const headers = endpoint.headers ? JSON.parse(endpoint.headers) : {};
  const queryParams = endpoint.query_params ? JSON.parse(endpoint.query_params) : null;
  
  // Apply variable mapping from endpoint config
  if (endpointConfig.map) {
    for (const [key, value] of Object.entries(endpointConfig.map)) {
      if (typeof value === 'string') {
        // Resolve variable references
        const resolvedValue = resolveVariableReference(value, variables, env);
        if (resolvedValue !== undefined) {
          // Replace in URL
          url = url.replace(`{${key}}`, encodeURIComponent(resolvedValue));
          
          // Replace in body if it's a string
          if (body && typeof body === 'string') {
            body = body.replace(`{${key}}`, resolvedValue);
          } else if (body && typeof body === 'object') {
            // Deep replace in object
            body = JSON.parse(JSON.stringify(body).replace(new RegExp(`\\{${key}\\}`, 'g'), resolvedValue));
          }
        }
      }
    }
  }
  
  return {
    url,
    method: endpoint.method,
    headers,
    body,
    query_params: queryParams
  };
}

// Helper to resolve variable references
function resolveVariableReference(
  value: string,
  variables: Record<string, any>,
  env: Record<string, string>
): string | undefined {
  if (value.startsWith('{') && value.endsWith('}')) {
    const path = value.slice(1, -1);
    
    // Check for query syntax: {query:type=api&endpoint=test_endpoint_123&path=response.id}
    if (path.startsWith('query:')) {
      // Parse query parameters
      const queryPart = path.substring(6); // Remove 'query:'
      const params = new URLSearchParams(queryPart);
      const type = params.get('type');
      
      if (type === 'api') {
        const endpoint = params.get('endpoint');
        const path = params.get('path');
        
        if (endpoint && variables.api && variables.api[endpoint]) {
          let current: any = variables.api[endpoint];
          if (current && current.response && path) {
            // Navigate the path (e.g., "response.id")
            const pathParts = path.split('.');
            for (const part of pathParts) {
              if (current && typeof current === 'object' && part in current) {
                current = current[part];
              } else {
                return undefined;
              }
            }
            return typeof current === 'string' || typeof current === 'number' ? String(current) : JSON.stringify(current);
          }
        }
        return undefined;
      }
      // Add other query types here if needed
    }
    
    const parts = path.split('.');
    
    if (parts[0] === 'api' && parts.length >= 3) {
      // {api.<endpoint_name>.response.<key>} - legacy syntax
      let current: any = variables.api;
      for (let i = 1; i < parts.length; i++) {
        if (current && typeof current === 'object' && parts[i] in current) {
          current = current[parts[i]];
        } else {
          return undefined;
        }
      }
      return typeof current === 'string' || typeof current === 'number' ? String(current) : JSON.stringify(current);
    } else if (parts[0] === 'env' && parts.length === 2) {
      // {env.<key>}
      return env[parts[1]];
    } else if (parts[0] === 'previous_step' && parts.length === 2) {
      // {previous_step.<key>}
      return variables.previous_step[parts[1]];
    }
  }
  
  return value;
}

// Helper to execute endpoint request
async function executeEndpointRequest(request: any, endpoint: any): Promise<any> {
  // STRICT EXECUTION: Make actual HTTP requests, NO mock responses
  console.log(`[STRICT] Executing endpoint: ${endpoint.name}`, {
    method: endpoint.method,
    endpoint: endpoint.endpoint,
    request
  });

  try {
    // Build URL with path parameters
    let url = endpoint.endpoint;
    
    // Replace path parameters (e.g., /api/users/:id)
    if (request.path_params) {
      Object.entries(request.path_params).forEach(([key, value]) => {
        url = url.replace(`:${key}`, encodeURIComponent(String(value)));
      });
    }
    
    // Add query parameters
    if (request.query_params) {
      const queryParams = new URLSearchParams();
      Object.entries(request.query_params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    
    // Prepare request options
    const options: RequestInit = {
      method: endpoint.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers || {})
      }
    };
    
    // Add body for POST/PUT/PATCH requests
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(endpoint.method?.toUpperCase() || '')) {
      options.body = JSON.stringify(request.body);
    }
    
    // Make the actual HTTP request
    console.log(`[STRICT] Making HTTP request: ${endpoint.method} ${url}`);
    const response = await fetch(url, options);
    
    // Parse response
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error(`[STRICT] Failed to parse JSON response for ${endpoint.name}:`, responseText);
      responseData = { raw_response: responseText };
    }
    
    // Return structured response
    return {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error(`[STRICT] Error executing endpoint ${endpoint.name}:`, error);
    
    // Return structured error (NO silent handling)
    return {
      status: 500,
      statusText: 'Internal Error',
      data: {
        error: 'Endpoint execution failed',
        message: error.message,
        endpoint: endpoint.name,
        timestamp: new Date().toISOString()
      },
      headers: {},
      timestamp: new Date().toISOString()
    };
  }
}

// Helper to inject API response data into instructions
export function injectApiResponses(
  instructions: string,
  apiCalls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
  }>,
  variables: Record<string, any>
): string {
  let result = instructions;
  
  // STEP 6: Clean response injection - inject structured variables only
  // Inject api variables
  if (variables.api) {
    for (const [endpointName, endpointData] of Object.entries(variables.api)) {
      if (endpointData && typeof endpointData === 'object' && endpointData.response) {
        // Inject {api.<endpoint_name>.response.<key>} placeholders
        const response = endpointData.response;
        if (typeof response === 'object') {
          for (const [key, value] of Object.entries(response)) {
            const placeholder = `{api.${endpointName}.response.${key}}`;
            if (result.includes(placeholder)) {
              result = result.replace(new RegExp(placeholder, 'g'), 
                typeof value === 'string' ? value : JSON.stringify(value));
            }
          }
        }
        
        // Also inject {api.<endpoint_name>.response} for the whole response
        const fullResponsePlaceholder = `{api.${endpointName}.response}`;
        if (result.includes(fullResponsePlaceholder)) {
          result = result.replace(new RegExp(fullResponsePlaceholder, 'g'), 
            JSON.stringify(response, null, 2));
        }
      }
    }
  }
  
  // Inject env variables
  if (variables.env) {
    for (const [key, value] of Object.entries(variables.env)) {
      const placeholder = `{env.${key}}`;
      if (result.includes(placeholder)) {
        result = result.replace(new RegExp(placeholder, 'g'), 
          typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  }
  
  // Inject previous_step variables
  if (variables.previous_step) {
    for (const [key, value] of Object.entries(variables.previous_step)) {
      const placeholder = `{previous_step.${key}}`;
      if (result.includes(placeholder)) {
        result = result.replace(new RegExp(placeholder, 'g'), 
          typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  }
  
  // Inject last_api_response if we have api calls
  if (apiCalls.length > 0) {
    const lastCall = apiCalls[apiCalls.length - 1];
    const placeholder = `{last_api_response}`;
    if (result.includes(placeholder)) {
      result = result.replace(new RegExp(placeholder, 'g'), 
        JSON.stringify(lastCall.response.data, null, 2));
    }
  }
  
  return result;
}

// Helper to inject input values into instructions
export function injectInputValues(
  instructions: string,
  inputs: Record<string, any>
): string {
  let result = instructions;
  
  // Inject [input:name] placeholders (legacy support)
  const inputRegex = /\[input:([^\]]+)\]/g;
  const matches = [...result.matchAll(inputRegex)];
  
  console.log(`[StepResolver:injectInputValues] Found ${matches.length} [input:name] placeholders: ${matches.map(m => m[1]).join(', ')}`);
  console.log(`[StepResolver:injectInputValues] Available inputs: ${Object.keys(inputs).join(', ')}`);
  
  for (const match of matches) {
    const fullMatch = match[0];
    const inputName = match[1];
    
    if (inputs[inputName] !== undefined) {
      const value = inputs[inputName];
      result = result.replace(new RegExp(fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
        typeof value === 'string' ? value : JSON.stringify(value));
      console.log(`[StepResolver:injectInputValues] Replaced ${fullMatch} with value`);
    } else {
      console.log(`[StepResolver:injectInputValues] WARNING: Input ${inputName} not found in available inputs`);
    }
  }
  
  return result;
}

// Helper to substitute {variable} placeholders in instructions
export function substituteVariables(
  instructions: string,
  variables: Record<string, any>,
  source: string = 'unknown'
): string {
  let result = instructions;
  
  // Find all {variable} placeholders
  const variableRegex = /\{([^}]+)\}/g;
  const matches = [...result.matchAll(variableRegex)];
  
  console.log(`[StepResolver:substituteVariables] Source: ${source}`);
  console.log(`[StepResolver:substituteVariables] Found ${matches.length} {variable} placeholders: ${matches.map(m => m[1]).join(', ')}`);
  console.log(`[StepResolver:substituteVariables] Available variables: ${Object.keys(variables).join(', ')}`);
  
  // DEBUG: Log ALL_VARIABLES with full structure
  console.log(`[StepResolver:substituteVariables] ALL_VARIABLES FULL OBJECT:`, JSON.stringify(variables, null, 2));
  
  // Create a SecureVariableResolver for proper substitution
  const resolver = new SecureVariableResolver({});
  
  try {
    // Use safeSubstitute for proper variable replacement
    result = resolver.safeSubstitute(instructions, variables);
    console.log(`[StepResolver:substituteVariables] Substitution completed successfully`);
    
    // Check for any remaining placeholders
    const remainingMatches = [...result.matchAll(variableRegex)];
    if (remainingMatches.length > 0) {
      console.log(`[StepResolver:substituteVariables] WARNING: ${remainingMatches.length} unresolved placeholders remain: ${remainingMatches.map(m => m[1]).join(', ')}`);
    }
    
  } catch (error) {
    console.error(`[StepResolver:substituteVariables] Error during variable substitution:`, error);
    // Fall back to manual replacement
    for (const match of matches) {
      const fullMatch = match[0];
      const varName = match[1];
      
      if (variables[varName] !== undefined) {
        const value = variables[varName];
        result = result.replace(new RegExp(fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
          typeof value === 'string' ? value : JSON.stringify(value));
        console.log(`[StepResolver:substituteVariables] Manually replaced ${fullMatch}`);
      } else {
        console.log(`[StepResolver:substituteVariables] WARNING: Variable ${varName} not found`);
      }
    }
  }
  
  return result;
}