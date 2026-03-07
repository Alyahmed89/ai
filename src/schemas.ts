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
  step_type: z.string().default('manual'),
  order_index: z.number().int().nonnegative().default(0),
  page_key: z.string().optional().nullable().default(null),
  blocking: booleanSchema.default(true),
  auto_fail_on_error: booleanSchema.default(true),
  retryable: booleanSchema.default(false),
  task_id: z.string().optional().nullable().default(null),
  output_keys: z.string().optional().nullable().default(null),
  output_url: z.string().url().optional().nullable().default(null),
  output_payload_template: z.string().optional().nullable().default(null),
  default_next_step: z.number().int().optional().nullable().default(null),
  default_next_step_id: z.string().optional().nullable().default(null),
  output_auth_token: z.string().optional().nullable().default(null),
  input_keys: z.string().optional().nullable().default(null),
  output: booleanSchema.default(false),
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
export const flowSchema = z.object({
  id: idSchema,
  name: z.string().min(1, 'name is required'),
  repo: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  max_iterations: z.number().int().positive().default(5),
  steps: z.string().optional().nullable(), // JSON string
  created_at: timestampSchema,
});

// Flow Create Schema
export const flowCreateSchema = flowSchema.omit({ created_at: true }).extend({
  id: idSchema,
});

// Flow Update Schema
export const flowUpdateSchema = flowCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
});

// Flow Definition Schema
export const flowDefinitionSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().nullable(),
  max_iterations: z.number().int().positive().default(20),
  repository: z.string().min(1, 'repository is required'),
  branch: z.string().default('main'),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  next_flow_id: z.string().optional().nullable(),
  priority: z.number().int().default(0),
});

// Flow Definition Create Schema
export const flowDefinitionCreateSchema = flowDefinitionSchema.omit({ 
  created_at: true, 
  updated_at: true 
}).extend({
  id: z.string().min(1, 'id is required'),
});

// Flow Definition Update Schema
export const flowDefinitionUpdateSchema = flowDefinitionCreateSchema.partial().extend({
  id: z.string().min(1, 'id is required for update'),
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