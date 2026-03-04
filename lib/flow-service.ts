// Flow Service Module
// Handles all flow-related business logic

import { queryDatabase, buildWhereClause, buildPagination } from './cloudflare-d1';

export interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  repository: string;
  branch: string;
  max_iterations: number;
  created_at: string;
  updated_at: string;
  next_flow_id: string | null;
  priority: number;
}

export interface FlowFilters {
  repository?: string;
  branch?: string;
  priority?: number;
}

export interface FlowListOptions {
  limit?: number;
  offset?: number;
  filters?: FlowFilters;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Get all flow definitions with optional filtering and pagination
 */
export async function getFlowDefinitions(options: FlowListOptions = {}): Promise<FlowDefinition[]> {
  const { limit = 20, offset = 0, filters = {}, orderBy = 'priority', orderDirection = 'DESC' } = options;
  
  // Build WHERE clause from filters
  const { sql: whereClause, params: whereParams } = buildWhereClause(filters);
  
  // Build pagination
  const pagination = buildPagination(limit, offset);
  
  // Build SQL query
  const sql = `
    SELECT id, name, description, repository, branch, max_iterations, 
           created_at, updated_at, next_flow_id, priority 
    FROM flow_definitions
    ${whereClause}
    ORDER BY ${orderBy} ${orderDirection}, name
    ${pagination}
  `;
  
  const flows = await queryDatabase(sql, whereParams);
  return flows || [];
}

/**
 * Get a single flow definition by ID
 */
export async function getFlowDefinitionById(id: string): Promise<FlowDefinition | null> {
  const sql = `
    SELECT id, name, description, repository, branch, max_iterations, 
           created_at, updated_at, next_flow_id, priority 
    FROM flow_definitions 
    WHERE id = ?
  `;
  
  const flows = await queryDatabase(sql, [id]);
  
  if (flows.length === 0) {
    return null;
  }
  
  return flows[0];
}

/**
 * Get steps for a specific flow definition
 */
export async function getFlowSteps(flowId: string): Promise<any[]> {
  const sql = `
    SELECT fs.id, fs.title, fs.step_type, fs.order_index, fs.flow_definition_id,
           fs.created_at, fs.updated_at, fs.input_schema, fs.output_schema,
           fd.name as flow_name
    FROM flow_steps fs
    JOIN flow_definitions fd ON fs.flow_definition_id = fd.id
    WHERE fs.flow_definition_id = ?
    ORDER BY fs.order_index ASC
  `;
  
  const steps = await queryDatabase(sql, [flowId]);
  return steps || [];
}

/**
 * Create a new flow definition
 */
export async function createFlowDefinition(flowData: Omit<FlowDefinition, 'id' | 'created_at' | 'updated_at'>): Promise<FlowDefinition> {
  const { name, description, repository, branch, max_iterations, next_flow_id, priority } = flowData;
  
  // In a real implementation, we would execute an INSERT statement
  const mockFlow: FlowDefinition = {
    id: Date.now().toString(),
    name,
    description: description || '',
    repository,
    branch,
    max_iterations,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_flow_id,
    priority: priority || 0
  };
  
  return mockFlow;
}

/**
 * Update an existing flow definition
 */
export async function updateFlowDefinition(id: string, flowData: Partial<Omit<FlowDefinition, 'id' | 'created_at'>>): Promise<FlowDefinition | null> {
  const existingFlow = await getFlowDefinitionById(id);
  if (!existingFlow) {
    return null;
  }
  
  // Merge existing data with updates
  const updatedFlow = { 
    ...existingFlow, 
    ...flowData,
    updated_at: new Date().toISOString()
  };
  
  return updatedFlow;
}

/**
 * Get flow statistics
 */
export async function getFlowStats(): Promise<{
  total: number;
  byRepository: Record<string, number>;
  byPriority: Record<number, number>;
}> {
  const allFlows = await getFlowDefinitions({ limit: 1000 });
  
  const byRepository: Record<string, number> = {};
  const byPriority: Record<number, number> = {};
  
  allFlows.forEach(flow => {
    byRepository[flow.repository] = (byRepository[flow.repository] || 0) + 1;
    byPriority[flow.priority] = (byPriority[flow.priority] || 0) + 1;
  });
  
  return {
    total: allFlows.length,
    byRepository,
    byPriority
  };
}