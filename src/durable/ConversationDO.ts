// Durable Object for conversation orchestration
// ALL state management and alarm-driven logic lives here
import { callDeepSeek, buildInitialMessages } from '../services/deepseek';
import { createOpenHandsConversation, getOpenHandsConversation, injectMessageToOpenHands, stopOpenHandsConversation } from '../services/openhands';
import { parseDoneResponse, extractPromptsAndResponses, parseCreateTask, parseSkipTask, extractAllTokens, extractStructuredOutput } from '../utils/parsing';
import { saveFlowRun, updateFlowRunStatus, saveIteration, saveStepRun, generateFlowRunId, generateStepRunId, getTaskData, getFirstPendingTask, getLastFlowResponse, getNextFlowBasedOnConditions } from '../services/database';
import { shouldCompleteTask } from '../services/verification';
import { validateFactUsage, resolveFactPlaceholders } from '../utils/factValidation';
import { resolveStepInstructions } from '../services/stepResolver';
import { evaluateCondition, loadExecutionData, saveExecutionData } from '../services/conditionEngine';
import { CommandExecutor } from '../services/commandExecutor';
import { ConditionEvaluator } from '../core/condition-evaluator';
import { Router } from '../core/router';
import { createExecutionContext } from '../core/execution-context';
import { 
  MAX_ITERATIONS, 
  END_FLOW_TOKEN, 
  END_FLOW_EARLY_TOKEN, 
  ALARM_DELAY_INIT, 
  ALARM_DELAY_WAITING, 
  ALARM_DELAY_ACTIVE,
  OPENHANDS_TIMEOUT, 
  NO_EVENT_TIMEOUT,
  AGGRESSIVE_MODE,
  AGGRESSIVE_NO_EVENT_TIMEOUT,
  AGGRESSIVE_OPENHANDS_TIMEOUT,
  STATIC_PROMPT_MODE,
  STATIC_PROMPTS,
  FORCE_END_FLOW_AFTER_TIMEOUT,
  AUTO_RESTART_CONVERSATION,
  RESTART_DELAY,
  MAX_RESTARTS,
  DEEPSEEK_RESPONSE_TIMEOUT,
  CHECKING_PROMPT,
  ADAPTIVE_POLLING_ENABLED,
  MIN_POLL_INTERVAL,
  MAX_POLL_INTERVAL,
  POLL_INTERVAL_INCREMENT,
  POLL_INTERVAL_RESET,
  ENABLE_REQUEST_CACHING,
  CACHE_TTL,
  MAX_CONCURRENT_CONVERSATIONS,
  MAX_DO_LIFETIME,
  IDLE_TIMEOUT,
  COMPLETED_CLEANUP_DELAY
} from '../constants';
import { CloudflareBindings, ConversationData, ConversationState, OpenHandsEvent, DoneResponseData, ProjectFact, StepData, ExecutionStepData, TaskData, Condition, CreateTaskData, SkipTaskData, CommandData, ExecutionEvent, ExecutionEventRecord, FlowInitResponse } from '../types';

export class ConversationOrchestratorDO_2026A {
  private state: DurableObjectState;
  private env: CloudflareBindings;
  private conversation: ConversationData | null = null;
  private flowRunId: string | null = null;
  private flowStepsCache: ExecutionStepData[] | null = null; // Cache for flow steps
  private flowStepsCacheTime: number = 0; // When cache was last updated
  private readonly FLOW_STEPS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  
  // Flow switching loop prevention
  private flowSwitchHistory: string[] = [];
  private readonly maxFlowSwitches = 5;
  
  // Command executor
  private commandExecutor: CommandExecutor | null = null;

  // New condition evaluation system
  private conditionEvaluator: ConditionEvaluator | null = null;
  private router: Router | null = null;

  // Event emission system for UI step streaming
  private eventListeners: ((event: ExecutionEvent) => void)[] = [];
  private eventSequence: number = 0; // Sequence counter for event ordering

  constructor(state: DurableObjectState, env: CloudflareBindings) {
    this.state = state;
    this.env = env;
    
    // NO async work in constructor - load state lazily in fetch handlers
    this.conversation = null;
    this.flowStepsCache = null;
    this.flowStepsCacheTime = 0;
    this.flowSwitchHistory = [];
    this.eventSequence = 0;
    this.conditionEvaluator = null;
    this.router = null;
  }
  // ==========================================================================
  // EVENT EMISSION SYSTEM
  // ==========================================================================

  /**
   * Add event listener for execution events
   */
  addEventListener(listener: (event: ExecutionEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: ExecutionEvent) => void): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }

  /**
   * Emit execution event to all listeners
   */
  private emitEvent(event: ExecutionEvent): void {
    // Increment sequence counter
    this.eventSequence++;
    
    // Ensure event has sequence and flowRunId
    const enrichedEvent = {
      ...event,
      sequence: this.eventSequence,
      flowRunId: this.flowRunId || 'unknown'
    } as ExecutionEvent;
    
    console.log(`[DO:${this.state.id}] Emitting event #${this.eventSequence}: ${enrichedEvent.type}`, enrichedEvent);
    
    // Store event in database for debugging/replay
    this.storeEventInDatabase(enrichedEvent).catch(error => {
      console.error(`[DO:${this.state.id}] Failed to store event in database:`, error);
    });
    
    // Notify all listeners
    for (const listener of this.eventListeners) {
      try {
        listener(enrichedEvent);
      } catch (error) {
        console.error(`[DO:${this.state.id}] Event listener error:`, error);
      }
    }
  }

  /**
   * Store event in database for debugging and replay
   */
  private async storeEventInDatabase(event: ExecutionEvent): Promise<void> {
    if (!this.env.FLOW_RUNS_DB || !this.flowRunId) {
      return; // No database configured or no flow run ID
    }

    try {
      const eventRecord: ExecutionEventRecord = {
        flow_run_id: this.flowRunId,
        event_type: event.type,
        payload: JSON.stringify(event),
        timestamp: event.ts,
        created_at: Date.now()
      };

      await this.env.FLOW_RUNS_DB.prepare(
        'INSERT INTO execution_events (flow_run_id, event_type, payload, timestamp, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        eventRecord.flow_run_id,
        eventRecord.event_type,
        eventRecord.payload,
        eventRecord.timestamp,
        eventRecord.created_at
      ).run();
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error storing event in database:`, error.message);
      // Don't throw - event emission should not fail if storage fails
    }
  }

  /**
   * Helper methods for common event types
   */
  private emitStepStarted(stepId: string, title: string): void {
    this.emitEvent({
      type: 'STEP_STARTED',
      stepId,
      flowRunId: this.flowRunId || '',
      sequence: this.eventSequence,
      title,
      ts: Date.now()
    });
  }

  private emitCommandCalling(stepId: string, command: string, params?: Record<string, unknown>): void {
    this.emitEvent({
      type: 'COMMAND_CALLING',
      stepId,
      flowRunId: this.flowRunId || '',
      sequence: this.eventSequence,
      command,
      params,
      ts: Date.now()
    });
  }

  private emitCommandResponse(stepId: string, command: string, response: unknown, startTime: number): void {
    // Normalize response for UI rendering
    const normalizedResponse = this.normalizeResponse(response);
    
    this.emitEvent({
      type: 'COMMAND_RESPONSE',
      stepId,
      flowRunId: this.flowRunId || '',
      sequence: this.eventSequence,
      command,
      response: normalizedResponse,
      duration: Date.now() - startTime,
      ts: Date.now()
    });
  }

  private emitStepCompleted(stepId: string, result: unknown): void {
    // Normalize result for UI rendering
    const normalizedResult = this.normalizeStepResult(result);
    
    this.emitEvent({
      type: 'STEP_COMPLETED',
      stepId,
      flowRunId: this.flowRunId || '',
      sequence: this.eventSequence,
      result: normalizedResult,
      ts: Date.now()
    });
  }

  private async emitStepError(stepId: string, error: string | Error): Promise<void> {
    // Normalize error for UI rendering
    const normalizedError = this.normalizeError(error);
    
    // Update step status to "failed" if we have a current step
    if (this.conversation?.flow_steps && this.conversation.current_step) {
      const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === this.conversation!.current_step!.step_id);
      if (stepIndex !== -1) {
        this.conversation.flow_steps[stepIndex].status = 'failed';
        console.log(`[DO:${this.state.id}] Updated step ${this.conversation.current_step.step_id} status to 'failed' due to error`);
        
        // PERSIST: Save conversation state immediately
        await this.state.storage.put('conversation', this.conversation);
        console.log(`[DO:${this.state.id}] Persisted conversation with step ${this.conversation.current_step.step_id} status='failed'`);
      }
    }
    
    this.emitEvent({
      type: 'STEP_ERROR',
      stepId,
      flowRunId: this.flowRunId || '',
      sequence: this.eventSequence,
      error: normalizedError,
      ts: Date.now()
    });
  }

  private emitFlowStarted(flowId: string, flowRunId: string): void {
    this.emitEvent({
      type: 'FLOW_STARTED',
      flowId,
      flowRunId,
      sequence: this.eventSequence,
      ts: Date.now()
    });
  }

  private emitFlowCompleted(flowId: string, flowRunId: string, result: unknown): void {
    // Normalize flow result for UI rendering
    const normalizedResult = this.normalizeFlowResult(result);
    
    this.emitEvent({
      type: 'FLOW_COMPLETED',
      flowId,
      flowRunId,
      sequence: this.eventSequence,
      result: normalizedResult,
      ts: Date.now()
    });
  }

  /**
   * Normalize response for UI rendering
   */
  private normalizeResponse(response: unknown): {
    type: 'text' | 'json' | 'error' | 'html' | 'markdown';
    content: string;
    metadata?: Record<string, unknown>;
  } {
    if (response === null || response === undefined) {
      return {
        type: 'text',
        content: 'null'
      };
    }

    if (typeof response === 'string') {
      // Try to detect content type
      if (response.startsWith('{') || response.startsWith('[')) {
        try {
          JSON.parse(response);
          return {
            type: 'json',
            content: response,
            metadata: { parsed: true }
          };
        } catch {
          // Not valid JSON
        }
      }
      
      if (response.toLowerCase().includes('<html>') || response.toLowerCase().includes('<div>')) {
        return {
          type: 'html',
          content: response,
          metadata: { sanitized: false }
        };
      }
      
      if (response.includes('# ') || response.includes('## ') || response.includes('* ')) {
        return {
          type: 'markdown',
          content: response,
          metadata: { rendered: false }
        };
      }
      
      return {
        type: 'text',
        content: response
      };
    }

    if (typeof response === 'object') {
      if (response instanceof Error) {
        return {
          type: 'error',
          content: response.message,
          metadata: { 
            name: response.name,
            stack: response.stack 
          }
        };
      }
      
      // Convert object to JSON string
      try {
        const jsonString = JSON.stringify(response, null, 2);
        return {
          type: 'json',
          content: jsonString,
          metadata: { 
            objectType: response.constructor.name,
            keys: Object.keys(response)
          }
        };
      } catch {
        return {
          type: 'text',
          content: String(response)
        };
      }
    }

    // Fallback for numbers, booleans, etc.
    return {
      type: 'text',
      content: String(response)
    };
  }

  /**
   * Normalize step result for UI rendering
   */
  private normalizeStepResult(result: unknown): {
    type: 'success' | 'partial' | 'skipped';
    summary: string;
    data?: unknown;
  } {
    if (typeof result === 'string') {
      return {
        type: 'success',
        summary: result,
        data: result
      };
    }

    if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;
      
      if (resultObj.type && ['success', 'partial', 'skipped'].includes(resultObj.type as string)) {
        return {
          type: resultObj.type as 'success' | 'partial' | 'skipped',
          summary: typeof resultObj.summary === 'string' ? resultObj.summary : 'Step completed',
          data: resultObj.data
        };
      }
    }

    // Default to success
    return {
      type: 'success',
      summary: 'Step completed successfully',
      data: result
    };
  }

  /**
   * Normalize error for UI rendering
   */
  private normalizeError(error: string | Error): {
    message: string;
    code?: string;
    details?: unknown;
  } {
    if (typeof error === 'string') {
      return {
        message: error
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: error.name,
        details: error.stack
      };
    }

    return {
      message: 'Unknown error occurred',
      details: error
    };
  }

  /**
   * Normalize flow result for UI rendering
   */
  private normalizeFlowResult(result: unknown): {
    status: 'success' | 'failed' | 'cancelled';
    summary: string;
    stepsCompleted: number;
    totalSteps: number;
    data?: unknown;
  } {
    // Default values
    const defaultResult = {
      status: 'success' as const,
      summary: 'Flow completed',
      stepsCompleted: 0,
      totalSteps: 0,
      data: result
    };

    if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;
      
      return {
        status: (resultObj.status as 'success' | 'failed' | 'cancelled') || 'success',
        summary: typeof resultObj.summary === 'string' ? resultObj.summary : defaultResult.summary,
        stepsCompleted: typeof resultObj.stepsCompleted === 'number' ? resultObj.stepsCompleted : defaultResult.stepsCompleted,
        totalSteps: typeof resultObj.totalSteps === 'number' ? resultObj.totalSteps : defaultResult.totalSteps,
        data: resultObj.data || result
      };
    }

    return defaultResult;
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
   * Lazily initialize command executor
   */
  private async getCommandExecutor(): Promise<CommandExecutor> {
    if (!this.commandExecutor) {
      this.commandExecutor = new CommandExecutor({
        env: this.env,
        db: this.env.FLOW_RUNS_DB,
        maxRetries: 3,
        timeoutMs: 10000,
        baseUrl: 'https://deepseek-agent.alghamdimo89.workers.dev'
      });
    }
    return this.commandExecutor;
  }

  private async getConditionEvaluator(): Promise<ConditionEvaluator> {
    if (!this.conditionEvaluator) {
      this.conditionEvaluator = new ConditionEvaluator();
    }
    return this.conditionEvaluator;
  }

  private async getRouter(): Promise<Router> {
    if (!this.router) {
      const evaluator = await this.getConditionEvaluator();
      this.router = new Router(evaluator);
    }
    return this.router;
  }
  
  /**
   * Get available commands for AI
   */
  private async getAvailableCommands(): Promise<string> {
    try {
      const commandExecutor = await this.getCommandExecutor();
      const commands = await commandExecutor.getAllCommands();
      
      if (commands.length === 0) {
        return "No commands available. Use /commands endpoint to discover commands.";
      }
      
      // Format commands for AI prompt
      const commandList = commands.map(cmd => {
        const params = cmd.parameters 
          ? `params: ${JSON.stringify(cmd.parameters, null, 2)}`
          : 'params: {}';
        return `- ${cmd.name}: ${cmd.description}\n  ${params}`;
      }).join('\n\n');
      
      return `AVAILABLE COMMANDS:\n${commandList}\n\nUse format: [COMMAND:command_name] params: {JSON_parameters}`;
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error getting available commands:`, error);
      return "Error loading commands. Use /commands endpoint to discover available commands.";
    }
  }
  
  /**
   * Safely update conversation state with invariant checks
   */
  private async updateConversationState(updates: Partial<ConversationState>): Promise<void> {
    if (!this.conversation) {
      throw new Error('Cannot update conversation: conversation is null');
    }
    
    // INVARIANT 1: Flow ID must be immutable
    if (updates.flow_id !== undefined && updates.flow_id !== this.conversation.flow_id) {
      console.error(`[DO:${this.state.id}] SECURITY VIOLATION: Flow ID mutation detected`);
      console.error(`[DO:${this.state.id}] Original flow_id: ${this.conversation.flow_id}`);
      console.error(`[DO:${this.state.id}] Attempted flow_id: ${updates.flow_id}`);
      throw new Error('ILLEGAL_FLOW_ID_MUTATION: flow_id is immutable during execution');
    }
    
    // Apply updates
    const originalFlowId = this.conversation.flow_id;
    this.conversation = {
      ...this.conversation,
      ...updates,
      updated_at: Date.now()
    };
    
    // Double-check invariant after update
    if (this.conversation.flow_id !== originalFlowId) {
      console.error(`[DO:${this.state.id}] CRITICAL BUG: Flow ID changed during update`);
      throw new Error('CRITICAL_FLOW_ID_MUTATION: flow_id changed unexpectedly');
    }
    
    await this.state.storage.put('conversation', this.conversation);
  }
  
  /**
   * Get next poll interval using adaptive polling logic
   */
  private getNextPollInterval(): number {
    if (!ADAPTIVE_POLLING_ENABLED || !this.conversation) {
      return ALARM_DELAY_WAITING;
    }
    
    // Initialize adaptive polling fields if not set
    if (this.conversation.current_poll_interval === undefined) {
      this.conversation.current_poll_interval = POLL_INTERVAL_RESET;
    }
    if (this.conversation.consecutive_idle_checks === undefined) {
      this.conversation.consecutive_idle_checks = 0;
    }
    if (this.conversation.last_activity_at === undefined) {
      this.conversation.last_activity_at = Date.now();
    }
    
    const timeSinceLastActivity = Date.now() - this.conversation.last_activity_at;
    const isActive = timeSinceLastActivity < 30000; // 30 seconds since last activity
    
    if (isActive) {
      // Reset to base interval when active
      this.conversation.current_poll_interval = POLL_INTERVAL_RESET;
      this.conversation.consecutive_idle_checks = 0;
      console.log(`[DO:${this.state.id}] Active conversation, reset poll interval to ${POLL_INTERVAL_RESET}ms`);
    } else {
      // Increase interval when idle
      this.conversation.consecutive_idle_checks = (this.conversation.consecutive_idle_checks || 0) + 1;
      this.conversation.current_poll_interval = Math.min(
        this.conversation.current_poll_interval! + POLL_INTERVAL_INCREMENT,
        MAX_POLL_INTERVAL
      );
      console.log(`[DO:${this.state.id}] Idle conversation (${this.conversation.consecutive_idle_checks} checks), increased poll interval to ${this.conversation.current_poll_interval}ms`);
    }
    
    return Math.max(MIN_POLL_INTERVAL, Math.min(MAX_POLL_INTERVAL, this.conversation.current_poll_interval));
  }
  
  /**
   * Update activity tracking
   */
  private updateActivityTracking(): void {
    if (!this.conversation) return;
    
    this.conversation.last_activity_at = Date.now();
    this.conversation.consecutive_idle_checks = 0;
    
    // Reset poll interval on activity if adaptive polling is enabled
    if (ADAPTIVE_POLLING_ENABLED) {
      this.conversation.current_poll_interval = POLL_INTERVAL_RESET;
    }
  }
  
  /**
   * Schedule next alarm with adaptive interval
   */
  private async scheduleNextAlarm(interval?: number): Promise<void> {
    const nextInterval = interval || this.getNextPollInterval();
    await this.state.storage.setAlarm(Date.now() + nextInterval);
    console.log(`[DO:${this.state.id}] Next alarm scheduled in ${nextInterval}ms`);
  }
  
  // Alarm handler (called by Cloudflare when alarm triggers)
  async alarm(): Promise<void> {
    console.log(`[DO:${this.state.id}] Alarm triggered`);
    await this.loadConversationState();
    await this.handleAlarm();
  }
  
  // HTTP endpoints for the Durable Object
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Load conversation state for all endpoints except initialization endpoints
    if (path !== '/initialize' && path !== '/initialize-flow' && path !== '/start-flow') {
      await this.loadConversationState();
    }
    
    // Initialize a new conversation
    if (path === '/initialize' && request.method === 'POST') {
      return this.handleInitialize(request);
    }
    
    // Initialize a new flow execution
    if (path === '/initialize-flow' && request.method === 'POST') {
      return this.handleInitializeFlow(request);
    }
    
    // Ultra-minimal flow execution (NEW)
    if (path === '/start-flow' && request.method === 'POST') {
      return this.handleStartFlow(request);
    }
    
    // Attach to existing OpenHands conversation
    if (path === '/attach' && request.method === 'POST') {
      return this.handleAttach(request);
    }
    
    // Get conversation state
    if (path === '/get-state' && request.method === 'GET') {
      return this.handleGetState();
    }
    
    // Get enriched conversation status with execution results
    if (path === '/status' && request.method === 'GET') {
      return this.handleStatus();
    }
    
    // Stop conversation
    if (path === '/stop' && request.method === 'POST') {
      return this.handleStop();
    }
    
    // Delete this Durable Object (cleanup)
    if (path === '/delete' && request.method === 'POST') {
      return this.handleDelete();
    }
    
    // Trigger next iteration (after task completion)
    if (path === '/trigger-next-iteration' && request.method === 'POST') {
      return this.handleTriggerNextIteration();
    }
    
    // OpenHands response webhook (for flow execution)
    if (path === '/openhands-response' && request.method === 'POST') {
      return this.handleOpenHandsResponse(request);
    }
    
    // Resume execution after waiting for input
    if (path === '/resume' && request.method === 'POST') {
      return this.handleResume(request);
    }
    
    return new Response(JSON.stringify({
      error: 'Not found',
      available_endpoints: ['POST /initialize', 'POST /initialize-flow', 'POST /start-flow', 'POST /attach', 'GET /get-state', 'POST /stop', 'POST /delete', 'POST /trigger-next-iteration', 'POST /openhands-response', 'POST /resume']
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // ==========================================================================
  // HTTP HANDLERS
  // ==========================================================================
  
  /**
   * Handle OpenHands response webhook (for flow execution)
   */
  private async handleOpenHandsResponse(request: Request): Promise<Response> {
    try {
      await this.loadConversationState();
      
      if (!this.conversation) {
        return new Response(JSON.stringify({ error: 'Conversation not initialized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if this is a flow execution
      if (!this.conversation.flow_steps || this.conversation.flow_steps.length === 0) {
        return new Response(JSON.stringify({ error: 'Not a flow execution' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if we're waiting for OpenHands response
      if (this.conversation.state !== 'WAITING_OPENHANDS') {
        return new Response(JSON.stringify({ 
          error: 'Not waiting for OpenHands response',
          current_state: this.conversation.state,
          note: 'Only accept responses when in WAITING_OPENHANDS state'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const body = await request.json() as { response: string };
      console.log(`[DO:${this.state.id}] Received OpenHands response for flow execution`);
      
      // Store the response for conditional branching (will be synced with ai_output below)
      // this.conversation.last_step_response = body.response; // REMOVED - will be set with ai_output sync
      console.log(`[DO:${this.state.id}] Received response (${body.response.length} chars) for conditional branching`);
      
      // Save OpenHands step run to database
      if (this.conversation.current_step) {
        // Get the prompt that was sent to OpenHands (from conversation history or step data)
        const prompt = this.conversation.current_step.description || this.conversation.current_step.title || "OpenHands step";
        
        await this.saveStepRunToDatabase(
          this.conversation.current_step,
          prompt,
          body.response,
          'completed'
        );
        
        // Send output if enabled for current step
        await this.sendStepOutputIfEnabled(this.conversation.current_step, body.response);
        
        // STORE STEP RESPONSE: Call handleStepCompletion to store response in step's response field
        await this.handleStepCompletion(this.conversation.current_step, body.response);
        
        // Update execution context with OpenHands response for new condition system
        if (this.conversation.execution_context) {
          // UNIFIED: Store in ai_output with source field (same as DeepSeek)
          this.conversation.execution_context.ai_output = {
            response: body.response,
            intent: '',
            actions: [],
            metadata: {},
            source: 'openhands'
          };
          
          // SYNC: Keep last_step_response in sync with ai_output for legacy compatibility
          this.conversation.last_step_response = body.response;
          this.conversation.last_response = body.response;
          
          // Increment step_count AFTER successful completion
          this.conversation.execution_context.step_count += 1;
        }
      }
      
      // For flow execution, we just need to move to next step
      // Check if we have more steps
      const currentStepIndex = this.conversation.current_step_index || 0;
      
      if (currentStepIndex >= this.conversation.flow_steps.length) {
        // All steps completed
        console.log(`[DO:${this.state.id}] All ${this.conversation.flow_steps.length} steps completed`);
        
        // Save steps completed count before stopping
        const stepsCompleted = this.conversation.flow_steps.length;
        
        // Restart the flow with same payload before stopping
        await this.restartFlow();
        
        // Stop current conversation
        await this.stopConversation('flow_completed');
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Flow execution completed, restarting flow',
          steps_completed: stepsCompleted,
          note: 'Flow is being restarted with same payload, current conversation stopped'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // More steps to execute
        console.log(`[DO:${this.state.id}] Moving to next step (${currentStepIndex + 1}/${this.conversation.flow_steps.length})`);
        
        // Cancel any pending alarm
        try {
          await this.state.storage.deleteAlarm();
        } catch (error) {
          // Ignore if no alarm scheduled
        }
        
        // Process next step immediately
        this.conversation.state = 'SENDING_STEP';
        this.conversation.updated_at = Date.now();
        
        await this.state.storage.put('conversation', this.conversation);
        await this.handleSendingStepState();
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Moving to next step',
          current_step: currentStepIndex,
          total_steps: this.conversation.flow_steps.length
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] OpenHands response error: ${error.message}`);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Load and cache flow steps from D1 database
   * @param flowId The flow ID to load steps for
   * @returns Array of flow steps or null if not configured
   */
  private async loadFlowSteps(flowId: string): Promise<ExecutionStepData[] | null> {
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] FLOW_RUNS_DB not configured, cannot load flow steps`);
      return null;
    }
    
    // Check cache first
    const now = Date.now();
    if (this.flowStepsCache && 
        (now - this.flowStepsCacheTime) < this.FLOW_STEPS_CACHE_TTL &&
        this.conversation?.flow_id === flowId) {
      console.log(`[DO:${this.state.id}] Using cached flow steps for ${flowId}`);
      return this.flowStepsCache;
    }
    
    try {
      console.log(`[DO:${this.state.id}] Loading flow steps for ${flowId} from database`);
      const { getFlowSteps } = await import('../services/database');
      const steps = await getFlowSteps(this.env.FLOW_RUNS_DB, flowId);
      
      // Convert StepData[] to ExecutionStepData[] by adding response and status fields
      const executionSteps: ExecutionStepData[] = steps.map(step => ({
        ...step,
        response: null,
        status: 'pending' as const
      }));
      
      // Update cache
      this.flowStepsCache = executionSteps;
      this.flowStepsCacheTime = now;
      console.log(`[DO:${this.state.id}] Cached ${executionSteps.length} flow steps for ${flowId}`);
      
      return executionSteps;
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error loading flow steps: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get next step for current flow using cache
   * @returns Next step or null if no more steps
   */
  private async getNextStep(): Promise<ExecutionStepData | null> {
    if (!this.conversation?.flow_id) {
      console.log(`[DO:${this.state.id}] No flow_id in conversation`);
      return null;
    }
    
    const flowId = this.conversation.flow_id;
    
    // Check if we have a response from the previous step for conditional branching
    if (this.conversation.last_step_response && this.conversation.current_step) {
      console.log(`[DO:${this.state.id}] Checking conditional branching for flow ${flowId}`);
      console.log(`[DO:${this.state.id}] Current step: ${this.conversation.current_step.step_id}, Response length: ${this.conversation.last_step_response.length}`);
      
      // NEW: Load conditions for routing decision
      const conditionsQuery = `
        SELECT fsc.* 
        FROM flow_step_conditions fsc
        WHERE fsc.flow_step_id = ?
        ORDER BY fsc.created_at
      `;
      
      const conditionsResult = await this.env.FLOW_RUNS_DB.prepare(conditionsQuery).bind(this.conversation.current_step.step_id).all();
      const conditions = conditionsResult.results as any[];
      
      // Skip conditions with source field (handled by routing before getNextStep)
      const legacyConditions = conditions.filter(c => !c.source);
      
      if (legacyConditions.length > 0) {
        console.log(`[DO:${this.state.id}] Found ${legacyConditions.length} legacy conditions, using legacy conditional branching`);
        
        // Fall back to legacy conditional branching logic
        const { getNextStepBasedOnConditions } = await import('../services/database');
        const nextStep = await getNextStepBasedOnConditions(
          this.env.FLOW_RUNS_DB,
          flowId,
          this.conversation.current_step.step_id,
          this.conversation.last_step_response
        );
      
        if (nextStep) {
          console.log(`[DO:${this.state.id}] Legacy conditional branching selected step: ${nextStep.title} (order_index: ${nextStep.order_index})`);
          
          // Check for termination condition
          if (nextStep.order_index === -1) {
            console.log(`[DO:${this.state.id}] Termination step detected, returning null to end flow`);
            return null;
          }
          
          // Return the matched step - index update will happen in completion handler
          return nextStep;
        } else {
          console.log(`[DO:${this.state.id}] No conditional branching match, using sequential order`);
        }
      } else {
        console.log(`[DO:${this.state.id}] No legacy conditions found, using sequential order`);
      }
    }
    
    // Fall back to sequential steps if no conditional branching
    // First, try to use steps from conversation (they have execution state)
    let steps: ExecutionStepData[] | null = null;
    
    if (this.conversation.flow_steps && this.conversation.flow_steps.length > 0) {
      console.log(`[DO:${this.state.id}] Using steps from conversation.flow_steps (${this.conversation.flow_steps.length} steps)`);
      steps = this.conversation.flow_steps;
    } else {
      // Fall back to loading from database
      console.log(`[DO:${this.state.id}] No steps in conversation.flow_steps, loading from database`);
      steps = await this.loadFlowSteps(flowId);
    }
    
    if (!steps || steps.length === 0) {
      console.log(`[DO:${this.state.id}] No steps found for flow ${flowId}`);
      return null;
    }
    
    // Get current step index from conversation state
    const currentStepIndex = this.conversation.current_step_index || 0;
    
    if (currentStepIndex >= steps.length) {
      console.log(`[DO:${this.state.id}] All ${steps.length} steps completed for flow ${flowId}`);
      return null;
    }
    
    const nextStep = steps[currentStepIndex];
    console.log(`[DO:${this.state.id}] Next step for flow ${flowId}: ${nextStep.title} (index ${currentStepIndex + 1}/${steps.length})`);
    
    return nextStep;
  }

  // Increment step index and save to conversation state
  private async incrementStepIdx(): Promise<void> {
    if (!this.conversation) {
      return;
    }
    
    const currentIndex = this.conversation.current_step_index || 0;
    this.conversation.current_step_index = currentIndex + 1;
    this.conversation.updated_at = Date.now();
    
    await this.state.storage.put('conversation', this.conversation);
    console.log(`[DO:${this.state.id}] Incremented step index to ${this.conversation.current_step_index}`);
  }

  /**
   * Test method to check syntax
   */
  private async testMethod(): Promise<void> {
    console.log(`[DO:${this.state.id}] Test method`);
  }
  

  
  /**
   * Load project facts from D1 database
   * @returns Array of project facts or empty array if not configured
   */
  private async loadProjectFacts(): Promise<ProjectFact[]> {
    // project_facts table doesn't exist in our database setup
    // Return empty array for compatibility
    return [];
  }
  
  /**
   * Validate DeepSeek response uses facts correctly and resolve placeholders
   * @param response DeepSeek response text
   * @returns Validation and resolution result
   */
  private validateAndResolveDeepSeekResponse(response: string): {
    valid: boolean;
    error?: string;
    resolvedText: string;
  } {
    if (!this.conversation?.project_facts || this.conversation.project_facts.length === 0) {
      // No facts configured, pass through unchanged
      return { valid: true, resolvedText: response };
    }
    
    // Validate fact usage
    const validation = validateFactUsage(response, this.conversation.project_facts);
    if (!validation.valid) {
      return { valid: false, error: validation.error, resolvedText: response };
    }
    
    // Resolve placeholders
    const { resolvedText, unresolvedTags } = resolveFactPlaceholders(response, this.conversation.project_facts);
    
    if (unresolvedTags.length > 0) {
      return {
        valid: false,
        error: `Unresolved fact tags: ${unresolvedTags.join(', ')}`,
        resolvedText: response
      };
    }
    
    return { valid: true, resolvedText };
  }
  
  private async handleInitialize(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        repository: string;
        branch?: string;
        initial_user_prompt: string;
        max_iterations?: number;
        input_payload?: string;
      };
      const { repository, branch, initial_user_prompt, max_iterations, input_payload } = body;
      
      if (!repository || !initial_user_prompt) {
        return new Response(JSON.stringify({ error: 'Need repository and initial_user_prompt' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Ensure reasonable minimum iterations
      const effectiveMaxIterations = max_iterations && max_iterations >= 10 ? max_iterations : MAX_ITERATIONS;
      
      // Generate flow run ID
      this.flowRunId = generateFlowRunId();
      
      // Inject input_payload into prompt if available
      let finalPrompt = initial_user_prompt;
      if (input_payload) {
        console.log(`[DO:${this.state.id}] Injecting input_payload into prompt (${input_payload.length} chars)`);
        // Keep raw JSON string, don't stringify twice
        finalPrompt = initial_user_prompt
          ? `Input Data:\n${input_payload}\n\nUser Prompt:\n${initial_user_prompt}`
          : `Input Data:\n${input_payload}`;
      }
      
      // Initialize conversation - SIMPLIFIED: No database dependencies
      this.conversation = {
        state: 'INIT',
        initial_user_prompt: finalPrompt,
        iteration: 0,
        repository,
        branch,
        max_iterations: effectiveMaxIterations,
        status: 'active',
        created_at: Date.now(),
        updated_at: Date.now(),
        project_facts: [], // Empty array instead of database query
        agent: 'openhands', // Default agent for non-flow initialization
        step_status_sent: false, // Track if SENDING STEP status has been sent for current step
        input_payload: input_payload || undefined // Store input payload for flow-to-flow propagation
      };
      
      await this.state.storage.put('conversation', this.conversation);
      
      // Create initial flow run record
      await this.createInitialFlowRun();
      
      // Schedule first alarm immediately
      await this.scheduleNextAlarm(ALARM_DELAY_INIT);
      
      console.log(`[DO:${this.state.id}] Initialized conversation, alarm scheduled`);
      
      return new Response(JSON.stringify({
        success: true,
        conversation_id: this.state.id.toString(),
        state: 'INIT',
        message: 'Conversation initialized. First alarm scheduled.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Initialize error: ${error.message}`);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleInitializeFlow(request: Request): Promise<Response> {
    try {
      console.log(`[DO:${this.state.id}] handleInitializeFlow called`);
      
      const body = await request.json() as {
        flow_id: string;
        repository?: string;
        branch?: string;
        initial_user_prompt?: string;
        max_iterations?: number;
        input_payload?: string;
      };
      const { flow_id, repository, branch, initial_user_prompt, max_iterations, input_payload } = body;
      
      console.log(`[DO:${this.state.id}] Parsed request: flow_id=${flow_id}`);
      
      if (!flow_id) {
        return new Response(JSON.stringify({ error: 'Need flow_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      let currentStep: StepData | null = null;
      
      // Ensure reasonable minimum iterations
      let effectiveMaxIterations = max_iterations && max_iterations >= 10 ? max_iterations : MAX_ITERATIONS;
      
      // Generate flow run ID
      this.flowRunId = generateFlowRunId();
      console.log(`[DO:${this.state.id}] Generated flow run ID: ${this.flowRunId}`);
      
      // Load flow context from database (if available)
      let flowContext = null;
      let flowDefinition = null;
      let taskPrompt = initial_user_prompt || `Execute flow: ${flow_id}`;
      let steps: StepData[] = []; // Initialize steps array
      
      // Variables that might be overridden by flow definition
      let effectiveRepository = repository;
      let effectiveBranch = branch;
      
      if (this.env.FLOW_RUNS_DB) {
        console.log(`[DO:${this.state.id}] FLOW_RUNS_DB is available`);
        try {
          // Import the database functions
          console.log(`[DO:${this.state.id}] Attempting to import database functions...`);
          const { getFlowContext, getNextStepForFlow, startTaskExecution } = await import('../services/database');
          console.log(`[DO:${this.state.id}] Database functions imported successfully`);
          
          // Load flow context from database
          flowContext = await getFlowContext(this.env.FLOW_RUNS_DB, flow_id);
          console.log(`[DO:${this.state.id}] Flow context loaded: ${flowContext ? 'yes' : 'no'}`);
          
          if (flowContext) {
            flowDefinition = flowContext.definition;
            console.log(`[DO:${this.state.id}] Loaded flow context for ${flow_id}: ${flowDefinition.name}`);
            
            // Use flow definition values if not provided in request
            effectiveRepository = repository || flowDefinition.repository;
            effectiveBranch = branch || flowDefinition.branch;
            const effectiveFlowMaxIterations = flowDefinition.max_iterations;
            
            // Use flow max iterations if not specified in request
            if (!max_iterations && effectiveFlowMaxIterations > 0) {
              effectiveMaxIterations = Math.max(effectiveFlowMaxIterations, effectiveMaxIterations);
            }
            
            // Use flow's first_prompt (stored as description) for initial task prompt
            if (flowDefinition.description) {
              taskPrompt = flowDefinition.description;
              console.log(`[DO:${this.state.id}] Using flow first_prompt: ${taskPrompt.substring(0, 100)}...`);
            }
          } else {
            console.log(`[DO:${this.state.id}] No flow context found for ${flow_id}, using request parameters`);
          }
          
          // Load first step directly from database (bypass getNextStep which needs conversation)
          const { getFlowSteps } = await import('../services/database');
          steps = await getFlowSteps(this.env.FLOW_RUNS_DB, flow_id);
          currentStep = steps && steps.length > 0 ? steps[0] : null;
          console.log(`[DO:${this.state.id}] First step loaded: ${currentStep ? currentStep.title : 'none'}`);
          
          if (currentStep) {
            // Fetch task data if task_id is present OR if requires_task is true
            let taskData = null;
            let dynamicTaskId = null;
            
            // First try static task_id (only if non-empty string)
            if (currentStep.task_id && currentStep.task_id.trim() && this.env.FLOW_RUNS_DB) {
              try {
                taskData = await getTaskData(this.env.FLOW_RUNS_DB, currentStep.task_id);
                if (taskData) {
                  console.log(`[DO:${this.state.id}] Loaded task data for task: ${currentStep.task_id}`);
                } else {
                  console.log(`[DO:${this.state.id}] Task not found in FLOW_RUNS_DB: ${currentStep.task_id}`);
                  // Clear taskData so we can try requires_task if set
                  taskData = null;
                }
              } catch (error) {
                console.error(`[DO:${this.state.id}] Error loading task data from FLOW_RUNS_DB: ${error}`);
              }
            }
            
            // If no task data from task_id, try requires_task
            // Convert requires_task to boolean explicitly (database returns 0/1 as number or string)
            const requiresTask = this.convertRequiresTaskToBoolean(currentStep.requires_task);
            console.log(`[DO:${this.state.id}] Task injection debug (other): taskData=${!!taskData}, requiresTask=${requiresTask}, flow_id=${flow_id}, FLOW_RUNS_DB=${!!this.env.FLOW_RUNS_DB}`);
            if (!taskData && requiresTask && this.env.FLOW_RUNS_DB) {
              // Dynamic task assignment - get first pending task for this flow
              console.log(`[DO:${this.state.id}] Step requires dynamic task, fetching first pending task for flow: ${flow_id}`);
              try {
                const pendingTask = await getFirstPendingTask(this.env.FLOW_RUNS_DB, flow_id);
                if (pendingTask) {
                  taskData = {
                    title: pendingTask.title,
                    description: pendingTask.description,
                    payload: pendingTask.payload
                  };
                  dynamicTaskId = pendingTask.id;
                  console.log(`[DO:${this.state.id}] Loaded first pending task: ${pendingTask.id} - ${pendingTask.title}`);
                } else {
                  console.log(`[DO:${this.state.id}] No pending tasks found for flow: ${flow_id}`);
                }
              } catch (error) {
                console.error(`[DO:${this.state.id}] Error loading first pending task: ${error}`);
              }
            }
            
            // Use the new step resolver for dynamic API data fetching
            // This handles both new input_keys system and backward compatibility
            try {
              // Get previous step responses for variable substitution
              const previousStepResponses = await this.getPreviousStepResponses();
              
              const resolvedStep = await resolveStepInstructions(
                currentStep,
                this.env.FLOW_RUNS_DB,
                this.env as Record<string, string>,
                {
                  flow_id: flow_id,
                  execution_id: this.flowRunId,
                  step_id: currentStep.step_id,
                  previous_step_responses: previousStepResponses
                }
              );
              
              // Build the task prompt with resolved instructions
              // Remove "Step X: " prefix from title to prevent AI from inferring progress
              const stepTitleWithoutNumber = currentStep.title.replace(/^Step \d+: /, '');
              taskPrompt = `Execute step: ${stepTitleWithoutNumber}`;
              
              // Add task data if available (backward compatibility)
              if (resolvedStep.task_data) {
                taskPrompt += `\n\n=== TASK ===`;
                const taskId = dynamicTaskId || currentStep.task_id;
                if (taskId) {
                  taskPrompt += `\nTask ID: ${taskId}`;
                }
                if (resolvedStep.task_data.title) {
                  taskPrompt += `\nTitle: ${resolvedStep.task_data.title}`;
                }
                if (resolvedStep.task_data.description) {
                  taskPrompt += `\nDescription: ${resolvedStep.task_data.description}`;
                }
                taskPrompt += `\n=== END TASK ===\n`;
                
                // Store dynamic task ID if we fetched one
                if (dynamicTaskId) {
                  console.log(`[DO:${this.state.id}] Using dynamic task ID: ${dynamicTaskId}`);
                }
              }
              
              // Add the resolved instructions
              taskPrompt += `\n${resolvedStep.instructions}`;
              
              // Add expected_response after instructions if provided
              if (currentStep.expected_response) {
                taskPrompt += `\n\nExpected response format:\n${currentStep.expected_response}`;
              }
              
              // Log API responses if any (for debugging)
              if (resolvedStep.api_responses && Object.keys(resolvedStep.api_responses).length > 0) {
                console.log(`[DO:${this.state.id}] Step ${currentStep.step_id} API responses:`, 
                  Object.keys(resolvedStep.api_responses).map(key => `${key}: ${resolvedStep.api_responses![key].success ? 'success' : 'failed'}`)
                );
              }
              
            } catch (error) {
              console.error(`[DO:${this.state.id}] Error resolving step instructions: ${error.message}`);
              
              // Fall back to old logic if step resolver fails
              // Remove "Step X: " prefix from title to prevent AI from inferring progress
              const stepTitleWithoutNumber = currentStep.title.replace(/^Step \d+: /, '');
              taskPrompt = `Execute step: ${stepTitleWithoutNumber}`;
              
              if (taskData) {
                taskPrompt += `\n\n=== TASK ===`;
                const taskId = dynamicTaskId || currentStep.task_id;
                if (taskId) {
                  taskPrompt += `\nTask ID: ${taskId}`;
                }
                if (taskData.title) {
                  taskPrompt += `\nTitle: ${taskData.title}`;
                }
                if (taskData.description) {
                  taskPrompt += `\nDescription: ${taskData.description}`;
                }
                taskPrompt += `\n=== END TASK ===\n`;
              }
              
              if (currentStep.description) {
                taskPrompt += `\n${currentStep.description}`;
              }
            }
            
            // Add step metadata
            if (currentStep.page_key) {
              taskPrompt += `\nPage: ${currentStep.page_key}`;
            }
            if (currentStep.blocking === false) {
              taskPrompt += `\nNote: This step is non-blocking - flow can continue even if this step fails`;
            }
            
            console.log(`[DO:${this.state.id}] Loaded step for flow ${flow_id}: ${currentStep.title} (${currentStep.step_type})`);
            
            // Start tracking step execution (using task_execution_steps table for now)
            try {
              const executionResult = await startTaskExecution(
                this.env.FLOW_RUNS_DB, 
                this.flowRunId!,
                currentStep.step_id
              );
              
              if (executionResult.success) {
                console.log(`[DO:${this.state.id}] Started tracking step execution: ${executionResult.execution_step_id}`);
                // Store execution step ID for later completion
                this.conversation!.current_execution_step_id = executionResult.execution_step_id;
                // Store step data for reference
                this.conversation!.current_step = currentStep;
                // Set current step index to 0 (first step)
                this.conversation!.current_step_index = 0;
              }
            } catch (trackingError: any) {
              console.error(`[DO:${this.state.id}] Error tracking step execution: ${trackingError.message}`);
              // Continue even if tracking fails
            }
          } else {
            console.log(`[DO:${this.state.id}] No steps found for flow ${flow_id}`);
          }
        } catch (error: any) {
          console.error(`[DO:${this.state.id}] Error loading flow context for ${flow_id}: ${error.message}`);
          console.error(`[DO:${this.state.id}] Error stack: ${error.stack}`);
          // Continue without flow context if database error occurs
        }
      } else {
        console.log(`[DO:${this.state.id}] FLOW_RUNS_DB not available, proceeding without flow context loading`);
      }
      
      // Initialize conversation for flow execution
      // Convert steps to ExecutionStepData by adding response and status fields
      const executionSteps: ExecutionStepData[] = steps ? steps.map(step => ({
        ...step,
        response: null,
        status: 'pending' as const
      })) : [];
      
      // Inject input_payload into prompt if available
      let finalPrompt = taskPrompt;
      if (input_payload) {
        console.log(`[DO:${this.state.id}] Injecting input_payload into prompt (${input_payload.length} chars)`);
        // Keep raw JSON string, don't stringify twice
        finalPrompt = taskPrompt
          ? `Input Data:\n${input_payload}\n\nUser Prompt:\n${taskPrompt}`
          : `Input Data:\n${input_payload}`;
      }
      
      this.conversation = {
        state: 'INIT',
        initial_user_prompt: finalPrompt,
        iteration: 0,
        repository: effectiveRepository || 'flow/execution',
        branch: effectiveBranch || 'main',
        max_iterations: effectiveMaxIterations,
        status: 'active',
        created_at: Date.now(),
        updated_at: Date.now(),
        project_facts: [], // Empty array instead of database query
        flow_id: flow_id, // Store flow ID for flow execution
        flow_steps: executionSteps, // Store all flow steps with execution data
        flow_completed: false, // Track if flow execution is complete
        current_step_index: 0, // Start at first step
        flow_execution_mode: true, // Flag to indicate flow execution mode,
        input_payload: input_payload || undefined, // Store input payload for flow-to-flow propagation
        
        // Store flow context for reference
        flow_context: flowContext ? {
          definition: flowDefinition,
          has_project_context: flowContext.project_context.length > 0,
          has_testing_priorities: flowContext.testing_priorities.length > 0,
          has_api_commands: flowContext.api_commands.length > 0
        } : undefined,
        
        // Task-based execution fields
        task_execution_mode: currentStep !== null,
        current_task_id: currentStep?.step_id,
        step_status_sent: false, // Track if SENDING STEP status has been sent for current step
        current_task_title: currentStep?.title,
        current_task_description: currentStep?.description || undefined,
        
        // Set agent from flow definition or default to 'openhands'
        agent: flowDefinition?.agent || 'openhands'
      };
      
      // Set current_step if we have steps
      if (executionSteps && executionSteps.length > 0) {
        this.conversation.current_step = executionSteps[0];
      }
      
      await this.state.storage.put('conversation', this.conversation);
      
      // Create initial flow run record in database
      await this.createInitialFlowRun();
      
      // Schedule first alarm immediately
      await this.scheduleNextAlarm(ALARM_DELAY_INIT);
      
      console.log(`[DO:${this.state.id}] Initialized flow execution for flow: ${flow_id}, alarm scheduled`);
      
      const responseData: FlowInitResponse = {
        success: true,
        conversation_id: this.state.id.toString(),
        flow_id: flow_id,
        state: 'INIT',
        message: 'Flow execution initialized. First alarm scheduled.',
        note: 'Flow execution: DeepSeek → OpenHands → API validation → Next step'
      };
      
      // Task info not available in flow execution mode - using currentStep instead
      
      return new Response(JSON.stringify(responseData), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Initialize flow error: ${error.message}`);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Ultra-minimal flow execution handler
  private async handleStartFlow(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { flow_id: string; inputs?: Record<string, any>; callback_url?: string };
      const { flow_id, inputs = {}, callback_url } = body;
      
      if (!flow_id) {
        return new Response(JSON.stringify({ error: 'Need flow_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`[DO:${this.state.id}] Starting ultra-minimal flow: ${flow_id}`);
      console.log(`[DO:${this.state.id}] DEBUG: handleStartFlow called at ${Date.now()}`);
      
      // Store flow_id for error reporting
      let errorContext = `flow_id: ${flow_id}`;
      
      // Load flow definition from database
      let flowDefinition = null;
      let effectiveRepository = '[FLOW]';
      let effectiveBranch = '[FLOW]';
      let effectiveMaxIterations = 20; // Default
      let databaseAvailable = false;
      
      if (this.env.FLOW_RUNS_DB) {
        try {
          errorContext += `, FLOW_RUNS_DB: available`;
          // Import database functions
          const { getFlowDefinition } = await import('../services/database');
          console.log(`[DO:${this.state.id}] Calling getFlowDefinition for ${flow_id}`);
          flowDefinition = await getFlowDefinition(this.env.FLOW_RUNS_DB, flow_id);
          
          if (flowDefinition) {
            console.log(`[DO:${this.state.id}] Loaded flow definition for ${flow_id}: ${flowDefinition.name}`);
            console.log(`[DO:${this.state.id}] Flow definition agent field: ${flowDefinition.agent || 'not set (defaults to openhands)'}`);
            databaseAvailable = true;
            
            // Use flow definition values
            effectiveRepository = flowDefinition.repository || '[FLOW]';
            effectiveBranch = flowDefinition.branch || '[FLOW]';
            
            // Use flow max iterations if available
            if (flowDefinition.max_iterations && flowDefinition.max_iterations > 0) {
              effectiveMaxIterations = flowDefinition.max_iterations;
            }
            
            console.log(`[DO:${this.state.id}] Using repository from database: ${effectiveRepository}, branch: ${effectiveBranch}, agent: ${flowDefinition?.agent || 'openhands'}`);
            
            // Warn if repository is placeholder
            if (effectiveRepository === '[FLOW]') {
              console.warn(`[DO:${this.state.id}] WARNING: Repository is placeholder '[FLOW]'. OpenHands conversation will be created but may not work correctly.`);
            }
          } else {
            console.warn(`[DO:${this.state.id}] No flow definition found for ${flow_id} in database. Using placeholder values.`);
            console.warn(`[DO:${this.state.id}] To fix: Ensure 'flow_definitions' table exists with repository and branch columns.`);
            // Note: agent will be set to 'openhands' as default when conversation object is created below
          }
        } catch (error: any) {
          console.error(`[DO:${this.state.id}] Error loading flow definition: ${error.message}`);
          console.error(`[DO:${this.state.id}] Database error details: ${error.message}`);
          console.error(`[DO:${this.state.id}] Using placeholder values. Check if 'flow_definitions' table exists.`);
          errorContext += `, flow_definition_error: ${error.message}`;
        }
      } else {
        console.warn(`[DO:${this.state.id}] FLOW_RUNS_DB not configured. Using placeholder values for repository and branch.`);
        errorContext += `, FLOW_RUNS_DB: not configured`;
      }
      
      // Load steps from database
      errorContext += `, loading steps`;
      console.log(`[DO:${this.state.id}] Calling loadFlowStepsFromDB for flow: ${flow_id}`);
      const steps = await this.loadFlowStepsFromDB(flow_id);
      console.log(`[DO:${this.state.id}] loadFlowStepsFromDB returned ${steps?.length || 0} steps`);
      
      if (!steps || steps.length === 0) {
        console.error(`[DO:${this.state.id}] No steps found for flow: ${flow_id}`);
        console.error(`[DO:${this.state.id}] Error context: ${errorContext}`);
        return new Response(JSON.stringify({ 
          error: `No steps found for flow: ${flow_id}`,
          context: errorContext
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`[DO:${this.state.id}] Loaded ${steps.length} steps for flow: ${flow_id}`);
      errorContext += `, steps: ${steps.length}`;
      
      // Adjust max iterations based on number of steps if not set by flow definition
      if (effectiveMaxIterations === 20) {
        effectiveMaxIterations = steps.length * 2; // Enough for all steps
      }
      
      // Resolve first step instructions with task data if needed
      let initialPrompt = `Execute flow: ${flow_id}`;
      const firstStep = steps[0];
      
      if (firstStep && this.env.FLOW_RUNS_DB) {
        try {
          console.log(`[DO:${this.state.id}] Attempting to resolve step instructions for step: ${firstStep.step_key}`);
          console.log(`[DO:${this.state.id}] Step has input_keys: ${!!firstStep.input_keys}`);
          console.log(`[DO:${this.state.id}] Step has task_id: ${firstStep.task_id}`);
          
          // Import step resolver
          const { resolveStepInstructions } = await import('../services/stepResolver');
          
          // Resolve step instructions with task data and inputs
          const resolvedStep = await resolveStepInstructions(
            firstStep,
            this.env.FLOW_RUNS_DB,
            this.env as Record<string, string>,
            {
              flow_id: flow_id,
              execution_id: `flow-${Date.now()}`,
              step_id: firstStep.step_id,
              previous_step_responses: {}, // First step has no previous responses
              inputs: inputs // Pass inputs for [input:name] replacement
            }
          );
          
          // Use resolved instructions directly
          initialPrompt = resolvedStep.instructions;
          
          // Add expected_response after instructions if provided
          if (firstStep.expected_response) {
            initialPrompt += `\n\nExpected response format:\n${firstStep.expected_response}`;
          }
          
          console.log(`[DO:${this.state.id}] Successfully resolved step instructions with task data`);
          console.log(`[DO:${this.state.id}] Resolved instructions length: ${initialPrompt.length}`);
          console.log(`[DO:${this.state.id}] First 200 chars of resolved instructions: ${initialPrompt.substring(0, 200)}`);
          
          // DEBUG: Check if [input:message] was replaced
          if (initialPrompt.includes('[input:')) {
            console.log(`[DO:${this.state.id}] DEBUG: Resolved instructions still contains [input: placeholder after injection`);
            console.log(`[DO:${this.state.id}] DEBUG: Inputs passed:`, Object.keys(inputs));
          } else {
            console.log(`[DO:${this.state.id}] DEBUG: [input:message] placeholder was successfully replaced`);
          }
        } catch (error: any) {
          console.error(`[DO:${this.state.id}] Error resolving step instructions: ${error.message}`);
          console.error(`[DO:${this.state.id}] Error stack: ${error.stack}`);
          // Continue with default prompt if resolution fails
        }
      }
      
      // Create ultra-minimal conversation with values from flow definition
      // Convert steps to ExecutionStepData by adding response and status fields
      const executionSteps: ExecutionStepData[] = steps.map(step => ({
        ...step,
        response: null,
        status: 'pending' as const
      }));
      
      if (!executionSteps || executionSteps.length === 0) {
        throw new Error('invalid_flow_no_steps');
      }
      
      console.log('FLOW_START_VALIDATION', {
        stepsCount: executionSteps.length
      });
      
      this.conversation = {
        state: 'SENDING_STEP',
        initial_user_prompt: initialPrompt,
        iteration: 0,
        repository: effectiveRepository,
        branch: effectiveBranch,
        max_iterations: effectiveMaxIterations,
        status: 'active',
        created_at: Date.now(),
        updated_at: Date.now(),
        project_facts: [],
        flow_id: flow_id,
        flow_steps: executionSteps,
        flow_completed: false, // Track if flow execution is complete
        current_step_index: 0,
        agent: flowDefinition?.agent || 'openhands', // Set agent from flow definition
        flow_execution_mode: true, // Enable flow execution mode for step-by-step execution
        step_status_sent: false, // Track if SENDING STEP status has been sent for current step
        // Initialize execution context with provided inputs
        execution_context: createExecutionContext(flow_id, executionSteps[0]?.step_id || 'step-1')
      };
      
      console.log(`[DO:${this.state.id}] DEBUG: Conversation object created with state: ${this.conversation.state}`);
      console.log(`[DO:${this.state.id}] DEBUG: Flow steps count: ${this.conversation.flow_steps?.length || 0}`);
      console.log(`[DO:${this.state.id}] DEBUG: Flow ID: ${this.conversation.flow_id}`);
      
      // Store provided inputs in execution context
      if (Object.keys(inputs).length > 0) {
        for (const [key, value] of Object.entries(inputs)) {
          this.conversation.execution_context!.inputs[key] = {
            value,
            metadata: {
              source: 'start_endpoint',
              timestamp: Date.now(),
              step_id: 'initial',
              input_name: key
            }
          };
        }
        console.log(`[DO:${this.state.id}] Stored ${Object.keys(inputs).length} inputs from /start endpoint`);
      }

      // Store callback_url if provided
      if (callback_url) {
        this.conversation.execution_context!.callback_url = callback_url;
        console.log(`[DO:${this.state.id}] Stored callback_url: ${callback_url}`);
      }
      
      // Set current_step (guaranteed to exist after validation)
      this.conversation.current_step = executionSteps[0];
      
      // DEBUG: Log current_step details
      console.log(`[DO:${this.state.id}] DEBUG: Setting current_step in handleStartFlow:`, {
        step_id: this.conversation.current_step.step_id,
        step_key: this.conversation.current_step.step_key,
        title: this.conversation.current_step.title,
        next_flow_id: this.conversation.current_step.next_flow_id,
        has_next_flow_id: this.conversation.current_step.next_flow_id !== undefined && this.conversation.current_step.next_flow_id !== null
      });
      
      await this.state.storage.put('conversation', this.conversation);
      
      // Generate flow run ID and save to database
      this.flowRunId = generateFlowRunId();
      console.log(`[DO:${this.state.id}] Generated flow run ID: ${this.flowRunId}`);
      console.log(`[DO:${this.state.id}] Database available: ${!!this.env.FLOW_RUNS_DB}`);
      console.log(`[DO:${this.state.id}] Conversation flow_id: ${this.conversation?.flow_id}`);
      console.log(`[DO:${this.state.id}] Conversation created_at: ${this.conversation?.created_at}`);
      
      // Emit FLOW_STARTED event for UI streaming
      this.emitFlowStarted(flow_id, this.flowRunId);
      
      await this.createInitialFlowRun();
      
      // Schedule alarm to send first step
      const alarmTime = Date.now() + 1000;
      console.log(`[DO:${this.state.id}] DEBUG: Setting alarm for ${alarmTime} (current time: ${Date.now()})`);
      await this.state.storage.setAlarm(alarmTime);
      console.log(`[DO:${this.state.id}] DEBUG: Alarm set successfully`);
      
      console.log(`[DO:${this.state.id}] Ultra-minimal flow initialized with ${steps.length} steps, repository: ${effectiveRepository}, branch: ${effectiveBranch}`);
      
      return new Response(JSON.stringify({
        success: true,
        flow_id: flow_id,
        repository: effectiveRepository,
        branch: effectiveBranch,
        steps_count: steps.length,
        database_available: databaseAvailable,
        repository_source: databaseAvailable && flowDefinition ? 'database' : 'placeholder',
        message: databaseAvailable && flowDefinition 
          ? 'Ultra-minimal flow execution started with repository and branch from database' 
          : 'Ultra-minimal flow execution started with placeholder repository and branch (database not available or flow definition not found)',
        warning: effectiveRepository === '[FLOW]' 
          ? 'Repository is placeholder "[FLOW]". OpenHands conversation may not work correctly without a valid repository.' 
          : undefined,
        conversation_id: this.state.id.toString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Start flow error: ${error.message}`);
      console.error(`[DO:${this.state.id}] Error context: ${errorContext}`);
      console.error(`[DO:${this.state.id}] Error stack: ${error.stack}`);
      return new Response(JSON.stringify({ 
        error: error.message,
        context: errorContext,
        flow_id: flow_id
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Helper to convert requires_task value to boolean (handles 0, 1, "0", "1", true, false)
  private convertRequiresTaskToBoolean(requiresTaskValue: any): boolean {
    if (requiresTaskValue === true || requiresTaskValue === 1 || requiresTaskValue === "1" || requiresTaskValue === "true") {
      return true;
    }
    return false; // Handles false, 0, "0", "false", null, undefined, etc.
  }

  // Helper to convert output value to boolean (handles 0, 1, "0", "1", true, false)
  private convertOutputToBoolean(outputValue: any): boolean {
    if (outputValue === true || outputValue === 1 || outputValue === "1" || outputValue === "true") {
      return true;
    }
    return false; // Handles false, 0, "0", "false", null, undefined, etc.
  }

  /**
   * Check if step is in dual-agent mode
   */
  private isDualAgentStep(step: StepData): boolean {
    return step.dual_agent === true || step.dual_agent === 'true' || step.dual_agent === 1;
  }

  /**
   * Handle dual-agent conversation loop
   */
  private async handleDualAgentConversation(step: StepData): Promise<void> {
    if (!this.isDualAgentStep(step)) {
      return;
    }

    console.log(`[DO:${this.state.id}] Starting dual-agent conversation for step: ${step.title}`);
    
    const rulerAgent = step.ruler_agent || 'openhands';
    const goalCriteria = step.goal_criteria || 'Complete the task according to instructions';
    const maxIterations = step.max_iterations_per_step || 5;
    const expectedResponse = step.expected_response || '';
    
    console.log(`[DO:${this.state.id}] Dual-agent config: ruler=${rulerAgent}, max_iterations=${maxIterations}, goal=${goalCriteria.substring(0, 100)}...`);
    
    // Initialize dual-agent state
    this.conversation.dual_agent_state = {
      step_id: step.step_id,
      ruler_agent: rulerAgent,
      goal_criteria: goalCriteria,
      max_iterations: maxIterations,
      current_iteration: 0,
      conversation_history: [],
      is_complete: false,
      completion_reason: ''
    };
    
    await this.state.storage.put('conversation', this.conversation);
    
    // Start the dual-agent conversation
    await this.startDualAgentIteration();
  }

  /**
   * Start a dual-agent iteration
   */
  private async startDualAgentIteration(): Promise<void> {
    if (!this.conversation.dual_agent_state) {
      return;
    }
    
    const dualState = this.conversation.dual_agent_state;
    dualState.current_iteration++;
    
    console.log(`[DO:${this.state.id}] Starting dual-agent iteration ${dualState.current_iteration}/${dualState.max_iterations}`);
    
    if (dualState.current_iteration > dualState.max_iterations) {
      console.log(`[DO:${this.state.id}] Dual-agent max iterations reached (${dualState.max_iterations})`);
      dualState.is_complete = true;
      dualState.completion_reason = 'max_iterations_reached';
      await this.state.storage.put('conversation', this.conversation);
      await this.completeDualAgentStep();
      return;
    }
    
    // Determine which agent should speak this iteration
    const isRulerTurn = dualState.current_iteration % 2 === 1; // Ruler speaks on odd iterations
    const currentAgent = isRulerTurn ? dualState.ruler_agent : 'deepseek';
    
    console.log(`[DO:${this.state.id}] Dual-agent iteration ${dualState.current_iteration}: ${currentAgent}'s turn`);
    
    // Build the conversation context
    let prompt = '';
    
    if (dualState.current_iteration === 1) {
      // First iteration: Start with the step instructions
      const currentStep = this.conversation.flow_steps.find(s => s.step_id === dualState.step_id);
      if (currentStep) {
        prompt = `Dual-Agent Conversation: ${currentStep.title}\n\n`;
        prompt += `Goal: ${dualState.goal_criteria}\n\n`;
        prompt += `Instructions: ${currentStep.description || currentStep.instructions || ''}\n\n`;
        
        if (currentStep.expected_response) {
          prompt += `Expected Response Format:\n${currentStep.expected_response}\n\n`;
        }
        
        prompt += `Ruler Agent (${dualState.ruler_agent}): Please start the conversation to achieve the goal.`;
      }
    } else {
      // Subsequent iterations: Continue the conversation
      prompt = `Dual-Agent Conversation - Iteration ${dualState.current_iteration}/${dualState.max_iterations}\n\n`;
      prompt += `Goal: ${dualState.goal_criteria}\n\n`;
      prompt += `Conversation History:\n`;
      
      dualState.conversation_history.forEach((entry, index) => {
        prompt += `${index + 1}. ${entry.agent}: ${entry.message.substring(0, 200)}...\n`;
      });
      
      prompt += `\n${currentAgent}: Please continue the conversation to achieve the goal.`;
    }
    
    // Store the prompt in conversation state
    this.conversation.current_prompt = prompt;
    await this.state.storage.put('conversation', this.conversation);
    
    // Send to the appropriate agent
    if (currentAgent === 'deepseek') {
      await this.sendToDeepSeek(prompt);
    } else {
      // For other agents (openhands), we would need to implement agent-specific handling
      console.log(`[DO:${this.state.id}] Would send to ${currentAgent}: ${prompt.substring(0, 100)}...`);
      // For now, treat as deepseek
      await this.sendToDeepSeek(prompt);
    }
  }

  /**
   * Handle dual-agent response
   */
  private async handleDualAgentResponse(response: string): Promise<void> {
    if (!this.conversation.dual_agent_state) {
      return;
    }
    
    const dualState = this.conversation.dual_agent_state;
    const isRulerTurn = dualState.current_iteration % 2 === 1;
    const currentAgent = isRulerTurn ? dualState.ruler_agent : 'deepseek';
    
    // Add to conversation history
    dualState.conversation_history.push({
      iteration: dualState.current_iteration,
      agent: currentAgent,
      message: response,
      timestamp: Date.now()
    });
    
    console.log(`[DO:${this.state.id}] Dual-agent response from ${currentAgent} (iteration ${dualState.current_iteration}): ${response.substring(0, 100)}...`);
    
    // Check if goal is achieved
    const goalAchieved = await this.checkDualAgentGoal(response);
    
    if (goalAchieved) {
      console.log(`[DO:${this.state.id}] Dual-agent goal achieved!`);
      dualState.is_complete = true;
      dualState.completion_reason = 'goal_achieved';
      await this.state.storage.put('conversation', this.conversation);
      await this.completeDualAgentStep();
      return;
    }
    
    // Save updated state
    await this.state.storage.put('conversation', this.conversation);
    
    // Continue to next iteration
    await this.startDualAgentIteration();
  }

  /**
   * Check if dual-agent goal is achieved
   */
  private async checkDualAgentGoal(response: string): Promise<boolean> {
    if (!this.conversation.dual_agent_state) {
      return false;
    }
    
    const dualState = this.conversation.dual_agent_state;
    const goalCriteria = dualState.goal_criteria.toLowerCase();
    const responseLower = response.toLowerCase();
    
    // Simple keyword matching for now
    // In a real implementation, this would use more sophisticated NLP
    const completionKeywords = ['completed', 'finished', 'done', 'achieved', 'success', 'ready', 'final'];
    const goalKeywords = goalCriteria.split(' ').filter(word => word.length > 3);
    
    // Check for completion keywords
    const hasCompletion = completionKeywords.some(keyword => responseLower.includes(keyword));
    
    // Check for goal keywords
    const hasGoalKeywords = goalKeywords.every(keyword => 
      responseLower.includes(keyword.toLowerCase()) || keyword.length < 4
    );
    
    // Also check if this looks like a final answer
    const isFinalAnswer = responseLower.includes('final answer') || 
                         responseLower.includes('conclusion') ||
                         responseLower.includes('summary');
    
    return hasCompletion && (hasGoalKeywords || isFinalAnswer);
  }

  /**
   * Complete dual-agent step
   */
  private async completeDualAgentStep(): Promise<void> {
    if (!this.conversation.dual_agent_state) {
      return;
    }
    
    const dualState = this.conversation.dual_agent_state;
    console.log(`[DO:${this.state.id}] Completing dual-agent step: ${dualState.completion_reason}`);
    
    // Get the last response as the step output
    const lastResponse = dualState.conversation_history.length > 0 
      ? dualState.conversation_history[dualState.conversation_history.length - 1].message
      : 'Dual-agent conversation completed';
    
    // Find the current step
    const currentStep = this.conversation.flow_steps.find(s => s.step_id === dualState.step_id);
    if (currentStep) {
      // Handle step completion with the final response
      await this.handleStepCompletion(currentStep, lastResponse);
    }
    
    // Clear dual-agent state
    this.conversation.dual_agent_state = undefined;
    await this.state.storage.put('conversation', this.conversation);
  }

  // Helper to send step response to output_url if output is enabled
  /**
   * Filter out status messages from AI response
   */
  private filterStatusMessages(response: string): string {
    // Remove lines that look like status messages
    console.log(`[DO:${this.state.id}] Filtering status messages from response: ${response.substring(0, 200)}...`);
    const lines = response.split('\n');
    const filteredLines = lines.filter(line => {
      // Remove lines that start with **Status:**, **Step:**, or **Progress:**
      const shouldFilter = line.trim().startsWith('**Status:**') || 
             line.trim().startsWith('**Step:**') || 
             line.trim().startsWith('**Progress:**');
      if (shouldFilter) {
        console.log(`[DO:${this.state.id}] Filtering out line: ${line}`);
      }
      return !shouldFilter;
    });
    const filteredResponse = filteredLines.join('\n').trim();
    console.log(`[DO:${this.state.id}] Filtered response: ${filteredResponse.substring(0, 200)}...`);
    return filteredResponse;
  }

  /**
   * Send step status message (SENDING STEP or STEP COMPLETED)
   */
  private async sendStepStatus(step: any, status: 'SENDING STEP' | 'STEP COMPLETED'): Promise<void> {
    if (!step || !this.conversation) {
      console.log(`[DO:${this.state.id}] No step or conversation for status sending`);
      return;
    }

    // Check if output is enabled for this step
    const outputEnabled = this.convertOutputToBoolean(step.output);
    if (!outputEnabled) {
      console.log(`[DO:${this.state.id}] Output not enabled for step: ${step.title}, skipping status`);
      return;
    }

    // Check if output_url is provided
    if (!step.output_url || !step.output_url.trim()) {
      console.log(`[DO:${this.state.id}] Output enabled but no output_url provided for step: ${step.title}, skipping status`);
      return;
    }

    // Calculate progress
    const totalSteps = this.conversation.flow_steps?.length || 0;
    const currentStep = this.conversation.current_flow_step || 1;
    // For SENDING STEP: progress = currentStep/totalSteps (current step number)
    // For STEP COMPLETED: progress = currentStep/totalSteps (steps completed including this one)
    // Note: Both use currentStep because when sending a step, we're on that step
    // When step completes, we're still on that step (moveToNextStep happens after)
    const progress = `${currentStep}/${totalSteps}`;

    // Format status message
    const statusMessage = `**Status:** ${status}\n**Step:** ${step.title}\n**Progress:** ${progress}`;

    console.log(`[DO:${this.state.id}] Sending ${status} status for step "${step.title}" with progress ${progress}`);

    // Send status message
    await this.sendStepOutputIfEnabled(step, statusMessage);
  }

  private async sendStepOutputIfEnabled(step: any, response: any): Promise<void> {
    if (!step) {
      console.log(`[DO:${this.state.id}] No step provided for output sending`);
      return;
    }

    // Check if output is enabled for this step
    const outputEnabled = this.convertOutputToBoolean(step.output);
    if (!outputEnabled) {
      console.log(`[DO:${this.state.id}] Output not enabled for step: ${step.title}`);
      return;
    }

    // Check if output_url is provided
    if (!step.output_url || !step.output_url.trim()) {
      console.log(`[DO:${this.state.id}] Output enabled but no output_url provided for step: ${step.title}`);
      return;
    }

    console.log(`[DO:${this.state.id}] Sending output for step "${step.title}" to: ${step.output_url}`);

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if output_auth_token is provided
      if (step.output_auth_token && step.output_auth_token.trim()) {
        headers['Authorization'] = `Bearer ${step.output_auth_token.trim()}`;
        console.log(`[DO:${this.state.id}] Added Authorization header for step "${step.title}"`);
      }

      // Check if this is a Cloudflare D1 API endpoint
      const isCloudflareD1Endpoint = step.output_url.includes('cloudflare.com/client/v4/accounts') && 
                                     step.output_url.includes('/d1/database/') && 
                                     step.output_url.includes('/query');
      
      let requestBody: string;
      
      // Try to parse response as JSON to determine if we should send it directly
      let parsedResponse: any = null;
      let responseString: string;
      let isJsonObject = false;
      
      // Convert response to string for logging and fallback
      if (typeof response === 'string') {
        responseString = response;
        try {
          parsedResponse = JSON.parse(response);
          console.log(`[DO:${this.state.id}] Successfully parsed string response as JSON`);
          // Check if it's a JSON object (not array, not primitive)
          isJsonObject = parsedResponse && typeof parsedResponse === 'object' && !Array.isArray(parsedResponse);
        } catch (parseError) {
          parsedResponse = null;
          console.log(`[DO:${this.state.id}] String response is not valid JSON: ${parseError.message}`);
        }
      } else if (typeof response === 'object' && response !== null) {
        // Response is already an object
        parsedResponse = response;
        responseString = JSON.stringify(response);
        console.log(`[DO:${this.state.id}] Response is already an object`);
        // Check if it's a JSON object (not array)
        isJsonObject = !Array.isArray(parsedResponse);
      } else {
        // Response is some other type (number, boolean, etc.)
        responseString = String(response);
        parsedResponse = null;
        console.log(`[DO:${this.state.id}] Response is not string or object, converting to string: ${typeof response}`);
      }
      
      // Determine if we should send the response directly or wrap it
      let sendDirectly = false;
      
      if (isCloudflareD1Endpoint) {
        // For Cloudflare D1 API, send directly only if it has a sql field
        if (parsedResponse && typeof parsedResponse === 'object' && parsedResponse.sql) {
          sendDirectly = true;
          console.log(`[DO:${this.state.id}] Sending direct SQL to Cloudflare D1 API: ${parsedResponse.sql.substring(0, 100)}...`);
        } else {
          console.log(`[DO:${this.state.id}] D1 endpoint but response doesn't contain 'sql' field or isn't valid JSON object`);
          if (parsedResponse) {
            console.log(`[DO:${this.state.id}] Parsed response type: ${typeof parsedResponse}, is object: ${typeof parsedResponse === 'object'}, keys: ${parsedResponse ? Object.keys(parsedResponse).join(', ') : 'none'}`);
          }
        }
      } else {
        // For non-D1 endpoints, send directly if it's a JSON object
        if (isJsonObject) {
          sendDirectly = true;
          console.log(`[DO:${this.state.id}] Sending JSON object directly to endpoint`);
          if (parsedResponse) {
            console.log(`[DO:${this.state.id}] JSON object keys: ${Object.keys(parsedResponse).join(', ')}`);
          }
        } else {
          console.log(`[DO:${this.state.id}] Response is not a JSON object (or is array/primitive), using wrapped format`);
        }
      }
      
      if (sendDirectly && parsedResponse) {
        // Send the parsed JSON object directly
        requestBody = JSON.stringify(parsedResponse);
      } else {
        // Wrap the response in metadata format
        requestBody = JSON.stringify({
          step_id: step.step_id,
          step_title: step.title,
          step_key: step.step_key,
          response: responseString,
          timestamp: Date.now(),
          flow_id: this.conversation?.flow_id,
          conversation_id: this.state.id.toString()
        });
      }

      // Send the POST request to output_url
      const fetchResponse = await fetch(step.output_url, {
        method: 'POST',
        headers: headers,
        body: requestBody
      });

      if (fetchResponse.ok) {
        console.log(`[DO:${this.state.id}] Successfully sent output for step "${step.title}"`);
      } else {
        console.error(`[DO:${this.state.id}] Failed to send output for step "${step.title}": ${fetchResponse.status} ${fetchResponse.statusText}`);
        const errorText = await fetchResponse.text();
        console.error(`[DO:${this.state.id}] Error response: ${errorText.substring(0, 500)}`);
      }
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error sending output for step "${step.title}": ${error.message}`);
    }
  }

  // Helper to load flow steps from database with robust schema detection
  private async loadFlowStepsFromDB(flowId: string): Promise<ExecutionStepData[]> {
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] FLOW_RUNS_DB not configured`);
      return [];
    }
    
    try {
      console.log(`[DO:${this.state.id}] Loading steps for flow: ${flowId}`);
      
      // First, try to detect the schema by checking what columns exist
      const availableColumns = await this.detectFlowStepsSchema();
      console.log(`[DO:${this.state.id}] Detected available columns: ${availableColumns.join(', ')}`);
      
      // Build query based on available columns
      const query = this.buildFlowStepsQuery(availableColumns);
      console.log(`[DO:${this.state.id}] Built query: ${query.substring(0, 200)}...`);
      
      // Execute the query
      const result = await this.env.FLOW_RUNS_DB.prepare(query).bind(flowId).all();
      console.log(`[DO:${this.state.id}] Query executed, found ${result.results?.length || 0} results`);
      
      if (!result.results || result.results.length === 0) {
        console.log(`[DO:${this.state.id}] No steps found for flow ${flowId}`);
        return [];
      }
      
      // DEBUG: Log raw database results
      console.log(`[DO:${this.state.id}] DEBUG: Raw database results for flow ${flowId}:`);
      result.results.forEach((step: any, index: number) => {
        console.log(`[DO:${this.state.id}]   Step ${index}:`, {
          id: step.id,
          step_key: step.step_key,
          title: step.title,
          next_flow_id: step.next_flow_id,
          has_next_flow_id: step.next_flow_id !== undefined && step.next_flow_id !== null
        });
      });
      
      // Transform results to expected format
      const transformedResults = this.transformFlowStepResults(result.results, availableColumns);
      console.log(`[DO:${this.state.id}] Transformed ${transformedResults.length} results`);
      
      // DEBUG: Log transformed results
      console.log(`[DO:${this.state.id}] DEBUG: Transformed results for flow ${flowId}:`);
      transformedResults.forEach((step: any, index: number) => {
        console.log(`[DO:${this.state.id}]   Transformed Step ${index}:`, {
          id: step.id,
          step_key: step.step_key,
          title: step.title,
          next_flow_id: step.next_flow_id,
          has_next_flow_id: step.next_flow_id !== undefined && step.next_flow_id !== null
        });
      });
      
      return transformedResults;
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error loading steps: ${error.message}`);
      console.error(`[DO:${this.state.id}] Error stack: ${error.stack}`);
      return [];
    }
  }
  
  // Detect available columns in flow_steps table
  private async detectFlowStepsSchema(): Promise<string[]> {
    const availableColumns: string[] = [];
    
    // Test for common column names
    const testColumns = [
      'id', 'flow_id', 'step_key', 'title', 'instructions', 'description', 
      'prompt', 'step_type', 'order_index', 'step_number', 'page_key',
      'blocking', 'auto_fail_on_error', 'retryable', 'task_id', 'input_keys',
      'output_url', 'output_auth_token', 'requires_task', 'dual_agent',
      'ruler_agent', 'goal_criteria', 'max_iterations_per_step', 
      'expected_response', 'use_endpoints', 'extra_step', 'next_flow_id', 'created_at', 'updated_at'
    ];
    
    for (const column of testColumns) {
      try {
        // Try a simple query with the column
        const testResult = await this.env.FLOW_RUNS_DB.prepare(
          `SELECT ${column} FROM flow_steps LIMIT 1`
        ).first();
        
        if (testResult !== null) {
          availableColumns.push(column);
        }
      } catch (error) {
        // Column doesn't exist or query failed, skip it
        console.log(`[DO:${this.state.id}] Column ${column} not available: ${error.message}`);
      }
    }
    
    // If we couldn't detect any columns, try a wildcard query
    if (availableColumns.length === 0) {
      try {
        const wildcardResult = await this.env.FLOW_RUNS_DB.prepare(
          'SELECT * FROM flow_steps LIMIT 1'
        ).first();
        
        if (wildcardResult) {
          // Get column names from the result object
          const columns = Object.keys(wildcardResult);
          availableColumns.push(...columns);
          console.log(`[DO:${this.state.id}] Detected columns via wildcard: ${columns.join(', ')}`);
        }
      } catch (error) {
        console.error(`[DO:${this.state.id}] Wildcard query failed: ${error.message}`);
      }
    }
    
    return availableColumns;
  }
  
  // Build query based on available columns
  private buildFlowStepsQuery(availableColumns: string[]): string {
    // Map column aliases to ensure consistent output format
    const columnMappings: Record<string, string> = {};
    
    // Always include id as step_id
    columnMappings['step_id'] = 'id';
    
    // Always include flow_id for cross-flow transition checks
    if (availableColumns.includes('flow_id')) {
      columnMappings['flow_id'] = 'flow_id';
    }
    
    // Map step_key (use id if step_key doesn't exist)
    if (availableColumns.includes('step_key')) {
      columnMappings['step_key'] = 'step_key';
    } else {
      columnMappings['step_key'] = 'id';
    }
    
    // Map title (generate if doesn't exist)
    if (availableColumns.includes('title')) {
      columnMappings['title'] = 'title';
    } else {
      columnMappings['title'] = `'Step ' || COALESCE(order_index, step_number, id)`;
    }
    
    // Map description/instructions/prompt
    if (availableColumns.includes('instructions')) {
      columnMappings['description'] = 'instructions';
    } else if (availableColumns.includes('prompt')) {
      columnMappings['description'] = 'prompt';
    } else if (availableColumns.includes('description')) {
      columnMappings['description'] = 'description';
    } else {
      columnMappings['description'] = `'Step instructions'`;
    }
    
    // Map step_type
    if (availableColumns.includes('step_type')) {
      columnMappings['step_type'] = 'step_type';
    } else {
      columnMappings['step_type'] = `'default'`;
    }
    
    // Map order_index/step_number
    if (availableColumns.includes('order_index')) {
      columnMappings['order_index'] = 'order_index';
    } else if (availableColumns.includes('step_number')) {
      columnMappings['order_index'] = 'step_number';
    } else {
      columnMappings['order_index'] = 'id';
    }
    
    // Map other columns if available
    const optionalColumns = [
      'page_key', 'blocking', 'auto_fail_on_error', 'retryable', 'task_id',
      'input_keys', 'output_url', 'output_auth_token', 'requires_task',
      'dual_agent', 'ruler_agent', 'goal_criteria', 'max_iterations_per_step',
      'expected_response', 'use_endpoints', 'extra_step', 'next_flow_id'
    ];
    
    for (const column of optionalColumns) {
      if (availableColumns.includes(column)) {
        columnMappings[column] = column;
      } else {
        // Provide default values for missing columns
        if (column === 'output_url' || column === 'output_auth_token' || 
            column === 'goal_criteria' || column === 'expected_response' ||
            column === 'use_endpoints') {
          columnMappings[column] = 'NULL';
        } else if (column === 'blocking' || column === 'auto_fail_on_error' ||
                  column === 'retryable' || column === 'requires_task' ||
                  column === 'dual_agent' || column === 'extra_step') {
          columnMappings[column] = '0';
        } else if (column === 'page_key' || column === 'task_id' ||
                  column === 'input_keys' || column === 'ruler_agent' ||
                  column === 'next_flow_id') {
          columnMappings[column] = 'NULL';
        } else if (column === 'max_iterations_per_step') {
          columnMappings[column] = 'NULL';
        }
      }
    }
    
    // Add output column (computed from output_url)
    if (availableColumns.includes('output_url')) {
      columnMappings['output'] = `CASE WHEN output_url IS NOT NULL AND output_url != '' THEN 1 ELSE 0 END`;
    } else {
      columnMappings['output'] = '0';
    }
    
    // Build SELECT clause
    const selectClause = Object.entries(columnMappings)
      .map(([alias, column]) => `${column} AS ${alias}`)
      .join(', ');
    
    // Build ORDER BY clause
    let orderByClause = 'ORDER BY ';
    if (availableColumns.includes('order_index')) {
      orderByClause += 'order_index';
    } else if (availableColumns.includes('step_number')) {
      orderByClause += 'step_number';
    } else {
      orderByClause += 'id';
    }
    
    return `SELECT ${selectClause} FROM flow_steps WHERE flow_id = ? ${orderByClause}`;
  }
  
  // Transform results to expected format
  private transformFlowStepResults(results: any[], availableColumns: string[]): any[] {
    return results.map((step: any) => {
      const transformed: any = { ...step };
      
      // Ensure required fields exist
      if (!transformed.step_key && transformed.step_id) {
        transformed.step_key = transformed.step_id;
      }
      
      if (!transformed.title && transformed.order_index !== undefined) {
        transformed.title = `Step ${transformed.order_index}`;
      } else if (!transformed.title) {
        transformed.title = `Step ${transformed.step_id || 'unknown'}`;
      }
      
      if (!transformed.instructions && transformed.description) {
        transformed.instructions = transformed.description;
      } else if (!transformed.instructions) {
        transformed.instructions = transformed.description || 'No instructions provided';
      }
      
      // Ensure boolean fields are properly typed
      const booleanFields = ['blocking', 'auto_fail_on_error', 'retryable', 'requires_task', 'dual_agent', 'extra_step', 'output'];
      for (const field of booleanFields) {
        if (transformed[field] !== undefined) {
          transformed[field] = Boolean(transformed[field]);
        }
      }
      
      // Ensure numeric fields are properly typed
      const numericFields = ['order_index', 'max_iterations_per_step'];
      for (const field of numericFields) {
        if (transformed[field] !== undefined && transformed[field] !== null) {
          transformed[field] = Number(transformed[field]);
        }
      }
      
      // Set defaults for missing optional fields
      const defaultValues: Record<string, any> = {
        page_key: null,
        blocking: false,
        auto_fail_on_error: false,
        retryable: false,
        task_id: null,
        input_keys: null,
        output: 0,
        output_url: null,
        output_auth_token: null,
        requires_task: false,
        dual_agent: false,
        ruler_agent: null,
        goal_criteria: null,
        max_iterations_per_step: null,
        expected_response: null,
        use_endpoints: null,
        extra_step: false,
        next_flow_id: null,
        // Initialize execution fields
        response: null,
        status: 'pending'
      };
      
      for (const [field, defaultValue] of Object.entries(defaultValues)) {
        if (transformed[field] === undefined) {
          transformed[field] = defaultValue;
        }
      }
      
      return transformed;
    });
  }

  private async handleAttach(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        openhands_conversation_id: string;
        max_iterations?: number;
      };
      const { openhands_conversation_id, max_iterations } = body;
      
      if (!openhands_conversation_id) {
        return new Response(JSON.stringify({ error: 'Need openhands_conversation_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Ensure reasonable minimum iterations
      const effectiveMaxIterations = max_iterations && max_iterations >= 10 ? max_iterations : MAX_ITERATIONS;
      
      // Generate flow run ID
      this.flowRunId = generateFlowRunId();
      
      // Load project facts from database
      const projectFacts = await this.loadProjectFacts();
      
      // Initialize conversation with existing OpenHands ID
      this.conversation = {
        state: 'WAITING_OPENHANDS', // Start by monitoring the existing conversation
        initial_user_prompt: '[ATTACHED TO EXISTING CONVERSATION]',
        iteration: 0,
        repository: '[EXISTING]',
        branch: '[EXISTING]',
        max_iterations: effectiveMaxIterations,
        status: 'active',
        created_at: Date.now(),
        updated_at: Date.now(),
        project_facts: projectFacts,
        openhands_conversation_id: openhands_conversation_id,
        agent: 'openhands', // Default to openhands for attached conversations
        step_status_sent: false // Track if SENDING STEP status has been sent for current step
      };
      
      await this.state.storage.put('conversation', this.conversation);
      
      // Save initial flow run to database - DISABLED for simplicity
      // await this.saveInitialFlowRunToDatabase();
      
      // Schedule first alarm immediately to start monitoring
      await this.scheduleNextAlarm(ALARM_DELAY_INIT);
      
      console.log(`[DO:${this.state.id}] Attached to existing OpenHands conversation: ${openhands_conversation_id}, alarm scheduled`);
      
      return new Response(JSON.stringify({
        success: true,
        conversation_id: this.state.id.toString(),
        openhands_conversation_id: openhands_conversation_id,
        state: 'WAITING_OPENHANDS',
        message: 'Attached to existing OpenHands conversation. Monitoring started.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Attach error: ${error.message}`);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  private handleGetState(): Response {
    return new Response(JSON.stringify({
      success: true,
      conversation: this.conversation || { state: 'not_initialized' }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private handleStatus(): Response {
    const conversation = this.conversation || { state: 'not_initialized' };
    
    return new Response(JSON.stringify({
      conversation: {
        state: conversation.state || 'idle',
        flow_completed: conversation.flow_completed || false,
        flow_steps: conversation.flow_steps || []
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleStop(): Promise<Response> {
    await this.stopConversation('manually_stopped');
    return new Response(JSON.stringify({
      success: true,
      message: 'Conversation stopped'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleDelete(): Promise<Response> {
    console.log(`[DO:${this.state.id}] Deleting Durable Object`);
    
    try {
      // Clear all storage
      await this.state.storage.deleteAll();
      
      // Cancel any pending alarms
      try {
        await this.state.storage.deleteAlarm();
      } catch (error) {
        // Ignore errors if no alarm exists
      }
      
      console.log(`[DO:${this.state.id}] Durable Object storage cleared, will auto-delete when idle`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Durable Object marked for deletion',
        id: this.state.id.toString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error deleting Durable Object: ${error.message}`);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleTriggerNextIteration(): Promise<Response> {
    console.log(`[DO:${this.state.id}] Triggering next iteration`);
    
    try {
      // Only proceed if we have a conversation and it's in task execution mode
      if (!this.conversation || !this.conversation.task_execution_mode || !this.conversation.flow_id) {
        return new Response(JSON.stringify({
          error: 'Not in task execution mode or no flow_id',
          note: 'This endpoint only works for task-based flow execution'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const flowId = this.conversation.flow_id;
      
      // Load next task for the flow
      if (!this.env.FLOW_RUNS_DB) {
        return new Response(JSON.stringify({
          error: 'Database not configured',
          note: 'FLOW_RUNS_DB binding is required for task loading'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const { startTaskExecution } = await import('../services/database');
      const nextStep = await this.getNextStep();
      
      console.log('NEXT_STEP_DEBUG', {
        step_id: nextStep?.step_id,
        flow_id: nextStep?.flow_id,
        next_flow_id: nextStep?.next_flow_id,
        currentFlowId: this.conversation.flow_id,
        current_step_id: this.conversation.current_step?.step_id,
        current_step_next_flow_id: this.conversation.current_step?.next_flow_id
      });
      
      // DEBUG: Log current_step object in detail before cross-flow check
      console.log(`[DO:${this.state.id}] DEBUG: current_step object before cross-flow check:`, {
        step_id: this.conversation.current_step?.step_id,
        step_key: this.conversation.current_step?.step_key,
        title: this.conversation.current_step?.title,
        flow_id: this.conversation.current_step?.flow_id,
        next_flow_id: this.conversation.current_step?.next_flow_id,
        has_next_flow_id: this.conversation.current_step?.next_flow_id !== undefined && this.conversation.current_step?.next_flow_id !== null,
        all_keys: this.conversation.current_step ? Object.keys(this.conversation.current_step) : 'current_step is null'
      });
      
      // Cross-flow transition check - use next_flow_id from COMPLETED step (current_step)
      // instead of next step to execute
      if (this.conversation.current_step?.next_flow_id) {
        console.log('FLOW_TRANSFER', {
          from: this.conversation.flow_id,
          to: this.conversation.current_step.next_flow_id,
          reason: 'next_flow_id set on completed step',
          completed_step_id: this.conversation.current_step.step_id,
          completed_step_title: this.conversation.current_step.title
        });

        // Start the next flow using startSpecificFlow
        await this.startSpecificFlow(this.conversation.current_step.next_flow_id, this.conversation.last_response || '');

        await this.stopConversation('flow_transferred');
        return;
      }
      
      if (!nextStep) {
        // NO MORE STEPS - FLOW TERMINATION
        console.log(`[DO:${this.state.id}] No more steps for flow ${flowId}, terminating flow`);
        
        // Save flow run to database with completed status
        try {
          await this.saveFlowRunToDatabase('flow_completed_no_more_steps', 'completed');
        } catch (error: any) {
          console.error(`[DO:${this.state.id}] Error saving flow run to database: ${error.message}`);
        }
        
        // Restart the flow with same payload before stopping
        await this.restartFlow();
        
        // Cancel alarms
        try {
          await this.state.storage.deleteAlarm();
        } catch (error) {
          // Ignore errors if no alarm exists
        }
        
        // Update conversation state
        this.conversation.state = 'DONE';
        this.conversation.status = 'stopped';
        this.conversation.updated_at = Date.now();
        await this.state.storage.put('conversation', this.conversation);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Flow terminated - no more steps, restarting flow',
          flow_id: flowId,
          flow_run_id: this.flowRunId,
          state: 'DONE',
          note: 'All steps completed. Flow is being restarted with same payload.'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // NEXT STEP EXISTS - INJECT AND CONTINUE
      console.log(`[DO:${this.state.id}] Loaded next step for flow ${flowId}: ${nextStep.title} (${nextStep.step_type})`);
      
      // Fetch task data if task_id is present OR if requires_task is true
      let taskData = null;
      let dynamicTaskId = null;
      
      // First try static task_id (only if non-empty string)
      if (nextStep.task_id && nextStep.task_id.trim() && this.env.FLOW_RUNS_DB) {
        try {
          taskData = await getTaskData(this.env.FLOW_RUNS_DB, nextStep.task_id);
          if (taskData) {
            console.log(`[DO:${this.state.id}] Loaded task data for task: ${nextStep.task_id}`);
          } else {
            console.log(`[DO:${this.state.id}] Task not found in FLOW_RUNS_DB: ${nextStep.task_id}`);
            // Clear taskData so we can try requires_task if set
            taskData = null;
          }
        } catch (error) {
          console.error(`[DO:${this.state.id}] Error loading task data from FLOW_RUNS_DB: ${error}`);
        }
      }
      
      // If no task data from task_id, try requires_task
      // Convert requires_task to boolean explicitly (database returns 0/1 as number or string)
      const requiresTask = this.convertRequiresTaskToBoolean(nextStep.requires_task);
      console.log(`[DO:${this.state.id}] Task injection debug (handleInitState): taskData=${!!taskData}, requiresTask=${requiresTask}, flowId=${flowId}, FLOW_RUNS_DB=${!!this.env.FLOW_RUNS_DB}`);
      if (!taskData && requiresTask && this.env.FLOW_RUNS_DB) {
        // Dynamic task assignment - get first pending task for this flow
        console.log(`[DO:${this.state.id}] Step requires dynamic task, fetching first pending task for flow: ${flowId}`);
        try {
          const pendingTask = await getFirstPendingTask(this.env.FLOW_RUNS_DB, flowId);
          if (pendingTask) {
            taskData = {
              title: pendingTask.title,
              description: pendingTask.description,
              payload: pendingTask.payload
            };
            dynamicTaskId = pendingTask.id;
            console.log(`[DO:${this.state.id}] Loaded first pending task: ${pendingTask.id} - ${pendingTask.title}`);
          } else {
            console.log(`[DO:${this.state.id}] No pending tasks found for flow: ${flowId}`);
          }
        } catch (error) {
          console.error(`[DO:${this.state.id}] Error loading first pending task: ${error}`);
        }
      }
      
      // Start tracking step execution (minimal observability)
      let executionStepId = null;
      try {
        const executionResult = await startTaskExecution(
          this.env.FLOW_RUNS_DB, 
          this.flowRunId!,
          nextStep.step_id
        );
        
        if (executionResult.success) {
          console.log(`[DO:${this.state.id}] Started tracking step execution: ${executionResult.execution_step_id}`);
          executionStepId = executionResult.execution_step_id;
          // Increment step index for next iteration
          await this.incrementStepIdx();
        }
      } catch (trackingError: any) {
        console.error(`[DO:${this.state.id}] Error tracking step execution: ${trackingError.message}`);
        // Continue even if tracking fails
      }
      
      // Build step prompt with step details
      // Remove "Step X: " prefix from title to prevent AI from inferring progress
      const stepTitleWithoutNumber = nextStep.title.replace(/^Step \d+: /, '');
      let taskPrompt = `Execute step: ${stepTitleWithoutNumber}`;
      
      // Inject task data if available
      if (taskData) {
        taskPrompt += `\n\n=== TASK ===`;
        // Include task ID if available (from dynamicTaskId or nextStep.task_id)
        const taskId = dynamicTaskId || nextStep.task_id;
        if (taskId) {
          taskPrompt += `\nTask ID: ${taskId}`;
        }
        if (taskData.title) {
          taskPrompt += `\nTitle: ${taskData.title}`;
        }
        if (taskData.description) {
          taskPrompt += `\nDescription: ${taskData.description}`;
        }
        // Add payload if it's JSON and contains additional metadata
        if (taskData.payload && taskData.payload.trim().startsWith('{') && taskData.payload.trim().endsWith('}')) {
          try {
            const payloadObj = JSON.parse(taskData.payload);
            // Add non-instruction fields from payload
            const metadataFields = Object.entries(payloadObj)
              .filter(([key, value]) => key !== 'instructions' && typeof value === 'string')
              .map(([key, value]) => `${key}: ${value}`);
            
            if (metadataFields.length > 0) {
              taskPrompt += `\nAdditional Details:`;
              metadataFields.forEach(field => {
                taskPrompt += `\n- ${field}`;
              });
            }
          } catch (e) {
            // Not valid JSON, skip
            console.log(`[DO:${this.state.id}] Task payload is not valid JSON: ${e.message}`);
          }
        }
        taskPrompt += `\n=== END TASK ===\n`;
        // REMOVED: Instructions to mark task as complete
        // Task completion is handled automatically by the system
        
        // Store dynamic task ID if we fetched one
        if (dynamicTaskId) {
          // We could store this for tracking, but for now just log it
          console.log(`[DO:${this.state.id}] Using dynamic task ID: ${dynamicTaskId}`);
        }
      }
      
      if (nextStep.description) {
        taskPrompt += `\n${nextStep.description}`;
      }
      
      // Add step metadata for context
      taskPrompt += `\n\nStep Type: ${nextStep.step_type}`;
      if (nextStep.page_key) {
        taskPrompt += `\nPage: ${nextStep.page_key}`;
      }
      if (nextStep.blocking === false) {
        taskPrompt += `\nNote: This step is non-blocking - flow can continue even if this step fails`;
      }
      
      // Update conversation with new step
      this.conversation.current_task_id = nextStep.step_id;
      this.conversation.current_task_title = nextStep.title;
      this.conversation.current_task_description = nextStep.description || undefined;
      this.conversation.current_execution_step_id = executionStepId || undefined;
      this.conversation.current_step = nextStep;
      this.conversation.initial_user_prompt = taskPrompt;
      this.conversation.state = 'INIT';
      this.conversation.iteration = 0;
      this.conversation.updated_at = Date.now();
      
      await this.state.storage.put('conversation', this.conversation);
      
      // Schedule alarm to start execution
      await this.scheduleNextAlarm(ALARM_DELAY_INIT);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Next step loaded and execution scheduled',
        flow_id: flowId,
        step: {
          step_id: nextStep.step_id,
          step_key: nextStep.step_key,
          title: nextStep.title,
          description: nextStep.description,
          step_type: nextStep.step_type
        },
        state: 'INIT',
        note: 'Step injected into prompt. Alarm scheduled for execution.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error triggering next iteration: ${error.message}`);
      return new Response(JSON.stringify({
        error: error.message,
        note: 'Failed to trigger next iteration'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // ==========================================================================
  // ALARM HANDLER (MAIN STATE MACHINE)
  // ==========================================================================
  
  private async handleAlarm(): Promise<void> {
    console.log(`[DO:${this.state.id}] DEBUG: handleAlarm called at ${Date.now()}`);
    
    if (!this.conversation) {
      console.log(`[DO:${this.state.id}] No conversation to handle alarm`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Alarm triggered, state: ${this.conversation.state}, iteration: ${this.conversation.iteration}`);
    console.log(`[DO:${this.state.id}] DEBUG: Conversation exists, flow_id: ${this.conversation.flow_id}, flow_steps count: ${this.conversation.flow_steps?.length || 0}`);
    
    // ==========================================================================
    // LIFECYCLE MANAGEMENT CHECKS
    // ==========================================================================
    
    // 1. Check maximum lifetime (1 hour)
    const conversationAge = Date.now() - this.conversation.created_at;
    if (conversationAge > MAX_DO_LIFETIME) {
      console.log(`[DO:${this.state.id}] Maximum lifetime exceeded (${conversationAge}ms > ${MAX_DO_LIFETIME}ms), cleaning up to free resources`);
      await this.cleanupStorage();
      return;
    }
    
    // 2. Check idle timeout (30 minutes since last update)
    const timeSinceUpdate = Date.now() - this.conversation.updated_at;
    if (timeSinceUpdate > IDLE_TIMEOUT) {
      console.log(`[DO:${this.state.id}] Conversation idle for too long (${timeSinceUpdate}ms > ${IDLE_TIMEOUT}ms), deleting to free resources`);
      await this.cleanupStorage();
      return;
    }
    
    // 3. Check if conversation is completed and should be cleaned up
    if (this.conversation.state === 'DONE' || this.conversation.status === 'stopped') {
      const timeSinceCompletion = Date.now() - this.conversation.updated_at;
      if (timeSinceCompletion > COMPLETED_CLEANUP_DELAY) {
        console.log(`[DO:${this.state.id}] Conversation completed ${timeSinceCompletion}ms ago, cleaning up to free resources`);
        await this.cleanupStorage();
        return;
      }
    }
    
    // Update timestamp
    this.conversation.updated_at = Date.now();
    
    // In aggressive mode, check if conversation has been stuck for too long
    // COMMENTED OUT: Too aggressive for complex tasks (20 minutes)
    // if (AGGRESSIVE_MODE && FORCE_END_FLOW_AFTER_TIMEOUT) {
    //   const aggressiveConversationAge = Date.now() - this.conversation.created_at;
    //   const maxConversationAge = AGGRESSIVE_OPENHANDS_TIMEOUT * 2; // 20 minutes
    //   
    //   if (aggressiveConversationAge > maxConversationAge) {
    //     console.log(`[DO:${this.state.id}] Conversation too old (${aggressiveConversationAge}ms > ${maxConversationAge}ms), force ending`);
    //     await this.forceEndAndRestartConversation(`conversation_too_old: ${aggressiveConversationAge}ms`);
    //     return;
    //   }
    // }
    
    // Check if DeepSeek is taking too long to respond (2 minutes max)
    if (this.conversation.deepseek_response_pending && this.conversation.last_deepseek_request_at) {
      const timeSinceRequest = Date.now() - this.conversation.last_deepseek_request_at;
      
      if (timeSinceRequest > DEEPSEEK_RESPONSE_TIMEOUT) {
        console.log(`[DO:${this.state.id}] DeepSeek response timeout (${timeSinceRequest}ms > ${DEEPSEEK_RESPONSE_TIMEOUT}ms), sending checking prompt`);
        
        // Send checking prompt to DeepSeek
        await this.sendCheckingPrompt();
        return;
      }
    }
    
    try {
      // State machine
      switch (this.conversation.state) {
        case 'INIT':
          await this.handleInitState();
          break;
          
        case 'WAITING_OPENHANDS':
          await this.handleWaitingOpenHandsState();
          break;
          
        case 'ITERATION_COMPLETE':
          await this.handleIterationCompleteState();
          break;
          
        case 'AWAITING_NEXT_ITERATION':
          await this.handleAwaitingNextIterationState();
          break;
          
        case 'DONE':
          console.log(`[DO:${this.state.id}] Conversation already DONE, no action needed`);
          return;
          
        case 'SENDING_STEP':
          await this.handleSendingStepState();
          break;
          
        default:
          await this.stopConversation(`invalid_state: ${this.conversation.state}`);
          return;
      }
      
      // Save updated state
      await this.state.storage.put('conversation', this.conversation);
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Alarm handler error: ${error.message}`);
      await this.stopConversation(`alarm_error: ${error.message}`);
    }
  }
  
  // ==========================================================================
  // STATE HANDLERS
  // ==========================================================================
  
  private async handleInitState(): Promise<void> {
    if (!this.conversation) return;
    
    // Check if this is a flow execution and we should bypass DeepSeek
    if (this.conversation.flow_execution_mode && this.conversation.current_step) {
      // For flow execution, check if this is a decision step (Step 7)
      const isDecisionStep = this.conversation.current_step.step_key === 'gap_analysis';
      
      if (!isDecisionStep) {
        // Check agent type - if deepseek, call DeepSeek API instead of OpenHands
        if (this.conversation.agent === 'deepseek') {
          console.log(`[DO:${this.state.id}] ====== ROUTING VALIDATION ======`);
          console.log(`[DO:${this.state.id}] Step: ${(this.conversation.current_step_index || 0) + 1}`);
          console.log(`[DO:${this.state.id}] Step Key: ${this.conversation.current_step.step_key}`);
          console.log(`[DO:${this.state.id}] Agent is 'deepseek', calling DeepSeek API instead of OpenHands`);
          console.log(`[DO:${this.state.id}] Payload to DeepSeek (first 500 chars): ${this.conversation.initial_user_prompt.substring(0, 500)}...`);
          console.log(`[DO:${this.state.id}] ====== END VALIDATION ======`);
          
          // Build messages for DeepSeek WITHOUT system message
          const messages = [
            {
              role: 'user',
              content: this.conversation.initial_user_prompt
            }
          ];
          
          // Call DeepSeek API
          const deepseekResult = await callDeepSeek(this.env.DEEPSEEK_API_KEY, messages);
          
          if (!deepseekResult.success) {
            console.error(`[DO:${this.state.id}] DeepSeek API call failed: ${deepseekResult.error}`);
            await this.stopConversation(`deepseek_failed: ${deepseekResult.error}`);
            return;
          }
          
          // Filter out status messages from AI response
          const filteredResponse = this.filterStatusMessages(deepseekResult.response!);
          
          // Store filtered DeepSeek response
          this.conversation.last_deepseek_response = filteredResponse;
          this.conversation.deepseek_response_pending = false;
          
          // Update execution context with AI output for new condition system
          if (this.conversation.execution_context) {
            this.conversation.execution_context.ai_output = {
              response: filteredResponse,
              intent: '',
              actions: [],
              metadata: {},
              source: 'deepseek'
            };
            
            // SYNC: Keep last_step_response in sync with ai_output for legacy compatibility
            this.conversation.last_step_response = filteredResponse;
            
            // Increment step_count AFTER successful completion
            this.conversation.execution_context.step_count += 1;
          }
          
          // IMMEDIATELY: Store response in current step and update status
          if (this.conversation.current_step && this.conversation.flow_steps) {
            const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === this.conversation!.current_step!.step_id);
            if (stepIndex !== -1) {
              this.conversation.flow_steps[stepIndex].response = filteredResponse;
              this.conversation.flow_steps[stepIndex].status = 'completed';
              console.log(`[DO:${this.state.id}] IMMEDIATELY stored response in step ${this.conversation.current_step.step_id} and set status='completed'`);
              
              // PERSIST: Save conversation state immediately
              await this.state.storage.put('conversation', this.conversation);
              console.log(`[DO:${this.state.id}] Persisted conversation with immediate step response`);
            }
          }
          
          // For deepseek-only flows, complete the step immediately
          await this.handleStepCompletion(this.conversation.current_step, filteredResponse);
          return;
        } else {
          // For openhands or both agents, send to OpenHands
          console.log(`[DO:${this.state.id}] ====== ROUTING VALIDATION ======`);
          console.log(`[DO:${this.state.id}] Step: ${(this.conversation.current_step_index || 0) + 1}`);
          console.log(`[DO:${this.state.id}] Step Key: ${this.conversation.current_step.step_key}`);
          console.log(`[DO:${this.state.id}] DeepSeek called: false (bypassing for execution step)`);
          console.log(`[DO:${this.state.id}] Payload to OpenHands (first 500 chars): ${this.conversation.initial_user_prompt.substring(0, 500)}...`);
          console.log(`[DO:${this.state.id}] ====== END VALIDATION ======`);
          
          // Build initial conversation messages WITHOUT system message
          const initialMessages = buildInitialMessages(
            this.conversation.initial_user_prompt,
            {
              repository: this.conversation.repository,
              branch: this.conversation.branch,
              iteration: this.conversation.iteration,
              max_iterations: this.conversation.max_iterations
            }
            // No system message - DeepSeek will execute step directly
          );
          
          // Store initial messages in conversation
          this.conversation.conversation_messages = initialMessages;
          
          // For flow execution mode, we need to send the command as if DeepSeek said it
          // Remove the user message (created by buildInitialMessages) and replace with assistant message
          // OpenHands expects: Assistant (DeepSeek) gives command → User (OpenHands) executes
          this.conversation.conversation_messages = [
            ...initialMessages.filter(m => m.role !== 'user'), // Keep system message if any
            {
              role: 'assistant',
              content: this.conversation.initial_user_prompt // This contains the exact command from DB
            }
          ];
          
          this.conversation.last_deepseek_response = this.conversation.initial_user_prompt;
          this.conversation.deepseek_response_pending = false;
          
          // Transition to WAITING_OPENHANDS state
          this.conversation.state = 'WAITING_OPENHANDS';
          console.log(`[DO:${this.state.id}] Transitioned to WAITING_OPENHANDS for flow step execution`);
          return;
        }
      } else {
        // This is a decision step (Step 7) - log that we're sending to DeepSeek
        console.log(`[DO:${this.state.id}] ====== ROUTING VALIDATION ======`);
        console.log(`[DO:${this.state.id}] Step: 7 (gap_analysis)`);
        console.log(`[DO:${this.state.id}] DeepSeek called: true (decision step)`);
        console.log(`[DO:${this.state.id}] ====== END VALIDATION ======`);
      }
    }
    
    // Normal flow: send to DeepSeek
    console.log(`[DO:${this.state.id}] INIT state: Sending to DeepSeek`);
    
    // Build initial conversation messages WITHOUT system message
    const initialMessages = buildInitialMessages(
      this.conversation.initial_user_prompt,
      {
        repository: this.conversation.repository,
        branch: this.conversation.branch,
        iteration: this.conversation.iteration,
        max_iterations: this.conversation.max_iterations
      }
      // No system message - DeepSeek will execute step directly
    );
    
    // Store initial messages in conversation
    this.conversation.conversation_messages = initialMessages;
    
    // Send initial prompt to DeepSeek
    const deepseekResult = await callDeepSeek(
      this.env.DEEPSEEK_API_KEY,
      this.conversation.conversation_messages!
    );
    
    if (!deepseekResult.success) {
      await this.stopConversation(`deepseek_failed: ${deepseekResult.error}`);
      return;
    }
    
    // Update activity tracking for adaptive polling
    this.updateActivityTracking();
    
    // Filter out status messages from AI response
    const filteredResponse = this.filterStatusMessages(deepseekResult.response!);
    
    // Check for stop condition
    const doneData = this.checkForDone(filteredResponse);
    
    // Check deterministic completion via external verification
    const verificationResult = await shouldCompleteTask(
      this.conversation.repository,
      this.conversation.branch || 'main',
      this.conversation.iteration,
      filteredResponse
    );
    
    // Complete if either AI says done OR external verification passes
    if (doneData.done || verificationResult.shouldComplete) {
      const reason = doneData.done ? 'deepseek_done' : `external_verification: ${verificationResult.completionReason}`;
      console.log(`[DO:${this.state.id}] Completion triggered: ${reason}`);
      console.log(`[DO:${this.state.id}] Verification details: ${JSON.stringify(verificationResult.verificationResult)}`);
      
      await this.handleDoneResponse(filteredResponse, reason);
      await this.stopConversation(reason);
      return;
    }
    
    // Add DeepSeek response to conversation history
    this.conversation.conversation_messages!.push({
      role: 'assistant',
      content: filteredResponse
    });
    
    this.conversation.last_deepseek_response = filteredResponse;
    
    // Clear DeepSeek response pending flag since we got a response
    this.conversation.deepseek_response_pending = false;
    
    // Check if we're in dual-agent mode
    if (this.conversation.dual_agent_state && !this.conversation.dual_agent_state.is_complete) {
      console.log(`[DO:${this.state.id}] Handling dual-agent response`);
      await this.handleDualAgentResponse(filteredResponse);
      return;
    }
    
    // Save initial iteration (iteration 0) - DISABLED to avoid database writes
    // await this.saveIterationToDatabase(
    //   this.conversation.initial_user_prompt,
    //   deepseekResult.response!
    // );
    
    this.conversation.iteration++;
    
    // Validate DeepSeek response uses facts correctly
    const validationResult = this.validateAndResolveDeepSeekResponse(deepseekResult.response!);
    if (!validationResult.valid) {
      console.log(`[DO:${this.state.id}] Fact validation failed: ${validationResult.error}`);
      await this.stopConversation(`FACT_VIOLATION: ${validationResult.error}`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Fact validation passed, resolved text: ${validationResult.resolvedText ? validationResult.resolvedText.substring(0, 100) + "..." : "EMPTY"}...`);
    
    // TEST: Simulate OpenHands API failure
    const TEST_OPENHANDS_FAILURE = false; // Set to true to test failure
    if (TEST_OPENHANDS_FAILURE) {
      await this.stopConversation(`openhands_create_failed: TEST_SIMULATED_ERROR`);
      return;
    }
    
    // Create OpenHands conversation with RESOLVED DeepSeek response
    const openhandsResult = await createOpenHandsConversation(
      this.env.OPENHANDS_API_URL,
      validationResult.resolvedText,
      this.conversation.repository,
      this.conversation.branch
    );
    
    if (!openhandsResult.success) {
      await this.stopConversation(`openhands_create_failed: ${openhandsResult.error}`);
      return;
    }
    
    this.conversation.openhands_conversation_id = openhandsResult.conversationId;
    this.conversation.state = 'WAITING_OPENHANDS';
    
    // Schedule next alarm to check OpenHands status
    await this.scheduleNextAlarm();
    console.log(`[DO:${this.state.id}] OpenHands conversation created: ${openhandsResult.conversationId}, next alarm scheduled`);
  }
  
  private async handleWaitingOpenHandsState(): Promise<void> {
    if (!this.conversation || !this.conversation.openhands_conversation_id) {
      await this.stopConversation('missing_openhands_conversation_id');
      return;
    }
    
    // Check max iterations
    if (this.conversation.iteration >= this.conversation.max_iterations) {
      console.log(`[DO:${this.state.id}] Max iterations reached: ${this.conversation.iteration}`);
      await this.stopConversation('max_iterations_reached');
      return;
    }
    
    console.log(`[DO:${this.state.id}] WAITING_OPENHANDS: Checking conversation ${this.conversation.openhands_conversation_id}`);
    
    // Get OpenHands conversation events FIRST (before checking timeout)
    // We need events to extract content even if we timeout
    const openhandsStatus = await getOpenHandsConversation(
      this.env.OPENHANDS_API_URL,
      this.conversation.openhands_conversation_id
    );
    
    if (!openhandsStatus.success) {
      // Track consecutive errors instead of stopping immediately
      this.conversation.openhands_error_count = (this.conversation.openhands_error_count || 0) + 1;
      console.log(`[DO:${this.state.id}] OpenHands API error (${this.conversation.openhands_error_count} consecutive): ${openhandsStatus.error}`);
      
      // Only stop after 5 consecutive errors
      if (this.conversation.openhands_error_count >= 5) {
        await this.stopConversation(`openhands_status_failed_after_${this.conversation.openhands_error_count}_attempts: ${openhandsStatus.error}`);
        return;
      }
      
      // Wait longer before retrying (exponential backoff: 10s, 20s, 40s, etc.)
      const backoffTime = Math.min(10000 * Math.pow(2, this.conversation.openhands_error_count - 1), 120000); // Max 2 minutes
      console.log(`[DO:${this.state.id}] Backing off for ${backoffTime/1000}s before retry`);
      await this.scheduleNextAlarm(backoffTime);
      return;
    }
    
    // Reset error count on success
    this.conversation.openhands_error_count = 0;
    
    const events = openhandsStatus.events || [];
    console.log(`[DO:${this.state.id}] Got ${events.length} events`);
    
    // Initialize pending actions if not exists
    if (!this.conversation.pending_actions) {
      this.conversation.pending_actions = [];
    }
    
    // Initialize iteration start time if not set
    if (!this.conversation.iteration_started_at) {
      this.conversation.iteration_started_at = Date.now();
      // Also initialize last event time
      this.conversation.last_event_seen_at = Date.now();
    }
    
    // Filter events to only process NEW events since last processed
    const lastProcessedEventId = this.conversation.last_sent_event_id || 0;
    const newEvents = events.filter(event => event.id > lastProcessedEventId);
    
    if (newEvents.length === 0) {
      console.log(`[DO:${this.state.id}] No new events since last processed event ID ${lastProcessedEventId}`);
    } else {
      console.log(`[DO:${this.state.id}] Processing ${newEvents.length} new events (since ID ${lastProcessedEventId})`);
      // Update last event time when we see new events
      this.conversation.last_event_seen_at = Date.now();
      // Update activity tracking for adaptive polling
      this.updateActivityTracking();
    }
    
    // Process events to track pending actions
    const newPendingActions = [...this.conversation.pending_actions];
    let iterationCompleted = false;
    let agentAwaitingInput = false;
    let contentToSend = '';
    
    // Process events in chronological order (oldest first)
    // Events come with ?reverse=true (newest first), so reverse them back
    const chronologicalEvents = [...newEvents].reverse();
    
    for (const event of chronologicalEvents) {
      console.log(`[DO:${this.state.id}] Processing event ${event.id}: action=${event.action}, observation=${event.observation}, tool_call_id=${event.args?.tool_call_id}`);
      
      // Check for ActionEvent (agent started a tool call)
      // EXCLUDE 'message' actions from pending actions - they're not actions that need completion
      if (event.action && event.action !== 'agent_state_changed' && event.action !== 'message') {
        // Try to get tool_call_id from args, or generate one from event ID
        const tool_call_id = event.args?.tool_call_id || `event_${event.id}`;
        
        // Check if this action is already tracked
        const existingIndex = newPendingActions.findIndex(a => a.tool_call_id === tool_call_id);
        if (existingIndex === -1) {
          // New action - add to pending list
          newPendingActions.push({
            tool_call_id: tool_call_id,
            action_type: event.action,
            started_at: Date.now(),
            event_id: event.id,
            description: event.message || event.content
          });
          console.log(`[DO:${this.state.id}] Added pending action: ${event.action} (tool_call_id: ${tool_call_id})`);
        }
      }
      
      // Check for ObservationEvent (tool execution completed)
      if (event.observation) {
        // Try to match observation to action
        // First try tool_call_id from args
        if (event.args?.tool_call_id) {
          const actionIndex = newPendingActions.findIndex(a => a.tool_call_id === event.args!.tool_call_id);
          if (actionIndex !== -1) {
            const completedAction = newPendingActions[actionIndex];
            console.log(`[DO:${this.state.id}] Action completed: ${completedAction.action_type} (tool_call_id: ${event.args!.tool_call_id})`);
            newPendingActions.splice(actionIndex, 1);
          }
        } else {
          // No tool_call_id - try to match by action type
          // Look for most recent pending action of the same type
          for (let i = newPendingActions.length - 1; i >= 0; i--) {
            const action = newPendingActions[i];
            if (action.action_type === event.observation) {
              console.log(`[DO:${this.state.id}] Action completed (type match): ${action.action_type} (event_id: ${action.event_id})`);
              newPendingActions.splice(i, 1);
              break;
            }
          }
        }
      }
      
      // Check for agent_state_changed to awaiting_user_input
      if (event.observation === 'agent_state_changed' && event.extras?.agent_state === 'awaiting_user_input') {
        agentAwaitingInput = true;
        console.log(`[DO:${this.state.id}] Agent is awaiting user input`);
        
        // SIMPLE RULE: Get the event right before this one
        // Events are in chronological order (oldest first) in chronologicalEvents
        const eventIndex = chronologicalEvents.findIndex(e => e.id === event.id);
        if (eventIndex > 0) {
          // Get the event right before awaiting_user_input
          const prevEvent = chronologicalEvents[eventIndex - 1];
          
          // Use message field first, then args.content, then content
          contentToSend = prevEvent.message || prevEvent.args?.content || prevEvent.content || '';
          
          if (contentToSend) {
            console.log(`[DO:${this.state.id}] Found content from previous event (ID: ${prevEvent.id}, Action: ${prevEvent.action}): ${contentToSend.length} chars`);
          } else {
            // Try one more event back if needed
            if (eventIndex > 1) {
              const prevPrevEvent = chronologicalEvents[eventIndex - 2];
              contentToSend = prevPrevEvent.message || prevPrevEvent.args?.content || prevPrevEvent.content || '';
              if (contentToSend) {
                console.log(`[DO:${this.state.id}] Found content from event before previous (ID: ${prevPrevEvent.id}, Action: ${prevPrevEvent.action}): ${contentToSend.length} chars`);
              }
            }
          }
        }
        
        if (!contentToSend) {
          console.log(`[DO:${this.state.id}] No content found in event before awaiting_user_input`);
        }
      }
      
      // INSTANT DETECTION: Check for agent message with wait_for_response: true
      // This happens BEFORE agent_state_changed, so we can detect it instantly
      if (event.source === 'agent' && event.action === 'message' && event.args?.wait_for_response === true) {
        agentAwaitingInput = true;
        console.log(`[DO:${this.state.id}] INSTANT DETECTION: Agent message with wait_for_response=true`);
        
        // Use this event's content directly
        contentToSend = event.args?.content || event.message || event.content || '';
        console.log(`[DO:${this.state.id}] Using content from wait_for_response message (${contentToSend.length} chars)`);
      }
    }
    
    // Update pending actions
    this.conversation.pending_actions = newPendingActions;
    
    // Update last processed event ID (track highest event ID processed)
    if (newEvents.length > 0) {
      const maxEventId = Math.max(...newEvents.map(e => e.id));
      this.conversation.last_sent_event_id = maxEventId;
      console.log(`[DO:${this.state.id}] Updated last processed event ID to ${maxEventId}`);
    }
    
    // Check if iteration is complete (agent is awaiting input)
    // When agent is awaiting_user_input, we should respond immediately regardless of pending actions
    // The agent is DONE and waiting for our response
    // For flow execution mode, we don't need contentToSend - just need to know agent is done
    const isFlowExecution = this.conversation.flow_steps && this.conversation.flow_steps.length > 0;
    
    if (agentAwaitingInput && (contentToSend || isFlowExecution)) {
      iterationCompleted = true;
      console.log(`[DO:${this.state.id}] Iteration ${this.conversation.iteration} completed! Agent awaiting input${contentToSend ? ` with content (${contentToSend.length} chars)` : ' (flow execution mode)'}`);
      
      // Generate iteration summary
      const iterationDuration = Date.now() - (this.conversation.iteration_started_at || Date.now());
      this.conversation.last_iteration_summary = `Iteration ${this.conversation.iteration} completed in ${iterationDuration}ms. Agent is awaiting next instructions.`;
      
      // Move to ITERATION_COMPLETE state and process immediately
      this.conversation.state = 'ITERATION_COMPLETE';
      this.conversation.pending_event_content = contentToSend;
      this.conversation.iteration_started_at = undefined; // Reset for next iteration
      
      // Save state
      await this.state.storage.put('conversation', this.conversation);
      
      // Process immediately instead of scheduling alarm
      await this.handleIterationCompleteState();
      return;
    }
    
    // If we get here, iteration is not complete yet
    console.log(`[DO:${this.state.id}] Iteration not complete. Pending actions: ${newPendingActions.length}, Agent awaiting input: ${agentAwaitingInput}`);
    
    // Check for "no new events" timeout (use aggressive timeout if enabled)
    if (this.conversation.last_event_seen_at) {
      const timeoutToUse = AGGRESSIVE_MODE ? AGGRESSIVE_NO_EVENT_TIMEOUT : NO_EVENT_TIMEOUT;
      const timeSinceLastEvent = Date.now() - this.conversation.last_event_seen_at;
      if (timeSinceLastEvent > timeoutToUse) {
        console.log(`[DO:${this.state.id}] No new events for ${timeSinceLastEvent}ms (> ${timeoutToUse}ms), assuming OH is stuck. Forcing completion.`);
        
        // Try to find any content in existing events to send to DeepSeek
        let fallbackContent = '';
        if (newEvents.length > 0) {
          // Look for the most recent message in new events
          const chronologicalEvents = [...newEvents].reverse(); // Oldest first
          let mostRecentMessage = null;
          
          for (const event of chronologicalEvents) {
            if (event.args?.content || event.message || event.content) {
              const content = event.args?.content || event.message || event.content || '';
              if (content) {
                mostRecentMessage = {
                  id: event.id,
                  content: content
                };
                // Keep going to find the MOST recent (last one in chronological order)
              }
            }
          }
          
          if (mostRecentMessage) {
            fallbackContent = mostRecentMessage.content;
            console.log(`[DO:${this.state.id}] Found most recent message in events (ID: ${mostRecentMessage.id}, ${fallbackContent.length} chars)`);
            
            // Add timeout context
            fallbackContent = `[OpenHands timed out after ${Math.round(timeSinceLastEvent/1000)}s without new events, last available response:]\n\n${fallbackContent}`;
          }
        }
        
        // Store any found content for next iteration
        if (fallbackContent) {
          this.conversation.pending_event_content = fallbackContent;
        }
        
        // Force move to next iteration and process immediately
        this.conversation.state = 'ITERATION_COMPLETE';
        this.conversation.last_iteration_summary = `Iteration ${this.conversation.iteration} forced completion - no new events for ${Math.round(timeSinceLastEvent/1000)}s.`;
        this.conversation.iteration_started_at = undefined;
        this.conversation.last_event_seen_at = undefined;
        
        await this.state.storage.put('conversation', this.conversation);
        await this.handleIterationCompleteState();
        return;
      }
    }
    
    // Check if iteration has timed out (general timeout check)
    const openhandsTimeoutToUse = AGGRESSIVE_MODE ? AGGRESSIVE_OPENHANDS_TIMEOUT : OPENHANDS_TIMEOUT;
    if (this.conversation.iteration_started_at && 
        Date.now() - this.conversation.iteration_started_at > openhandsTimeoutToUse) {
      console.log(`[DO:${this.state.id}] Iteration ${this.conversation.iteration} timed out after ${openhandsTimeoutToUse}ms. Forcing completion.`);
      
      // Try to find the MOST RECENT agent message content in NEW events
      let fallbackContent = '';
      
      // Process events in chronological order (oldest to newest) to find the most recent
      const chronologicalEvents = [...newEvents].reverse(); // Oldest first
      let mostRecentMessage = null;
      
      for (const event of chronologicalEvents) {
        if (event.args?.content || event.message || event.content) {
          const content = event.args?.content || event.message || event.content || '';
          if (content) {
            mostRecentMessage = {
              id: event.id,
              content: content
            };
            // Keep going to find the MOST recent (last one in chronological order)
          }
        }
      }
      
      if (mostRecentMessage) {
        fallbackContent = mostRecentMessage.content;
        console.log(`[DO:${this.state.id}] Found most recent agent message (ID: ${mostRecentMessage.id}, ${fallbackContent.length} chars)`);
        
        // Add timeout context
        fallbackContent = `[OpenHands timed out after ${OPENHANDS_TIMEOUT}ms, partial response:]\n\n${fallbackContent}`;
      }
      
      // Store any found content for next iteration
      if (fallbackContent) {
        this.conversation.pending_event_content = fallbackContent;
      }
      
      // Force move to next iteration and process immediately
      this.conversation.state = 'ITERATION_COMPLETE';
      this.conversation.last_iteration_summary = `Iteration ${this.conversation.iteration} forced completion after timeout (${OPENHANDS_TIMEOUT}ms).`;
      this.conversation.iteration_started_at = undefined;
      
      await this.state.storage.put('conversation', this.conversation);
      await this.handleIterationCompleteState();
      return;
    }
    
    // ADAPTIVE POLLING: Poll faster as we approach expected completion
    const iterationDuration = Date.now() - this.conversation.iteration_started_at!;
    let nextCheckDelay = ALARM_DELAY_WAITING; // Default 50ms
    
    // If we just started (first 5 seconds), poll less frequently
    if (iterationDuration < 5000) {
      nextCheckDelay = 1000; // 1 second for long operations
    } 
    // If we're in the middle (5-30 seconds), poll moderately
    else if (iterationDuration < 30000) {
      nextCheckDelay = 500; // 500ms for medium operations
    }
    // If we're past 30 seconds, poll very frequently (expecting completion soon)
    else if (iterationDuration < 60000) {
      nextCheckDelay = 100; // 100ms for operations nearing completion
    }
    // After 1 minute, poll extremely frequently
    else {
      nextCheckDelay = ALARM_DELAY_ACTIVE; // 10ms for immediate detection
    }
    
    console.log(`[DO:${this.state.id}] Next check in ${nextCheckDelay}ms (iteration duration: ${iterationDuration}ms)`);
    await this.scheduleNextAlarm(nextCheckDelay);
  }
  
  // ==========================================================================
  // NEW STATE HANDLERS
  // ==========================================================================
  
  private async handleIterationCompleteState(): Promise<void> {
    if (!this.conversation) return;
    
    console.log(`[DO:${this.state.id}] ITERATION_COMPLETE: Iteration ${this.conversation.iteration} completed`);
    
    // Check if this is ultra-minimal flow mode
    if (this.conversation.flow_steps && this.conversation.current_step_index !== undefined) {
      // Ultra-minimal flow mode: Go to next step
      console.log(`[DO:${this.state.id}] Ultra-minimal flow mode: Moving to next step`);
      
      // Extract response from pending_event_content for conditional branching
      if (this.conversation.pending_event_content) {
        try {
          // Try to parse as JSON to extract status
          const content = this.conversation.pending_event_content.trim();
          if (content.startsWith('{') && content.endsWith('}')) {
            const parsed = JSON.parse(content);
            // Extract status field if present
            if (parsed.status) {
              this.conversation.last_step_response = `Status: ${parsed.status}`;
              console.log(`[DO:${this.state.id}] Extracted status from response: ${parsed.status}`);
              // Send output if enabled for current step
              if (this.conversation.current_step) {
                await this.sendStepOutputIfEnabled(this.conversation.current_step, `Status: ${parsed.status}`);
                // STORE STEP RESPONSE: Call handleStepCompletion to store response in step's response field
                await this.handleStepCompletion(this.conversation.current_step, `Status: ${parsed.status}`);
              }
            } else {
              // Use the full content as response
              this.conversation.last_step_response = content;
              console.log(`[DO:${this.state.id}] Using full content as step response (${content.length} chars)`);
              // Send output if enabled for current step
              if (this.conversation.current_step) {
                await this.sendStepOutputIfEnabled(this.conversation.current_step, content);
                // STORE STEP RESPONSE: Call handleStepCompletion to store response in step's response field
                await this.handleStepCompletion(this.conversation.current_step, content);
              }
            }
          } else {
            // Not JSON, use as-is
            this.conversation.last_step_response = content;
            console.log(`[DO:${this.state.id}] Using non-JSON content as step response (${content.length} chars)`);
            // Send output if enabled for current step
            if (this.conversation.current_step) {
              await this.sendStepOutputIfEnabled(this.conversation.current_step, content);
              // STORE STEP RESPONSE: Call handleStepCompletion to store response in step's response field
              await this.handleStepCompletion(this.conversation.current_step, content);
            }
          }
        } catch (error) {
          // If JSON parsing fails, use as-is
          console.log(`[DO:${this.state.id}] Failed to parse JSON, using content as-is: ${error}`);
          this.conversation.last_step_response = this.conversation.pending_event_content;
          // Send output if enabled for current step
          if (this.conversation.current_step && this.conversation.pending_event_content) {
            await this.sendStepOutputIfEnabled(this.conversation.current_step, this.conversation.pending_event_content);
            // STORE STEP RESPONSE: Call handleStepCompletion to store response in step's response field
            await this.handleStepCompletion(this.conversation.current_step, this.conversation.pending_event_content);
          }
        }
      }
      
      // Clear pending event content (not needed for ultra-minimal flow)
      this.conversation.pending_event_content = undefined;
      
      // Update step index based on conditional branching or sequential order
      if (this.conversation.last_step_response && this.conversation.current_step) {
        // Check for conditional branching
        const { getNextStepBasedOnConditions } = await import('../services/database');
        const matchedStep = await getNextStepBasedOnConditions(
          this.env.FLOW_RUNS_DB,
          this.conversation.flow_id!,
          this.conversation.current_step.step_id,
          this.conversation.last_step_response
        );
        
        if (matchedStep) {
          // Check for termination condition (order_index = -1)
          if (matchedStep.order_index === -1) {
            console.log(`[DO:${this.state.id}] Termination condition met, ending flow`);
            await this.stopConversation('terminated_by_condition');
            return;
          }
          
          // Conditional branching matched: set index to matched step's order_index
          this.conversation.current_step_index = matchedStep.order_index - 1;
          console.log(`[DO:${this.state.id}] Conditional branching matched: updating current_step_index to ${this.conversation.current_step_index} (order_index: ${matchedStep.order_index})`);
        } else {
          // No conditional branching: increment sequentially
          await this.incrementStepIdx();
        }
      } else {
        // No response for conditional branching: increment sequentially
        await this.incrementStepIdx();
      }
      
      this.conversation.state = 'SENDING_STEP';
      
      // Save state
      await this.state.storage.put('conversation', this.conversation);
      
      // Process immediately
      await this.handleSendingStepState();
    } else {
      // Regular mode: Go to DeepSeek for next instructions
      this.conversation.state = 'AWAITING_NEXT_ITERATION';
      
      // Save state
      await this.state.storage.put('conversation', this.conversation);
      
      // Process immediately
      await this.handleAwaitingNextIterationState();
    }
  }
  
  private async handleAwaitingNextIterationState(): Promise<void> {
    if (!this.conversation) return;
    
    console.log(`[DO:${this.state.id}] AWAITING_NEXT_ITERATION: Deciding next step for iteration ${this.conversation.iteration}`);
    
    // Check if we have pending event content from timeout or previous iteration
    if (this.conversation.pending_event_content) {
      console.log(`[DO:${this.state.id}] Using pending event content (${this.conversation.pending_event_content.length} chars)`);
      const contentToSend = this.conversation.pending_event_content;
      this.conversation.pending_event_content = undefined; // Clear after use
      await this.state.storage.put('conversation', this.conversation);
      await this.sendToDeepSeek(contentToSend);
      return;
    }
    
    // In aggressive mode with static prompts, use a static prompt instead of getting content from OpenHands
    if (AGGRESSIVE_MODE && STATIC_PROMPT_MODE) {
      console.log(`[DO:${this.state.id}] Using static prompt mode for iteration ${this.conversation.iteration}`);
      
      // Get the appropriate static prompt based on iteration
      const promptIndex = (this.conversation.iteration - 1) % STATIC_PROMPTS.length;
      const staticPrompt = STATIC_PROMPTS[promptIndex];
      
      console.log(`[DO:${this.state.id}] Using static prompt ${promptIndex + 1}/${STATIC_PROMPTS.length}: ${staticPrompt ? staticPrompt.substring(0, 100) + "..." : "EMPTY"}`);
      
      // Send the static prompt to DeepSeek
      await this.sendToDeepSeek(staticPrompt);
      return;
    }
    
    // Check if this is flow execution mode
    if (this.conversation.flow_execution_mode) {
      console.log(`[DO:${this.state.id}] Flow execution mode: Getting next step for flow ${this.conversation.flow_id}`);
      
      // Check for routing BEFORE getting next step
      let route = null;
      let nextStep = null;
      
      if (this.conversation.last_step_response && this.conversation.current_step) {
        console.log(`[DO:${this.state.id}] Checking for routing conditions before getting next step in handleOpenHandsResponse`);
        
        // Load conditions for routing decision
        const conditionsQuery = `
          SELECT fsc.* 
          FROM flow_step_conditions fsc
          WHERE fsc.flow_step_id = ?
          ORDER BY fsc.created_at
        `;
        
        const conditionsResult = await this.env.FLOW_RUNS_DB.prepare(conditionsQuery).bind(this.conversation.current_step.step_id).all();
        const conditions = conditionsResult.results as any[];
        
        // Check if any condition has source field (new system)
        if (conditions.some(c => c.source)) {
          console.log(`[DO:${this.state.id}] Found conditions with source field, evaluating routing`);
          
          const routedConditions = conditions.map(c => ({
            condition: {
              source: c.source,
              operator: c.operator,
              value: c.value
            },
            route: {
              type: c.route_type,
              target_id: c.target_id,
              context_preservation: c.context_preservation
            }
          }));
          
          // Get router and evaluate
          const router = await this.getRouter();
          route = router.resolveWithFallback(
            routedConditions,
            this.conversation.execution_context
          );
          
          console.log(`[DO:${this.state.id}] Router returned route: ${route.type} -> ${route.target_id}`);
        }
      }
      
      // Apply route if exists
      if (route) {
        if (route.type === 'flow') {
          const newFlowId = route.target_id;
          
          // 1. Reset flow
          this.conversation.flow_id = newFlowId;
          
          // 2. Reset step index
          this.conversation.current_step_index = 0;
          
          // 3. Reset step tracking
          this.conversation.flow_steps = [];
          
          // 4. Handle context preservation
          const context = this.conversation.execution_context;
          
          if (route.context_preservation === 'none') {
            this.conversation.execution_context = createExecutionContext(newFlowId, '');
          }
          
          if (route.context_preservation === 'partial') {
            const newCtx = createExecutionContext(newFlowId, '');
            
            for (const [key, val] of context.data.entries()) {
              if (val?.metadata?.persist) {
                newCtx.data.set(key, val);
              }
            }
            
            this.conversation.execution_context = newCtx;
          }
          
          if (route.context_preservation === 'full') {
            context.flow_id = newFlowId;
            this.conversation.execution_context = context;
          }
          
          // 5. Reload steps
          await this.loadFlowSteps(newFlowId);
          
          // 6. Get first step of new flow
          if (this.conversation.flow_steps && this.conversation.flow_steps.length > 0) {
            nextStep = this.conversation.flow_steps[0];
            console.log(`[DO:${this.state.id}] Flow transition to ${newFlowId}, first step: ${nextStep.title}`);
            
            // Save state after flow switch
            await this.state.storage.put('conversation', this.conversation);
          } else {
            console.log(`[DO:${this.state.id}] No steps in new flow ${newFlowId}, completing flow execution`);
            await this.saveFlowRunToDatabase('flow_completed_no_more_steps', 'completed');
            await this.restartFlow();
            await this.stopConversation('flow_completed');
            return;
          }
        }
        
        if (route.type === 'step') {
          // Find step by target_id in current flow steps
          if (this.conversation.flow_steps) {
            nextStep = this.conversation.flow_steps.find(s => s.step_id === route.target_id);
            if (nextStep) {
              console.log(`[DO:${this.state.id}] Step transition to: ${nextStep.title}`);
              // Update current_step_index to match the found step
              const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === route.target_id);
              if (stepIndex !== -1) {
                this.conversation.current_step_index = stepIndex;
              }
            } else {
              console.log(`[DO:${this.state.id}] Step ${route.target_id} not found in current flow, completing flow execution`);
              await this.saveFlowRunToDatabase('flow_completed_no_more_steps', 'completed');
              await this.restartFlow();
              await this.stopConversation('flow_completed');
              return;
            }
          } else {
            console.log(`[DO:${this.state.id}] No flow steps available, completing flow execution`);
            await this.saveFlowRunToDatabase('flow_completed_no_more_steps', 'completed');
            await this.restartFlow();
            await this.stopConversation('flow_completed');
            return;
          }
        }
        
        if (route.type === 'end') {
          console.log(`[DO:${this.state.id}] Route type is 'end', flow should complete`);
          await this.saveFlowRunToDatabase('flow_completed_by_route', 'completed');
          await this.restartFlow();
          await this.stopConversation('flow_completed');
          return;
        }
      }
      
      // If no route, get next step using legacy logic
      if (!nextStep) {
        nextStep = await this.getNextStep();
        
        if (!nextStep) {
          console.log(`[DO:${this.state.id}] No more steps in flow, completing flow execution`);
          await this.saveFlowRunToDatabase('flow_completed_no_more_steps', 'completed');
          await this.restartFlow();
          await this.stopConversation('flow_completed');
          return;
        }
      }
      
      // Check if this is a decision step (Step 7 - gap_analysis)
      const isDecisionStep = nextStep.step_key === 'gap_analysis';
      
      if (!isDecisionStep) {
        // EXECUTION STEP: Send directly to OpenHands
        console.log(`[DO:${this.state.id}] ====== ROUTING VALIDATION ======`);
        console.log(`[DO:${this.state.id}] Step: ${(this.conversation.current_step_index || 0) + 1}`);
        console.log(`[DO:${this.state.id}] Step Key: ${nextStep.step_key}`);
        console.log(`[DO:${this.state.id}] DeepSeek called: false (bypassing for execution step)`);
        console.log(`[DO:${this.state.id}] Payload to OpenHands (first 500 chars): ${nextStep.description ? nextStep.description.substring(0, 500) : 'No description'}...`);
        console.log(`[DO:${this.state.id}] ====== END VALIDATION ======`);
        
        // Build step command
        // Remove "Step X: " prefix from title to prevent AI from inferring progress
        const stepTitleWithoutNumber = nextStep.title.replace(/^Step \d+: /, '');
        let stepCommand = `Execute step: ${stepTitleWithoutNumber}`;
        if (nextStep.description) {
          stepCommand += `\n${nextStep.description}`;
        }
        stepCommand += `\n\nStep Type: ${nextStep.step_type}`;
        if (nextStep.page_key) {
          stepCommand += `\nPage: ${nextStep.page_key}`;
        }
        if (nextStep.blocking === false) {
          stepCommand += `\nNote: This step is non-blocking - flow can continue even if this step fails`;
        }
        
        // Check for task injection (similar to handleSendingStepState logic)
        // Priority: 1. Static task_id, 2. Dynamic requires_task
        let taskInjected = false;
        
        // Only check task_id if it's a non-empty string (truthy)
        if (nextStep.task_id && nextStep.task_id.trim() && this.env.FLOW_RUNS_DB) {
          console.log(`[DO:${this.state.id}] Step has static task_id: ${nextStep.task_id}`);
          try {
            const { getTaskData } = await import('../services/database');
            const taskData = await getTaskData(this.env.FLOW_RUNS_DB, nextStep.task_id);
            if (taskData) {
              stepCommand += `\n\n=== TASK ===`;
              stepCommand += `\nTask ID: ${nextStep.task_id}`;
              stepCommand += `\nTitle: ${taskData.title}`;
              if (taskData.description) {
                stepCommand += `\nDescription: ${taskData.description}`;
              }
              // Add payload if it's JSON and contains additional metadata
              if (taskData.payload && taskData.payload.trim().startsWith('{') && taskData.payload.trim().endsWith('}')) {
                try {
                  const payloadObj = JSON.parse(taskData.payload);
                  // Add non-instruction fields from payload
                  const metadataFields = Object.entries(payloadObj)
                    .filter(([key, value]) => key !== 'instructions' && typeof value === 'string')
                    .map(([key, value]) => `${key}: ${value}`);
                  
                  if (metadataFields.length > 0) {
                    stepCommand += `\nAdditional Details:`;
                    metadataFields.forEach(field => {
                      stepCommand += `\n- ${field}`;
                    });
                  }
                } catch (e) {
                  // Not valid JSON, skip
                  console.log(`[DO:${this.state.id}] Task payload is not valid JSON: ${e.message}`);
                }
              }
              stepCommand += `\n=== END TASK ===\n`;
              // REMOVED: Instructions to mark task as complete
              // Task completion is handled automatically by the system
              console.log(`[DO:${this.state.id}] Injected task: ${taskData.title} (ID: ${nextStep.task_id})`);
              taskInjected = true;
            }
          } catch (error: any) {
            console.error(`[DO:${this.state.id}] Error fetching task data: ${error.message}`);
          }
        }
        
        // If task_id didn't work or wasn't set, try requires_task
        // Convert requires_task to boolean explicitly (database returns 0/1 as number or string)
        const requiresTask = this.convertRequiresTaskToBoolean(nextStep.requires_task);
        console.log(`[DO:${this.state.id}] Task injection debug (handleAwaitingNextIterationState): taskInjected=${taskInjected}, requiresTask=${requiresTask}, flow_id=${this.conversation.flow_id}, FLOW_RUNS_DB=${!!this.env.FLOW_RUNS_DB}`);
        if (!taskInjected && requiresTask && this.conversation.flow_id && this.env.FLOW_RUNS_DB) {
          console.log(`[DO:${this.state.id}] Step requires dynamic task, fetching first pending task for flow: ${this.conversation.flow_id}`);
          try {
            const { getFirstPendingTask } = await import('../services/database');
            const pendingTask = await getFirstPendingTask(this.env.FLOW_RUNS_DB, this.conversation.flow_id);
            if (pendingTask) {
              stepCommand += `\n\n=== TASK ===`;
              stepCommand += `\nTask ID: ${pendingTask.id}`;
              stepCommand += `\nTitle: ${pendingTask.title}`;
              if (pendingTask.description) {
                stepCommand += `\nDescription: ${pendingTask.description}`;
              }
              // Add payload if it's JSON and contains additional metadata
              if (pendingTask.payload && pendingTask.payload.trim().startsWith('{') && pendingTask.payload.trim().endsWith('}')) {
                try {
                  const payloadObj = JSON.parse(pendingTask.payload);
                  // Add non-instruction fields from payload
                  const metadataFields = Object.entries(payloadObj)
                    .filter(([key, value]) => key !== 'instructions' && typeof value === 'string')
                    .map(([key, value]) => `${key}: ${value}`);
                  
                  if (metadataFields.length > 0) {
                    stepCommand += `\nAdditional Details:`;
                    metadataFields.forEach(field => {
                      stepCommand += `\n- ${field}`;
                    });
                  }
                } catch (e) {
                  // Not valid JSON, skip
                  console.log(`[DO:${this.state.id}] Task payload is not valid JSON: ${e.message}`);
                }
              }
              stepCommand += `\n=== END TASK ===\n`;
              // REMOVED: Instructions to mark task as complete
              // Task completion is handled automatically by the system
              console.log(`[DO:${this.state.id}] Injected task: ${pendingTask.title} (ID: ${pendingTask.id})`);
              taskInjected = true;
            } else {
              console.log(`[DO:${this.state.id}] No pending tasks found for flow: ${this.conversation.flow_id}`);
            }
          } catch (error: any) {
            console.error(`[DO:${this.state.id}] Error fetching pending task: ${error.message}`);
          }
        }
        
        // Store step in conversation for reference
        this.conversation.current_step = nextStep;
        
        // Start tracking step execution
        try {
          const { startTaskExecution } = await import('../services/database');
          const executionResult = await startTaskExecution(
            this.env.FLOW_RUNS_DB, 
            this.flowRunId!,
            nextStep.step_id
          );
          
          if (executionResult.success) {
            console.log(`[DO:${this.state.id}] Started tracking step execution: ${executionResult.execution_step_id}`);
            this.conversation.current_execution_step_id = executionResult.execution_step_id;
          }
        } catch (trackingError: any) {
          console.error(`[DO:${this.state.id}] Error tracking step execution: ${trackingError.message}`);
          // Continue even if tracking fails
        }
        
        // Increment step index for next iteration
        await this.incrementStepIdx();
        
        // Send step command directly to OpenHands (bypassing DeepSeek)
        // Add to conversation messages as if DeepSeek sent it
        this.conversation.conversation_messages!.push({
          role: 'assistant',
          content: stepCommand
        });
        
        this.conversation.last_deepseek_response = stepCommand;
        this.conversation.deepseek_response_pending = false;
        
        // Transition to WAITING_OPENHANDS state
        this.conversation.state = 'WAITING_OPENHANDS';
        console.log(`[DO:${this.state.id}] Transitioned to WAITING_OPENHANDS for execution step ${nextStep.step_key}`);
        return;
      } else {
        // DECISION STEP: Get OpenHands report and send to DeepSeek
        console.log(`[DO:${this.state.id}] ====== ROUTING VALIDATION ======`);
        console.log(`[DO:${this.state.id}] Step: 7 (gap_analysis)`);
        console.log(`[DO:${this.state.id}] DeepSeek called: true (decision step)`);
        console.log(`[DO:${this.state.id}] Getting OpenHands report for decision analysis`);
        console.log(`[DO:${this.state.id}] ====== END VALIDATION ======`);
        
        // Get OpenHands conversation to find the last message (report)
        const openhandsStatus = await getOpenHandsConversation(
          this.env.OPENHANDS_API_URL,
          this.conversation.openhands_conversation_id!
        );
        
        if (!openhandsStatus.success) {
          console.log(`[DO:${this.state.id}] Failed to get OpenHands conversation: ${openhandsStatus.error}`);
          // Retry in 10 seconds
          await this.scheduleNextAlarm(10000);
          return;
        }
        
        const events = openhandsStatus.events || [];
        // Find the agent's last message (report)
        let reportContent = '';
        const chronologicalEvents = [...events].reverse();
        
        for (let i = 0; i < chronologicalEvents.length; i++) {
          const event = chronologicalEvents[i];
          if (event.observation === 'agent_state_changed' && event.extras?.agent_state === 'awaiting_user_input') {
            if (i > 0) {
              const prevEvent = chronologicalEvents[i - 1];
              reportContent = prevEvent.message || prevEvent.args?.content || prevEvent.content || '';
              if (reportContent) break;
            }
            break;
          }
        }
        
        if (reportContent) {
          console.log(`[DO:${this.state.id}] Found OpenHands report (${reportContent.length} chars), sending to DeepSeek for decision`);
          console.log(`[DO:${this.state.id}] Report preview (first 300 chars): ${reportContent.substring(0, 300)}...`);
          
          // Store step in conversation for reference
          this.conversation.current_step = nextStep;
          
          // Send report to DeepSeek for decision
          await this.sendToDeepSeek(reportContent);
        } else {
          console.log(`[DO:${this.state.id}] No OpenHands report found, sending generic message to DeepSeek`);
          await this.sendToDeepSeek(`OpenHands completed previous step. Please analyze and decide next action for step: ${nextStep.title}`);
        }
        return;
      }
    }
    
    // NON-FLOW MODE: Original logic - always send to DeepSeek
    console.log(`[DO:${this.state.id}] Non-flow mode: Getting OpenHands response to send to DeepSeek`);
    
    // Get OpenHands conversation to find the last message
    const openhandsStatus = await getOpenHandsConversation(
      this.env.OPENHANDS_API_URL,
      this.conversation.openhands_conversation_id!
    );
    
    if (!openhandsStatus.success) {
      console.log(`[DO:${this.state.id}] Failed to get OpenHands conversation: ${openhandsStatus.error}`);
      // Retry in 10 seconds
      await this.scheduleNextAlarm(10000);
      return;
    }
    
    const events = openhandsStatus.events || [];
    // Events come with ?reverse=true (newest first), search in that order
    // Find the agent's last message (before awaiting_user_input)
    let contentToSend = '';
    
    // Reverse events to chronological order (oldest first) for easier processing
    const chronologicalEvents = [...events].reverse();
    
    for (let i = 0; i < chronologicalEvents.length; i++) {
      const event = chronologicalEvents[i];
      if (event.observation === 'agent_state_changed' && event.extras?.agent_state === 'awaiting_user_input') {
        // Get the event right before this one (if exists)
        if (i > 0) {
          const prevEvent = chronologicalEvents[i - 1];
          // Use message field first, then args.content, then content
          contentToSend = prevEvent.message || prevEvent.args?.content || prevEvent.content || '';
          
          if (contentToSend) {
            console.log(`[DO:${this.state.id}] Found content from event before awaiting_user_input (ID: ${prevEvent.id}, Action: ${prevEvent.action}): ${contentToSend.length} chars`);
            break;
          }
          
          // Try one more event back if needed
          if (i > 1 && !contentToSend) {
            const prevPrevEvent = chronologicalEvents[i - 2];
            contentToSend = prevPrevEvent.message || prevPrevEvent.args?.content || prevPrevEvent.content || '';
            if (contentToSend) {
              console.log(`[DO:${this.state.id}] Found content from event before previous (ID: ${prevPrevEvent.id}, Action: ${prevPrevEvent.action}): ${contentToSend.length} chars`);
              break;
            }
          }
        }
        
        if (!contentToSend) {
          console.log(`[DO:${this.state.id}] No content found in event before awaiting_user_input`);
        }
        break;
      }
    }
    
    if (contentToSend) {
      console.log(`[DO:${this.state.id}] Found content to send to DeepSeek (${contentToSend.length} chars)`);
      
      // Send to DeepSeek for next instructions
      await this.sendToDeepSeek(contentToSend);
    } else {
      console.log(`[DO:${this.state.id}] No content found to send to DeepSeek`);
      
      // If we have a last iteration summary (e.g., from timeout), use that
      if (this.conversation.last_iteration_summary) {
        console.log(`[DO:${this.state.id}] Using last iteration summary as fallback content`);
        const timeoutMessage = `OpenHands timed out or didn't provide a response. ${this.conversation.last_iteration_summary}`;
        await this.sendToDeepSeek(timeoutMessage);
      } else {
        // No content and no summary - send a generic message
        console.log(`[DO:${this.state.id}] No content or summary available, sending generic timeout message`);
        const timeoutMessage = `OpenHands didn't provide a response for iteration ${this.conversation.iteration}. Please provide simpler instructions or check if OpenHands is working.`;
        await this.sendToDeepSeek(timeoutMessage);
      }
    }
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Resume execution after waiting for input
   */
  private async handleResume(request: Request): Promise<Response> {
    try {
      // Check if conversation is in WAITING_FOR_INPUT state
      if (this.conversation.state !== 'WAITING_FOR_INPUT' || !this.conversation.waiting_for_input) {
        return new Response(JSON.stringify({
          error: 'Not waiting for input',
          current_state: this.conversation.state,
          waiting_for_input: this.conversation.waiting_for_input
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json() as { input: any };
      const { input } = body;
      
      if (input === undefined) {
        return new Response(JSON.stringify({
          error: 'Missing input field in request body'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { name: inputName, step_id: stepId } = this.conversation.waiting_for_input;
      
      console.log(`[DO:${this.state.id}] Resuming execution with input for ${inputName}:`, input);

      // Store input in execution context with metadata
      if (this.conversation.execution_context) {
        this.conversation.execution_context.inputs[inputName] = {
          value: input,
          metadata: {
            source: 'user',
            timestamp: Date.now(),
            step_id: stepId,
            input_name: inputName
          }
        };
        
        // Clear awaiting_input
        this.conversation.execution_context.awaiting_input = undefined;
      }

      // Update the paused step with the input result
      if (this.conversation.flow_steps && this.conversation.current_step) {
        const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === stepId);
        if (stepIndex !== -1) {
          this.conversation.flow_steps[stepIndex].response = `Received input for ${inputName}: ${JSON.stringify(input)}`;
          this.conversation.flow_steps[stepIndex].status = 'completed';
          console.log(`[DO:${this.state.id}] Updated step ${stepId} with input result`);
        }
      }

      // Clear waiting state
      this.conversation.state = 'SENDING_STEP';
      this.conversation.status = 'active';
      this.conversation.waiting_for_input = undefined;

      // Save state
      await this.state.storage.put('conversation', this.conversation);

      // Continue execution
      await this.handleSendingStepState();

      return new Response(JSON.stringify({
        success: true,
        message: `Resumed execution with input for ${inputName}`,
        input_name: inputName,
        step_id: stepId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error in handleResume:`, error);
      return new Response(JSON.stringify({
        error: 'Failed to resume execution',
        details: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle flow completion by checking flow_definitions.next_flow_id
   * This is the SINGLE AUTHORITY for flow transitions
   */
  private async handleFlowCompletion(): Promise<void> {
    if (!this.conversation?.flow_id || !this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Cannot handle flow completion: missing flow_id or database`);
      return;
    }
    
    // IDEMPOTENCY GUARD: Track flow completion to prevent double execution
    if (this.conversation.flow_completed) {
      console.warn(`[DO:${this.state.id}] Flow already marked as completed, ignoring duplicate completion`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Handling flow completion for: ${this.conversation.flow_id}`);
    
    try {
      // Get last response from the flow run
      const lastResponse = getLastFlowResponse(this.conversation.conversation_messages);
      console.log(`[DO:${this.state.id}] Last flow response (first 200 chars): ${lastResponse.substring(0, 200)}...`);
      
      // Get the last step's output payload for flow-to-flow propagation
      let transitionPayload: string | null = null;
      if (this.flowRunId) {
        try {
          const lastStep = await this.env.FLOW_RUNS_DB.prepare(`
            SELECT output_payload FROM step_runs 
            WHERE flow_run_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
          `).bind(this.flowRunId).first();
          
          if (lastStep?.output_payload) {
            transitionPayload = lastStep.output_payload as string;
            console.log(`[DO:${this.state.id}] Found last step output payload (${transitionPayload.length} chars)`);
          } else {
            console.log(`[DO:${this.state.id}] No output_payload found for last step`);
          }
        } catch (error: any) {
          console.error(`[DO:${this.state.id}] Error getting last step payload: ${error.message}`);
        }
      }
      
      // Check for flow chain in inputs (passed from parent flow)
      let flowChain: string[] = [];
      if (this.conversation.execution_context?.inputs) {
        try {
          const inputs = this.conversation.execution_context.inputs;
          if (inputs._flow_chain && Array.isArray(inputs._flow_chain)) {
            flowChain = inputs._flow_chain;
            console.log(`[DO:${this.state.id}] Found flow chain in inputs: ${JSON.stringify(flowChain)}`);
          }
        } catch (error: any) {
          console.error(`[DO:${this.state.id}] Error parsing flow chain from inputs: ${error.message}`);
        }
      }
      
      // Check for conditional next flow based on last response
      const conditionalNextFlowId = await getNextFlowBasedOnConditions(
        this.env.FLOW_RUNS_DB,
        this.conversation.flow_id,
        lastResponse
      );
      
      let nextFlowIds: string[] = [];
      let nextFlowId: string | null = null;
      
      if (conditionalNextFlowId) {
        console.log(`[DO:${this.state.id}] Using conditional next flow: ${conditionalNextFlowId}`);
        nextFlowIds = [conditionalNextFlowId];
        nextFlowId = conditionalNextFlowId;
      } else {
        // Fall back to static next_flow_id/next_flow_ids from flow_definitions table
        const nextFlow = await this.env.FLOW_RUNS_DB.prepare(`
          SELECT next_flow_id, next_flow_ids FROM flow_definitions WHERE id = ?
        `).bind(this.conversation.flow_id).first();
        
        // Normalize to array: use next_flow_ids if available, fall back to next_flow_id
        if (nextFlow?.next_flow_ids) {
          try {
            // Parse JSON array from next_flow_ids column
            const parsedIds = JSON.parse(nextFlow.next_flow_ids as string);
            if (Array.isArray(parsedIds) && parsedIds.every(id => typeof id === 'string')) {
              nextFlowIds = parsedIds;
              console.log(`[DO:${this.state.id}] Using next_flow_ids from flow_definitions: ${JSON.stringify(nextFlowIds)}`);
            } else {
              console.warn(`[DO:${this.state.id}] Invalid next_flow_ids format, falling back to next_flow_id`);
            }
          } catch (error: any) {
            console.error(`[DO:${this.state.id}] Error parsing next_flow_ids: ${error.message}`);
          }
        }
        
        // If no next_flow_ids or parsing failed, fall back to next_flow_id
        if (nextFlowIds.length === 0 && nextFlow?.next_flow_id) {
          nextFlowIds = [nextFlow.next_flow_id as string];
          console.log(`[DO:${this.state.id}] Using next_flow_id from flow_definitions: ${nextFlow.next_flow_id}`);
        }
        
        if (nextFlowIds.length > 0) {
          // Store the first flow ID in nextFlowId for backward compatibility in single flow case
          nextFlowId = nextFlowIds[0];
        } else {
          console.log(`[DO:${this.state.id}] No next_flow_id or next_flow_ids defined in flow_definitions for: ${this.conversation.flow_id}`);
          console.log(`[DO:${this.state.id}] Flow chain ends here`);
        }
      }
      
      // Check if we have a callback_url to send response to
      const callbackUrl = this.conversation.execution_context?.callback_url;
      if (callbackUrl) {
        console.log(`[DO:${this.state.id}] Sending flow response to callback URL: ${callbackUrl}`);
        
        try {
          // Extract the last response from the flow
          const lastResponse = getLastFlowResponse(this.conversation.conversation_messages);
          
          // Parse the callback URL to extract conversation ID
          // Expected format: http://placeholder/resume?conversation_id=...
          const url = new URL(callbackUrl);
          const conversationId = url.searchParams.get('conversation_id');
          
          if (conversationId) {
            console.log(`[DO:${this.state.id}] Found conversation ID in callback: ${conversationId}`);
            
            // Get the parent conversation Durable Object
            const parentConversationId = this.env.CONVERSATIONS.idFromString(conversationId);
            const parentConversation = this.env.CONVERSATIONS.get(parentConversationId);
            
            // Send resume request to parent conversation with flow response
            const resumeResponse = await parentConversation.fetch('http://placeholder/resume', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: lastResponse,
                source: `flow_response_${this.conversation.flow_id}`
              })
            });
            
            if (resumeResponse.ok) {
              console.log(`[DO:${this.state.id}] Successfully sent response to parent flow`);
            } else {
              const errorText = await resumeResponse.text();
              console.error(`[DO:${this.state.id}] Failed to send response to parent: ${resumeResponse.status} - ${errorText}`);
            }
          } else {
            console.error(`[DO:${this.state.id}] No conversation_id found in callback URL: ${callbackUrl}`);
          }
        } catch (error: any) {
          console.error(`[DO:${this.state.id}] Error sending response to callback: ${error.message}`);
        }
      } else if (nextFlowIds.length > 0) {
        console.log(`[DO:${this.state.id}] Starting ${nextFlowIds.length} next flow(s): ${JSON.stringify(nextFlowIds)}`);
        
        // Update current flow run with all next flow IDs
        if (this.flowRunId && this.env.FLOW_RUNS_DB) {
          try {
            await updateFlowRunStatus(
              this.env.FLOW_RUNS_DB,
              this.flowRunId,
              'new_flow_started',
              'multiple_next_flows_triggered',
              nextFlowIds[0], // First flow ID for backward compatibility
              undefined,
              nextFlowIds // All flow IDs for multiple flows support
            );
            console.log(`[DO:${this.state.id}] Updated flow run with next_flow_ids: ${JSON.stringify(nextFlowIds)}`);
          } catch (error: any) {
            console.error(`[DO:${this.state.id}] Error updating flow run with next_flow_ids: ${error.message}`);
          }
        }
        
        // TRUE CHAINING: A → B → C (not fan-out)
        // Only start ONE next flow at a time, pass remaining chain as metadata
        
        // Combine flow chain from inputs with nextFlowIds from flow definition
        // Priority: flowChain (from parent) > nextFlowIds (from definition)
        const allNextFlowIds = flowChain.length > 0 ? flowChain : nextFlowIds;
        
        if (allNextFlowIds.length > 0) {
          // Extract first flow ID and remaining chain
          const [nextFlowId, ...restChain] = allNextFlowIds;
          
          console.log(`[DO:${this.state.id}] Starting next flow in chain: ${nextFlowId}`);
          console.log(`[DO:${this.state.id}] Remaining chain: ${JSON.stringify(restChain)}`);
          
          // Start the next flow with current payload and chain metadata
          await this.startSpecificFlowWithChain(nextFlowId, transitionPayload, restChain, true);
        }
      }
      
      // Mark flow as completed to prevent double execution
      await this.updateConversationState({ flow_completed: true });
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error handling flow completion: ${error.message}`);
    }
  }
  
  private async stopConversation(reason: string): Promise<void> {
    console.log(`[DO:${this.state.id}] Stopping conversation: ${reason}`);
    
    // IDEMPOTENCY GUARD: Prevent double completion
    if (this.conversation?.state === 'DONE') {
      console.warn(`[DO:${this.state.id}] Conversation already in DONE state, ignoring stop request`);
      return;
    }
    
    // Update current step status to "failed" if this is an error (not flow completion)
    const isFlowCompletion = reason === 'flow_completed' || 
                            reason === 'terminated_by_condition' ||
                            reason.includes('end_flow');
    
    if (!isFlowCompletion && this.conversation?.flow_steps && this.conversation.current_step) {
      const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === this.conversation!.current_step!.step_id);
      if (stepIndex !== -1 && this.conversation.flow_steps[stepIndex].status !== 'completed') {
        this.conversation.flow_steps[stepIndex].status = 'failed';
        console.log(`[DO:${this.state.id}] Updated step ${this.conversation.current_step.step_id} status to 'failed' due to stopConversation: ${reason}`);
        
        // PERSIST: Save conversation state immediately
        await this.state.storage.put('conversation', this.conversation);
        console.log(`[DO:${this.state.id}] Persisted conversation with step ${this.conversation.current_step.step_id} status='failed'`);
      }
    }
    
    // If flow completed, check for next flow in flow_definitions
    if (isFlowCompletion && this.conversation?.flow_id) {
      await this.handleFlowCompletion();
    }
    
    // First, try to stop the OpenHands conversation via API if we have an ID
    if (this.conversation?.openhands_conversation_id) {
      console.log(`[DO:${this.state.id}] Stopping OpenHands conversation: ${this.conversation.openhands_conversation_id}`);
      try {
        const stopResult = await stopOpenHandsConversation(
          this.env.OPENHANDS_API_URL,
          this.conversation.openhands_conversation_id
        );
        
        if (!stopResult.success) {
          console.warn(`[DO:${this.state.id}] Failed to stop OpenHands conversation: ${stopResult.error}`);
        } else {
          console.log(`[DO:${this.state.id}] OpenHands conversation stopped successfully`);
        }
      } catch (error: any) {
        console.error(`[DO:${this.state.id}] Error stopping OpenHands conversation: ${error.message}`);
        // Continue with local cleanup even if OpenHands stop fails
      }
    }
    
    if (this.conversation) {
      // Save flow run to database if this is a flow execution
      try {
        // Determine status based on reason
        let flowStatus: 'completed' | 'stopped' | 'new_flow_started' = 'stopped';
        if (reason.includes('flow_completed') || reason.includes('max_iterations_reached') || reason.includes('END_FLOW')) {
          flowStatus = 'completed';
        } else if (reason.includes('new_flow_started') || reason.includes('end_flow_with_new_prompt')) {
          flowStatus = 'new_flow_started';
        }
        
        await this.saveFlowRunToDatabase(reason, flowStatus);
        
        // Emit FLOW_COMPLETED event for UI streaming if this is a flow completion
        if (isFlowCompletion && this.flowRunId && this.conversation?.flow_id) {
          this.emitFlowCompleted(this.conversation.flow_id, this.flowRunId, { reason, flowStatus });
        }
      } catch (error: any) {
        console.error(`[DO:${this.state.id}] Error saving flow run in stopConversation: ${error.message}`);
      }
      
      this.conversation.state = 'DONE';
      this.conversation.status = 'stopped';
      this.conversation.error_message = reason;
      this.conversation.updated_at = Date.now();
      
      // Clear any pending event fields
      this.conversation.pending_event_content = undefined;
      this.conversation.pending_event_id = undefined;
      this.conversation.last_event_seen_at = undefined;
      this.conversation.cooldown_started_at = undefined;
      this.conversation.conversation_messages = undefined;
      
      await this.state.storage.put('conversation', this.conversation);
      
      // In aggressive mode with auto-restart, schedule a new conversation
      if (AGGRESSIVE_MODE && AUTO_RESTART_CONVERSATION) {
        const restartCount = this.conversation.restart_count || 0;
        if (restartCount < MAX_RESTARTS) {
          console.log(`[DO:${this.state.id}] Scheduling auto-restart in ${RESTART_DELAY}ms (restart ${restartCount + 1}/${MAX_RESTARTS})`);
          
          // Store restart count
          this.conversation.restart_count = restartCount + 1;
          await this.state.storage.put('conversation', this.conversation);
          
          // Schedule restart alarm
          await this.scheduleNextAlarm(RESTART_DELAY);
        } else {
          console.log(`[DO:${this.state.id}] Max restarts reached (${MAX_RESTARTS}), not auto-restarting`);
          // After max restarts, delete storage to free resources
          await this.cleanupStorage();
        }
      } else {
        // If not auto-restarting, delete storage to free resources
        await this.cleanupStorage();
      }
    }
    
    // Cancel any pending alarms
    try {
      await this.state.storage.deleteAlarm();
    } catch (error) {
      // Ignore errors if no alarm exists
    }
  }
  
  private async cleanupStorage(): Promise<void> {
    try {
      console.log(`[DO:${this.state.id}] Cleaning up storage to free resources`);
      
      // Decrement active conversation count in KV
      try {
        if (this.env.RATE_LIMIT_KV) {
          const activeConversationsKey = 'global:active_conversations';
          const currentCount = await this.env.RATE_LIMIT_KV.get(activeConversationsKey);
          if (currentCount) {
            const newCount = Math.max(0, parseInt(currentCount) - 1);
            await this.env.RATE_LIMIT_KV.put(activeConversationsKey, newCount.toString(), { expirationTtl: 3600 });
            console.log(`[DO:${this.state.id}] Decremented active conversations to ${newCount}`);
          }
        }
      } catch (kvError) {
        console.error(`[DO:${this.state.id}] Error updating active conversation count: ${kvError}`);
      }
      
      // Delete all storage to reduce Durable Object usage
      await this.state.storage.deleteAll();
      console.log(`[DO:${this.state.id}] Storage cleaned up successfully`);
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error cleaning up storage: ${error.message}`);
    }
  }
  
  private async forceEndAndRestartConversation(reason: string): Promise<void> {
    console.log(`[DO:${this.state.id}] Force ending and restarting conversation: ${reason}`);
    
    // First, stop the current conversation
    await this.stopConversation(`force_ended: ${reason}`);
    
    // The stopConversation method will handle auto-restart if enabled
  }
  
  /**
   * Process a pending event that has passed the cooldown period
   * This sends the event content to DeepSeek and continues the loop
   */
  private async sendToDeepSeek(messageContent: string): Promise<void> {
    if (!this.conversation) {
      console.log(`[DO:${this.state.id}] No conversation to send to DeepSeek`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Sending to DeepSeek: ${messageContent.length} chars`);
    
    // Track DeepSeek request time and mark response as pending
    this.conversation.last_deepseek_request_at = Date.now();
    this.conversation.deepseek_response_pending = true;
    
    // Add OpenHands response to conversation history as user message
    if (!this.conversation.conversation_messages) {
      // This should never happen - conversation_messages should be initialized in handleInitState
      console.error(`[DO:${this.state.id}] conversation_messages is undefined!`);
      this.conversation.conversation_messages = [];
    }
    
    // Add iteration context to OpenHands response
    const messageContentWithContext = `[Iteration ${this.conversation.iteration + 1} of ${this.conversation.max_iterations}]
${messageContent}`;
    
    this.conversation.conversation_messages!.push({
      role: 'user',
      content: messageContentWithContext
    });
    
    // Send OpenHands response to DeepSeek with full conversation history
    const deepseekResult = await callDeepSeek(
      this.env.DEEPSEEK_API_KEY,
      this.conversation.conversation_messages
    );
    
    if (!deepseekResult.success) {
      await this.stopConversation(`deepseek_failed: ${deepseekResult.error}`);
      return;
    }
    
    // Update activity tracking for adaptive polling
    this.updateActivityTracking();
    
    // Filter out status messages from AI response
    const filteredResponse = this.filterStatusMessages(deepseekResult.response!);
    
    // Check for stop condition
    const doneData = this.checkForDone(filteredResponse);
    
    // Check deterministic completion via external verification
    const verificationResult = await shouldCompleteTask(
      this.conversation.repository,
      this.conversation.branch || 'main',
      this.conversation.iteration,
      filteredResponse
    );
    
    // Complete if either AI says done OR external verification passes
    if (doneData.done || verificationResult.shouldComplete) {
      const reason = doneData.done ? 'deepseek_done' : `external_verification: ${verificationResult.completionReason}`;
      console.log(`[DO:${this.state.id}] Completion triggered: ${reason}`);
      console.log(`[DO:${this.state.id}] Verification details: ${JSON.stringify(verificationResult.verificationResult)}`);
      
      await this.handleDoneResponse(filteredResponse, reason);
      await this.stopConversation(reason);
      return;
    }
    
    // Add DeepSeek response to conversation history
    this.conversation.conversation_messages!.push({
      role: 'assistant',
      content: filteredResponse
    });
    
    this.conversation.last_deepseek_response = filteredResponse;
    
    // Clear DeepSeek response pending flag since we got a response
    this.conversation.deepseek_response_pending = false;
    
    // Check if we're in dual-agent mode
    if (this.conversation.dual_agent_state && !this.conversation.dual_agent_state.is_complete) {
      console.log(`[DO:${this.state.id}] Handling dual-agent response`);
      await this.handleDualAgentResponse(filteredResponse);
      return;
    }
    
    // Save iteration with OpenHands response as prompt and DeepSeek response - DISABLED to avoid database writes
    // await this.saveIterationToDatabase(
    //   messageContent, // Original OpenHands response (without iteration context)
    //   deepseekResult.response!
    // );
    
    this.conversation.iteration++;
    
    // Validate DeepSeek response uses facts correctly
    const validationResult = this.validateAndResolveDeepSeekResponse(deepseekResult.response!);
    if (!validationResult.valid) {
      console.log(`[DO:${this.state.id}] Fact validation failed: ${validationResult.error}`);
      await this.stopConversation(`FACT_VIOLATION: ${validationResult.error}`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Fact validation passed, resolved text: ${validationResult.resolvedText ? validationResult.resolvedText.substring(0, 100) + "..." : "EMPTY"}...`);
    
    // Inject RESOLVED DeepSeek response back to OpenHands
    const injectResult = await injectMessageToOpenHands(
      this.env.OPENHANDS_API_URL,
      this.conversation.openhands_conversation_id!,
      validationResult.resolvedText
    );
    
    if (!injectResult.success) {
      await this.stopConversation(`openhands_inject_failed: ${injectResult.error}`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Message injected to OpenHands, iteration: ${this.conversation.iteration}`);
    
    // Update activity tracking for adaptive polling
    this.updateActivityTracking();
    
    // Stay in WAITING_OPENHANDS state to wait for next agent response
    // (We just injected a task, now wait for agent to execute it)
    this.conversation.state = 'WAITING_OPENHANDS';
    await this.state.storage.put('conversation', this.conversation);
    
    // After sending new instruction, wait for OH to start execution
    // Use standard check interval (no special timing for different commands)
    console.log(`[DO:${this.state.id}] After sending instruction, waiting for OH to start`);
    await this.scheduleNextAlarm();
  }
  
  /**
   * Send a checking prompt to DeepSeek when response is taking too long
   */
  private async sendCheckingPrompt(): Promise<void> {
    if (!this.conversation) {
      console.log(`[DO:${this.state.id}] No conversation to send checking prompt`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Sending checking prompt to DeepSeek`);
    
    // Update last DeepSeek request time to prevent immediate re-check
    this.conversation.last_deepseek_request_at = Date.now();
    
    // Add checking prompt to conversation history
    if (!this.conversation.conversation_messages) {
      this.conversation.conversation_messages = [];
    }
    
    this.conversation.conversation_messages!.push({
      role: 'user',
      content: CHECKING_PROMPT
    });
    
    // Send checking prompt to DeepSeek
    const deepseekResult = await callDeepSeek(
      this.env.DEEPSEEK_API_KEY,
      this.conversation.conversation_messages
    );
    
    if (!deepseekResult.success) {
      console.error(`[DO:${this.state.id}] Checking prompt failed: ${deepseekResult.error}`);
      // Don't stop conversation on checking prompt failure
      return;
    }
    
    // Update activity tracking for adaptive polling
    this.updateActivityTracking();
    
    // Filter out status messages from AI response
    const filteredResponse = this.filterStatusMessages(deepseekResult.response!);
    
    // Add filtered DeepSeek response to conversation history
    this.conversation.conversation_messages!.push({
      role: 'assistant',
      content: filteredResponse
    });
    
    this.conversation.last_deepseek_response = filteredResponse;
    
    // Clear DeepSeek response pending flag
    this.conversation.deepseek_response_pending = false;
    
    // Save checking prompt iteration - DISABLED to avoid database writes
    // await this.saveIterationToDatabase(
    //   CHECKING_PROMPT,
    //   deepseekResult.response!
    // );
    
    console.log(`[DO:${this.state.id}] Checking prompt sent and response received`);
    
    // Save state
    await this.state.storage.put('conversation', this.conversation);
    
    // Set alarm for next check
    await this.scheduleNextAlarm();
  }
  
  private checkForDone(response: string): DoneResponseData {
    return parseDoneResponse(response);
  }

  // Ultra-minimal flow execution: Send step directly to OpenHands
  private async handleSendingStepState(): Promise<void> {
    console.log(`[DO:${this.state.id}] DEBUG: handleSendingStepState called at ${Date.now()}`);
    
    if (!this.conversation) {
      console.log(`[DO:${this.state.id}] DEBUG: No conversation in handleSendingStepState`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] SENDING_STEP: Sending step to OpenHands`);
    console.log(`[DO:${this.state.id}] DEBUG: Current flow_id: ${this.conversation.flow_id}, flow_steps count: ${this.conversation.flow_steps?.length || 0}`);
    
    // Check if we have flow steps
    if (!this.conversation.flow_steps || this.conversation.flow_steps.length === 0) {
      console.log(`[DO:${this.state.id}] No flow steps available`);
      await this.stopConversation('no_flow_steps');
      return;
    }
    
    // Check for routing BEFORE getting next step
    let route = null;
    let step = null;
    
    if (this.conversation.last_step_response && this.conversation.current_step) {
      console.log(`[DO:${this.state.id}] Checking for routing conditions before getting next step`);
      
      // Load conditions for routing decision
      const conditionsQuery = `
        SELECT fsc.* 
        FROM flow_step_conditions fsc
        WHERE fsc.flow_step_id = ?
        ORDER BY fsc.created_at
      `;
      
      const conditionsResult = await this.env.FLOW_RUNS_DB.prepare(conditionsQuery).bind(this.conversation.current_step.step_id).all();
      const conditions = conditionsResult.results as any[];
      
      // Check if any condition has source field (new system)
      if (conditions.some(c => c.source)) {
        console.log(`[DO:${this.state.id}] Found conditions with source field, evaluating routing`);
        
        const routedConditions = conditions.map(c => ({
          condition: {
            source: c.source,
            operator: c.operator,
            value: c.value
          },
          route: {
            type: c.route_type,
            target_id: c.target_id,
            context_preservation: c.context_preservation
          }
        }));
        
        // Get router and evaluate
        const router = await this.getRouter();
        route = router.resolveWithFallback(
          routedConditions,
          this.conversation.execution_context
        );
        
        console.log(`[DO:${this.state.id}] Router returned route: ${route.type} -> ${route.target_id}`);
      }
    }
    
    // Apply route if exists
    if (route) {
      if (route.type === 'flow') {
        const newFlowId = route.target_id;
        
        // 1. Reset flow
        this.conversation.flow_id = newFlowId;
        
        // 2. Reset step index
        this.conversation.current_step_index = 0;
        
        // 3. Reset step tracking
        this.conversation.flow_steps = [];
        
        // 4. Handle context preservation
        const context = this.conversation.execution_context;
        
        if (route.context_preservation === 'none') {
          this.conversation.execution_context = createExecutionContext(newFlowId, '');
        }
        
        if (route.context_preservation === 'partial') {
          const newCtx = createExecutionContext(newFlowId, '');
          
          for (const [key, val] of context.data.entries()) {
            if (val?.metadata?.persist) {
              newCtx.data.set(key, val);
            }
          }
          
          this.conversation.execution_context = newCtx;
        }
        
        if (route.context_preservation === 'full') {
          context.flow_id = newFlowId;
          this.conversation.execution_context = context;
        }
        
        // 5. Reload steps
        await this.loadFlowSteps(newFlowId);
        
        // 6. Get first step of new flow
        if (this.conversation.flow_steps && this.conversation.flow_steps.length > 0) {
          step = this.conversation.flow_steps[0];
          console.log(`[DO:${this.state.id}] Flow transition to ${newFlowId}, first step: ${step.title}`);
          
          // Save state after flow switch
          await this.state.storage.put('conversation', this.conversation);
        } else {
          console.log(`[DO:${this.state.id}] No steps in new flow ${newFlowId}`);
          await this.restartFlow();
          await this.stopConversation('no_flow_steps');
          return;
        }
      }
      
      if (route.type === 'step') {
        // Find step by target_id in current flow steps
        if (this.conversation.flow_steps) {
          step = this.conversation.flow_steps.find(s => s.step_id === route.target_id);
          if (step) {
            console.log(`[DO:${this.state.id}] Step transition to: ${step.title}`);
            // Update current_step_index to match the found step
            const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === route.target_id);
            if (stepIndex !== -1) {
              this.conversation.current_step_index = stepIndex;
            }
          } else {
            console.log(`[DO:${this.state.id}] Step ${route.target_id} not found in current flow`);
            await this.restartFlow();
            await this.stopConversation('step_not_found');
            return;
          }
        } else {
          console.log(`[DO:${this.state.id}] No flow steps available`);
          await this.restartFlow();
          await this.stopConversation('no_flow_steps');
          return;
        }
      }
      
      if (route.type === 'end') {
        console.log(`[DO:${this.state.id}] Route type is 'end', flow should complete`);
        await this.restartFlow();
        await this.stopConversation('flow_completed_by_route');
        return;
      }
    }
    
    // If no route, get next step using legacy logic
    if (!step) {
      step = await this.getNextStep();
      
      if (!step) {
        console.log(`[DO:${this.state.id}] No more steps in flow`);
        await this.restartFlow();
        await this.stopConversation('flow_completed');
        return;
      }
    }
    
    // DEBUG: Log step object before cross-flow check
    console.log(`[DO:${this.state.id}] DEBUG: Step object before cross-flow check:`, {
      step_id: step?.step_id,
      step_key: step?.step_key,
      title: step?.title,
      flow_id: step?.flow_id,
      next_flow_id: step?.next_flow_id,
      has_next_flow_id: step?.next_flow_id !== undefined && step?.next_flow_id !== null,
      all_keys: step ? Object.keys(step) : 'step is null'
    });
    
    // Cross-flow transition check - use next_flow_id instead of flow_id comparison
    if (step?.next_flow_id) {
      console.log('NEXT_STEP_DEBUG', {
        step_id: step?.step_id,
        flow_id: step?.flow_id,
        next_flow_id: step?.next_flow_id,
        currentFlowId: this.conversation.flow_id
      });
      
      console.log('FLOW_TRANSFER', {
        from: this.conversation.flow_id,
        to: step.next_flow_id,
        reason: 'next_flow_id set on current step'
      });

      // Start the next flow using startSpecificFlow
      await this.startSpecificFlow(step.next_flow_id, this.conversation.last_response || '');

      await this.stopConversation('flow_transferred');
      return;
    }
    
    console.log(`[DO:${this.state.id}] Sending step: ${step.title} (order_index: ${step.order_index})`);
    
    // Update ExecutionContext for new step
    if (!this.conversation.execution_context) {
      // Create new context if none exists
      this.conversation.execution_context = createExecutionContext(this.conversation.flow_id, step.step_id);
    } else {
      // Update existing context with new step_id
      this.conversation.execution_context.step_id = step.step_id;
      // DO NOT increment step_count here - only increment AFTER successful completion
      
      // SAFE PATTERN: Store previous AI output before clearing (for debugging/fallback)
      if (this.conversation.execution_context.ai_output) {
        // Store in data map for reference
        this.conversation.execution_context.data.set('previous_ai_output', {
          value: this.conversation.execution_context.ai_output,
          metadata: { persist: false, timestamp: Date.now() }
        });
      }
      
      // Clear ai_output for new step (but preserve data, command_results, etc.)
      this.conversation.execution_context.ai_output = null;
      this.conversation.execution_context.ai_input = '';
    }
    
    // Update current_step to track which step is being executed
    // DEBUG: Log step being set as current_step
    console.log(`[DO:${this.state.id}] DEBUG: Setting step as current_step:`, {
      step_id: step?.step_id,
      step_key: step?.step_key,
      title: step?.title,
      next_flow_id: step?.next_flow_id,
      has_next_flow_id: step?.next_flow_id !== undefined && step?.next_flow_id !== null
    });
    this.conversation.current_step = step;
    
    // Update step status in flow_steps array to "running"
    if (this.conversation.flow_steps) {
      const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === step.step_id);
      if (stepIndex !== -1) {
        this.conversation.flow_steps[stepIndex].status = 'running';
        console.log(`[DO:${this.state.id}] Updated step ${step.step_id} status to 'running'`);
        
        // PERSIST: Save conversation state immediately
        await this.state.storage.put('conversation', this.conversation);
        console.log(`[DO:${this.state.id}] Persisted conversation with step ${step.step_id} status='running'`);
      }
    }
    
    // Emit STEP_STARTED event for UI streaming
    this.emitStepStarted(step.step_id || step.id || `step-${step.order_index}`, step.title);
    
    // Check if we have a current_prompt (e.g., from continueWithCommandResult)
    let prompt = this.conversation.current_prompt;
    
    // Only send SENDING STEP status when we're first sending a step
    // Track with step_status_sent flag to prevent duplicates
    if (!this.conversation.step_status_sent) {
      // Send SENDING STEP status with progress
      await this.sendStepStatus(step, 'SENDING STEP');
      this.conversation.step_status_sent = true;
    }
    
    // Check if this is a dual-agent step
    if (this.isDualAgentStep(step)) {
      console.log(`[DO:${this.state.id}] Step is in dual-agent mode, starting dual-agent conversation`);
      await this.handleDualAgentConversation(step);
      return;
    }
    // Declare resolvedStep at function scope so it's available later
    let resolvedStep: any = null;
    
    if (prompt) {
      console.log(`[DO:${this.state.id}] Using existing current_prompt (${prompt.length} chars)`);
      // Clear current_prompt after using it
      this.conversation.current_prompt = undefined;
    } else {
      // Build new prompt with step instructions
      // Remove "Step X: " prefix from title to prevent AI from inferring progress
      const stepTitleWithoutNumber = step.title.replace(/^Step \d+: /, '');
      prompt = `Execute step: ${stepTitleWithoutNumber}`;
      
      // Check for task injection
      // Priority: 1. Static task_id, 2. Dynamic requires_task
      let taskInjected = false;
    
    // Only check task_id if it's a non-empty string (truthy)
    if (step.task_id && step.task_id.trim() && this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Step has static task_id: ${step.task_id}`);
      try {
        const { getTaskData } = await import('../services/database');
        const taskData = await getTaskData(this.env.FLOW_RUNS_DB, step.task_id);
        if (taskData) {
          prompt += `\n\n=== TASK ===`;
          prompt += `\nTask ID: ${step.task_id}`;
          prompt += `\nTitle: ${taskData.title}`;
          if (taskData.description) {
            prompt += `\nDescription: ${taskData.description}`;
          }
          // Add payload if it's JSON and contains additional metadata
          if (taskData.payload && taskData.payload.trim().startsWith('{') && taskData.payload.trim().endsWith('}')) {
            try {
              const payloadObj = JSON.parse(taskData.payload);
              // Add non-instruction fields from payload
              const metadataFields = Object.entries(payloadObj)
                .filter(([key, value]) => key !== 'instructions' && typeof value === 'string')
                .map(([key, value]) => `${key}: ${value}`);
              
              if (metadataFields.length > 0) {
                prompt += `\nAdditional Details:`;
                metadataFields.forEach(field => {
                  prompt += `\n- ${field}`;
                });
              }
            } catch (e) {
              // Not valid JSON, skip
              console.log(`[DO:${this.state.id}] Task payload is not valid JSON: ${e.message}`);
            }
          }
          prompt += `\n=== END TASK ===\n`;
          // REMOVED: Instructions to mark task as complete
          // Task completion is handled automatically by the system
          console.log(`[DO:${this.state.id}] Injected task: ${taskData.title} (ID: ${step.task_id})`);
          taskInjected = true;
        } else {
          console.log(`[DO:${this.state.id}] Task not found with ID: ${step.task_id}, will try requires_task if set`);
        }
      } catch (error: any) {
        console.error(`[DO:${this.state.id}] Error fetching task data: ${error.message}`);
      }
    }
    
    // If task_id didn't work or wasn't set, try requires_task
    // Convert requires_task to boolean explicitly (database returns 0/1 as number or string)
    console.log(`[DO:${this.state.id}] Step requires_task value: ${step.requires_task} (type: ${typeof step.requires_task})`);
    console.log(`[DO:${this.state.id}] Step object keys: ${Object.keys(step).join(', ')}`);
    
    // FALLBACK: If step doesn't have requires_task, check flow_steps array
    let effectiveRequiresTask = step.requires_task;
    if (effectiveRequiresTask === undefined && this.conversation.flow_steps && this.conversation.current_step_index !== undefined) {
      const flowStep = this.conversation.flow_steps[this.conversation.current_step_index];
      if (flowStep && flowStep.requires_task !== undefined) {
        console.log(`[DO:${this.state.id}] Using requires_task from flow_steps array: ${flowStep.requires_task}`);
        effectiveRequiresTask = flowStep.requires_task;
      }
    }
    
    const requiresTask = this.convertRequiresTaskToBoolean(effectiveRequiresTask);
    console.log(`[DO:${this.state.id}] Task injection debug: taskInjected=${taskInjected}, requiresTask=${requiresTask}, flow_id=${this.conversation.flow_id}, FLOW_RUNS_DB=${!!this.env.FLOW_RUNS_DB}`);
    
    // Declare pendingTask variable outside the if block for debug storage
    let pendingTask: any = null;
    
    if (!taskInjected && requiresTask && this.conversation.flow_id && this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Step requires dynamic task, fetching first pending task for flow: "${this.conversation.flow_id}"`);
      try {
        const { getFirstPendingTask } = await import('../services/database');
        console.log(`[DO:${this.state.id}] Calling getFirstPendingTask with flow_id: "${this.conversation.flow_id}"`);
        pendingTask = await getFirstPendingTask(this.env.FLOW_RUNS_DB, this.conversation.flow_id);
        console.log(`[DO:${this.state.id}] getFirstPendingTask returned:`, pendingTask);
        console.log(`[DO:${this.state.id}] Task object details:`, pendingTask ? {
          id: pendingTask.id,
          title: pendingTask.title,
          descriptionLength: pendingTask.description?.length || 0,
          payloadLength: pendingTask.payload?.length || 0
        } : 'No task');
        if (pendingTask) {
          prompt += `\n\n=== TASK ===`;
          prompt += `\nTask ID: ${pendingTask.id}`;
          prompt += `\nTitle: ${pendingTask.title}`;
          if (pendingTask.description) {
            prompt += `\nDescription: ${pendingTask.description}`;
          }
          // Add payload if it's JSON and contains additional metadata
          if (pendingTask.payload && pendingTask.payload.trim().startsWith('{') && pendingTask.payload.trim().endsWith('}')) {
            try {
              const payloadObj = JSON.parse(pendingTask.payload);
              // Add non-instruction fields from payload
              const metadataFields = Object.entries(payloadObj)
                .filter(([key, value]) => key !== 'instructions' && typeof value === 'string')
                .map(([key, value]) => `${key}: ${value}`);
              
              if (metadataFields.length > 0) {
                prompt += `\nAdditional Details:`;
                metadataFields.forEach(field => {
                  prompt += `\n- ${field}`;
                });
              }
            } catch (e) {
              // Not valid JSON, skip
              console.log(`[DO:${this.state.id}] Task payload is not valid JSON: ${e.message}`);
            }
          }
          prompt += `\n=== END TASK ===\n`;
          // REMOVED: Instructions to mark task as complete
          // Task completion is handled automatically by the system
          console.log(`[DO:${this.state.id}] Injected task: ${pendingTask.title} (ID: ${pendingTask.id})`);
          taskInjected = true;
        } else {
          console.log(`[DO:${this.state.id}] No pending tasks found for flow: ${this.conversation.flow_id}`);
        }
      } catch (error: any) {
        console.error(`[DO:${this.state.id}] Error fetching pending task: ${error.message}`);
      }
    }
    
    // Add step instructions - USE RESOLVED INSTRUCTIONS
    // resolvedStep is already declared at function scope
    try {
      // Get previous step responses for variable substitution
      const previousStepResponses = await this.getPreviousStepResponses();
      
      resolvedStep = await resolveStepInstructions(
        step,
        this.env.FLOW_RUNS_DB,
        this.env as Record<string, string>,
        {
          flow_id: this.conversation.flow_id,
          execution_id: this.flowRunId,
          step_id: step.step_id,
          previous_step_responses: previousStepResponses
        }
      );
      
      console.log(`[DO:${this.state.id}] Resolved instructions length: ${resolvedStep.instructions?.length || 0} chars`);
      console.log(`[DO:${this.state.id}] Original description length: ${step.description?.length || 0} chars`);
      
      // DEBUG: Check if [input:message] is still in resolved instructions
      if (resolvedStep.instructions && resolvedStep.instructions.includes('[input:')) {
        console.log(`[DO:${this.state.id}] DEBUG: Resolved instructions still contains [input: placeholder`);
        console.log(`[DO:${this.state.id}] DEBUG: First 300 chars of resolved instructions: ${resolvedStep.instructions.substring(0, 300)}`);
      }
      
      if (resolvedStep.instructions) {
        prompt += `\n\n${resolvedStep.instructions}`;
        // Add expected_response after instructions if provided
        if (step.expected_response) {
          prompt += `\n\nExpected response format:\n${step.expected_response}`;
        }
      } else if (step.description) {
        prompt += `\n\n${step.description}`;
        // Add expected_response after description if provided
        if (step.expected_response) {
          prompt += `\n\nExpected response format:\n${step.expected_response}`;
        }
      }
      
      // Log if variables were resolved
      if (resolvedStep.api_responses && Object.keys(resolvedStep.api_responses).length > 0) {
        console.log(`[DO:${this.state.id}] Step ${step.step_id} API responses:`, 
          Object.keys(resolvedStep.api_responses).map(key => `${key}: ${resolvedStep.api_responses![key].success ? 'success' : 'failed'}`)
        );
      }
      
      // Ensure resolvedStep has api_calls property for database storage
      // Convert api_responses to api_calls format if needed
      if (!resolvedStep.api_calls) {
        resolvedStep.api_calls = resolvedStep.api_responses ? Object.values(resolvedStep.api_responses) : [];
      }
      
    } catch (error) {
      console.error(`[DO:${this.state.id}] Error resolving step instructions: ${error.message}`);
      // Fall back to original description
      if (step.description) {
        prompt += `\n\n${step.description}`;
      }
      // Initialize resolvedStep with empty api_calls if not set
      if (!resolvedStep) {
        resolvedStep = { api_calls: [] };
      }
    }
    
    console.log(`[DO:${this.state.id}] Final prompt length: ${prompt.length} chars`);
    console.log(`[DO:${this.state.id}] Final prompt preview: ${prompt.substring(0, 200)}...`);
    
    // Set AI input in execution context for new condition system
    if (this.conversation.execution_context) {
      this.conversation.execution_context.ai_input = prompt;
    }
    
    // Store debug information for observability
    this.conversation.last_step_debug = {
      step_id: step.step_id,
      step_title: step.title,
      requires_task: effectiveRequiresTask,
      requires_task_converted: requiresTask,
      task_injected: taskInjected,
      task_found: !!pendingTask,
      task_id: pendingTask?.id,
      task_title: pendingTask?.title,
      prompt_preview: prompt.substring(0, 500),
      prompt_length: prompt.length,
      timestamp: Date.now()
    };
    } // End of else block (not using existing prompt)
    
    // SPECIAL HANDLING: For 'hello' step type, complete immediately without OpenHands
    if (step.step_type === 'hello') {
      console.log(`[DO:${this.state.id}] 'hello' step type detected, completing immediately`);
      // Save hello step run to database (no API calls for hello steps)
      await this.saveStepRunToDatabase(
        step,
        "Hello step (auto-completed)",
        "Hello step completed successfully",
        'completed'
      );
      await this.handleStepCompletion(step, "Hello step completed successfully");
      return;
    }

    // SPECIAL HANDLING: For 'call_flow' step type, start another flow and wait for response
    if (step.step_type === 'call_flow') {
      console.log(`[DO:${this.state.id}] 'call_flow' step type detected`);
      
      // Extract target flow ID from step instructions or parameters
      const targetFlowId = step.instructions?.match(/\[flow:(\w+)\]/)?.[1] || 
                          step.description?.match(/\[flow:(\w+)\]/)?.[1];
      
      if (!targetFlowId) {
        console.error(`[DO:${this.state.id}] No target flow ID found in call_flow step`);
        await this.handleStepCompletion(step, "Error: No target flow ID specified");
        return;
      }

      console.log(`[DO:${this.state.id}] Starting flow call to: ${targetFlowId}`);
      
      // Create callback URL to this flow's /resume endpoint
      // Note: In production, this would need to be the actual external URL
      const callbackUrl = `http://placeholder/resume?conversation_id=${this.state.id.toString()}`;
      
      // Start the target flow with callback
      await this.startSpecificFlowWithCallback(targetFlowId, callbackUrl);
      
      // Enter WAITING_FOR_INPUT state to wait for response
      await this.updateConversationState({
        state: 'WAITING_FOR_INPUT',
        waiting_for_input: {
          name: `flow_response_${targetFlowId}`,
          step_id: step.step_id,
          timestamp: Date.now()
        }
      });
      
      console.log(`[DO:${this.state.id}] Waiting for response from flow: ${targetFlowId}`);
      return;
    }


    
    // Check agent type - if deepseek, call DeepSeek API instead of OpenHands
    if (this.conversation.agent === 'deepseek') {
      console.log(`[DO:${this.state.id}] Agent is 'deepseek', calling DeepSeek API instead of OpenHands`);
      console.log(`[DO:${this.state.id}] Flow ID: ${this.conversation.flow_id}, Step: ${this.conversation.current_flow_step}`);
      console.log(`[DO:${this.state.id}] Prompt preview: ${prompt.substring(0, 200)}...`);
      
      // Build messages for DeepSeek WITHOUT system message
      const messages = [
        { role: 'user', content: prompt }
      ];
      
      // Call DeepSeek API
      console.log(`[DO:${this.state.id}] Calling callDeepSeek() with API key present: ${!!this.env.DEEPSEEK_API_KEY}`);
      const deepseekResult = await callDeepSeek(
        this.env.DEEPSEEK_API_KEY,
        messages
      );
      
      if (!deepseekResult.success) {
        console.error(`[DO:${this.state.id}] DeepSeek API call failed: ${deepseekResult.error}`);
        // Save failed step run to database with API calls
        await this.saveStepRunToDatabase(
          step,
          prompt,
          `DeepSeek API error: ${deepseekResult.error}`,
          'failed',
          1,
          resolvedStep?.api_calls || [] // Pass API calls for database storage, safely handle undefined
        );
        // For errors, we still need to complete the step to move forward
        // Update execution context with error for new condition system
        if (this.conversation.execution_context) {
          this.conversation.execution_context.ai_output = {
            response: `DeepSeek API error: ${deepseekResult.error}`,
            intent: '',
            actions: [],
            metadata: {},
            source: 'deepseek_error'
          };
          
          // SYNC: Keep last_step_response in sync with ai_output for legacy compatibility
          this.conversation.last_step_response = `DeepSeek API error: ${deepseekResult.error}`;
          
          // Increment step_count even for errors (step was attempted)
          this.conversation.execution_context.step_count += 1;
        }
        
        await this.handleStepCompletion(step, `DeepSeek API error: ${deepseekResult.error}`);
        // Check if conversation is still active before scheduling next alarm
        // Check for any active state, not just SENDING_STEP
        if (this.conversation && this.conversation.state !== 'DONE') {
          await this.scheduleNextAlarm(1000); // Schedule immediately for next step
        }
        return;
      }
      
      // Process DeepSeek response
      const response = deepseekResult.response;
      console.log(`[DO:${this.state.id}] DeepSeek response received (${response.length} chars)`);
      
      // Save successful step run to database with API calls
      await this.saveStepRunToDatabase(
        step,
        prompt,
        response,
        'completed',
        1,
        resolvedStep?.api_calls || [] // Pass API calls for database storage, safely handle undefined
      );
      
      // Update execution context with AI output for new condition system
      if (this.conversation.execution_context) {
        this.conversation.execution_context.ai_output = {
          response: response,
          intent: '',
          actions: [],
          metadata: {},
          source: 'deepseek'
        };
        
        // SYNC: Keep last_step_response in sync with ai_output for legacy compatibility
        this.conversation.last_step_response = response;
        
        // Increment step_count AFTER successful completion
        this.conversation.execution_context.step_count += 1;
      }
      
      // Complete the step with DeepSeek response
      await this.handleStepCompletion(step, response);
      // Check if conversation is still active before scheduling next alarm
      // Check for any active state, not just SENDING_STEP
      if (this.conversation && this.conversation.state !== 'DONE') {
        await this.scheduleNextAlarm(1000); // Schedule immediately for next step
      }
      return;
    }
    
    // Create OpenHands conversation if needed
    if (!this.conversation.openhands_conversation_id) {
      console.log(`[DO:${this.state.id}] Creating new OpenHands conversation`);
      const createResult = await createOpenHandsConversation(
        this.env.OPENHANDS_API_URL,
        prompt,
        this.conversation.repository,
        this.conversation.branch
      );
      
      if (!createResult.success) {
        console.error(`[DO:${this.state.id}] Failed to create OpenHands conversation: ${createResult.error}`);
        await this.scheduleNextAlarm(10000); // Retry in 10 seconds
        return;
      }
      
      this.conversation.openhands_conversation_id = createResult.conversationId;
      console.log(`[DO:${this.state.id}] Created OpenHands conversation: ${this.conversation.openhands_conversation_id}`);
    } else {
      // Inject message to existing conversation
      console.log(`[DO:${this.state.id}] Injecting message to existing OpenHands conversation: ${this.conversation.openhands_conversation_id}`);
      
      // CRITICAL LOG: What is actually being sent to OpenHands?
      console.log(`[DO:${this.state.id}] SENT TO OPENHANDS (first 500 chars):`, prompt.substring(0, 500));
      if (prompt.includes('{task_data')) {
        console.log(`[DO:${this.state.id}] WARNING: Template variables still present in prompt!`);
        console.log(`[DO:${this.state.id}] Contains {task_data:`, prompt.includes('{task_data'));
      }
      
      const injectResult = await injectMessageToOpenHands(
        this.env.OPENHANDS_API_URL,
        this.conversation.openhands_conversation_id,
        prompt
      );
      
      if (!injectResult.success) {
        console.error(`[DO:${this.state.id}] Failed to inject message: ${injectResult.error}`);
        await this.scheduleNextAlarm(10000); // Retry in 10 seconds
        return;
      }
    }
    
    // Update state to wait for OpenHands response
    this.conversation.state = 'WAITING_OPENHANDS';
    this.conversation.iteration = (this.conversation.iteration || 0) + 1;
    // Note: current_step_index is already updated by getNextStep() based on conditional branching
    console.log(`[DO:${this.state.id}] Step sent, waiting for OpenHands response. Current step index: ${this.conversation.current_step_index}`);
    
    // Schedule next alarm to check for response
    // Use shorter interval for flow execution (5 seconds) vs regular (30 seconds)
    const pollInterval = this.conversation.flow_steps ? 5000 : 30000;
    await this.scheduleNextAlarm(pollInterval); // Check in 5 seconds for flow, 30 seconds for regular
  }

  /**
   * Handle a [END_FLOW] or [END_FLOW_EARLY] response by saving flow run and closing conversation
   * @param response The DeepSeek response containing [END_FLOW] or [END_FLOW_EARLY]
   * @param reason Reason for stopping
   */
  private async handleDoneResponse(response: string, reason: string): Promise<void> {
    if (!this.conversation) return;

    // Parse the done response
    const doneData = this.checkForDone(response);
    
    if (!doneData.done) {
      return;
    }

    // Determine the final stop reason
    let finalStopReason = reason;
    let flowStatus: 'completed' | 'stopped' | 'new_flow_started' = 'completed';
    
    if (doneData.is_end_flow_early) {
      // END_FLOW_EARLY: Stop without starting new flow
      finalStopReason = `end_flow_early: ${doneData.stop_reason || 'no_reason_provided'}`;
      flowStatus = 'stopped';
      console.log(`[DO:${this.state.id}] END_FLOW_EARLY detected: ${doneData.stop_reason}`);
    } else if (doneData.new_prompt) {
      // END_FLOW with new prompt: Start new flow
      finalStopReason = `end_flow_with_new_prompt: ${doneData.new_prompt ? doneData.new_prompt.substring(0, 50) + "..." : "EMPTY"}`;
      flowStatus = 'new_flow_started';
      console.log(`[DO:${this.state.id}] END_FLOW with new prompt detected, starting new flow`);
    } else {
      // END_FLOW without new prompt: Just stop
      finalStopReason = 'end_flow_no_new_prompt';
      flowStatus = 'completed';
      console.log(`[DO:${this.state.id}] END_FLOW without new prompt detected`);
    }

    // Save the current flow run to database with appropriate status
    await this.saveFlowRunToDatabase(finalStopReason, flowStatus);

    // Stop the conversation since END_FLOW was detected
    await this.stopConversation(`end_flow_detected: ${finalStopReason}`);

    // DISABLED: [END_FLOW] tokens should not trigger new flows
    // Flow transitions only happen via flow_definitions.next_flow_id
    // when flow completes (next_step == -1)
    // if (doneData.new_prompt && !doneData.is_end_flow_early) {
    //   await this.startNextFlow(doneData);
    // }
  }

  /**
   * Handle [COMMAND: name] token from AI response
   */
  private async handleCommand(
    commandData: CommandData,
    step: StepData,
    originalResponse: string
  ): Promise<void> {
    if (!this.conversation) return;

    console.log(`[DO:${this.state.id}] Processing command: ${commandData.name}`, commandData.params);

    try {
      // Handle fallback commands
      const mappedCommand = this.mapFallbackCommand(commandData);
      if (mappedCommand !== commandData) {
        console.log(`[DO:${this.state.id}] Mapped command ${commandData.name} to ${mappedCommand.name}`);
        commandData = mappedCommand;
      }

      // Get command executor
      const commandExecutor = await this.getCommandExecutor();
      
      // Emit COMMAND_CALLING event for UI streaming
      const stepId = step.step_id || step.id || `step-${step.order_index}`;
      this.emitCommandCalling(stepId, commandData.name, commandData.params);
      
      // Execute the command
      const startTime = Date.now();
      const result = await commandExecutor.executeCommand(commandData);
      
      // Emit COMMAND_RESPONSE event for UI streaming
      this.emitCommandResponse(stepId, commandData.name, result, startTime);
      
      // Format result for AI
      const resultMessage = commandExecutor.formatResultForAI(result);
      
      // Update execution context with command result for new condition system
      if (this.conversation.execution_context) {
        this.conversation.execution_context.command_results.push({
          name: commandData.name,
          params: commandData.params,
          result: result,
          error: result.error || undefined,
          success: !result.error,
          timestamp: Date.now()
        });
      }
      
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
      
      // Continue the conversation with command result
      await this.continueWithCommandResult(step, originalResponse, resultMessage);
      
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error handling command ${commandData.name}:`, error);
      
      // Emit STEP_ERROR event for UI streaming
      if (step) {
        const stepId = step.step_id || step.id || `step-${step.order_index}`;
        await this.emitStepError(stepId, `Command "${commandData.name}" failed: ${error.message}`);
      }
      
      // Add error to conversation history
      if (this.conversation.conversation_history) {
        this.conversation.conversation_history.push({
          role: 'system',
          content: `Command "${commandData.name}" failed: ${error.message}`,
          timestamp: Date.now()
        });
      }
      
      // Save updated conversation state
      await this.state.storage.put('conversation', this.conversation);
      
      // Continue with error message
      await this.continueWithCommandResult(step, originalResponse, `Command failed: ${error.message}`);
    }
  }

  /**
   * Map fallback commands like list/help to actual commands
   */
  private mapFallbackCommand(commandData: CommandData): CommandData {
    const { name, params } = commandData;
    
    // Map list command to get_tasks
    if (name === 'list') {
      return {
        name: 'get_tasks',
        params: params || {}
      };
    }
    
    // Map help command to return available commands
    if (name === 'help') {
      // Return a special command that will show available commands
      return {
        name: 'help',
        params: { 
          message: 'Available commands can be discovered via /commands endpoint. Use [COMMAND:get_tasks] to list tasks, [COMMAND:get_flow_definitions] to list flows, etc.'
        }
      };
    }
    
    // Map rules_search to get_tasks with search parameters
    if (name === 'rules_search') {
      return {
        name: 'get_tasks',
        params: { 
          search: params?.query || '',
          ...params
        }
      };
    }
    
    // Map rules_check_synonyms to get_tasks with tag search
    if (name === 'rules_check_synonyms') {
      return {
        name: 'get_tasks',
        params: { 
          tags: params?.words || [],
          ...params
        }
      };
    }
    
    // Return original command if no mapping
    return commandData;
  }

  /**
   * Continue conversation after command execution
   */
  private async continueWithCommandResult(
    step: StepData,
    originalResponse: string,
    commandResult: string
  ): Promise<void> {
    if (!this.conversation) return;

    console.log(`[DO:${this.state.id}] Continuing conversation with command result`);
    
    // Build new prompt with command result
    const newPrompt = `${originalResponse}\n\nCommand Result:\n${commandResult}\n\nContinue with the task.`;
    
    // Update conversation with new prompt
    this.conversation.current_prompt = newPrompt;
    await this.state.storage.put('conversation', this.conversation);
    
    // Continue processing the step
    await this.handleSendingStepState();
  }

  /**
   * Start a new flow when [END_FLOW] contains a new prompt
   * @param doneData Parsed done response data
   */
  private async startNextFlow(doneData: DoneResponseData): Promise<void> {
    if (!doneData.new_prompt) return;

    console.log(`[DO:${this.state.id}] Starting next flow with prompt: ${doneData.new_prompt ? doneData.new_prompt.substring(0, 50) + "..." : "EMPTY"}`);

    // Prepare the request body for the new flow
    const requestBody = {
      repository: this.conversation!.repository, // Use same repository
      branch: doneData.new_branch || this.conversation!.branch || 'main',
      initial_user_prompt: doneData.new_prompt,
      max_iterations: this.conversation!.max_iterations // Use same max iterations
    };

    try {
      // We need to make an HTTP request to the worker's /start endpoint
      // But we don't have the worker URL in the Durable Object
      // For now, we'll create a new Durable Object directly
      const newConversationIdObj = this.env.CONVERSATIONS.newUniqueId();
      const newConversationStub = this.env.CONVERSATIONS.get(newConversationIdObj);

      // Initialize the new Durable Object
      const initResponse = await newConversationStub.fetch('http://placeholder/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error(`[DO:${this.state.id}] Failed to initialize next flow: ${initResponse.status} - ${errorText}`);
        return;
      }

      console.log(`[DO:${this.state.id}] Next flow started with ID: ${newConversationIdObj.toString()}`);
      
      // Update current flow run with next_flow_id if database is available
      if (this.env.FLOW_RUNS_DB && this.flowRunId) {
        await this.env.FLOW_RUNS_DB.prepare(
          'UPDATE flow_runs SET next_flow_id = ? WHERE id = ?'
        ).bind(newConversationIdObj.toString(), this.flowRunId).run();
      }
    } catch (error) {
      console.error(`[DO:${this.state.id}] Failed to start next flow:`, error);
    }
  }

  /**
   * Restart the same flow when it completes all steps
   */
  private async restartFlow(): Promise<void> {
    if (!this.conversation?.flow_id) {
      console.log(`[DO:${this.state.id}] Cannot restart flow: no flow_id in conversation`);
      return;
    }

    console.log(`[DO:${this.state.id}] Restarting flow: ${this.conversation.flow_id}`);
    
    // Prepare the request body for the new flow (same as original)
    const requestBody = {
      flow_id: this.conversation.flow_id,
      repository: this.conversation.repository,
      branch: this.conversation.branch || 'main',
      initial_user_prompt: this.conversation.initial_user_prompt,
      max_iterations: this.conversation.max_iterations,
      agent: this.conversation.agent || 'openhands' // Include agent field
    };

    try {
      // Create a new Durable Object for the restarted flow
      const newConversationIdObj = this.env.CONVERSATIONS.newUniqueId();
      const newConversationStub = this.env.CONVERSATIONS.get(newConversationIdObj);

      // Initialize the new Durable Object for flow execution
      const initResponse = await newConversationStub.fetch('http://placeholder/initialize-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error(`[DO:${this.state.id}] Failed to restart flow: ${initResponse.status} - ${errorText}`);
        return;
      }

      console.log(`[DO:${this.state.id}] Flow restarted with ID: ${newConversationIdObj.toString()}`);
      
      // Update current flow run with next_flow_id if database is available
      if (this.env.FLOW_RUNS_DB && this.flowRunId) {
        await this.env.FLOW_RUNS_DB.prepare(
          'UPDATE flow_runs SET next_flow_id = ? WHERE id = ?'
        ).bind(newConversationIdObj.toString(), this.flowRunId).run();
      }
    } catch (error) {
      console.error(`[DO:${this.state.id}] Failed to restart flow:`, error);
    }
  }

  /**
   * Enhanced flow transition with condition engine and loop prevention
   */
  private async handleStepCompletion(step: StepData, response: string): Promise<void> {
    if (!this.conversation) return;
    
    console.log(`[DO:${this.state.id}] Handling step completion for step: ${step.step_id}`);
    
    // Update step status in flow_steps array to "completed" and store response
    if (this.conversation.flow_steps) {
      const stepIndex = this.conversation.flow_steps.findIndex(s => s.step_id === step.step_id);
      if (stepIndex !== -1) {
        this.conversation.flow_steps[stepIndex].status = 'completed';
        this.conversation.flow_steps[stepIndex].response = response;
        console.log(`[DO:${this.state.id}] Updated step ${step.step_id} status to 'completed' and stored response (${response.length} chars)`);
        
        // PERSIST: Save conversation state immediately
        await this.state.storage.put('conversation', this.conversation);
        console.log(`[DO:${this.state.id}] Persisted conversation with step ${step.step_id} status='completed' and response`);
      }
    }
    
    // ENFORCEMENT INVARIANT: No flow switching in step completion
    // This method should only handle step-to-step transitions within the same flow
    console.log(`[DO:${this.state.id}] Flow transitions disabled in step completion`);
    console.log(`[DO:${this.state.id}] Next flow will be determined by flow_definitions.next_flow_id only`);
    
    // 0. Update execution data based on step results
    await this.updateExecutionData(step, response);
    
    // NOTE: last_step_response is set by the caller (handleDeepSeekResponse or handleOpenHandsResponse)
    // to keep it in sync with ai_output.response
    // DO NOT set last_step_response here to avoid duplication
    
    // NOTE: ai_output is set by the caller (handleDeepSeekResponse or handleOpenHandsResponse)
    // DO NOT set ai_output here to avoid duplication
    // step_count is also incremented by the caller
    
    // 1. Check step conditions (flow transitions removed)
    const stepEvaluation = await this.shouldExecuteStep(step);
    
    // FLOW TRANSITIONS ARE NOT ALLOWED AT STEP LEVEL
    // Steps can only control step execution, not flow transitions
    // Flow transitions only happen via flow_definitions.next_flow_id
    // when flow completes (next_step == -1)
    
    // 2. Check for AI decision tokens (hardened regex)
    const tokens = extractAllTokens(response);
    
    if (tokens.createTask) {
      await this.createTaskInFlow(
        tokens.createTask.flow_id,
        tokens.createTask.title,
        tokens.createTask.description,
        tokens.createTask.order_index,
        tokens.createTask.priority
      );
    }
    
    if (tokens.skipTask) {
      await this.markTaskAsDone(tokens.skipTask.task_id, `Skipped: ${tokens.skipTask.reason}`);
    }
    
    // 3. Check for [COMMAND: name] tokens
    if (tokens.command) {
      await this.handleCommand(tokens.command, step, response);
      return; // Command handling will continue the conversation
    }
    
    // 4. Check for [END_FLOW] tokens
    if (tokens.done.done) {
      await this.handleDoneResponse(response, 'ai_end_flow');
      return;
    }
    
    // 5. Filter out any status messages from AI response and send output if enabled
    const filteredResponse = this.filterStatusMessages(response);
    if (filteredResponse) {
      await this.sendStepOutputIfEnabled(step, filteredResponse);
    }
    
    // 6. Send STEP COMPLETED status
    await this.sendStepStatus(step, 'STEP COMPLETED');
    
    // 7. Emit STEP_COMPLETED event for UI streaming
    const stepId = step.step_id || step.id || `step-${step.order_index}`;
    this.emitStepCompleted(stepId, { response, filteredResponse });
    
    // 8. Reset step status sent flag for next step
    this.conversation.step_status_sent = false;
    
    // 8. Check if we need to pause for user input
    // Check both: step.await_input config and AI actions that set awaiting_input
    const shouldPause = await this.checkAndPauseForInput(step);
    if (shouldPause) {
      console.log(`[DO:${this.state.id}] Execution paused for user input`);
      return;
    }
    
    // 9. Continue with next step in current flow
    // System arbitration for flow switching is DISABLED
    // Flow transitions only happen via flow_definitions.next_flow_id
    // when flow completes (next_step == -1)
    await this.moveToNextStep();
  }

  /**
   * Check if we need to pause for user input and handle pausing
   */
  private async checkAndPauseForInput(step: StepData): Promise<boolean> {
    const context = this.conversation.execution_context;
    if (!context) return false;

    // Check for await_input from two sources:
    // 1. Step config (step.await_input)
    // 2. AI actions (context.awaiting_input)
    
    let inputName: string | undefined;
    let params: Record<string, any> = {};

    // First check step config
    if (step.await_input) {
      inputName = step.await_input.name;
      params = step.await_input.params || {};
      console.log(`[DO:${this.state.id}] Step config requests input: ${inputName}`);
    }
    
    // Then check AI actions (overrides step config if both exist)
    if (context.awaiting_input) {
      inputName = context.awaiting_input.name;
      params = context.awaiting_input.params || {};
      console.log(`[DO:${this.state.id}] AI action requests input: ${inputName}`);
    }

    if (!inputName) {
      return false;
    }

    // Check if input is already provided (e.g., from /start endpoint)
    if (context.inputs && context.inputs[inputName] !== undefined) {
      console.log(`[DO:${this.state.id}] Input ${inputName} already provided, skipping pause`);
      
      // Clear awaiting_input if it was set by AI action
      if (context.awaiting_input) {
        context.awaiting_input = undefined;
      }
      
      return false; // Don't pause, continue execution
    }

    // Set conversation to WAITING_FOR_INPUT state
    this.conversation.state = 'WAITING_FOR_INPUT';
    this.conversation.status = 'paused';
    this.conversation.waiting_for_input = {
      name: inputName,
      params: params,
      step_id: step.step_id,
      timestamp: Date.now()
    };

    // Save await_input step run to database
    await this.saveStepRunToDatabase(
      step,
      `Awaiting input: ${inputName}`,
      `Waiting for user input: ${inputName}`,
      'paused'
    );

    // Save state and stop execution
    await this.state.storage.put('conversation', this.conversation);
    console.log(`[DO:${this.state.id}] Execution paused, waiting for input: ${inputName}`);
    return true;
  }

  /**
   * Check if a step should execute based on conditions
   */
  private async shouldExecuteStep(step: StepData): Promise<{
    execute: boolean;
    skipReason?: string;
    // nextFlowId removed: Flow transitions not allowed at step level
    // Only flow_definitions.next_flow_id controls flow transitions
  }> {
    // ENFORCEMENT INVARIANT: No flow transitions at step level
    // This is a critical safety check to prevent regression
    if (step.conditions?.some(c => c.condition_type === 'next_flow')) {
      console.error(`[DO:${this.state.id}] SECURITY VIOLATION: Step ${step.id} has next_flow condition`);
      console.error(`[DO:${this.state.id}] Flow transitions are ONLY allowed via flow_definitions.next_flow_id`);
      throw new Error('ILLEGAL_FLOW_TRANSITION: next_flow conditions are not allowed at step level');
    }
    
    if (!this.env.FLOW_RUNS_DB || !this.conversation?.flow_id) {
      return { execute: true }; // No conditions, execute
    }
    
    // Load conditions for this step
    // Note: Using flow_step_conditions table which exists, not flow_conditions
    const conditions = await this.env.FLOW_RUNS_DB.prepare(`
      SELECT 
        fsc.id,
        fs.flow_id,
        fsc.flow_step_id as step_id,
        fsc.condition_type,
        'static' as condition_engine, -- Default engine
        NULL as condition_key,
        fsc.condition_value,
        NULL as condition_query,
        fd.next_flow_id as flow_def_next_flow_id, -- Get from flow_definitions table
        fsc.next_flow_id as step_condition_next_flow_id, -- Get from flow_step_conditions table
        fsc.condition_operator -- Include operator for evaluation
      FROM flow_step_conditions fsc
      JOIN flow_steps fs ON fsc.flow_step_id = fs.id
      JOIN flow_definitions fd ON fs.flow_id = fd.id
      WHERE fs.flow_id = ? AND fs.id = ?
      ORDER BY fsc.condition_type
    `).bind(this.conversation.flow_id, step.step_id).all();
    
    const executionData = await this.loadExecutionData();
    
    for (const conditionRow of conditions.results as any[]) {
      // Convert to Condition interface (adding missing fields)
      const condition: Condition = {
        id: conditionRow.id,
        flow_id: conditionRow.flow_id,
        step_id: conditionRow.step_id,
        condition_type: conditionRow.condition_type,
        condition_engine: conditionRow.condition_engine,
        condition_key: conditionRow.condition_key,
        condition_value: conditionRow.condition_value,
        condition_query: conditionRow.condition_query,
        // Use step condition's next_flow_id if available, otherwise fall back to flow definition's
        next_flow_id: conditionRow.step_condition_next_flow_id || conditionRow.flow_def_next_flow_id
      };
      
      // Legacy condition evaluation for static/sql engines
      let passes = false;
      const conditionOperator = conditionRow.condition_operator;
      const conditionValue = conditionRow.condition_value;
      
      if (conditionOperator === 'equals') {
        if (conditionValue === 'always') {
          passes = true;
        } else if (conditionValue === 'never') {
          passes = false;
        } else {
          // For now, simple string comparison
          passes = true; // Default to true for testing
        }
      } else {
        // Unknown operator, default to true for static engine
        passes = condition.condition_engine === 'static';
      }
      
      const result = { passes, nextFlowId: condition.next_flow_id, error: undefined as string | undefined };
      
      if (result.error) {
        console.error(`[DO:${this.state.id}] Condition evaluation error: ${result.error}`);
        continue;
      }
      
      switch (condition.condition_type) {
        case 'prerequisite':
          if (!result.passes) {
            return { 
              execute: false, 
              skipReason: `Prerequisite not met: ${condition.condition_key || condition.condition_query}` 
            };
          }
          break;
          
        case 'skip_if':
          if (result.passes) {
            return { 
              execute: false, 
              skipReason: `Skip condition met: ${condition.condition_key || condition.condition_query}` 
            };
          }
          break;
          
        case 'execute_if':
          if (!result.passes) {
            return { 
              execute: false, 
              skipReason: `Execute condition not met: ${condition.condition_key || condition.condition_query}` 
            };
          }
          break;
          
        // FLOW TRANSITIONS ARE NOT ALLOWED AT STEP LEVEL
        // Removed: 'next_flow' condition type
        // Flow transitions only happen via flow_definitions.next_flow_id
        // when flow completes (next_step == -1)
      }
    }
    
    return { execute: true };
  }



  /**
   * Start a specific flow with chain continuation support
   */
  private async startSpecificFlowWithChain(flowId: string, inputPayload: string | null, nextFlowIds: string[], skipFlowRunUpdate: boolean = false): Promise<void> {
    console.log(`[DO:${this.state.id}] Starting flow ${flowId} with chain: ${JSON.stringify(nextFlowIds)}`);
    
    // Load flow definition to get repository and other details
    if (!this.env.FLOW_RUNS_DB) {
      console.error(`[DO:${this.state.id}] Database not configured, cannot start flow with chain`);
      return;
    }
    
    const flow = await this.env.FLOW_RUNS_DB.prepare(`
      SELECT * FROM flow_definitions WHERE id = ?
    `).bind(flowId).first();
    
    if (!flow) {
      console.error(`[DO:${this.state.id}] Flow not found: ${flowId}`);
      return;
    }
    
    // Create request body for the new flow
    const requestBody: any = {
      flow_id: flowId,
      repository: (flow as any).repository || '[FLOW]',
      branch: (flow as any).branch || 'main',
      initial_user_prompt: (flow as any).name || `Execute flow: ${flowId}`,
      max_iterations: (flow as any).max_iterations || 20
    };
    
    // Add input payload if provided
    if (inputPayload) {
      try {
        // Parse the payload to add metadata
        const payloadObj = JSON.parse(inputPayload);
        payloadObj._flow_chain = nextFlowIds; // Add chain metadata
        requestBody.inputs = payloadObj;
      } catch (error) {
        // If payload is not JSON, create a new payload with chain metadata
        requestBody.inputs = {
          _input: inputPayload,
          _flow_chain: nextFlowIds
        };
      }
    } else if (nextFlowIds.length > 0) {
      // Even without input payload, we need to pass the chain
      requestBody.inputs = {
        _flow_chain: nextFlowIds
      };
    }
    
    // Create a new Durable Object for this flow
    const newConversationIdObj = this.env.CONVERSATIONS.newUniqueId();
    const newConversationStub = this.env.CONVERSATIONS.get(newConversationIdObj);
    
    const initResponse = await newConversationStub.fetch('http://placeholder/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error(`[DO:${this.state.id}] Failed to start flow with chain: ${initResponse.status} - ${errorText}`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Flow with chain started with ID: ${newConversationIdObj.toString()}`);
    
    // Update current flow run
    if (this.flowRunId && !skipFlowRunUpdate) {
      await updateFlowRunStatus(
        this.env.FLOW_RUNS_DB, 
        this.flowRunId, 
        'new_flow_started', 
        'next_flow_triggered', 
        newConversationIdObj.toString(),
        undefined,
        undefined
      );
    }
  }

  /**
   * Start a specific flow (with loop prevention)
   */
  private async startSpecificFlow(flowId: string, inputPayload?: string | null, skipFlowRunUpdate: boolean = false): Promise<void> {
    // Check for loops
    this.flowSwitchHistory.push(flowId);
    
    if (this.flowSwitchHistory.length > this.maxFlowSwitches) {
      console.error(`[DO:${this.state.id}] Flow switching loop detected: ${this.flowSwitchHistory.join(' → ')}`);
      await this.stopConversation('flow_switching_loop');
      return;
    }
    
    // Check for immediate back-and-forth
    if (this.flowSwitchHistory.length >= 2) {
      const lastTwo = this.flowSwitchHistory.slice(-2);
      if (lastTwo[0] === lastTwo[1]) {
        console.error(`[DO:${this.state.id}] Immediate flow repeat detected: ${lastTwo[0]}`);
        await this.stopConversation('immediate_flow_repeat');
        return;
      }
    }
    
    console.log(`[DO:${this.state.id}] Starting specific flow: ${flowId}`);
    
    // CONCURRENCY CHECK: Verify flow is not already running
    if (this.env.FLOW_RUNS_DB) {
      try {
        const activeFlow = await this.env.FLOW_RUNS_DB.prepare(`
          SELECT COUNT(*) as active_count FROM flow_runs 
          WHERE flow_id = ? AND status = 'active'
        `).bind(flowId).first();
        
        if (activeFlow && (activeFlow.active_count as number) > 0) {
          console.warn(`[DO:${this.state.id}] Flow ${flowId} is already active (${activeFlow.active_count} instances), skipping duplicate start`);
          return;
        }
      } catch (error: any) {
        console.error(`[DO:${this.state.id}] Error checking flow concurrency: ${error.message}`);
        // Continue anyway - better to have duplicate than to fail
      }
    }
    
    // Load flow definition from database
    if (!this.env.FLOW_RUNS_DB) {
      console.error(`[DO:${this.state.id}] Database not configured, cannot start specific flow`);
      return;
    }
    
    // Load flow definition from flow_definitions table
    const flow = await this.env.FLOW_RUNS_DB.prepare(`
      SELECT * FROM flow_definitions WHERE id = ?
    `).bind(flowId).first();
    
    if (!flow) {
      console.error(`[DO:${this.state.id}] Flow not found: ${flowId}`);
      return;
    }
    
    // Get first step instructions from flow_steps table
    const firstStep = await this.env.FLOW_RUNS_DB.prepare(`
      SELECT instructions FROM flow_steps 
      WHERE flow_id = ? AND order_index = 1
      ORDER BY order_index LIMIT 1
    `).bind(flowId).first();
    
    if (!firstStep) {
      console.error(`[DO:${this.state.id}] First step not found for flow: ${flowId}`);
      return;
    }
    
    // Prepare the request body for the new flow
    const requestBody: any = {
      flow_id: flowId,
      repository: flow.repository, // Use repository column (not repo)
      branch: flow.branch || 'main',
      initial_user_prompt: firstStep.instructions, // Get from first step instructions
      max_iterations: flow.max_iterations || 20,
      agent: flow.agent || 'openhands' // Include agent field from flow definition
    };
    
    // Add input_payload for flow-to-flow propagation if available
    if (inputPayload !== undefined && inputPayload !== null) {
      requestBody.input_payload = inputPayload;
      console.log(`[DO:${this.state.id}] Adding input_payload to next flow (${inputPayload.length} chars)`);
    }
    
    try {
      const newConversationIdObj = this.env.CONVERSATIONS.newUniqueId();
      const newConversationStub = this.env.CONVERSATIONS.get(newConversationIdObj);
      
      const initResponse = await newConversationStub.fetch('http://placeholder/initialize-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error(`[DO:${this.state.id}] Failed to start specific flow: ${initResponse.status} - ${errorText}`);
        return;
      }
      
      console.log(`[DO:${this.state.id}] Specific flow started with ID: ${newConversationIdObj.toString()}`);
      
      // Update current flow run with next_flow_id (new conversation ID)
      // Skip if skipFlowRunUpdate is true (e.g., when starting multiple flows)
      if (this.flowRunId && !skipFlowRunUpdate) {
        await updateFlowRunStatus(
          this.env.FLOW_RUNS_DB, 
          this.flowRunId, 
          'new_flow_started', 
          'next_flow_triggered', 
          newConversationIdObj.toString(),
          undefined, // outputResponse - not needed for flow chaining
          undefined // nextFlowIds - not needed for single flow
        );
      }
    } catch (error) {
      console.error(`[DO:${this.state.id}] Failed to start specific flow:`, error);
    }
  }

  /**
   * Start a specific flow with callback URL for response return
   */
  private async startSpecificFlowWithCallback(flowId: string, callbackUrl: string): Promise<void> {
    console.log(`[DO:${this.state.id}] Starting flow with callback: ${flowId}, callback: ${callbackUrl}`);
    
    // Load flow definition from database
    if (!this.env.FLOW_RUNS_DB) {
      console.error(`[DO:${this.state.id}] Database not configured, cannot start flow with callback`);
      return;
    }
    
    // Load flow definition from flow_definitions table
    const flow = await this.env.FLOW_RUNS_DB.prepare(`
      SELECT * FROM flow_definitions WHERE id = ?
    `).bind(flowId).first();
    
    if (!flow) {
      console.error(`[DO:${this.state.id}] Flow not found: ${flowId}`);
      return;
    }
    
    // Get first step instructions from flow_steps table
    const firstStep = await this.env.FLOW_RUNS_DB.prepare(`
      SELECT instructions FROM flow_steps 
      WHERE flow_id = ? AND order_index = 1
      ORDER BY order_index LIMIT 1
    `).bind(flowId).first();
    
    if (!firstStep) {
      console.error(`[DO:${this.state.id}] First step not found for flow: ${flowId}`);
      return;
    }
    
    // Prepare the request body for the new flow with callback
    const requestBody = {
      flow_id: flowId,
      repository: flow.repository, // Use repository column (not repo)
      branch: flow.branch || 'main',
      initial_user_prompt: firstStep.instructions, // Get from first step instructions
      max_iterations: flow.max_iterations || 20,
      callback_url: callbackUrl
    };
    
    try {
      const newConversationIdObj = this.env.CONVERSATIONS.newUniqueId();
      const newConversationStub = this.env.CONVERSATIONS.get(newConversationIdObj);
      
      // Use /start endpoint instead of /initialize to include callback_url
      const initResponse = await newConversationStub.fetch('http://placeholder/start-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow_id: flowId,
          callback_url: callbackUrl
        })
      });
      
      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error(`[DO:${this.state.id}] Failed to start flow with callback: ${initResponse.status} - ${errorText}`);
        return;
      }
      
      console.log(`[DO:${this.state.id}] Flow with callback started with ID: ${newConversationIdObj.toString()}`);
      
      // Update current flow run with next_flow_id (new conversation ID)
      if (this.flowRunId) {
        await updateFlowRunStatus(
          this.env.FLOW_RUNS_DB, 
          this.flowRunId, 
          'flow_called', 
          'waiting_for_response', 
          newConversationIdObj.toString(),
          undefined, // outputResponse - not needed for flow chaining
          undefined // nextFlowIds - not needed for callback flow
        );
      }
    } catch (error) {
      console.error(`[DO:${this.state.id}] Failed to start flow with callback:`, error);
    }
  }

  /**
   * Determine next flow based on priority system
   */
  private async determineNextFlow(): Promise<string | null> {
    // WARNING: This method is for monitoring/logging only
    // It MUST NOT be used for flow switching decisions
    // Flow transitions only happen via flow_definitions.next_flow_id
    // when flow completes (next_step == -1)
    
    // System-level arbitration (priority-based) - FOR MONITORING ONLY
    if (!this.env.FLOW_RUNS_DB || !this.conversation?.flow_id) {
      return null;
    }
    
    const result = await this.env.FLOW_RUNS_DB.prepare(`
      SELECT f.id 
      FROM flow_definitions f
      LEFT JOIN tasks t ON f.id = t.flow_id AND t.status = 'pending'
      WHERE f.id IN ('etaflow', 'honoflow', 'honorch')
        AND f.id != ? -- Don't select current flow
      GROUP BY f.id
      ORDER BY 
        -- Critical tasks first
        MAX(CASE WHEN t.priority = 2 THEN 100 
                 WHEN t.priority = 1 THEN 50 
                 ELSE COALESCE(t.priority, 0) END) DESC,
        -- Most pending tasks
        COUNT(t.id) DESC,
        -- Flow priority
        f.priority DESC,
        -- Oldest flow first
        MIN(t.created_at) ASC
      LIMIT 1
    `).bind(this.conversation.flow_id).first();
    
    return result?.id || null;
  }

  /**
   * Load execution data for condition evaluation
   */
  private async loadExecutionData(): Promise<Map<string, string>> {
    const data = new Map<string, string>();
    
    if (!this.env.FLOW_RUNS_DB || !this.conversation?.flow_id || !this.state.id) {
      return data;
    }
    
    try {
      const result = await this.env.FLOW_RUNS_DB.prepare(`
        SELECT key, value FROM flow_execution_data 
        WHERE flow_id = ? AND conversation_id = ?
        ORDER BY created_at DESC
      `).bind(this.conversation.flow_id, this.state.id.toString()).all();
      
      for (const row of result.results) {
        data.set(row.key, row.value);
      }
      
      console.log(`[DO:${this.state.id}] Loaded ${data.size} execution data entries`);
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Failed to load execution data: ${error.message}`);
    }
    
    // Add filesystem checks
    await this.addFilesystemChecks(data);
    
    return data;
  }

  /**
   * Add filesystem checks to execution data
   */
  private async addFilesystemChecks(data: Map<string, string>): Promise<void> {
    try {
      // Check if hono repo exists (for honoflow)
      const fs = require('fs');
      const honoExists = fs.existsSync('/workspace/hono');
      const honoHasFiles = honoExists && fs.readdirSync('/workspace/hono').length > 0;
      data.set('hono_repo_exists', honoHasFiles ? 'true' : 'false');
      
      console.log(`[DO:${this.state.id}] Filesystem check: hono_repo_exists = ${honoHasFiles}`);
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Filesystem check failed: ${error.message}`);
      data.set('hono_repo_exists', 'false');
    }
  }

  /**
   * Update execution data based on step results
   */
  private async updateExecutionData(step: StepData, response: string): Promise<void> {
    if (!this.env.FLOW_RUNS_DB || !this.conversation?.flow_id || !this.state.id) {
      return;
    }
    
    // Track step completion
    await saveExecutionData(
      this.env.FLOW_RUNS_DB,
      this.conversation.flow_id,
      this.state.id.toString(),
      `step_${step.step_id}_completed`,
      'true'
    );
    
    // Parse and store key metrics from response
    if (response.includes('200 OK')) {
      await saveExecutionData(
        this.env.FLOW_RUNS_DB,
        this.conversation.flow_id,
        this.state.id.toString(),
        'last_endpoint_status',
        'success'
      );
    }
    
    if (response.includes('failed') || response.includes('error')) {
      await saveExecutionData(
        this.env.FLOW_RUNS_DB,
        this.conversation.flow_id,
        this.state.id.toString(),
        'issues_found',
        'true'
      );
    }
    
    // Track generator issues
    if (response.includes('auto-generated') || response.includes('lacks context')) {
      await saveExecutionData(
        this.env.FLOW_RUNS_DB,
        this.conversation.flow_id,
        this.state.id.toString(),
        'generator_issues',
        'true'
      );
    }
  }

  /**
   * Create a task in another flow via output system
   */
  private async createTaskInFlow(
    flowId: string, 
    title: string, 
    description: string, 
    orderIndex: number, 
    priority: number
  ): Promise<void> {
    if (!this.env.FLOW_RUNS_DB) {
      console.warn(`[DO:${this.state.id}] Database not configured, cannot create task`);
      return;
    }
    
    try {
      // Generate a unique task ID
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.env.FLOW_RUNS_DB.prepare(`
        INSERT INTO tasks (id, flow_id, title, description, order_index, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(
        taskId,
        flowId,
        title,
        description,
        orderIndex,
        priority,
        Date.now(),
        Date.now()
      ).run();
      
      console.log(`[DO:${this.state.id}] Created task in flow ${flowId}: ${title} (priority: ${priority})`);
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Failed to create task: ${error.message}`);
    }
  }

  /**
   * Mark task as done via output system
   */
  private async markTaskAsDone(taskId: string, reason: string): Promise<void> {
    if (!this.env.FLOW_RUNS_DB) {
      console.warn(`[DO:${this.state.id}] Database not configured, cannot mark task as done`);
      return;
    }
    
    try {
      await this.env.FLOW_RUNS_DB.prepare(`
        UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?
      `).bind(Date.now(), taskId).run();
      
      console.log(`[DO:${this.state.id}] Marked task as done: ${taskId} (reason: ${reason})`);
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Failed to mark task as done: ${error.message}`);
    }
  }

  /**
   * Move to next step in current flow
   */
  private async moveToNextStep(): Promise<void> {
    if (!this.conversation) return;
    
    // Increment step index (used for step selection)
    const currentIndex = this.conversation.current_step_index || 0;
    this.conversation.current_step_index = currentIndex + 1;
    
    // Also increment flow step counter for logging
    this.conversation.current_flow_step = (this.conversation.current_flow_step || 0) + 1;
    
    // Save updated conversation state
    await this.state.storage.put('conversation', this.conversation);
    
    console.log(`[DO:${this.state.id}] Moved to step ${this.conversation.current_flow_step} (index: ${this.conversation.current_step_index})`);
  }

  /**
   * Save initial flow run to database when conversation starts
   */
  private async saveInitialFlowRunToDatabase(): Promise<void> {
    if (!this.conversation || !this.flowRunId) return;
    
    // Check if database is configured
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Database not configured, skipping initial flow run save`);
      return;
    }

    // Prepare initial flow run data
    const flowRunData = {
      id: this.flowRunId,
      conversation_id: this.state.id.toString(),
      initial_prompt: this.conversation.initial_user_prompt,
      repository: this.conversation.repository,
      branch: this.conversation.branch || 'main',
      max_iterations: this.conversation.max_iterations,
      actual_iterations: 0,
      status: 'active' as const,
      stop_reason: undefined,
      prompts_and_responses: JSON.stringify([]),
      created_at: this.conversation.created_at,
      updated_at: this.conversation.updated_at,
      ended_at: undefined,
      next_flow_id: undefined,
      task_type: undefined,
      success_score: undefined,
      quality_metrics: undefined,
      deployment_id: undefined,
      improvement_suggestions: undefined
    };

    // Save to database
    const result = await saveFlowRun(this.env.FLOW_RUNS_DB, flowRunData);
    if (!result.success) {
      console.error(`[DO:${this.state.id}] Failed to save initial flow run to database: ${result.error}`);
    } else {
      console.log(`[DO:${this.state.id}] Initial flow run saved to database: ${this.flowRunId}`);
    }
  }

  /**
   * Create initial flow run record when flow starts
   */
  private async createInitialFlowRun(): Promise<void> {
    console.log(`[DO:${this.state.id}] createInitialFlowRun called`);
    console.log(`[DO:${this.state.id}] Has conversation: ${!!this.conversation}`);
    console.log(`[DO:${this.state.id}] Has flowRunId: ${!!this.flowRunId}`);
    
    if (!this.conversation || !this.flowRunId) {
      console.log(`[DO:${this.state.id}] Missing conversation or flowRunId, skipping`);
      return;
    }
    
    // Check if database is configured
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Database not configured, skipping initial flow run creation`);
      return;
    }

    console.log(`[DO:${this.state.id}] Preparing flow run data with flow_id: ${this.conversation.flow_id}`);
    
    // Prepare initial flow run data
    const flowRunData = {
      id: this.flowRunId,
      flow_id: this.conversation.flow_id || null,
      conversation_id: this.state.id.toString(),
      step_id: null,
      input_prompt: this.conversation.initial_user_prompt,
      input_payload: this.conversation.input_payload || null,
      output_response: null,
      status: 'active' as const,
      duration_ms: 0,
      created_at: this.conversation.created_at,
      next_flow_id: null
    };

    console.log(`[DO:${this.state.id}] Calling saveFlowRun with ID: ${this.flowRunId}`);
    
    // Save to database
    const result = await saveFlowRun(this.env.FLOW_RUNS_DB, flowRunData);
    if (!result.success) {
      console.error(`[DO:${this.state.id}] Failed to create initial flow run: ${result.error}`);
    } else {
      console.log(`[DO:${this.state.id}] Initial flow run created: ${this.flowRunId}`);
    }
  }

  /**
   * Save current flow run to database
   * @param stopReason Reason for stopping
   */
  private async saveFlowRunToDatabase(stopReason: string, status: 'completed' | 'stopped' | 'new_flow_started' = 'completed'): Promise<void> {
    if (!this.conversation || !this.flowRunId) return;
    
    // Check if database is configured
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Database not configured, skipping flow run save`);
      return;
    }

    // Prepare flow run data matching actual schema
    const flowRunData = {
      id: this.flowRunId,
      flow_id: this.conversation.flow_id || null,
      conversation_id: this.state.id.toString(),
      step_id: this.conversation.current_step?.step_id || null,
      input_prompt: this.conversation.initial_user_prompt,
      output_response: this.conversation.last_step_response || null,
      status: status,
      duration_ms: Date.now() - this.conversation.created_at,
      created_at: this.conversation.created_at,
      next_flow_id: null, // Will be set by startSpecificFlow if chaining occurs
      next_flow_ids: null // Will be set by handleFlowCompletion if multiple next flows
    };

    // Update flow run in database with output_response
    const result = await updateFlowRunStatus(
      this.env.FLOW_RUNS_DB, 
      this.flowRunId, 
      status, 
      stopReason, 
      null, // nextFlowId
      this.conversation.last_step_response, // outputResponse
      null // nextFlowIds
    );
    if (!result.success) {
      console.error(`[DO:${this.state.id}] Failed to update flow run: ${result.error}`);
    } else {
      console.log(`[DO:${this.state.id}] Flow run updated: ${this.flowRunId} with status: ${status}, output_response: ${this.conversation.last_step_response ? 'saved' : 'null'}`);
    }
  }

  /**
   * Save an iteration to the database
   * @param prompt Prompt sent to DeepSeek
   * @param response DeepSeek response
   * @param openhandsResponse OpenHands response (if any)
   */
  private async saveIterationToDatabase(
    prompt: string,
    response: string,
    openhandsResponse?: string
  ): Promise<void> {
    if (!this.conversation || !this.flowRunId) return;
    
    // Check if database is configured
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Database not configured, skipping iteration save`);
      return;
    }

    // Prepare iteration data
    const iterationData = {
      flow_run_id: this.flowRunId,
      iteration_number: this.conversation.iteration,
      prompt,
      response,
      openhands_response: openhandsResponse,
      timestamp: Date.now(),
      metadata: JSON.stringify({
        repository: this.conversation.repository,
        branch: this.conversation.branch,
        iteration: this.conversation.iteration,
        max_iterations: this.conversation.max_iterations
      })
    };

    // Save to database
    const result = await saveIteration(this.env.FLOW_RUNS_DB, iterationData);
    if (!result.success) {
      console.error(`[DO:${this.state.id}] Failed to save iteration to database: ${result.error}`);
    } else {
      console.log(`[DO:${this.state.id}] Iteration ${this.conversation.iteration} saved to database`);
    }
  }

  /**
   * Save a step run to the database
   * @param step Step data
   * @param prompt Prompt sent to DeepSeek
   * @param response DeepSeek response
   * @param status Step status
   * @param attempt Attempt number (default: 1)
   */
  private async saveStepRunToDatabase(
    step: StepData,
    prompt: string,
    response: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' = 'completed',
    attempt: number = 1,
    apiCalls?: any[] // Optional API calls data from unified endpoint system
  ): Promise<void> {
    if (!this.conversation || !this.flowRunId) return;
    
    // Check if database is configured
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Database not configured, skipping step run save`);
      return;
    }

    // Get current iteration (step index)
    const iteration = this.conversation.current_step_index || 0;
    
    // Extract structured output for payload propagation
    const outputPayload = extractStructuredOutput(response);
    
    // Check if step should export payload (default: true)
    const shouldExportPayload = step.export_payload !== false; // Default to true if not explicitly false
    
    // Prepare step run data
    const stepRunData = {
      id: generateStepRunId(),
      flow_run_id: this.flowRunId,
      step_id: step.step_id,
      iteration,
      attempt,
      prompt,
      response,
      input_payload: JSON.stringify({
        step_key: step.step_key,
        step_type: step.step_type,
        requires_task: step.requires_task,
        task_id: step.task_id,
        output_enabled: step.output
      }),
      output_payload: shouldExportPayload ? (outputPayload || null) : null, // Only store if export_payload is not false
      status,
      created_at: Math.floor(Date.now() / 1000),
      duration_ms: 0, // TODO: Calculate actual duration
      api_calls: apiCalls ? JSON.stringify(apiCalls) : undefined
    };

    // Save to database
    const result = await saveStepRun(this.env.FLOW_RUNS_DB, stepRunData);
    if (!result.success) {
      console.error(`[DO:${this.state.id}] Failed to save step run to database: ${result.error}`);
    } else {
      console.log(`[DO:${this.state.id}] Step run saved to database: ${step.step_id}, iteration ${iteration}, attempt ${attempt}`);
      if (outputPayload && shouldExportPayload) {
        console.log(`[DO:${this.state.id}] Structured output payload saved (${outputPayload.length} chars)`);
      } else if (!shouldExportPayload) {
        console.log(`[DO:${this.state.id}] Step configured with export_payload=false, skipping payload export`);
      }
    }
  }

  /**
   * Get previous step responses for variable substitution
   */
  private async getPreviousStepResponses(): Promise<Record<string, any>> {
    if (!this.conversation?.flow_id || !this.env.FLOW_RUNS_DB) {
      return {};
    }

    try {
      // Get all completed steps for this flow run
      const result = await this.env.FLOW_RUNS_DB.prepare(`
        SELECT step_id, response 
        FROM flow_step_runs 
        WHERE flow_run_id = ? AND status = 'completed'
        ORDER BY created_at ASC
      `).bind(this.flowRunId).all();

      const responses: Record<string, any> = {};
      if (result.results) {
        for (const row of result.results) {
          const stepId = row.step_id as string;
          const response = row.response as string;
          responses[stepId] = response;
        }
      }

      console.log(`[DO:${this.state.id}] Retrieved ${Object.keys(responses).length} previous step responses`);
      return responses;
    } catch (error) {
      console.error(`[DO:${this.state.id}] Error getting previous step responses:`, error);
      return {};
    }
  }
}