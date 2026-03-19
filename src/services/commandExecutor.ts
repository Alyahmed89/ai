// Command execution service for AI commands
import { CommandData } from '../types';

export interface CommandRegistryEntry {
  name: string;
  description: string;
  method: string;
  endpoint: string;
  parameters?: Record<string, any>;
  tags: string[];
}

export interface CommandExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  commandName: string;
  executionTime: number;
}

export interface CommandExecutorOptions {
  env: any;
  db: any;
  maxRetries?: number;
  timeoutMs?: number;
  baseUrl?: string;
}

/**
 * Command executor service for AI commands
 */
export class CommandExecutor {
  private env: any;
  private db: any;
  private maxRetries: number;
  private timeoutMs: number;
  private baseUrl: string;

  constructor(options: CommandExecutorOptions) {
    this.env = options.env;
    this.db = options.db;
    this.maxRetries = options.maxRetries || 3;
    this.timeoutMs = options.timeoutMs || 10000;
    this.baseUrl = options.baseUrl || 'https://deepseek-agent.alghamdimo89.workers.dev';
  }

  /**
   * Get command details from registry
   */
  async getCommandFromRegistry(name: string): Promise<CommandRegistryEntry | null> {
    try {
      const query = `
        SELECT 
          name,
          description,
          method,
          url as endpoint,
          parameter_schema,
          tags
        FROM endpoint_registry 
        WHERE name = ?
      `;

      const result = await this.db.prepare(query).bind(name).first();
      
      if (!result) {
        console.warn(`[COMMAND] Command not found in registry: ${name}`);
        return null;
      }

      return {
        name: result.name,
        description: result.description,
        method: result.method,
        endpoint: result.endpoint,
        parameters: result.parameter_schema ? JSON.parse(result.parameter_schema) : null,
        tags: result.tags ? JSON.parse(result.tags) : []
      };
    } catch (error: any) {
      console.error(`[COMMAND] Error fetching command ${name}:`, error);
      return null;
    }
  }

  /**
   * Execute a command from AI response
   */
  async executeCommand(commandData: CommandData): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[COMMAND] Executing command: ${commandData.name}`, commandData.params);
      
      // Handle special commands that don't exist in registry
      if (commandData.name === 'help') {
        return {
          success: true,
          data: commandData.params?.message || 'Available commands can be discovered via /commands endpoint.',
          commandName: commandData.name,
          executionTime: Date.now() - startTime
        };
      }
      
      // Get command details from registry
      const command = await this.getCommandFromRegistry(commandData.name);
      if (!command) {
        return {
          success: false,
          error: `Command not found in registry: ${commandData.name}`,
          commandName: commandData.name,
          executionTime: Date.now() - startTime
        };
      }

      // Validate parameters against schema
      const validationError = this.validateParameters(commandData.params, command.parameters);
      if (validationError) {
        return {
          success: false,
          error: `Parameter validation failed: ${validationError}`,
          commandName: commandData.name,
          executionTime: Date.now() - startTime
        };
      }

      // Execute the command
      const result = await this.executeHttpCommand(command, commandData.params);
      
      return {
        success: true,
        data: result,
        commandName: commandData.name,
        executionTime: Date.now() - startTime
      };
      
    } catch (error: any) {
      console.error(`[COMMAND] Error executing command ${commandData.name}:`, error);
      
      return {
        success: false,
        error: `Execution failed: ${error.message}`,
        commandName: commandData.name,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate command parameters against schema
   */
  private validateParameters(
    providedParams: Record<string, any> | undefined,
    schema: Record<string, any> | null
  ): string | null {
    if (!schema || !providedParams) {
      return null; // No schema or no params to validate
    }

    // Simple validation - check required fields
    const requiredFields = Object.entries(schema)
      .filter(([_, fieldSchema]) => fieldSchema.required)
      .map(([fieldName]) => fieldName);

    for (const requiredField of requiredFields) {
      if (!(requiredField in providedParams)) {
        return `Missing required parameter: ${requiredField}`;
      }
    }

    // Type validation (basic)
    for (const [fieldName, value] of Object.entries(providedParams)) {
      if (schema[fieldName]) {
        const expectedType = schema[fieldName].type;
        if (expectedType && typeof value !== expectedType) {
          return `Parameter ${fieldName} should be type ${expectedType}, got ${typeof value}`;
        }
      }
    }

    return null;
  }

  /**
   * Execute HTTP command
   */
  private async executeHttpCommand(
    command: CommandRegistryEntry,
    params: Record<string, any> | undefined
  ): Promise<any> {
    const endpointPath = this.buildCommandUrl(command.endpoint, params, command.method);
    
    // Determine if we need to prepend baseUrl
    let url: string;
    if (endpointPath.startsWith('http://') || endpointPath.startsWith('https://')) {
      // Already a full URL, use as-is
      url = endpointPath;
    } else {
      // Relative path, prepend baseUrl
      url = `${this.baseUrl}${endpointPath}`;
    }
    
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

    // Execute with retry logic
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[COMMAND] Attempt ${attempt}/${this.maxRetries}: ${command.method} ${url} (endpoint: ${endpointPath})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
        
      } catch (error: any) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`[COMMAND] Retry ${attempt} failed, waiting ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error(`Failed after ${this.maxRetries} attempts`);
  }

  /**
   * Build command URL with path parameters
   */
  private buildCommandUrl(endpoint: string, params: Record<string, any> | undefined, method?: string): string {
    let url = endpoint;
    const usedPathParams = new Set<string>();
    
    // Replace path parameters and track which ones were used
    // Support both :param and {param} syntax
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' || typeof value === 'number') {
          // Try :param syntax first
          const colonPlaceholder = `:${key}`;
          if (url.includes(colonPlaceholder)) {
            url = url.replace(colonPlaceholder, encodeURIComponent(value.toString()));
            usedPathParams.add(key);
          } else {
            // Try {param} syntax
            const bracePlaceholder = `{${key}}`;
            if (url.includes(bracePlaceholder)) {
              url = url.replace(bracePlaceholder, encodeURIComponent(value.toString()));
              usedPathParams.add(key);
            }
          }
        }
      }
    }
    
    // Add query parameters for GET/DELETE requests
    // For POST/PUT/PATCH, params go in the request body, not query string
    if (params && method && ['GET', 'DELETE'].includes(method.toUpperCase())) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        // Skip path params that were already used in the URL
        if (!usedPathParams.has(key)) {
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
   * Format command result for AI consumption
   */
  formatResultForAI(result: CommandExecutionResult): string {
    if (!result.success) {
      return `Command "${result.commandName}" failed: ${result.error}`;
    }

    const dataStr = typeof result.data === 'object' 
      ? JSON.stringify(result.data, null, 2)
      : String(result.data);

    return `Command "${result.commandName}" executed successfully (${result.executionTime}ms):
${dataStr}`;
  }

  /**
   * Get all available commands for AI
   */
  async getAllCommands(): Promise<CommandRegistryEntry[]> {
    try {
      const query = `
        SELECT 
          name,
          description,
          method,
          url as endpoint,
          tags
        FROM endpoint_registry 
        ORDER BY name
      `;

      const result = await this.db.prepare(query).all();
      
      return result.results.map((cmd: any) => ({
        name: cmd.name,
        description: cmd.description,
        method: cmd.method,
        endpoint: cmd.endpoint,
        parameters: cmd.parameters ? JSON.parse(cmd.parameters) : null,
        tags: cmd.tags ? JSON.parse(cmd.tags) : []
      }));
    } catch (error: any) {
      console.error('[COMMAND] Error fetching all commands:', error);
      return [];
    }
  }
}