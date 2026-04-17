// Strict Flow Execution Service
// NO fallbacks, NO silent handling, NO retries
// Every failure must be exposed clearly in status

import { StepData } from '../types';
import { StrictCommandExecutor, StrictCommandExecutionResult } from './strictCommandExecutor';

export interface StrictFlowExecutionResult {
  success: boolean;
  completed: boolean;
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
    action: string;
    details: any;
  }>;
  execution_time: number;
}

export interface StrictFlowExecutorOptions {
  env: any;
  db: any;
  commandExecutor: StrictCommandExecutor;
  timeoutMs?: number;
}

/**
 * Strict Flow Executor - Debug Engine for flow execution
 * 
 * RULES:
 * 1. Execute steps sequentially
 * 2. If a step fails → STOP entire flow immediately
 * 3. NO fallbacks, NO alternative strategies
 * 4. NO retries (max attempts = 1)
 * 5. ALWAYS expose exact failure details
 */
export class StrictFlowExecutor {
  private env: any;
  private db: any;
  private commandExecutor: StrictCommandExecutor;
  private timeoutMs: number;
  private executionState: StrictFlowExecutionResult;

  constructor(options: StrictFlowExecutorOptions) {
    this.env = options.env;
    this.db = options.db;
    this.commandExecutor = options.commandExecutor;
    this.timeoutMs = options.timeoutMs || 60000; // 60 second flow timeout
    this.executionState = {
      success: false,
      completed: false,
      completed_steps: [],
      logs: [],
      execution_time: 0
    };
  }

  /**
   * Execute a flow with strict rules
   */
  async executeFlow(
    flowId: string,
    steps: StepData[],
    initialPrompt?: string
  ): Promise<StrictFlowExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.log(`Starting strict flow execution: ${flowId}`, {
        flow_id: flowId,
        steps_count: steps.length,
        initial_prompt: initialPrompt
      });

      // Reset command executor state
      this.commandExecutor.resetExecutionState();

      // Sort steps by order_index
      const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
      
      this.log(`Sorted ${sortedSteps.length} steps for execution`, {
        step_order: sortedSteps.map(s => ({ id: s.step_id, title: s.title, order: s.order_index }))
      });

      // Execute steps sequentially
      for (const step of sortedSteps) {
        const stepResult = await this.executeStep(step, flowId);
        
        if (!stepResult.success) {
          // STEP FAILED → STOP ENTIRE FLOW IMMEDIATELY
          this.executionState.failed_step = {
            step: step.step_id,
            error: stepResult.error,
            timestamp: Date.now()
          };
          this.executionState.success = false;
          this.executionState.completed = false;
          this.executionState.execution_time = Date.now() - startTime;
          
          this.log(`Flow execution STOPPED due to step failure`, {
            step: step.step_id,
            step_title: step.title,
            error: stepResult.error,
            completed_steps: this.executionState.completed_steps
          });
          
          return this.executionState;
        }
        
        // Step succeeded - mark as completed
        this.executionState.completed_steps.push(step.step_id);
        this.executionState.current_step = step.step_id;
        
        this.log(`Step completed successfully`, {
          step: step.step_id,
          step_title: step.title,
          completed_steps_count: this.executionState.completed_steps.length,
          total_steps: sortedSteps.length
        });
      }

      // All steps completed successfully
      this.executionState.success = true;
      this.executionState.completed = true;
      this.executionState.execution_time = Date.now() - startTime;
      
      this.log(`Flow execution COMPLETED successfully`, {
        flow_id: flowId,
        steps_completed: this.executionState.completed_steps.length,
        total_steps: sortedSteps.length,
        execution_time: this.executionState.execution_time
      });

      return this.executionState;

    } catch (error: any) {
      // Unexpected error in flow executor
      this.executionState.success = false;
      this.executionState.completed = false;
      this.executionState.execution_time = Date.now() - startTime;
      
      this.log(`Unexpected error in flow executor`, {
        error: error.message,
        stack: error.stack,
        completed_steps: this.executionState.completed_steps
      });

      return this.executionState;
    }
  }

  /**
   * Execute a single step with strict rules
   */
  private async executeStep(
    step: StepData,
    flowId: string
  ): Promise<{ success: boolean; error?: any; result?: any }> {
    const stepStartTime = Date.now();
    
    try {
      this.log(`Starting step execution`, {
        step: step.step_id,
        step_title: step.title,
        step_type: step.step_type,
        flow_id: flowId
      });

      // Different handling based on step type
      switch (step.step_type) {
        case 'command':
          return await this.executeCommandStep(step, flowId);
        
        case 'ai':
          return await this.executeAIStep(step, flowId);
        
        case 'condition':
          return await this.executeConditionStep(step, flowId);
        
        default:
          return {
            success: false,
            error: {
              code: 'UNKNOWN_STEP_TYPE',
              message: `Unknown step type: ${step.step_type}`,
              details: { step_type: step.step_type }
            }
          };
      }

    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'STEP_EXECUTION_ERROR',
          message: `Unexpected error executing step: ${error.message}`,
          details: {
            step: step.step_id,
            step_title: step.title,
            error: error.message,
            stack: error.stack
          }
        }
      };
    }
  }

  /**
   * Execute a command step
   */
  private async executeCommandStep(
    step: StepData,
    flowId: string
  ): Promise<{ success: boolean; error?: any; result?: any }> {
    this.log(`Executing command step`, {
      step: step.step_id,
      step_title: step.title,
      description: step.description
    });

    // Extract command from step description
    const commandMatch = step.description?.match(/\[COMMAND:(\w+)\]/);
    if (!commandMatch) {
      return {
        success: false,
        error: {
          code: 'NO_COMMAND_FOUND',
          message: `No command found in step description`,
          details: {
            step: step.step_id,
            description: step.description,
            expected_format: '[COMMAND:command_name] params: {...}'
          }
        }
      };
    }

    const commandName = commandMatch[1];
    
    // Extract parameters from description
    let params = {};
    const paramsMatch = step.description?.match(/params:\s*(\{.*\})/s);
    if (paramsMatch) {
      try {
        params = JSON.parse(paramsMatch[1]);
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS_JSON',
            message: `Failed to parse parameters JSON`,
            details: {
              step: step.step_id,
              params_string: paramsMatch[1],
              error: error.message
            }
          }
        };
      }
    }

    // Execute the command with strict executor
    const commandResult = await this.commandExecutor.executeCommand(
      { name: commandName, params },
      step.step_id
    );

    // Log command execution result
    this.log(`Command execution result`, {
      step: step.step_id,
      command: commandName,
      success: commandResult.success,
      execution_time: commandResult.executionTime,
      error: commandResult.error
    });

    if (!commandResult.success) {
      return {
        success: false,
        error: commandResult.error
      };
    }

    return {
      success: true,
      result: commandResult.data
    };
  }

  /**
   * Execute an AI step (placeholder - would integrate with AI service)
   */
  private async executeAIStep(
    step: StepData,
    flowId: string
  ): Promise<{ success: boolean; error?: any; result?: any }> {
    this.log(`Executing AI step`, {
      step: step.step_id,
      step_title: step.title,
      description: step.description
    });

    // For now, just mark as successful
    // In a real implementation, this would call an AI service
    return {
      success: true,
      result: { message: 'AI step executed (placeholder)' }
    };
  }

  /**
   * Execute a condition step
   */
  private async executeConditionStep(
    step: StepData,
    flowId: string
  ): Promise<{ success: boolean; error?: any; result?: any }> {
    this.log(`Executing condition step`, {
      step: step.step_id,
      step_title: step.title,
      description: step.description
    });

    // Import the condition evaluation function
    const { getNextStepBasedOnConditions } = await import('./database');
    
    // Get the last response from the most recent command execution
    // Look for response in the last log entry
    let lastResponse = '';
    if (this.executionState.logs.length > 0) {
      const lastLog = this.executionState.logs[this.executionState.logs.length - 1];
      if (lastLog.details?.result?.response) {
        lastResponse = lastLog.details.result.response;
      } else if (lastLog.details?.data?.response) {
        lastResponse = lastLog.details.data.response;
      }
    }
    
    console.log("RESPONSE:", lastResponse);
    
    this.log(`Condition evaluation parameters`, {
      flow_id: flowId,
      step_id: step.step_id,
      last_response_length: lastResponse?.length || 0,
      last_response_preview: lastResponse?.substring(0, 100) || 'none'
    });

    const nextStep = await getNextStepBasedOnConditions(
      this.env.FLOW_RUNS_DB,
      flowId,
      step.step_id,
      lastResponse || ''
    );

    if (nextStep) {
      this.log(`Condition matched next step`, {
        next_step_id: nextStep.step_id,
        next_step_title: nextStep.title,
        next_step_order: nextStep.order_index
      });
      
      // Return success with the selected next step
      return {
        success: true,
        result: { 
          message: 'Condition step executed successfully',
          next_step: nextStep,
          matched: true
        }
      };
    } else {
      this.log(`No condition matched, continuing sequentially`, {
        step_id: step.step_id
      });
      
      // Return success but no match (will continue to next sequential step)
      return {
        success: true,
        result: { 
          message: 'Condition step executed - no match, continuing sequentially',
          matched: false
        }
      };
    }
  }

  /**
   * Log execution details
   */
  private log(message: string, details: any): void {
    const logEntry = {
      timestamp: Date.now(),
      step: details.step || 'flow',
      action: message,
      details
    };
    
    this.executionState.logs.push(logEntry);
    
    console.log(`[STRICT_FLOW_EXECUTOR] ${message}`, details);
  }

  /**
   * Get execution state for debugging
   */
  getExecutionState(): StrictFlowExecutionResult {
    return this.executionState;
  }

  /**
   * Reset execution state (for new flow execution)
   */
  resetExecutionState(): void {
    this.executionState = {
      success: false,
      completed: false,
      completed_steps: [],
      logs: [],
      execution_time: 0
    };
    this.commandExecutor.resetExecutionState();
  }

  /**
   * Format flow execution result for display
   */
  formatResultForDisplay(result: StrictFlowExecutionResult): string {
    if (!result.success) {
      return `[STRICT_FLOW_EXECUTION_FAILED]
Flow execution failed at step: ${result.failed_step?.step}
Error: ${JSON.stringify(result.failed_step?.error, null, 2)}
Completed Steps: ${result.completed_steps.length}
Execution Time: ${result.execution_time}ms
Logs: ${result.logs.length} entries`;
    }

    return `[STRICT_FLOW_EXECUTION_SUCCESS]
Flow execution completed successfully
Steps Completed: ${result.completed_steps.length}
Execution Time: ${result.execution_time}ms
Logs: ${result.logs.length} entries`;
  }
}