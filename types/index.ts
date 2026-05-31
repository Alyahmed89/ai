// Shared types for the AI Documentation System

// Command Item Interface
export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  type: 'command' | 'variable' | 'flow' | 'step' | 'flowrun';
  value: string;
}

// Flow Definition Interface
export interface FlowDefinition {
  id: string;
  name: string;
  description: string | null;
  max_iterations: number;
  repository: string;
  branch: string;
  created_at: string;
  updated_at: string;
  next_flow_id: string | null;
  priority: number;
  agent?: string;
  system_message?: string;
}

// Flow Step Interface
export interface FlowStep {
  id: string;
  flow_id: string;
  title: string;
  instructions: string;
  step_type?: string;
  step_key: string;
  order_index: number;
  blocking: number;
  retryable: number;
  auto_fail_on_error: number;
  requires_task: number;
  output: number;
  use_endpoints: string;
  page_key?: string | null;
  task_id?: string | null;
  output_keys: string;
  output_url?: string | null;
  output_payload_template?: string | null;
  default_next_step?: string | null;
  output_auth_token?: string | null;
  default_next_step_id?: string | null;
  step_number?: string | null;
  created_at: string;
  updated_at: string;
}

// Flow Run Interface
export interface FlowRun {
  id: string;
  flow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'active';
  started_at: number;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
  input_prompt?: string;
  output_response?: string;
  flow_definition_name?: string;
}

// Parameter Field Interface
export interface ParameterField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
  options?: string[];
}

// Variable Interface
export interface Variable {
  id: string;
  name: string;
  value: string;
  type: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Pro Check Types
export interface CorrectionFlowVariable {
  name: string;
  value: unknown;
}

export interface CorrectionFlow {
  flow_id: string;
  variables: CorrectionFlowVariable[];
}

export interface ProCheck {
  status: 'stop' | 'continue' | 'approve';
  correction_flow?: CorrectionFlow;
}

export interface ProCheckRequest {
  response: Record<string, unknown>;
  rules: unknown[];
  plans: unknown[];
  step_run_id: string;
}

export interface StepRunResult {
  pro_check_request?: ProCheckRequest;
  pro_check?: ProCheck;
  [key: string]: unknown;
}

// Component Props Types
export interface FlowRunProps {
  flowRun: FlowRun;
  onSelect?: (flowRun: FlowRun) => void;
  className?: string;
}

export interface IntelligentTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  commands?: CommandItem[];
  variables?: CommandItem[];
  flows?: CommandItem[];
  steps?: CommandItem[];
  flowruns?: CommandItem[];
}

export interface CommandPaletteProps {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
  onClose: () => void;
  position: { x: number; y: number };
  searchQuery: string;
  triggerType: '/' | '#' | null;
}