// Step Service Module
// Handles all step-related business logic

import { queryDatabase, buildWhereClause, buildPagination } from './cloudflare-d1';

export interface FlowStep {
  id: string;
  title: string;
  step_type: string;
  order_index: number;
  flow_definition_id: string;
  created_at: string;
  updated_at: string;
  input_schema: any;
  output_schema: any;
  flow_name?: string;
}

export interface StepFilters {
  step_type?: string;
  flow_definition_id?: string;
}

export interface StepListOptions {
  limit?: number;
  offset?: number;
  filters?: StepFilters;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Get all flow steps with optional filtering and pagination
 */
export async function getFlowSteps(options: StepListOptions = {}): Promise<FlowStep[]> {
  const { limit = 50, offset = 0, filters = {}, orderBy = 'created_at', orderDirection = 'DESC' } = options;
  
  // Build WHERE clause from filters
  const { sql: whereClause, params: whereParams } = buildWhereClause(filters);
  
  // Build pagination
  const pagination = buildPagination(limit, offset);
  
  // Build SQL query with flow name join
  const sql = `
    SELECT fs.id, fs.title, fs.step_type, fs.order_index, fs.flow_definition_id,
           fs.created_at, fs.updated_at, fs.input_schema, fs.output_schema,
           fd.name as flow_name
    FROM flow_steps fs
    LEFT JOIN flow_definitions fd ON fs.flow_definition_id = fd.id
    ${whereClause}
    ORDER BY ${orderBy} ${orderDirection}
    ${pagination}
  `;
  
  const steps = await queryDatabase(sql, whereParams);
  return steps || [];
}

/**
 * Get a single flow step by ID
 */
export async function getFlowStepById(id: string): Promise<FlowStep | null> {
  const sql = `
    SELECT fs.id, fs.title, fs.step_type, fs.order_index, fs.flow_definition_id,
           fs.created_at, fs.updated_at, fs.input_schema, fs.output_schema,
           fd.name as flow_name
    FROM flow_steps fs
    LEFT JOIN flow_definitions fd ON fs.flow_definition_id = fd.id
    WHERE fs.id = ?
  `;
  
  const steps = await queryDatabase(sql, [id]);
  
  if (steps.length === 0) {
    return null;
  }
  
  return steps[0];
}

/**
 * Get step conditions
 */
export async function getStepConditions(stepId: string): Promise<any[]> {
  const sql = `
    SELECT id, step_id, condition_type, condition_value, next_step_id, created_at
    FROM step_conditions
    WHERE step_id = ?
    ORDER BY created_at ASC
  `;
  
  const conditions = await queryDatabase(sql, [stepId]);
  return conditions || [];
}

/**
 * Get step input
 */
export async function getStepInput(stepId: string): Promise<any> {
  const sql = `
    SELECT id, step_id, input_data, created_at, updated_at
    FROM step_inputs
    WHERE step_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const inputs = await queryDatabase(sql, [stepId]);
  
  if (inputs.length === 0) {
    return null;
  }
  
  return inputs[0];
}

/**
 * Create a new flow step
 */
export async function createFlowStep(stepData: Omit<FlowStep, 'id' | 'created_at' | 'updated_at' | 'flow_name'>): Promise<FlowStep> {
  const { title, step_type, order_index, flow_definition_id, input_schema, output_schema } = stepData;
  
  // In a real implementation, we would execute an INSERT statement
  const mockStep: FlowStep = {
    id: Date.now().toString(),
    title,
    step_type,
    order_index,
    flow_definition_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input_schema: input_schema || {},
    output_schema: output_schema || {}
  };
  
  return mockStep;
}

/**
 * Update an existing flow step
 */
export async function updateFlowStep(id: string, stepData: Partial<Omit<FlowStep, 'id' | 'created_at' | 'flow_name'>>): Promise<FlowStep | null> {
  const existingStep = await getFlowStepById(id);
  if (!existingStep) {
    return null;
  }
  
  // Merge existing data with updates
  const updatedStep = { 
    ...existingStep, 
    ...stepData,
    updated_at: new Date().toISOString()
  };
  
  return updatedStep;
}

/**
 * Get step statistics
 */
export async function getStepStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byFlow: Record<string, number>;
}> {
  const allSteps = await getFlowSteps({ limit: 1000 });
  
  const byType: Record<string, number> = {};
  const byFlow: Record<string, number> = {};
  
  allSteps.forEach(step => {
    byType[step.step_type] = (byType[step.step_type] || 0) + 1;
    const flowName = step.flow_name || 'Unknown';
    byFlow[flowName] = (byFlow[flowName] || 0) + 1;
  });
  
  return {
    total: allSteps.length,
    byType,
    byFlow
  };
}