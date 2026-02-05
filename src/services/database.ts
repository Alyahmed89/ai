// Database service for flow runs tracking
import { FlowRunData, IterationData, ProjectFact } from '../types';

/**
 * Save a flow run to the database
 * @param db D1Database instance
 * @param flowRun Flow run data to save
 * @returns Promise with success status
 */
export async function saveFlowRun(db: D1Database, flowRun: FlowRunData): Promise<{success: boolean; error?: string}> {
  try {
    await db.prepare(`
      INSERT INTO flow_runs (
        id, conversation_id, initial_prompt, deepseek_system, repository, branch,
        max_iterations, actual_iterations, status, stop_reason, prompts_and_responses,
        created_at, updated_at, ended_at, next_flow_id,
        task_type, success_score, quality_metrics, deployment_id, improvement_suggestions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      flowRun.id,
      flowRun.conversation_id,
      flowRun.initial_prompt,
      flowRun.deepseek_system || null,
      flowRun.repository,
      flowRun.branch || 'main',
      flowRun.max_iterations,
      flowRun.actual_iterations,
      flowRun.status,
      flowRun.stop_reason || null,
      flowRun.prompts_and_responses,
      flowRun.created_at,
      flowRun.updated_at,
      flowRun.ended_at || null,
      flowRun.next_flow_id || null,
      flowRun.task_type || null,
      flowRun.success_score || null,
      flowRun.quality_metrics || null,
      flowRun.deployment_id || null,
      flowRun.improvement_suggestions || null
    ).run();

    return { success: true };
  } catch (error: any) {
    console.error(`[DATABASE] Error saving flow run: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Update a flow run status
 * @param db D1Database instance
 * @param flowRunId Flow run ID
 * @param status New status
 * @param stopReason Reason for stopping (optional)
 * @param nextFlowId Next flow ID if starting new flow (optional)
 * @returns Promise with success status
 */
export async function updateFlowRunStatus(
  db: D1Database,
  flowRunId: string,
  status: FlowRunData['status'],
  stopReason?: string,
  nextFlowId?: string
): Promise<{success: boolean; error?: string}> {
  try {
    const now = Date.now();
    await db.prepare(`
      UPDATE flow_runs 
      SET status = ?, stop_reason = ?, next_flow_id = ?, updated_at = ?, ended_at = ?
      WHERE id = ?
    `).bind(
      status,
      stopReason || null,
      nextFlowId || null,
      now,
      status !== 'active' ? now : null,
      flowRunId
    ).run();

    return { success: true };
  } catch (error: any) {
    console.error(`[DATABASE] Error updating flow run status: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Save an iteration to the database
 * @param db D1Database instance
 * @param iteration Iteration data to save
 * @returns Promise with success status
 */
export async function saveIteration(db: D1Database, iteration: IterationData): Promise<{success: boolean; error?: string}> {
  try {
    await db.prepare(`
      INSERT INTO iterations (
        flow_run_id, iteration_number, prompt, response, openhands_response, timestamp, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      iteration.flow_run_id,
      iteration.iteration_number,
      iteration.prompt,
      iteration.response,
      iteration.openhands_response || null,
      iteration.timestamp,
      iteration.metadata || null
    ).run();

    return { success: true };
  } catch (error: any) {
    console.error(`[DATABASE] Error saving iteration: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get a flow run by ID
 * @param db D1Database instance
 * @param flowRunId Flow run ID
 * @returns Promise with flow run data or null
 */
export async function getFlowRun(db: D1Database, flowRunId: string): Promise<FlowRunData | null> {
  try {
    const result = await db.prepare(`
      SELECT * FROM flow_runs WHERE id = ?
    `).bind(flowRunId).first();

    return result as FlowRunData | null;
  } catch (error: any) {
    console.error(`[DATABASE] Error getting flow run: ${error.message}`);
    return null;
  }
}

/**
 * Get flow runs by status
 * @param db D1Database instance
 * @param status Status to filter by
 * @param limit Maximum number of results
 * @returns Promise with array of flow runs
 */
export async function getFlowRunsByStatus(
  db: D1Database,
  status: FlowRunData['status'],
  limit: number = 100
): Promise<FlowRunData[]> {
  try {
    const result = await db.prepare(`
      SELECT * FROM flow_runs 
      WHERE status = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).bind(status, limit).all();

    return result.results as FlowRunData[];
  } catch (error: any) {
    console.error(`[DATABASE] Error getting flow runs by status: ${error.message}`);
    return [];
  }
}

/**
 * Get iterations for a flow run
 * @param db D1Database instance
 * @param flowRunId Flow run ID
 * @returns Promise with array of iterations
 */
export async function getIterationsForFlowRun(db: D1Database, flowRunId: string): Promise<IterationData[]> {
  try {
    const result = await db.prepare(`
      SELECT * FROM iterations 
      WHERE flow_run_id = ? 
      ORDER BY iteration_number ASC
    `).bind(flowRunId).all();

    return result.results as IterationData[];
  } catch (error: any) {
    console.error(`[DATABASE] Error getting iterations: ${error.message}`);
    return [];
  }
}

/**
 * Generate a unique flow run ID
 * @returns Unique flow run ID
 */
export function generateFlowRunId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all project facts from the database
 * @param db D1Database instance (PROJECT_FACTS_DB)
 * @returns Promise with array of project facts
 */
export async function getProjectFacts(db: D1Database): Promise<ProjectFact[]> {
  try {
    const result = await db.prepare(`
      SELECT tag, value FROM project_facts
    `).all();
    
    return result.results as ProjectFact[];
  } catch (error: any) {
    console.error(`[DATABASE] Error getting project facts: ${error.message}`);
    return [];
  }
}