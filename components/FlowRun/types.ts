// All type definitions for FlowRun

export type ChatMessage = {
  id: string;
  type: 'user' | 'assistant' | 'api_call' | 'api_response' | 'step';
  content: string;
  timestamp: Date;
};

export type ExecutionEvent = {
  key: string;
  type: 'FLOW_RUNNING' | 'STEP_PROMPT' | 'STEP_RESPONSE' | 'FLOW_COMPLETED' | 
        'API_CALL' | 'API_RESPONSE' | 'STATUS_UPDATE' | 'FLOW_STATUS' | 'STEP_STATUS' |
        'USER_MESSAGE' | 'AI_RESPONSE' | 'COMMAND_CALL' | 'SYSTEM_MESSAGE' | 'STEP_MESSAGE';
  content?: string;
  metadata?: {
    apiEndpoint?: string;
    apiMethod?: string;
    apiParams?: any;
    apiResponse?: any;
    statusType?: string;
    duration?: number;
    timestamp?: number;
    stepIndex?: number;
    stepTitle?: string;
    stepStatus?: string;
    collapsed?: boolean;
    isThinking?: boolean;
    commandName?: string;
    commandParams?: any;
    progress?: string;
    stepName?: string;
  };
};

export type ConversationData = {
  flow_completed?: boolean;
  state?: string;
  status?: string;
  progress?: number;
  current_step?: string;
  flow_steps?: Array<{
    id?: string;
    title?: string;
    instructions?: string;
    response?: string | null;
    output?: string | null;
    result?: string | null;
    response_preview?: string | null;
    status?: string;
    api_calls?: Array<{
      endpoint: string;
      method: string;
      params?: any;
      response?: any;
      timestamp: number;
      duration?: number;
    }>;
    execution?: {
      response?: string | null;
      response_preview?: string | null;
    };
  }>;
  last_step_response?: string;
  _updatedAt?: number;
};

export interface FlowRunProps {
  data: ConversationData | null;
  chatMessages?: ChatMessage[];
  conversationId?: string | null;
  flowRunId?: string | null;
  onSendMessage?: (prompt: string, variables?: Record<string, string>) => void;
  isRunning?: boolean;
  selectedFlowId?: string | null;
  variableValues?: Record<string, string>;
}