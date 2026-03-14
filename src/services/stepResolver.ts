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
  
  // New system: input_keys for dynamic API data fetching
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
          task_data: taskData
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