export type ContextValue = {
  value: any
  metadata?: {
    persist?: boolean
    source?: string
    created_at?: number
    [key: string]: any
  }
}

export type CommandResult = {
  name: string
  params: any
  result: any
  error?: string
  success: boolean
  timestamp: number
}

export type Action = {
  type: 'command' | 'await_input' | 'flow_switch' | 'complete' | string
  name: string
  params: any
}

export type StructuredAIOutput = {
  response: string
  intent: string
  actions: Array<Action>
  metadata?: Record<string, any>
}

export type ExecutionContext = {
  flow_id: string
  step_id: string
  flow_run_id?: string

  data: Map<string, ContextValue>

  ai_input: string
  ai_output: StructuredAIOutput | null
  ai_timestamp: number

  command_results: CommandResult[]

  inputs: Record<string, any>
  outputs: Record<string, any>

  step_count: number
  iteration_count: number
  command_count: number

  // Wait/Resume system
  awaiting_input?: {
    name: string
    params?: Record<string, any>
  }

  // Flow-to-flow communication
  callback_url?: string
}

export function createExecutionContext(flow_id: string, step_id: string, flow_run_id?: string): ExecutionContext {
  return {
    flow_id,
    step_id,
    flow_run_id,
    data: new Map(),

    ai_input: '',
    ai_output: null,
    ai_timestamp: Date.now(),

    command_results: [],

    inputs: {},
    outputs: {},

    step_count: 0,
    iteration_count: 0,
    command_count: 0,

    // awaiting_input is undefined by default
  }
}

export function serializeContext(ctx: ExecutionContext): any {
  return {
    ...ctx,
    data: Array.from(ctx.data.entries())
  }
}

export function deserializeContext(raw: any): ExecutionContext {
  return {
    ...raw,
    data: new Map(raw.data || [])
  }
}