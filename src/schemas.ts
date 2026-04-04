import { z } from 'zod';

// Base schemas for common fields
export const idSchema = z.string().min(1).optional();
export const timestampSchema = z.string().datetime().optional();
export const booleanSchema = z.boolean().optional();

// Flow Step Schema
export const flowStepSchema = z.object({
  id: idSchema,
  flow_id: z.string().min(1, 'flow_id is required'),
  step_key: z.string().min(1, 'step_key is required'),
  title: z.string().min(1, 'title is required'),
  instructions: z.string().min(1, 'instructions is required'),
  order_index: z.number().int().nonnegative().default(0),
  page_key: z.string().optional().nullable().default(null),
  blocking: booleanSchema.default(true),
  auto_fail_on_error: booleanSchema.default(true),
  retryable: booleanSchema.default(false),
  task_id: z.string().optional().nullable().default(null),
  requires_task: booleanSchema.default(false),
  // output_keys removed per user directive
  output_url: z.string().url().optional().nullable().default(null),
  output_payload_template: z.string().optional().nullable().default(null),
  default_next_step: z.number().int().optional().nullable().default(null),
  default_next_step_id: z.string().optional().nullable().default(null),
  output_auth_token: z.string().optional().nullable().default(null),
  // input_keys removed per user directive
  output: booleanSchema.default(false),
  next_flow_id: z.string().optional().nullable().default(null),
  // Unified endpoint system
  use_endpoints: z.string().optional().nullable().default(null),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// Flow Step Create Schema (for POST requests)
export const flowStepCreateSchema = flowStepSchema.omit({ 
  created_at: true, 
  updated_at: true 
}).extend({
  id: idSchema,
});

// Flow Step Update Schema (for PUT requests)
export const flowStepUpdateSchema = flowStepCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// Flow Schema


// Flow Definition Base Schema (without refinements for .omit() compatibility)
export const flowDefinitionBaseSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().nullable(),
  max_iterations: z.number().int().positive().default(20),
  repository: z.string().optional().nullable(),
  branch: z.string().default('main'),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  next_flow_id: z.string().optional().nullable(),
  priority: z.number().int().default(0),
  agent: z.string().default('openhands'),
});

// Flow Definition Schema with refinement
export const flowDefinitionSchema = flowDefinitionBaseSchema.superRefine((data, ctx) => {
  // Repository is required only if agent is "openhands"
  if (data.agent === 'openhands' && (!data.repository || data.repository.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'repository is required when agent is "openhands"',
      path: ['repository'],
    });
  }
});

// Flow Definition Create Schema
export const flowDefinitionCreateSchema = flowDefinitionBaseSchema.omit({ 
  created_at: true, 
  updated_at: true 
}).extend({
  id: idSchema,
}).superRefine((data, ctx) => {
  // Repository is required only if agent is "openhands"
  if (data.agent === 'openhands' && (!data.repository || data.repository.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'repository is required when agent is "openhands"',
      path: ['repository'],
    });
  }
});

// Flow Definition Update Schema
export const flowDefinitionUpdateSchema = flowDefinitionBaseSchema.omit({ 
  created_at: true, 
  updated_at: true 
}).extend({
  id: idSchema,
}).partial().extend({
  id: z.string().min(1, 'id is required for update'),
}).superRefine((data, ctx) => {
  // Repository is required only if agent is "openhands"
  if (data.agent === 'openhands' && (!data.repository || data.repository.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'repository is required when agent is "openhands"',
      path: ['repository'],
    });
  }
});

// Task Schema (simplified - actual schema has 31 columns)
export const taskSchema = z.object({
  id: idSchema,
  feature_id: z.string().optional().nullable().default(null),
  title: z.string().optional().nullable().default(null),
  description: z.string().optional().nullable().default(null),
  task_type: z.string().optional().nullable().default(null),
  priority: z.string().optional().nullable().default(null),
  status: z.string().default('pending'),
  action: z.string().optional().nullable().default(null),
  dependencies: z.string().optional().nullable().default(null),
  file: z.string().optional().nullable().default(null),
  line: z.number().int().optional().nullable().default(null),
  estimated_complexity: z.string().optional().nullable().default(null),
  validation_checklist: z.string().optional().nullable().default(null),
  created_at: timestampSchema,
  numeric_priority: z.number().int().default(3),
  endpoint_path: z.string().optional().nullable().default(null),
  http_method: z.string().optional().nullable().default(null),
  sample_payload: z.string().optional().nullable().default(null),
  expected_response: z.string().optional().nullable().default(null),
  auth_required: booleanSchema.default(false),
  ai_context: z.any().optional().nullable().default(null),
  last_runtime_validation_at: timestampSchema,
  last_runtime_validation_status: z.enum(['pass', 'fail', 'error', 'skipped']).optional().nullable().default(null),
  runtime_validation_count: z.number().int().default(0),
  expectation_override: z.any().optional().nullable().default(null),
  expectation_source: z.enum(['ast_extraction', 'manual_override']).default('ast_extraction'),
  flow: z.any().optional().nullable().default(null),
  obligation_evidence: z.any().optional().nullable().default(null),
  obligation_reason: z.string().optional().nullable().default(null),
  flow_id: z.string().optional().nullable().default(null),
  order_index: z.number().int().default(0),
});

// Task Create Schema
export const taskCreateSchema = taskSchema.omit({ created_at: true }).extend({
  id: idSchema,
});

// Task Update Schema
export const taskUpdateSchema = taskCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// Project Schema
export const projectSchema = z.object({
  id: idSchema,
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().nullable().default(null),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// Project Create Schema (for POST requests)
export const projectCreateSchema = projectSchema.omit({ 
  created_at: true, 
  updated_at: true 
}).extend({
  id: idSchema,
});

// Project Update Schema (for PUT requests)
export const projectUpdateSchema = projectCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// Flow Step Condition Schema
export const flowStepConditionSchema = z.object({
  id: z.string().min(1, 'id is required').optional(),
  flow_step_id: z.string().min(1, 'flow_step_id is required'),
  condition_type: z.string().min(1, 'condition_type is required'),
  condition_value: z.string().min(1, 'condition_value is required'),
  condition_operator: z.string().default('equals'),
  next_step: z.number().int().optional().nullable().default(null),
  next_step_id: z.string().optional().nullable().default(null),
  next_flow_id: z.string().optional().nullable().default(null), // New field for flow transitions
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// Flow Step Condition Create Schema
export const flowStepConditionCreateSchema = flowStepConditionSchema.omit({ 
  created_at: true, 
  updated_at: true 
}).extend({
  id: idSchema,
});

// Flow Step Condition Update Schema
export const flowStepConditionUpdateSchema = flowStepConditionCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// Flow Condition Schema
export const flowConditionSchema = z.object({
  id: z.string().min(1, 'id is required').optional(),
  flow_id: z.string().min(1, 'flow_id is required'),
  step_id: z.string().min(1, 'step_id is required'),
  condition_type: z.enum(['prerequisite', 'skip_if', 'execute_if', 'next_flow']),
  condition_engine: z.enum(['sql', 'state', 'static']).default('static'),
  condition_key: z.string().optional().nullable().default(null),
  condition_value: z.string().optional().nullable().default(null),
  condition_query: z.string().optional().nullable().default(null),
  next_flow_id: z.string().optional().nullable().default(null),
  created_at: timestampSchema,
});

// Flow Condition Create Schema
export const flowConditionCreateSchema = flowConditionSchema.omit({ 
  created_at: true 
}).extend({
  id: idSchema,
});

// Flow Condition Update Schema
export const flowConditionUpdateSchema = flowConditionCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// Flow Edge Schema (for DAG/FlowReact support)
export const flowEdgeSchema = z.object({
  id: idSchema,
  flow_id: z.string().min(1, 'flow_id is required'),
  source_step_id: z.string().min(1, 'source_step_id is required'),
  target_step_id: z.string().min(1, 'target_step_id is required'),
  edge_type: z.enum(['next', 'success', 'error', 'retry', 'fallback', 'conditional']).default('next'),
  condition: z.string().optional().nullable().default(null),
  route: z.string().optional().nullable().default(null),
  weight: z.number().default(1.0),
  metadata: z.string().optional().nullable().default(null),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// Flow Edge Create Schema
export const flowEdgeCreateSchema = flowEdgeSchema.omit({ 
  created_at: true, 
  updated_at: true 
}).extend({
  id: idSchema,
});

// Flow Edge Update Schema
export const flowEdgeUpdateSchema = flowEdgeCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// Flow Steps Update Payload (for bulk updates from FlowReact)
export const flowStepsUpdatePayloadSchema = z.object({
  flow_id: z.string().min(1, 'flow_id is required'),
  steps: z.array(flowStepUpdateSchema),
  edges: z.array(flowEdgeCreateSchema),
  deleted_step_ids: z.array(z.string()).optional().default([]),
  deleted_edge_ids: z.array(z.string()).optional().default([]),
});

// Variable Schema
export const variableSchema = z.object({
  id: idSchema,
  flow_id: z.string().optional().nullable().default(null),
  flow_run_id: z.string().optional().nullable().default(null),
  step_id: z.string().optional().nullable().default(null),
  step_run_id: z.string().optional().nullable().default(null),
  key: z.string().min(1, 'key is required'),
  value: z.any().optional().nullable().default(null),
  source: z.enum(['api', 'ai', 'user', 'command', 'system']).default('api'),
  created_at: timestampSchema,
});

export const variableCreateSchema = variableSchema.omit({ 
  created_at: true 
}).extend({
  id: idSchema,
});

export const variableUpdateSchema = variableCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// API Response Schema
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

// Validation helper function
export function validateSchema<T>(schema: z.ZodSchema<T>, data: any): { success: boolean; data?: T; error?: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Type-safe access to issues property (Zod v4 uses 'issues' instead of 'errors')
      const zodError = error as z.ZodError;
      const errors = zodError.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Validation failed: ${errors}` };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}