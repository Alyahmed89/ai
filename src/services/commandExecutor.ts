// Command execution service for AI commands
import { CommandData } from '../types';
import { ApiCaller } from './ApiCaller';

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
  flow_id?: string;
  flow_run_id?: string;
  step_id?: string;
  step_run_id?: string;
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
  private apiCaller: ApiCaller;
  private flow_id?: string;
  private flow_run_id?: string;
  private step_id?: string;
  private step_run_id?: string;

  constructor(options: CommandExecutorOptions) {
    this.env = options.env;
    this.db = options.db;
    this.maxRetries = options.maxRetries || 3;
    this.timeoutMs = options.timeoutMs || 10000;
    this.baseUrl = options.baseUrl || 'https://deepseek-agent.alghamdimo89.workers.dev';
    this.apiCaller = new ApiCaller(this.db);
    this.flow_id = options.flow_id;
    this.flow_run_id = options.flow_run_id;
    this.step_id = options.step_id;
    this.step_run_id = options.step_run_id;
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

      // Execute the command using ApiCaller
      const apiResult = await this.apiCaller.callEndpoint(
        commandData.name,
        {
          flow_id: this.flow_id,
          flow_run_id: this.flow_run_id,
          step_id: this.step_id,
          step_run_id: this.step_run_id,
          parameters: commandData.params || {}
        },
        'command',
        commandData.method // Pass the HTTP method from command
      );
      
      if (apiResult.success) {
        return {
          success: true,
          data: apiResult.data,
          commandName: commandData.name,
          executionTime: Date.now() - startTime
        };
      } else {
        return {
          success: false,
          error: apiResult.error || 'Command execution failed',
          commandName: commandData.name,
          executionTime: Date.now() - startTime
        };
      }
      
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
   * Execute HTTP command (legacy - now handled by ApiCaller)
   */
  private async executeHttpCommand(
    command: CommandRegistryEntry,
    params: Record<string, any> | undefined
  ): Promise<any> {
    // This method is kept for backward compatibility but now uses ApiCaller
    const apiResult = await this.apiCaller.callEndpoint(
      command.name,
      {
        flow_id: this.flow_id,
        flow_run_id: this.flow_run_id,
        step_id: this.step_id,
        step_run_id: this.step_run_id,
        parameters: params || {}
      },
      'command',
      command.method // Pass the HTTP method from command
    );
    
    if (apiResult.success) {
      return apiResult.data;
    } else {
      throw new Error(apiResult.error || 'Command execution failed');
    }
  }

  /**
   * Build command URL with path parameters (legacy - now handled by ApiCaller)
   */
  private buildCommandUrl(endpoint: string, params: Record<string, any> | undefined, method?: string): string {
    // This method is kept for backward compatibility
    // ApiCaller handles URL building internally
    return endpoint;
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