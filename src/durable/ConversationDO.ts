// Durable Object for conversation orchestration
// ALL state management and alarm-driven logic lives here
import { callDeepSeek, buildInitialMessages } from '../services/deepseek';
import { createOpenHandsConversation, getOpenHandsConversation, injectMessageToOpenHands } from '../services/openhands';
import { parseDoneResponse, extractPromptsAndResponses } from '../utils/parsing';
import { saveFlowRun, updateFlowRunStatus, saveIteration, generateFlowRunId, getProjectFacts } from '../services/database';
import { shouldCompleteTask } from '../services/verification';
import { validateFactUsage, resolveFactPlaceholders } from '../utils/factValidation';
import { MAX_ITERATIONS, END_FLOW_TOKEN, END_FLOW_EARLY_TOKEN, ALARM_DELAY_INIT, ALARM_DELAY_WAITING, OPENHANDS_TIMEOUT, NO_EVENT_TIMEOUT } from '../constants';
import { CloudflareBindings, ConversationData, ConversationState, OpenHandsEvent, DoneResponseData, ProjectFact } from '../types';

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
  
  /**
   * Load project facts from D1 database
   * @returns Array of project facts or empty array if not configured
   */
  private async loadProjectFacts(): Promise<ProjectFact[]> {
    if (!this.env.PROJECT_FACTS_DB) {
      console.log(`[DO:${this.state.id}] PROJECT_FACTS_DB not configured, using empty facts`);
      return [];
    }
    
    try {
      const facts = await getProjectFacts(this.env.PROJECT_FACTS_DB);
      console.log(`[DO:${this.state.id}] Loaded ${facts.length} project facts`);
      return facts;
    } catch (error: any) {
      console.error(`[DO:${this.state.id}] Error loading project facts: ${error.message}`);
      return [];
    }
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
      
      // Load project facts from database
      const projectFacts = await this.loadProjectFacts();
      
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
        deepseek_system,
        project_facts: projectFacts
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
          
        case 'ITERATION_COMPLETE':
          await this.handleIterationCompleteState();
          break;
          
        case 'AWAITING_NEXT_ITERATION':
          await this.handleAwaitingNextIterationState();
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
    
    // Check deterministic completion via external verification
    const verificationResult = await shouldCompleteTask(
      this.conversation.repository,
      this.conversation.branch || 'main',
      this.conversation.iteration,
      deepseekResult.response!
    );
    
    // Complete if either AI says done OR external verification passes
    if (doneData.done || verificationResult.shouldComplete) {
      const reason = doneData.done ? 'deepseek_done' : `external_verification: ${verificationResult.completionReason}`;
      console.log(`[DO:${this.state.id}] Completion triggered: ${reason}`);
      console.log(`[DO:${this.state.id}] Verification details: ${JSON.stringify(verificationResult.verificationResult)}`);
      
      await this.handleDoneResponse(deepseekResult.response!, reason);
      await this.stopConversation(reason);
      return;
    }
    
    // Add DeepSeek response to conversation history
    this.conversation.conversation_messages!.push({
      role: 'assistant',
      content: deepseekResult.response!
    });
    
    this.conversation.last_deepseek_response = deepseekResult.response;
    
    // Save initial iteration (iteration 0)
    await this.saveIterationToDatabase(
      this.conversation.initial_user_prompt,
      deepseekResult.response!
    );
    
    this.conversation.iteration++;
    
    // Validate DeepSeek response uses facts correctly
    const validationResult = this.validateAndResolveDeepSeekResponse(deepseekResult.response!);
    if (!validationResult.valid) {
      console.log(`[DO:${this.state.id}] Fact validation failed: ${validationResult.error}`);
      await this.stopConversation(`FACT_VIOLATION: ${validationResult.error}`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Fact validation passed, resolved text: ${validationResult.resolvedText.substring(0, 100)}...`);
    
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
      
      // Wait longer before retrying (exponential backoff: 30s, 60s, 120s, etc.)
      const backoffTime = Math.min(30000 * Math.pow(2, this.conversation.openhands_error_count - 1), 300000); // Max 5 minutes
      console.log(`[DO:${this.state.id}] Backing off for ${backoffTime/1000}s before retry`);
      await this.state.storage.setAlarm(Date.now() + backoffTime);
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
      this.conversation.last_event_time = Date.now();
    }
    
    // Filter events to only process NEW events since last processed
    const lastProcessedEventId = this.conversation.last_sent_event_id || 0;
    const newEvents = events.filter(event => event.id > lastProcessedEventId);
    
    if (newEvents.length === 0) {
      console.log(`[DO:${this.state.id}] No new events since last processed event ID ${lastProcessedEventId}`);
    } else {
      console.log(`[DO:${this.state.id}] Processing ${newEvents.length} new events (since ID ${lastProcessedEventId})`);
      // Update last event time when we see new events
      this.conversation.last_event_time = Date.now();
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
      if (event.action && event.action !== 'agent_state_changed') {
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
        
        // Look for the agent's message content
        const messageEvent = chronologicalEvents.find(e => 
          e.id < event.id && (e.args?.content || e.message || e.content)
        );
        
        if (messageEvent) {
          contentToSend = messageEvent.args?.content || messageEvent.message || messageEvent.content || '';
          console.log(`[DO:${this.state.id}] Found content to send (${contentToSend.length} chars)`);
        }
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
    
    // Check if iteration is complete (no pending actions AND agent is awaiting input)
    if (newPendingActions.length === 0 && agentAwaitingInput) {
      iterationCompleted = true;
      console.log(`[DO:${this.state.id}] Iteration ${this.conversation.iteration} completed!`);
      
      // Generate iteration summary
      const iterationDuration = Date.now() - (this.conversation.iteration_started_at || Date.now());
      this.conversation.last_iteration_summary = `Iteration ${this.conversation.iteration} completed in ${iterationDuration}ms. Agent is awaiting next instructions.`;
      
      // Move to ITERATION_COMPLETE state
      this.conversation.state = 'ITERATION_COMPLETE';
      this.conversation.iteration_started_at = undefined; // Reset for next iteration
      
      // Save state and schedule alarm for next iteration decision
      await this.state.storage.put('conversation', this.conversation);
      await this.state.storage.setAlarm(Date.now() + 1000); // Check immediately for next step
      return;
    }
    
    // If we get here, iteration is not complete yet
    console.log(`[DO:${this.state.id}] Iteration not complete. Pending actions: ${newPendingActions.length}, Agent awaiting input: ${agentAwaitingInput}`);
    
    // Check for "no new events for 3 minutes" timeout
    if (this.conversation.last_event_time) {
      const timeSinceLastEvent = Date.now() - this.conversation.last_event_time;
      if (timeSinceLastEvent > NO_EVENT_TIMEOUT) {
        console.log(`[DO:${this.state.id}] No new events for ${timeSinceLastEvent}ms (> ${NO_EVENT_TIMEOUT}ms), assuming OH is stuck. Forcing completion.`);
        
        // Force move to next iteration
        this.conversation.state = 'ITERATION_COMPLETE';
        this.conversation.last_iteration_summary = `Iteration ${this.conversation.iteration} forced completion - no new events for ${Math.round(timeSinceLastEvent/1000)}s.`;
        this.conversation.iteration_started_at = undefined;
        this.conversation.last_event_time = undefined;
        
        await this.state.storage.put('conversation', this.conversation);
        await this.state.storage.setAlarm(Date.now() + 1000);
        return;
      }
    }
    
    // Check if iteration has timed out (general timeout check)
    if (this.conversation.iteration_started_at && 
        Date.now() - this.conversation.iteration_started_at > OPENHANDS_TIMEOUT) {
      console.log(`[DO:${this.state.id}] Iteration ${this.conversation.iteration} timed out after ${OPENHANDS_TIMEOUT}ms. Forcing completion.`);
      
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
      
      // Force move to next iteration
      this.conversation.state = 'ITERATION_COMPLETE';
      this.conversation.last_iteration_summary = `Iteration ${this.conversation.iteration} forced completion after timeout (${OPENHANDS_TIMEOUT}ms).`;
      this.conversation.iteration_started_at = undefined;
      
      await this.state.storage.put('conversation', this.conversation);
      await this.state.storage.setAlarm(Date.now() + 1000);
      return;
    }
    
    // Adaptive polling: Check more frequently early, less frequently later
    const iterationDuration = Date.now() - this.conversation.iteration_started_at!;
    let nextCheckDelay = ALARM_DELAY_WAITING; // Default 5 seconds
    
    if (iterationDuration < 30000) {
      // First 30 seconds: Check every 2 seconds (quick commands)
      nextCheckDelay = 2000;
    } else if (iterationDuration < 120000) {
      // 30-120 seconds: Check every 5 seconds (medium commands)
      nextCheckDelay = 5000;
    } else {
      // After 2 minutes: Check every 10 seconds (long commands)
      nextCheckDelay = 10000;
    }
    
    console.log(`[DO:${this.state.id}] Next check in ${nextCheckDelay}ms (iteration duration: ${iterationDuration}ms)`);
    await this.state.storage.setAlarm(Date.now() + nextCheckDelay);
  }
  
  // ==========================================================================
  // NEW STATE HANDLERS
  // ==========================================================================
  
  private async handleIterationCompleteState(): Promise<void> {
    if (!this.conversation) return;
    
    console.log(`[DO:${this.state.id}] ITERATION_COMPLETE: Iteration ${this.conversation.iteration} completed`);
    
    // Check if we should continue or stop
    // For now, always continue to next iteration
    // In the future, we could add logic to decide based on iteration summary
    
    // Move to AWAITING_NEXT_ITERATION state to wait for DeepSeek decision
    this.conversation.state = 'AWAITING_NEXT_ITERATION';
    
    // Schedule immediate check for next iteration decision
    await this.state.storage.setAlarm(Date.now() + 1000);
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
    
    // For now, always send to DeepSeek to get next instructions
    // We need to get the last OpenHands response to send to DeepSeek
    
    // Get OpenHands conversation to find the last message
    const openhandsStatus = await getOpenHandsConversation(
      this.env.OPENHANDS_API_URL,
      this.conversation.openhands_conversation_id!
    );
    
    if (!openhandsStatus.success) {
      console.log(`[DO:${this.state.id}] Failed to get OpenHands conversation: ${openhandsStatus.error}`);
      // Retry in 10 seconds
      await this.state.storage.setAlarm(Date.now() + 10000);
      return;
    }
    
    const events = openhandsStatus.events || [];
    // Events come with ?reverse=true (newest first), search in that order
    // Find the agent's last message (before awaiting_user_input)
    let contentToSend = '';
    for (const event of events) {
      if (event.observation === 'agent_state_changed' && event.extras?.agent_state === 'awaiting_user_input') {
        // Look backward for the agent's message (events are newest-first)
        const messageEvent = events.find(e => 
          e.id < event.id && (e.args?.content || e.message || e.content)
        );
        
        if (messageEvent) {
          contentToSend = messageEvent.args?.content || messageEvent.message || messageEvent.content || '';
          break;
        }
      }
    }
    
    if (contentToSend) {
      console.log(`[DO:${this.state.id}] Found content to send to DeepSeek (${contentToSend.length} chars)`);
      
      // Send to DeepSeek for next instructions
      await this.sendToDeepSeek(contentToSend);
    } else {
      console.log(`[DO:${this.state.id}] No content found to send to DeepSeek`);
      // Wait and retry
      await this.state.storage.setAlarm(Date.now() + 10000);
    }
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
    
    // Check deterministic completion via external verification
    const verificationResult = await shouldCompleteTask(
      this.conversation.repository,
      this.conversation.branch || 'main',
      this.conversation.iteration,
      deepseekResult.response!
    );
    
    // Complete if either AI says done OR external verification passes
    if (doneData.done || verificationResult.shouldComplete) {
      const reason = doneData.done ? 'deepseek_done' : `external_verification: ${verificationResult.completionReason}`;
      console.log(`[DO:${this.state.id}] Completion triggered: ${reason}`);
      console.log(`[DO:${this.state.id}] Verification details: ${JSON.stringify(verificationResult.verificationResult)}`);
      
      await this.handleDoneResponse(deepseekResult.response!, reason);
      await this.stopConversation(reason);
      return;
    }
    
    // Add DeepSeek response to conversation history
    this.conversation.conversation_messages!.push({
      role: 'assistant',
      content: deepseekResult.response!
    });
    
    this.conversation.last_deepseek_response = deepseekResult.response;
    
    // Save iteration with OpenHands response as prompt and DeepSeek response
    await this.saveIterationToDatabase(
      messageContent, // Original OpenHands response (without iteration context)
      deepseekResult.response!
    );
    
    this.conversation.iteration++;
    
    // Validate DeepSeek response uses facts correctly
    const validationResult = this.validateAndResolveDeepSeekResponse(deepseekResult.response!);
    if (!validationResult.valid) {
      console.log(`[DO:${this.state.id}] Fact validation failed: ${validationResult.error}`);
      await this.stopConversation(`FACT_VIOLATION: ${validationResult.error}`);
      return;
    }
    
    console.log(`[DO:${this.state.id}] Fact validation passed, resolved text: ${validationResult.resolvedText.substring(0, 100)}...`);
    
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
    
    // Stay in WAITING_OPENHANDS state to wait for next agent response
    // (We just injected a task, now wait for agent to execute it)
    this.conversation.state = 'WAITING_OPENHANDS';
    await this.state.storage.put('conversation', this.conversation);
    
    // After sending new instruction, wait for OH to start execution
    // Use standard check interval (no special timing for different commands)
    console.log(`[DO:${this.state.id}] After sending instruction, waiting ${ALARM_DELAY_WAITING/1000}s for OH to start`);
    await this.state.storage.setAlarm(Date.now() + ALARM_DELAY_WAITING);
  }
  
  private checkForDone(response: string): DoneResponseData {
    return parseDoneResponse(response);
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
      finalStopReason = `end_flow_with_new_prompt: ${doneData.new_prompt.substring(0, 50)}...`;
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

    // If there's a new prompt and it's not END_FLOW_EARLY, start a new flow
    if (doneData.new_prompt && !doneData.is_end_flow_early) {
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
      status: status,
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
      console.log(`[DO:${this.state.id}] Flow run saved to database: ${this.flowRunId} with status: ${status}`);
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
}