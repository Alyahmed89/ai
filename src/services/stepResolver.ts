// Step Resolver for Dynamic API Data Fetching
// ============================================================================

import { SecureVariableResolver } from './secureVariableResolver';
import { getTaskData } from './database';
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
      
      // Inject API responses into instructions
      instructions = injectApiResponses(instructions, unifiedResult.api_calls, unifiedResult.variables);
      
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
      
      // We need to modify SecureVariableResolver to accept initial variables
      // For now, we'll use a workaround by injecting task data into the instructions
      let instructionsWithTaskData = step.instructions || step.description || step.title || '';
      
      if (taskData) {
        instructionsWithTaskData = injectTaskData(instructionsWithTaskData, taskData, step.task_id);
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

// Unified endpoint execution for use_endpoints field
export async function executeUnifiedEndpoints(
  step: StepData,
  db: D1Database | null,
  env: Record<string, string>,
  context: {
    flow_id?: string;
    execution_id?: string;
    step_id?: string;
    previous_step_responses?: Record<string, any>;
    api_calls?: Array<{
      endpoint_id: string;
      endpoint_name: string;
      phase: string;
      request: any;
      response: any;
    }>;
  }
): Promise<{
  api_calls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
  }>;
  variables: Record<string, any>;
}> {
  const apiCalls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
  }> = context.api_calls || [];
  
  // STEP 2: Normalize variable format
  const variables: Record<string, any> = {
    api: {},
    env: env,
    previous_step: context.previous_step_responses || {}
  };
  
  if (!step.use_endpoints || !db) {
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
          phase: ep.phase || 'command' // Default to command if not specified
        };
      }
      return ep;
    });
    
    // Group endpoints by phase
    const inputEndpoints = normalizedEndpoints.filter((ep: any) => ep.phase === 'input');
    const commandEndpoints = normalizedEndpoints.filter((ep: any) => ep.phase === 'command');
    const outputEndpoints = normalizedEndpoints.filter((ep: any) => ep.phase === 'output');
    
    // Execute input phase endpoints
    for (const endpointConfig of inputEndpoints) {
      try {
        // Get endpoint details from registry
        const endpointSql = `
          SELECT id, name, url, method, auth_type, auth_value,
                 headers, body_template, query_params, response_path,
                 timeout_ms, max_retries, retry_delay_ms,
                 parameter_schema, sample_response
          FROM endpoint_registry
          WHERE id = ?
        `;
        
        const endpoint = await db.prepare(endpointSql).bind(endpointConfig.endpoint_id).first();
        
        if (!endpoint) {
          console.error(`[executeUnifiedEndpoints] Endpoint not found: ${endpointConfig.endpoint_id}`);
          continue;
        }
        
        // Build request with variable substitution
        const request = await buildEndpointRequest(endpoint, endpointConfig, variables, env);
        
        // Execute request
        const response = await executeEndpointRequest(request, endpoint);
        
        // STEP 3: Standardize API call storage
        const apiCall = {
          endpoint_id: endpointConfig.endpoint_id,
          endpoint_name: endpoint.name,
          phase: 'input',
          request,
          response
        };
        
        apiCalls.push(apiCall);
        
        // STEP 2: Store response in normalized format
        if (!variables.api[endpoint.name]) {
          variables.api[endpoint.name] = {};
        }
        variables.api[endpoint.name].response = response.data;
        
      } catch (error) {
        console.error(`[executeUnifiedEndpoints] Error executing input endpoint ${endpointConfig.endpoint_id}:`, error);
      }
    }
    
    // Execute command phase endpoints (will be handled by AI command parsing)
    // This is a placeholder for STEP 4 implementation
    // Command execution happens after AI response parsing
    
    return { api_calls: apiCalls, variables };
    
  } catch (error) {
    console.error('[executeUnifiedEndpoints] Error parsing use_endpoints:', error);
    return { api_calls: apiCalls, variables };
  }
}

// STEP 4: Unified command execution
export async function executeUnifiedCommands(
  step: StepData,
  db: D1Database | null,
  env: Record<string, string>,
  aiResponse: string,
  context: {
    flow_id?: string;
    execution_id?: string;
    step_id?: string;
    previous_step_responses?: Record<string, any>;
    api_calls?: Array<{
      endpoint_id: string;
      endpoint_name: string;
      phase: string;
      request: any;
      response: any;
    }>;
  }
): Promise<{
  api_calls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
  }>;
  command_results: Array<{
    command_name: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
}> {
  const apiCalls: Array<{
    endpoint_id: string;
    endpoint_name: string;
    phase: string;
    request: any;
    response: any;
  }> = context.api_calls || [];
  
  const commandResults: Array<{
    command_name: string;
    success: boolean;
    data?: any;
    error?: string;
  }> = [];
  
  if (!step.use_endpoints || !db) {
    return { api_calls: apiCalls, command_results: commandResults };
  }
  
  try {
    const useEndpoints = JSON.parse(step.use_endpoints);
    
    if (!Array.isArray(useEndpoints)) {
      console.error('[executeUnifiedCommands] use_endpoints must be a JSON array');
      return { api_calls: apiCalls, command_results: commandResults };
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
          phase: ep.phase || 'command' // Default to command if not specified
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
                 parameter_schema, sample_response
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
        
        // Build request with command parameters
        const request = await buildCommandRequest(endpoint, command.params);
        
        // Execute command
        const response = await executeEndpointRequest(request, endpoint);
        
        // Store API call
        const apiCall = {
          endpoint_id: endpoint.id,
          endpoint_name: endpoint.name,
          phase: 'command',
          request,
          response
        };
        
        apiCalls.push(apiCall);
        
        // Store command result
        commandResults.push({
          command_name: command.name,
          success: response.status >= 200 && response.status < 300,
          data: response.data,
          error: response.status >= 400 ? `HTTP ${response.status}` : undefined
        });
        
      } catch (error: any) {
        console.error(`[executeUnifiedCommands] Error executing command ${command.name}:`, error);
        commandResults.push({
          command_name: command.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return { api_calls: apiCalls, command_results: commandResults };
    
  } catch (error) {
    console.error('[executeUnifiedCommands] Error:', error);
    return { api_calls: apiCalls, command_results: commandResults };
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
    const parts = path.split('.');
    
    if (parts[0] === 'api' && parts.length >= 3) {
      // {api.<endpoint_name>.response.<key>}
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
  // For now, use mock response for testing
  // In production, this would make actual HTTP requests
  if (endpoint.sample_response) {
    try {
      const sampleData = JSON.parse(endpoint.sample_response);
      return {
        status: 200,
        data: sampleData
      };
    } catch (error) {
      console.error(`[executeEndpointRequest] Error parsing sample_response for ${endpoint.name}:`, error);
    }
  }
  
  // Default mock response
  return {
    status: 200,
    data: {
      id: 1,
      name: endpoint.name,
      message: "Mock response for testing"
    }
  };
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