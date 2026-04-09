// Shared types for DeepSeek Agent

// Cloudflare bindings
export interface CloudflareBindings {
  DEEPSEEK_API_KEY: string;
  OPENHANDS_API_URL: string;
  ADMIN_KEY?: string; // Optional admin key for protected endpoints
  CONVERSATIONS: DurableObjectNamespace;
  FLOW_RUNS_DB?: D1Database; // Optional - may not be configured
  PROJECT_FACTS_DB?: D1Database; // Optional - for authoritative project facts
  RATE_LIMIT_KV?: KVNamespace; // Optional - for rate limiting
}

// Conversation state machine
export type ConversationState = 'INIT' | 'WAITING_OPENHANDS' | 'ITERATION_COMPLETE' | 'AWAITING_NEXT_ITERATION' | 'DONE' | 'WAITING_FOR_INPUT';

// Conversation data (persisted in Durable Object storage)
export interface ConversationData {
  // Required persisted fields
  state: ConversationState;
  initial_user_prompt: string;
  openhands_conversation_id?: string;
  last_sent_event_id?: number; // Track last sent event ID for idempotency
  iteration: number;
  
  // Additional metadata
  repository: string;
  branch?: string;
  max_iterations: number;
  agent?: string; // Agent type: 'openhands' (default) or 'deepseek'
  system_message?: string; // Custom system message for DeepSeek
  memory_prompt?: string; // Custom memory prompt for flow
  
  // Current status
  status: 'active' | 'stopped' | 'error' | 'paused';
  error_message?: string;
  
  // Tracking
  last_deepseek_response?: string;
  last_openhands_response?: string;
  deepseek_error_details?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    requestBodyPreview: string;
  };
  created_at: number;
  updated_at: number;
  
  // Cooldown tracking for event processing
  pending_event_content?: string;
  pending_event_id?: number;
  last_event_seen_at?: number; // Timestamp when we last saw an event
  cooldown_started_at?: number; // Timestamp when cooldown period started
  
  // Error tracking for OpenHands API
  openhands_error_count?: number; // Consecutive OpenHands API errors
  

  
  // DeepSeek conversation history (maintains context across iterations)
  conversation_messages?: DeepSeekMessage[];
  
  // Project facts for authoritative command/URL/path enforcement
  project_facts?: ProjectFact[];

  // Iteration completion tracking
  pending_actions?: PendingAction[]; // Track ActionEvents waiting for ObservationEvents
  iteration_started_at?: number; // When current iteration started
  last_iteration_summary?: string; // Summary of what was done in last iteration
  
  // Aggressive mode tracking
  restart_count?: number; // Number of times conversation has been auto-restarted
  
  // DeepSeek response tracking
  last_deepseek_request_at?: number; // When we last sent a request to DeepSeek
  deepseek_response_pending?: boolean; // Whether we're waiting for DeepSeek response
  
  // Adaptive polling optimization
  current_poll_interval?: number; // Current polling interval in ms
  last_activity_at?: number; // When we last saw activity
  consecutive_idle_checks?: number; // Number of consecutive checks with no activity

  // Flow execution mode
  flow_id?: string; // Flow ID for flow-based execution
  flow_steps?: ExecutionStepData[]; // Flow steps with execution results
  flow_execution_mode?: boolean; // Flag to indicate flow execution mode
  current_flow_step?: number; // Current step in flow execution
  flow_steps_completed?: number[]; // Array of completed step numbers
  current_step?: StepData; // Current step data for flow execution
  last_step_response?: string; // Response from the last completed step (for conditional branching)
  flow_completed?: boolean; // Flag to prevent double completion handling

  // Task-based execution (deterministic task system)
  current_task_id?: string; // Current task ID being executed
  current_task_title?: string; // Title of current task (for prompt injection)
  current_task_description?: string; // Description of current task (for prompt injection)
  task_execution_mode?: boolean; // Flag to indicate task-based execution mode
  current_execution_step_id?: string; // ID of current task execution step for tracking
  
  // Flow context from database
  flow_context?: {
    definition?: any;
    has_project_context: boolean;
    has_testing_priorities: boolean;
    has_api_commands: boolean;
  };
  
  // API key management
  effective_deepseek_api_key?: string; // API key from request (header/body) that overrides env

  // Debug information for observability
  last_step_debug?: {
    step_id: string;
    step_title: string;
    requires_task: any;
    requires_task_converted: boolean;
    task_injected: boolean;
    task_found: boolean;
    task_id?: string;
    task_title?: string;
    prompt_preview: string;
    prompt_length: number;
    timestamp: number;
  };

  // Dual-agent conversation state
  dual_agent_state?: {
    step_id: string;
    ruler_agent: string;
    goal_criteria: string;
    max_iterations: number;
    current_iteration: number;
    conversation_history: Array<{
      iteration: number;
      agent: string;
      message: string;
      timestamp: number;
    }>;
    is_complete: boolean;
    completion_reason: string;
  };

  // New condition system execution context
  execution_context?: any;

  // Wait/Resume system for interactive flows
  waiting_for_input?: {
    name: string;
    params?: Record<string, any>;
    step_id: string;
    timestamp: number;
  };

  // Step status tracking
  step_status_sent?: boolean; // Track if SENDING STEP status has been sent for current step
}

// OpenHands event types
export interface OpenHandsEvent {
  id: number;
  timestamp: string;
  source: string;
  message: string;
  action: string;
  observation?: string;
  args?: {
    content?: string;
    tool_call_id?: string;
    [key: string]: any;
  };
  content?: string;
  extras?: {
    agent_state?: string;
    [key: string]: any;
  };
}

// Pending action tracking
export interface PendingAction {
  tool_call_id: string;
  action_type: string;
  started_at: number;
  event_id: number;
  description?: string;
}

export interface OpenHandsEventsResponse {
  events: OpenHandsEvent[];
}

// OpenHands message types (deprecated - use events instead)
export interface OpenHandsMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface OpenHandsConversation {
  conversation_id: string;
  status: string;
  agent_state: string;
  messages?: OpenHandsMessage[];
}

// DeepSeek API types
export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature: number;
  max_tokens: number;
}

export interface DeepSeekResponse {
  id: string;
  choices: Array<{
    message: DeepSeekMessage;
    finish_reason: string;
  }>;
}

// Service result types
export interface DeepSeekResult {
  success: boolean;
  response?: string;
  error?: string;
  errorDetails?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    requestBodyPreview: string;
  };
}

export interface OpenHandsCreateResult {
  success: boolean;
  conversationId?: string;
  error?: string;
}

export interface OpenHandsStatusResult {
  success: boolean;
  events?: OpenHandsEvent[];
  error?: string;
}

export interface OpenHandsInjectResult {
  success: boolean;
  error?: string;
}

// Flow run types for D1 database
export interface FlowRunData {
  id: string;
  flow_id?: string;
  conversation_id: string;
  step_id?: string;
  input_prompt?: string;
  input_payload?: string | null;
  output_response?: string;
  status: 'active' | 'completed' | 'failed' | 'stopped' | 'new_flow_started';
  duration_ms?: number;
  created_at: number;
  next_flow_id?: string;
  next_flow_ids?: string[]; // Array of next flow IDs for multiple next flows support
}

export interface IterationData {
  id?: number;
  flow_run_id: string;
  iteration_number: number;
  prompt: string;
  response: string;
  openhands_response?: string;
  timestamp: number;
  metadata?: string; // JSON string
}

export interface StepRunData {
  id: string;
  flow_run_id: string;
  step_id: string;
  iteration: number;
  attempt: number;
  prompt: string;
  response: string;
  input_payload?: string;
  output_payload?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  created_at: number;
  duration_ms: number;
  api_calls?: string; // JSON string of API calls for unified endpoint system
  memory_json?: string; // JSON string of structured conversation memory
}

export interface DoneResponseData {
  done: boolean;
  new_prompt?: string;
  new_branch?: string;
  is_end_flow_early?: boolean;
  stop_reason?: string;
}

// Project facts for authoritative command/URL/path enforcement
export interface ProjectFact {
  tag: string;
  value: string;
}

// Task data for deterministic task system
export interface TaskData {
  task_id: string;
  title: string;
  description: string | null;
  task_type: 'TASK' | 'FOLLOWUP';
  parent_task_id: string | null;
}

// Step data for flow execution steps
export interface StepData {
  step_id: string;
  step_key: string;
  title: string;
  description: string | null;
  order_index: number;
  page_key: string | null;
  blocking: boolean;
  auto_fail_on_error: boolean;
  retryable: boolean;
  flow_id?: string; // For cross-flow transition checks
  next_flow_id?: string; // For cross-flow transition to specific flow
  task_id?: string;
  requires_task?: boolean;
  // DEPRECATED: input_keys - Use use_endpoints with phase: 'input' instead
  // DEPRECATED: output_url - Use use_endpoints with phase: 'output' instead
  output?: boolean;
  output_url?: string; // DEPRECATED: Use use_endpoints with phase: 'output' instead
  output_auth_token?: string; // DEPRECATED: Use endpoint_registry auth configuration instead
  // NEW: Dual-agent mode fields
  dual_agent?: boolean;
  ruler_agent?: 'deepseek' | 'openhands';
  goal_criteria?: string;
  max_iterations_per_step?: number;
  expected_response?: string; // Expected response that goes after instructions in prompt
  // NEW: Unified endpoint system
  use_endpoints?: string; // JSON array of endpoint configurations with phase: 'input'|'command'|'output'
  // NEW: Wait/Resume system
  await_input?: {
    name: string;
    params?: Record<string, any>;
  };
  // NEW: Payload export control for flow-to-flow propagation
  export_payload?: boolean; // Whether to export step output as payload for next flow (default: true)
  // NEW: System message override
  system_message?: string; // Override system message for this step
}

// Step data with execution results for in-memory tracking
export interface ExecutionStepData extends StepData {
  response?: string;       // AI output for this step
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'; // Execution status
  rendered_instructions?: string; // Instructions after variable substitution (post-rendering)
}

// AI token parsing types
export interface CreateTaskData {
  flow_id: string;
  title: string;
  description: string;
  order_index: number;
  priority: number;
}

export interface SkipTaskData {
  task_id: string;
  reason: string;
}

export interface CommandData {
  name: string;
  params?: Record<string, any>;
}

// Condition engine types
export interface Condition {
  id: string;
  flow_id: string;
  step_id: string;
  condition_type: 'prerequisite' | 'skip_if' | 'execute_if' | 'next_flow';
  condition_engine: 'sql' | 'state' | 'static';
  condition_key?: string;
  condition_value?: string;
  condition_query?: string;
  next_flow_id?: string;
}

export interface ConditionEvaluationResult {
  passes: boolean;
  error?: string;
  nextFlowId?: string;
}

// Execution events for UI step streaming
export type ExecutionEvent =
  | { 
      type: 'STEP_STARTED'; 
      stepId: string; 
      flowRunId: string;
      sequence: number;
      title: string; 
      ts: number;
    }
  | { 
      type: 'COMMAND_CALLING'; 
      stepId: string;
      flowRunId: string;
      sequence: number;
      command: string; 
      params?: Record<string, unknown>; 
      ts: number;
    }
  | { 
      type: 'COMMAND_RESPONSE'; 
      stepId: string;
      flowRunId: string;
      sequence: number;
      command: string;
      response: {
        type: 'text' | 'json' | 'error' | 'html' | 'markdown';
        content: string;
        metadata?: Record<string, unknown>;
      };
      duration: number; 
      ts: number;
    }
  | { 
      type: 'STEP_COMPLETED'; 
      stepId: string; 
      flowRunId: string;
      sequence: number;
      result: {
        type: 'success' | 'partial' | 'skipped';
        summary: string;
        data?: unknown;
      };
      ts: number;
    }
  | { 
      type: 'STEP_ERROR'; 
      stepId: string; 
      flowRunId: string;
      sequence: number;
      error: {
        message: string;
        code?: string;
        details?: unknown;
      };
      ts: number;
    }
  | { 
      type: 'FLOW_STARTED'; 
      flowId: string; 
      flowRunId: string;
      sequence: number;
      ts: number;
    }
  | { 
      type: 'FLOW_COMPLETED'; 
      flowId: string; 
      flowRunId: string;
      sequence: number;
      result: {
        status: 'success' | 'failed' | 'cancelled';
        summary: string;
        stepsCompleted: number;
        totalSteps: number;
        data?: unknown;
      };
      ts: number;
    };

// Event storage for debugging/replay
export interface ExecutionEventRecord {
  id?: number;
  flow_run_id: string;
  event_type: string;
  payload: string; // JSON string of event data
  timestamp: number;
  created_at?: number;
}

// Standard API response format
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  [key: string]: unknown; // Allow additional properties
}

// Flow initialization response
export interface FlowInitResponse {
  success: boolean;
  conversation_id: string;
  flow_id: string;
  state: string;
  message: string;
  note?: string;
}