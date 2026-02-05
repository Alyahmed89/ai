// Durable Object for conversation orchestration
// ALL state management and alarm-driven logic lives here
import { callDeepSeek, buildInitialMessages } from '../services/deepseek';
import { createOpenHandsConversation, getOpenHandsConversation, injectMessageToOpenHands } from '../services/openhands';
import { parseDoneResponse, extractPromptsAndResponses } from '../utils/parsing';
import { saveFlowRun, updateFlowRunStatus, saveIteration, generateFlowRunId } from '../services/database';
import { MAX_ITERATIONS, STOP_TOKEN, ALARM_DELAY_INIT, ALARM_DELAY_WAITING } from '../constants';
import { CloudflareBindings, ConversationData, ConversationState, OpenHandsEvent, DoneResponseData } from '../types';

export class ConversationOrchestratorDO_2026A {
  private state: DurableObjectState;
  private env: CloudflareBindings;
  private conversation: ConversationData | null = null;
  private flowRunId: string | null = null;

  constructor(state: DurableObjectState, env: CloudflareBindings) {
    this.state = state;
    this.env = env;
    
    // Load conversation state from storage
    this.state.blockConcurrencyWhile(async () => {
      this.conversation = await this.state.storage.get('conversation') || null;
    });
  }
  
  // Alarm handler (called by Cloudflare when alarm triggers)
  async alarm(): Promise<void> {
    console.log(`[DO:${this.state.id}] Alarm triggered`);
    await this.handleAlarm();
  }
  
  // HTTP endpoints for the Durable Object
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Initialize a new conversation
    if (path === '/initialize' && request.method === 'POST') {
      return this.handleInitialize(request);
    }
    
    // Get conversation state
    if (path === '/get-state' && request.method === 'GET') {
      return this.handleGetState();
    }
    
    // Stop conversation
    if (path === '/stop' && request.method === 'POST') {
      return this.handleStop();
    }
    
    return new Response(JSON.stringify({
      error: 'Not found',
      available_endpoints: ['POST /initialize', 'GET /get-state', 'POST /stop']
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // ==========================================================================
  // HTTP HANDLERS
  // ==========================================================================
  
  private async handleInitialize(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        repository: string;
        branch?: string;
        initial_user_prompt: string;
        max_iterations?: number;
        deepseek_system?: string;
      };
      const { repository, branch, initial_user_prompt, max_iterations, deepseek_system } = body;
      
      if (!repository || !initial_user_prompt) {
        return new Response(JSON.stringify({ error: 'Need repository and initial_user_prompt' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Generate flow run ID
      this.flowRunId = generateFlowRunId();
      
      // Initialize conversation
      this.conversation = {
        state: 'INIT',
        initial_user_prompt,
        iteration: 0,
        repository,
        branch,
        max_iterations: max_iterations || MAX_ITERATIONS,
        status: 'active',
        created_at: Date.now(),
        updated_at: Date.now(),
        deepseek_system
      };
      
      await this.state.storage.put('conversation', this.conversation);
      
      // Save initial flow run to database
      await this.saveInitialFlowRunToDatabase();
      
      // Schedule first alarm immediately
      await this.state.storage.setAlarm(Date.now() + ALARM_DELAY_INIT);
      
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
  
  private handleGetState(): Response {
    return new Response(JSON.stringify({
      success: true,
      conversation: this.conversation || { state: 'not_initialized' }
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
  
  // ==========================================================================
  // ALARM HANDLER (MAIN STATE MACHINE)
  // ==========================================================================
  
  private async handleAlarm(): Promise<void> {
    if (!this.conversation) {
      console.log(`[DO:${this.state.id}] No conversation to handle alarm`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Alarm triggered, state: ${this.conversation.state}, iteration: ${this.conversation.iteration}`);
    
    // Update timestamp
    this.conversation.updated_at = Date.now();
    
    try {
      // State machine
      switch (this.conversation.state) {
        case 'INIT':
          await this.handleInitState();
          break;
          
        case 'WAITING_OPENHANDS':
          await this.handleWaitingOpenHandsState();
          break;
          
        case 'DONE':
          console.log(`[DO:${this.state.id}] Conversation already DONE, no action needed`);
          return;
          
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
    
    console.log(`[DO:${this.state.id}] INIT state: Sending to DeepSeek`);
    
    // Build initial conversation messages
    const initialMessages = buildInitialMessages(
      this.conversation.initial_user_prompt,
      {
        repository: this.conversation.repository,
        branch: this.conversation.branch,
        iteration: this.conversation.iteration,
        max_iterations: this.conversation.max_iterations
      },
      this.conversation.deepseek_system
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
    
    // Check for stop condition
    const doneData = this.checkForDone(deepseekResult.response!);
    if (doneData.done) {
      console.log(`[DO:${this.state.id}] DeepSeek responded with ${STOP_TOKEN}`);
      await this.handleDoneResponse(deepseekResult.response!, 'deepseek_done');
      await this.stopConversation('deepseek_done');
      return;
    }
    
    // Add DeepSeek response to conversation history
    this.conversation.conversation_messages!.push({
      role: 'assistant',
      content: deepseekResult.response!
    });
    
    this.conversation.last_deepseek_response = deepseekResult.response;
    this.conversation.iteration++;
    
    // Create OpenHands conversation with DeepSeek response
    const openhandsResult = await createOpenHandsConversation(
      this.env.OPENHANDS_API_URL,
      deepseekResult.response!,
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
    await this.state.storage.setAlarm(Date.now() + ALARM_DELAY_WAITING);
    console.log(`[DO:${this.state.id}] OpenHands conversation created: ${openhandsResult.conversationId}, next alarm in ${ALARM_DELAY_WAITING}ms`);
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
    
    // Get OpenHands conversation events (last 2 events, reverse=true)
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
      
      // Wait longer before retrying (exponential backoff: 30s, 60s, 120s, etc.)
      const backoffTime = Math.min(30000 * Math.pow(2, this.conversation.openhands_error_count - 1), 300000); // Max 5 minutes
      console.log(`[DO:${this.state.id}] Backing off for ${backoffTime/1000}s before retry`);
      await this.state.storage.setAlarm(Date.now() + backoffTime);
      return;
    }
    
    // Reset error count on success
    this.conversation.openhands_error_count = 0;
    
    // SIMPLE RULE: Check last 2 events
    // events[0] = most recent event (index 0)
    // events[1] = previous event (index 1)
    const events = openhandsStatus.events || [];
    console.log(`[DO:${this.state.id}] Got ${events.length} events`);
    
    if (events.length >= 2) {
      const mostRecentEvent = events[0]; // index 0 = most recent
      const previousEvent = events[1];   // index 1 = previous event
      
      console.log(`[DO:${this.state.id}] Event 0 (most recent): id=${mostRecentEvent.id}, source=${mostRecentEvent.source}, observation=${mostRecentEvent.observation}`);
      console.log(`[DO:${this.state.id}] Event 1 (previous): id=${previousEvent.id}, source=${previousEvent.source}, action=${previousEvent.action}`);
      
      // Check if most recent event has agent_state: "awaiting_user_input"
      if (mostRecentEvent.observation === 'agent_state_changed' && 
          mostRecentEvent.extras?.agent_state === 'awaiting_user_input') {
        
        console.log(`[DO:${this.state.id}] Agent is awaiting user input!`);
        
        // Get content from previous event (the agent's message)
        let contentToSend = '';
        
        if (previousEvent.args?.content) {
          contentToSend = previousEvent.args.content;
        } else if (previousEvent.message) {
          contentToSend = previousEvent.message;
        }
        
        if (contentToSend) {
          console.log(`[DO:${this.state.id}] Found content to send (${contentToSend.length} chars)`);
          
          // Send to DeepSeek
          await this.sendToDeepSeek(contentToSend);
          return;
        } else {
          console.log(`[DO:${this.state.id}] No content found in previous event`);
        }
      } else {
        console.log(`[DO:${this.state.id}] Most recent event is NOT agent_state_changed with awaiting_user_input`);
        console.log(`[DO:${this.state.id}] observation=${mostRecentEvent.observation}, agent_state=${mostRecentEvent.extras?.agent_state}`);
      }
    } else {
      console.log(`[DO:${this.state.id}] Not enough events (need 2, got ${events.length})`);
    }
    
    // If we get here, either:
    // 1. Not enough events
    // 2. Agent not awaiting user input
    // 3. No content found
    
    // Reschedule check in 10 seconds
    await this.state.storage.setAlarm(Date.now() + 10000); // Check every 10 seconds
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  private async stopConversation(reason: string): Promise<void> {
    console.log(`[DO:${this.state.id}] Stopping conversation: ${reason}`);
    
    if (this.conversation) {
      this.conversation.state = 'DONE';
      this.conversation.status = 'stopped';
      this.conversation.error_message = reason;
      this.conversation.updated_at = Date.now();
      
      // Clear any pending event fields
      this.conversation.pending_event_content = undefined;
      this.conversation.pending_event_id = undefined;
      this.conversation.last_event_seen_at = undefined;
      this.conversation.cooldown_started_at = undefined;
      this.conversation.deepseek_system = undefined;
      this.conversation.conversation_messages = undefined;
      
      await this.state.storage.put('conversation', this.conversation);
    }
    
    // Cancel any pending alarms
    try {
      await this.state.storage.deleteAlarm();
    } catch (error) {
      // Ignore errors if no alarm exists
    }
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
    
    // Check for stop condition
    const doneData = this.checkForDone(deepseekResult.response!);
    if (doneData.done) {
      console.log(`[DO:${this.state.id}] DeepSeek responded with ${STOP_TOKEN}`);
      await this.handleDoneResponse(deepseekResult.response!, 'deepseek_done');
      await this.stopConversation('deepseek_done');
      return;
    }
    
    // Add DeepSeek response to conversation history
    this.conversation.conversation_messages!.push({
      role: 'assistant',
      content: deepseekResult.response!
    });
    
    this.conversation.last_deepseek_response = deepseekResult.response;
    this.conversation.iteration++;
    
    // Inject DeepSeek response back to OpenHands
    const injectResult = await injectMessageToOpenHands(
      this.env.OPENHANDS_API_URL,
      this.conversation.openhands_conversation_id!,
      deepseekResult.response!
    );
    
    if (!injectResult.success) {
      await this.stopConversation(`openhands_inject_failed: ${injectResult.error}`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Message injected to OpenHands, iteration: ${this.conversation.iteration}`);
    
    // Stay in WAITING_OPENHANDS state to wait for next agent response
    // (We just injected a task, now wait for agent to execute it)
    this.conversation.state = 'WAITING_OPENHANDS';
    await this.state.storage.put('conversation', this.conversation);
    
    // Schedule next alarm to check OpenHands status
    await this.state.storage.setAlarm(Date.now() + ALARM_DELAY_WAITING);
  }
  
  private checkForDone(response: string): DoneResponseData {
    return parseDoneResponse(response);
  }

  /**
   * Handle a [END_FLOW] response by saving flow run and closing conversation
   * @param response The DeepSeek response containing [END_FLOW]
   * @param reason Reason for stopping
   */
  private async handleDoneResponse(response: string, reason: string): Promise<void> {
    if (!this.conversation) return;

    // Parse the done response
    const doneData = this.checkForDone(response);
    
    if (!doneData.done) {
      return;
    }

    // Save the current flow run to database
    await this.saveFlowRunToDatabase(reason);

    // If there's a new prompt, start a new flow
    if (doneData.new_prompt) {
      await this.startNextFlow(doneData);
    }
  }

  /**
   * Start a new flow when [END_FLOW] contains a new prompt
   * @param doneData Parsed done response data
   */
  private async startNextFlow(doneData: DoneResponseData): Promise<void> {
    if (!doneData.new_prompt) return;

    console.log(`[DO:${this.state.id}] Starting next flow with prompt: ${doneData.new_prompt.substring(0, 50)}...`);

    // Generate a new conversation ID
    const newConversationId = crypto.randomUUID();
    
    // Get the Durable Object stub for the new conversation
    const newConversationIdObj = this.env.CONVERSATIONS.idFromName(newConversationId);
    const newConversationStub = this.env.CONVERSATIONS.get(newConversationIdObj);

    // Prepare the request body for the new flow
    const requestBody = {
      repository: this.conversation!.repository, // Use same repository
      branch: doneData.new_branch || this.conversation!.branch || 'main',
      initial_user_prompt: doneData.new_prompt,
      max_iterations: this.conversation!.max_iterations, // Use same max iterations
      deepseek_system: doneData.new_deepseek_system || this.conversation!.deepseek_system
    };

    // Create a request to initialize the new conversation
    const request = new Request('http://dummy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    try {
      // Call the fetch method on the new Durable Object
      const response = await newConversationStub.fetch(request);
      console.log(`[DO:${this.state.id}] Next flow started with ID: ${newConversationId}`);
      
      // Update current flow run with next_flow_id if database is available
      if (this.env.FLOW_RUNS_DB && this.flowRunId) {
        await this.env.FLOW_RUNS_DB.prepare(
          'UPDATE flow_runs SET next_flow_id = ? WHERE id = ?'
        ).bind(newConversationId, this.flowRunId).run();
      }
    } catch (error) {
      console.error(`[DO:${this.state.id}] Failed to start next flow:`, error);
    }
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
      deepseek_system: this.conversation.deepseek_system,
      repository: this.conversation.repository,
      branch: this.conversation.branch || 'main',
      max_iterations: this.conversation.max_iterations,
      actual_iterations: 0,
      status: 'active' as const,
      stop_reason: null,
      prompts_and_responses: JSON.stringify([]),
      created_at: this.conversation.created_at,
      updated_at: this.conversation.updated_at,
      ended_at: null,
      next_flow_id: null,
      task_type: null,
      success_score: null,
      quality_metrics: null,
      deployment_id: null,
      improvement_suggestions: null
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
   * Save current flow run to database
   * @param stopReason Reason for stopping
   */
  private async saveFlowRunToDatabase(stopReason: string): Promise<void> {
    if (!this.conversation || !this.flowRunId) return;
    
    // Check if database is configured
    if (!this.env.FLOW_RUNS_DB) {
      console.log(`[DO:${this.state.id}] Database not configured, skipping flow run save`);
      return;
    }

    // Extract prompts and responses
    const promptsAndResponses = this.conversation.conversation_messages 
      ? extractPromptsAndResponses(this.conversation.conversation_messages)
      : JSON.stringify([]);

    // Prepare flow run data
    const flowRunData = {
      id: this.flowRunId,
      conversation_id: this.state.id.toString(),
      initial_prompt: this.conversation.initial_user_prompt,
      deepseek_system: this.conversation.deepseek_system,
      repository: this.conversation.repository,
      branch: this.conversation.branch || 'main',
      max_iterations: this.conversation.max_iterations,
      actual_iterations: this.conversation.iteration,
      status: 'completed' as const,
      stop_reason: stopReason,
      prompts_and_responses: promptsAndResponses,
      created_at: this.conversation.created_at,
      updated_at: Date.now(),
      ended_at: Date.now()
    };

    // Save to database
    const result = await saveFlowRun(this.env.FLOW_RUNS_DB, flowRunData);
    if (!result.success) {
      console.error(`[DO:${this.state.id}] Failed to save flow run to database: ${result.error}`);
    } else {
      console.log(`[DO:${this.state.id}] Flow run saved to database: ${this.flowRunId}`);
    }
  }
}