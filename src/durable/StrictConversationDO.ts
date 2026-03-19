// Strict Conversation Durable Object
// Uses strict execution engine with NO fallbacks, NO silent handling

import { StrictCommandExecutor } from '../services/strictCommandExecutor';
import { StrictFlowExecutor } from '../services/strictFlowExecutor';
import { CloudflareBindings, ConversationData, StepData, CommandData } from '../types';

export class StrictConversationDO {
  private state: DurableObjectState;
  private env: CloudflareBindings;
  private conversation: ConversationData | null = null;
  private strictCommandExecutor: StrictCommandExecutor | null = null;
  private strictFlowExecutor: StrictFlowExecutor | null = null;

  constructor(state: DurableObjectState, env: CloudflareBindings) {
    this.state = state;
    this.env = env;
    this.conversation = null;
  }

  /**
   * Lazily load conversation state from storage
   */
  private async loadConversationState(): Promise<void> {
    if (this.conversation === null) {
      this.conversation = await this.state.storage.get('conversation') || null;
    }
  }

  /**
   * Lazily initialize strict command executor
   */
  private async getStrictCommandExecutor(): Promise<StrictCommandExecutor> {
    if (!this.strictCommandExecutor) {
      this.strictCommandExecutor = new StrictCommandExecutor({
        env: this.env,
        db: this.env.FLOW_RUNS_DB,
        timeoutMs: 10000,
        baseUrl: 'https://deepseek-agent.alghamdimo89.workers.dev'
      });
    }
    return this.strictCommandExecutor;
  }

  /**
   * Lazily initialize strict flow executor
   */
  private async getStrictFlowExecutor(): Promise<StrictFlowExecutor> {
    if (!this.strictFlowExecutor) {
      const commandExecutor = await this.getStrictCommandExecutor();
      this.strictFlowExecutor = new StrictFlowExecutor({
        env: this.env,
        db: this.env.FLOW_RUNS_DB,
        commandExecutor,
        timeoutMs: 60000
      });
    }
    return this.strictFlowExecutor;
  }

  /**
   * Handle command with strict execution (NO FALLBACKS)
   */
  async handleCommandStrict(
    commandData: CommandData,
    step: StepData,
    originalResponse: string
  ): Promise<{ success: boolean; message: string; error?: any }> {
    if (!this.conversation) {
      return {
        success: false,
        message: 'No conversation state available',
        error: { code: 'NO_CONVERSATION_STATE' }
      };
    }

    console.log(`[STRICT_DO] Processing command: ${commandData.name}`, commandData.params);

    try {
      // NO command mapping - use exact command as provided
      // NO fallback logic - if command doesn't exist, it fails
      
      // Get strict command executor
      const commandExecutor = await this.getStrictCommandExecutor();
      
      // Execute the command with strict validation
      const result = await commandExecutor.executeCommand(commandData, step.step_id);
      
      // Format result for AI (strict version shows ALL details)
      const resultMessage = commandExecutor.formatResultForAI(result);
      
      // Add command result to conversation history
      if (this.conversation.conversation_history) {
        this.conversation.conversation_history.push({
          role: 'system',
          content: resultMessage,
          timestamp: Date.now()
        });
      }
      
      // Save updated conversation state
      await this.state.storage.put('conversation', this.conversation);
      
      return {
        success: result.success,
        message: resultMessage,
        error: result.error
      };
      
    } catch (error: any) {
      console.error(`[STRICT_DO] Unexpected error handling command ${commandData.name}:`, error);
      
      const errorMessage = `[STRICT_EXECUTION_UNEXPECTED_ERROR] Command "${commandData.name}" failed with unexpected error:
Error: ${error.message}
Stack: ${error.stack}`;
      
      // Add error to conversation history
      if (this.conversation.conversation_history) {
        this.conversation.conversation_history.push({
          role: 'system',
          content: errorMessage,
          timestamp: Date.now()
        });
      }
      
      // Save updated conversation state
      await this.state.storage.put('conversation', this.conversation);
      
      return {
        success: false,
        message: errorMessage,
        error: {
          code: 'UNEXPECTED_EXECUTOR_ERROR',
          message: error.message,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Execute flow with strict rules (sequential, no fallbacks, stop on failure)
   */
  async executeFlowStrict(
    flowId: string,
    steps: StepData[],
    initialPrompt?: string
  ): Promise<{ success: boolean; result: any; logs: any[] }> {
    try {
      const flowExecutor = await this.getStrictFlowExecutor();
      
      // Reset execution state for new flow
      flowExecutor.resetExecutionState();
      
      // Execute flow with strict rules
      const result = await flowExecutor.executeFlow(flowId, steps, initialPrompt);
      
      // Format logs for display
      const formattedLogs = result.logs.map(log => ({
        timestamp: new Date(log.timestamp).toISOString(),
        step: log.step,
        action: log.action,
        details: log.details
      }));
      
      return {
        success: result.success,
        result: {
          flow_id: flowId,
          completed: result.completed,
          completed_steps: result.completed_steps,
          failed_step: result.failed_step,
          execution_time: result.execution_time
        },
        logs: formattedLogs
      };
      
    } catch (error: any) {
      console.error(`[STRICT_DO] Error executing flow ${flowId}:`, error);
      
      return {
        success: false,
        result: {
          flow_id: flowId,
          error: {
            code: 'FLOW_EXECUTION_ERROR',
            message: error.message,
            stack: error.stack
          }
        },
        logs: [{
          timestamp: new Date().toISOString(),
          step: 'flow',
          action: 'flow_execution_failed',
          details: { error: error.message, stack: error.stack }
        }]
      };
    }
  }

  /**
   * Get execution state for debugging
   */
  async getExecutionState(): Promise<{
    command_execution_state: any;
    flow_execution_state: any;
    conversation_state: any;
  }> {
    const commandExecutor = await this.getStrictCommandExecutor();
    const flowExecutor = await this.getStrictFlowExecutor();
    
    return {
      command_execution_state: commandExecutor.getExecutionState(),
      flow_execution_state: flowExecutor.getExecutionState(),
      conversation_state: this.conversation
    };
  }

  /**
   * Reset all execution state
   */
  async resetExecutionState(): Promise<void> {
    const commandExecutor = await this.getStrictCommandExecutor();
    const flowExecutor = await this.getStrictFlowExecutor();
    
    commandExecutor.resetExecutionState();
    flowExecutor.resetExecutionState();
    
    console.log(`[STRICT_DO] Execution state reset`);
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      await this.loadConversationState();
      
      if (path.endsWith('/handle-command-strict') && request.method === 'POST') {
        return await this.handleCommandStrictEndpoint(request);
      }
      
      if (path.endsWith('/execute-flow-strict') && request.method === 'POST') {
        return await this.executeFlowStrictEndpoint(request);
      }
      
      if (path.endsWith('/execution-state') && request.method === 'GET') {
        return await this.getExecutionStateEndpoint();
      }
      
      if (path.endsWith('/reset-execution-state') && request.method === 'POST') {
        return await this.resetExecutionStateEndpoint();
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error: any) {
      console.error(`[STRICT_DO] Error handling request:`, error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle command strict endpoint
   */
  private async handleCommandStrictEndpoint(request: Request): Promise<Response> {
    const body = await request.json();
    const { commandData, step, originalResponse } = body;
    
    if (!commandData || !commandData.name) {
      return new Response(JSON.stringify({
        error: 'Invalid request',
        message: 'commandData with name is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await this.handleCommandStrict(commandData, step, originalResponse);
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Execute flow strict endpoint
   */
  private async executeFlowStrictEndpoint(request: Request): Promise<Response> {
    const body = await request.json();
    const { flowId, steps, initialPrompt } = body;
    
    if (!flowId || !steps || !Array.isArray(steps)) {
      return new Response(JSON.stringify({
        error: 'Invalid request',
        message: 'flowId and steps array are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await this.executeFlowStrict(flowId, steps, initialPrompt);
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get execution state endpoint
   */
  private async getExecutionStateEndpoint(): Promise<Response> {
    const state = await this.getExecutionState();
    
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Reset execution state endpoint
   */
  private async resetExecutionStateEndpoint(): Promise<Response> {
    await this.resetExecutionState();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Execution state reset'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}