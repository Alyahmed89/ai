// Strict Command Execution Service
// NO fallbacks, NO silent handling, NO retries
// Every failure must be exposed clearly in status

import { CommandData } from '../types';

export interface StrictCommandExecutionResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details: any;
  };
  commandName: string;
  executionTime: number;
  meta: {
    step?: string;
    attempt: number;
    validation_passed: boolean;
    execution_attempted: boolean;
  };
}

export interface StrictCommandRegistryEntry {
  name: string;
  description: string;
  method: string;
  endpoint: string;
  parameters?: Record<string, {
    type: string;
    required: boolean;
    description?: string;
    pattern?: string; // regex pattern for validation
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    enum?: string[]; // allowed values
  }>;
  tags: string[];
}

export interface StrictCommandExecutorOptions {
  env: any;
  db: any;
  timeoutMs?: number;
  baseUrl?: string;
}

export interface ExecutionState {
  current_step?: string;
  completed_steps: string[];
  failed_step?: {
    step: string;
    error: any;
    timestamp: number;
  };
  logs: Array<{
    timestamp: number;
    step: string;
    endpoint?: string;
    params_sent: any;
    validation_result: any;
    execution_result: any;
    error?: any;
  }>;
}

/**
 * Strict Command Executor - Debug Engine, NOT a smart assistant
 * 
 * RULES:
 * 1. NO hardcoding endpoints
 * 2. NO fallback logic
 * 3. NO skipping failures
 * 4. NO retries (max attempts = 1)
 * 5. ALWAYS expose exact failure details
 */
export class StrictCommandExecutor {
  private env: any;
  private db: any;
  private timeoutMs: number;
  private baseUrl: string;
  private executionState: ExecutionState;

  constructor(options: StrictCommandExecutorOptions) {
    this.env = options.env;
    this.db = options.db;
    this.timeoutMs = options.timeoutMs || 10000;
    this.baseUrl = options.baseUrl || 'https://deepseek-agent.alghamdimo89.workers.dev';
    this.executionState = {
      completed_steps: [],
      logs: []
    };
  }

  /**
   * Get command details from registry
   */
  async getCommandFromRegistry(name: string): Promise<StrictCommandRegistryEntry | null> {
    try {
      const query = `
        SELECT 
          name,
          description,
          method,
          url as endpoint,
          parameters,
          tags
        FROM endpoint_registry 
        WHERE name = ?
      `;

      const result = await this.db.prepare(query).bind(name).first();
      
      if (!result) {
        this.log(`Command not found in registry: ${name}`, { command: name });
        return null;
      }

      return {
        name: result.name,
        description: result.description,
        method: result.method,
        endpoint: result.endpoint,
        parameters: result.parameters ? JSON.parse(result.parameters) : undefined,
        tags: result.tags ? JSON.parse(result.tags) : []
      };
    } catch (error: any) {
      this.log(`Error fetching command ${name}`, { command: name, error: error.message });
      return null;
    }
  }

  /**
   * Execute a command with strict validation and NO fallbacks
   */
  async executeCommand(
    commandData: CommandData, 
    step?: string
  ): Promise<StrictCommandExecutionResult> {
    const startTime = Date.now();
    const attempt = 1; // MAX ATTEMPTS = 1 (NO RETRIES)
    
    try {
      this.log(`Starting command execution: ${commandData.name}`, { 
        step, 
        command: commandData.name, 
        params: commandData.params 
      });

      // 1. Get command details from registry
      const command = await this.getCommandFromRegistry(commandData.name);
      if (!command) {
        return this.createFailureResult(
          commandData.name,
          startTime,
          {
            code: 'COMMAND_NOT_FOUND',
            message: `Command not found in registry: ${commandData.name}`,
            details: { registry_query_failed: false }
          },
          { step, attempt, validation_passed: false, execution_attempted: false }
        );
      }

      // 2. Parameter Standardization and Validation
      const validationResult = this.validateParameters(commandData.params, command.parameters);
      if (!validationResult.valid) {
        return this.createFailureResult(
          commandData.name,
          startTime,
          {
            code: 'VALIDATION_ERROR',
            message: 'Missing or invalid parameters',
            details: validationResult.errors
          },
          { step, attempt, validation_passed: false, execution_attempted: false }
        );
      }

      // 3. Pre-Execution Validation Layer
      const preExecutionValidation = this.preExecutionValidation(commandData.params, command);
      if (!preExecutionValidation.valid) {
        return this.createFailureResult(
          commandData.name,
          startTime,
          {
            code: 'PRE_EXECUTION_VALIDATION_ERROR',
            message: 'Pre-execution validation failed',
            details: preExecutionValidation.errors
          },
          { step, attempt, validation_passed: false, execution_attempted: false }
        );
      }

      // 4. Strict Execution Wrapper (NO RETRIES, NO FALLBACKS)
      const executionResult = await this.executeStrictHttpCommand(
        command, 
        commandData.params, 
        step
      );

      if (!executionResult.success) {
        return this.createFailureResult(
          commandData.name,
          startTime,
          {
            code: 'REQUEST_FAILED',
            message: 'Endpoint request failed',
            details: executionResult.errorDetails
          },
          { step, attempt, validation_passed: true, execution_attempted: true }
        );
      }

      // 5. Success - return result
      return {
        success: true,
        data: executionResult.data,
        commandName: commandData.name,
        executionTime: Date.now() - startTime,
        meta: { step, attempt, validation_passed: true, execution_attempted: true }
      };

    } catch (error: any) {
      // This should only catch unexpected errors in the executor itself
      return this.createFailureResult(
        commandData.name,
        startTime,
        {
          code: 'EXECUTOR_ERROR',
          message: 'Unexpected error in command executor',
          details: {
            error: error.message,
            stack: error.stack
          }
        },
        { step, attempt, validation_passed: false, execution_attempted: false }
      );
    }
  }

  /**
   * Create a failure result with consistent structure
   */
  private createFailureResult(
    commandName: string,
    startTime: number,
    error: { code: string; message: string; details: any },
    meta: { step?: string; attempt: number; validation_passed: boolean; execution_attempted: boolean }
  ): StrictCommandExecutionResult {
    return {
      success: false,
      error,
      commandName,
      executionTime: Date.now() - startTime,
      meta
    };
  }

  /**
   * Log execution details
   */
  private log(message: string, details: any): void {
    const logEntry = {
      timestamp: Date.now(),
      message,
      details
    };
    
    this.executionState.logs.push({
      timestamp: Date.now(),
      step: details.step || 'unknown',
      endpoint: details.endpoint,
      params_sent: details.params,
      validation_result: details.validation_result,
      execution_result: details.execution_result,
      error: details.error
    });
    
    console.log(`[STRICT_EXECUTOR] ${message}`, details);
  }

  /**
   * Parameter Standardization and Validation
   */
  private validateParameters(
    providedParams: Record<string, any> | undefined,
    schema: Record<string, any> | undefined
  ): { valid: boolean; errors: any[] } {
    const errors: any[] = [];

    if (!schema || !providedParams) {
      // No schema or no params - validation passes
      return { valid: true, errors: [] };
    }

    // Check required fields
    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      if (fieldSchema.required && !(fieldName in providedParams)) {
        errors.push({
          field: fieldName,
          error: 'REQUIRED_FIELD_MISSING',
          message: `Required parameter '${fieldName}' is missing`
        });
      }
    }

    // Type and format validation
    for (const [fieldName, value] of Object.entries(providedParams)) {
      if (schema[fieldName]) {
        const fieldSchema = schema[fieldName];
        
        // Type validation
        if (fieldSchema.type) {
          const expectedType = fieldSchema.type;
          const actualType = typeof value;
          
          if (expectedType === 'string' && actualType !== 'string') {
            errors.push({
              field: fieldName,
              error: 'TYPE_MISMATCH',
              message: `Parameter '${fieldName}' should be type '${expectedType}', got '${actualType}'`,
              expected: expectedType,
              actual: actualType
            });
          } else if (expectedType === 'number' && actualType !== 'number') {
            errors.push({
              field: fieldName,
              error: 'TYPE_MISMATCH',
              message: `Parameter '${fieldName}' should be type '${expectedType}', got '${actualType}'`,
              expected: expectedType,
              actual: actualType
            });
          } else if (expectedType === 'boolean' && actualType !== 'boolean') {
            errors.push({
              field: fieldName,
              error: 'TYPE_MISMATCH',
              message: `Parameter '${fieldName}' should be type '${expectedType}', got '${actualType}'`,
              expected: expectedType,
              actual: actualType
            });
          } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
            errors.push({
              field: fieldName,
              error: 'TYPE_MISMATCH',
              message: `Parameter '${fieldName}' should be type '${expectedType}', got '${actualType}'`,
              expected: expectedType,
              actual: actualType
            });
          } else if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push({
              field: fieldName,
              error: 'TYPE_MISMATCH',
              message: `Parameter '${fieldName}' should be type '${expectedType}', got '${actualType}'`,
              expected: expectedType,
              actual: actualType
            });
          }
        }

        // Pattern validation (regex)
        if (fieldSchema.pattern && typeof value === 'string') {
          const regex = new RegExp(fieldSchema.pattern);
          if (!regex.test(value)) {
            errors.push({
              field: fieldName,
              error: 'PATTERN_MISMATCH',
              message: `Parameter '${fieldName}' does not match required pattern`,
              pattern: fieldSchema.pattern,
              value: value
            });
          }
        }

        // Length validation for strings
        if (fieldSchema.minLength !== undefined && typeof value === 'string' && value.length < fieldSchema.minLength) {
          errors.push({
            field: fieldName,
            error: 'MIN_LENGTH_VIOLATION',
            message: `Parameter '${fieldName}' must be at least ${fieldSchema.minLength} characters`,
            minLength: fieldSchema.minLength,
            actualLength: value.length
          });
        }

        if (fieldSchema.maxLength !== undefined && typeof value === 'string' && value.length > fieldSchema.maxLength) {
          errors.push({
            field: fieldName,
            error: 'MAX_LENGTH_VIOLATION',
            message: `Parameter '${fieldName}' must be at most ${fieldSchema.maxLength} characters`,
            maxLength: fieldSchema.maxLength,
            actualLength: value.length
          });
        }

        // Range validation for numbers
        if (fieldSchema.min !== undefined && typeof value === 'number' && value < fieldSchema.min) {
          errors.push({
            field: fieldName,
            error: 'MIN_VALUE_VIOLATION',
            message: `Parameter '${fieldName}' must be at least ${fieldSchema.min}`,
            min: fieldSchema.min,
            actual: value
          });
        }

        if (fieldSchema.max !== undefined && typeof value === 'number' && value > fieldSchema.max) {
          errors.push({
            field: fieldName,
            error: 'MAX_VALUE_VIOLATION',
            message: `Parameter '${fieldName}' must be at most ${fieldSchema.max}`,
            max: fieldSchema.max,
            actual: value
          });
        }

        // Enum validation
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          errors.push({
            field: fieldName,
            error: 'ENUM_VIOLATION',
            message: `Parameter '${fieldName}' must be one of: ${fieldSchema.enum.join(', ')}`,
            allowedValues: fieldSchema.enum,
            actualValue: value
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Pre-Execution Validation Layer
   * Validates IDs, conversation safety, etc.
   */
  private preExecutionValidation(
    params: Record<string, any> | undefined,
    command: StrictCommandRegistryEntry
  ): { valid: boolean; errors: any[] } {
    const errors: any[] = [];

    if (!params) {
      return { valid: true, errors: [] };
    }

    // Conversation safety: validate conversation_id format if present
    if ('conversation_id' in params) {
      const conversationId = params.conversation_id;
      if (typeof conversationId !== 'string' || conversationId.length < 10) {
        errors.push({
          field: 'conversation_id',
          error: 'INVALID_CONVERSATION_ID',
          message: 'Conversation ID must be a valid string with minimum length 10',
          value: conversationId
        });
      }
    }

    // Flow ID validation if present
    if ('flow_id' in params) {
      const flowId = params.flow_id;
      if (typeof flowId !== 'string' || flowId.length < 1) {
        errors.push({
          field: 'flow_id',
          error: 'INVALID_FLOW_ID',
          message: 'Flow ID must be a non-empty string',
          value: flowId
        });
      }
    }

    // Task ID validation if present
    if ('task_id' in params) {
      const taskId = params.task_id;
      if (typeof taskId !== 'string' || taskId.length < 1) {
        errors.push({
          field: 'task_id',
          error: 'INVALID_TASK_ID',
          message: 'Task ID must be a non-empty string',
          value: taskId
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Strict HTTP Command Execution (NO RETRIES, NO FALLBACKS)
   */
  private async executeStrictHttpCommand(
    command: StrictCommandRegistryEntry,
    params: Record<string, any> | undefined,
    step?: string
  ): Promise<{ success: boolean; data?: any; errorDetails?: any }> {
    const endpointPath = this.buildCommandUrl(command.endpoint, params);
    const url = `${this.baseUrl}${endpointPath}`;
    
    const options: RequestInit = {
      method: command.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(command.method.toUpperCase())) {
      options.body = JSON.stringify(params || {});
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      this.log(`Executing HTTP request: ${command.method} ${url}`, {
        step,
        endpoint: command.endpoint,
        method: command.method,
        params
      });

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Capture FULL error details
      if (!response.ok) {
        let responseBody = '';
        try {
          responseBody = await response.text();
        } catch (e) {
          responseBody = '[Unable to read response body]';
        }

        return {
          success: false,
          errorDetails: {
            status: response.status,
            statusText: response.statusText,
            response: responseBody,
            endpoint: command.endpoint,
            url: url,
            params: params,
            error_type: 'http_error'
          }
        };
      }

      // Parse successful response
      const contentType = response.headers.get('content-type');
      let data: any;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      this.log(`HTTP request succeeded: ${response.status}`, {
        step,
        endpoint: command.endpoint,
        status: response.status,
        response_size: typeof data === 'string' ? data.length : JSON.stringify(data).length
      });

      return {
        success: true,
        data
      };

    } catch (error: any) {
      clearTimeout(timeoutId);

      // Determine error type
      let errorType = 'unknown_error';
      let errorMessage = error.message;
      
      if (error.name === 'AbortError') {
        errorType = 'timeout';
        errorMessage = `Request timed out after ${this.timeoutMs}ms`;
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorType = 'network_error';
      }

      return {
        success: false,
        errorDetails: {
          error_type: errorType,
          message: errorMessage,
          endpoint: command.endpoint,
          url: url,
          params: params,
          timeout_ms: this.timeoutMs,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Build command URL with path parameters
   */
  private buildCommandUrl(endpoint: string, params: Record<string, any> | undefined): string {
    let url = endpoint;
    
    // Replace path parameters
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' || typeof value === 'number') {
          url = url.replace(`:${key}`, encodeURIComponent(value.toString()));
        }
      }
    }
    
    // Add query parameters for GET/DELETE
    if (params && ['GET', 'DELETE'].includes(url.split(' ')[0]?.toUpperCase() || '')) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (!url.includes(`:${key}`)) { // Skip path params
          queryParams.append(key, value.toString());
        }
      }
      
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    
    return url;
  }

  /**
   * Get execution state for debugging
   */
  getExecutionState(): ExecutionState {
    return this.executionState;
  }

  /**
   * Reset execution state (for new flow execution)
   */
  resetExecutionState(): void {
    this.executionState = {
      completed_steps: [],
      logs: []
    };
  }

  /**
   * Format result for AI consumption (strict version)
   */
  formatResultForAI(result: StrictCommandExecutionResult): string {
    if (!result.success) {
      return `[STRICT_EXECUTION_FAILED] Command "${result.commandName}" failed:
Error Code: ${result.error?.code}
Message: ${result.error?.message}
Details: ${JSON.stringify(result.error?.details, null, 2)}
Meta: ${JSON.stringify(result.meta, null, 2)}
Execution Time: ${result.executionTime}ms`;
    }

    const dataStr = typeof result.data === 'object' 
      ? JSON.stringify(result.data, null, 2)
      : String(result.data);

    return `[STRICT_EXECUTION_SUCCESS] Command "${result.commandName}" executed successfully:
${dataStr}
Meta: ${JSON.stringify(result.meta, null, 2)}
Execution Time: ${result.executionTime}ms`;
  }
}