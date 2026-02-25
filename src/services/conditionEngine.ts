// Condition Engine Service
// Safe evaluation engine for flow conditions

export enum ConditionEngine {
  SQL = 'sql',
  STATE = 'state',
  STATIC = 'static'
}

export interface Condition {
  id: string;
  flow_id: string;
  step_id: string;
  condition_type: 'prerequisite' | 'skip_if' | 'execute_if' | 'next_flow';
  condition_engine: ConditionEngine;
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

/**
 * Evaluate a condition safely
 */
export async function evaluateCondition(
  condition: Condition,
  db: D1Database,
  executionData: Map<string, string>
): Promise<ConditionEvaluationResult> {
  try {
    let passes = false;
    
    switch (condition.condition_engine) {
      case ConditionEngine.SQL:
        passes = await evaluateSqlCondition(condition, db);
        break;
      case ConditionEngine.STATE:
        passes = evaluateStateCondition(condition, executionData);
        break;
      case ConditionEngine.STATIC:
        passes = evaluateStaticCondition(condition);
        break;
      default:
        return {
          passes: false,
          error: `Unknown condition engine: ${condition.condition_engine}`
        };
    }
    
    return {
      passes,
      nextFlowId: condition.next_flow_id
    };
    
  } catch (error: any) {
    return {
      passes: false,
      error: `Condition evaluation failed: ${error.message}`
    };
  }
}

/**
 * Safely evaluate SQL conditions
 * Only allows SELECT queries, validates no DML
 */
async function evaluateSqlCondition(condition: Condition, db: D1Database): Promise<boolean> {
  if (!condition.condition_query) {
    console.error(`[CONDITION] No query provided for SQL condition: ${condition.id}`);
    return false;
  }
  
  const query = condition.condition_query.trim();
  const upperQuery = query.toUpperCase();
  
  // Validate: Must start with SELECT, no semicolons, no DML keywords
  if (!upperQuery.startsWith('SELECT')) {
    console.error(`[CONDITION] Invalid SQL query (must start with SELECT): ${query.substring(0, 100)}`);
    return false;
  }
  
  if (query.includes(';')) {
    console.error(`[CONDITION] Invalid SQL query (contains semicolon): ${query.substring(0, 100)}`);
    return false;
  }
  
  const dmlKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE'];
  for (const keyword of dmlKeywords) {
    if (upperQuery.includes(keyword)) {
      console.error(`[CONDITION] Invalid SQL query (contains DML keyword ${keyword}): ${query.substring(0, 100)}`);
      return false;
    }
  }
  
  try {
    const result = await db.prepare(query).first();
    
    // Accept multiple result formats:
    // SELECT 1 as ok
    // SELECT COUNT(*) as count
    // SELECT value FROM table WHERE condition
    // SELECT EXISTS(...) as exists
    const ok = result?.ok === 1 || 
               result?.count > 0 || 
               result?.value === 1 || 
               result?.exists === 1 ||
               result?.result === 1;
    
    console.log(`[CONDITION] SQL query result: ${JSON.stringify(result)}, passes: ${ok}`);
    return Boolean(ok);
    
  } catch (error: any) {
    console.error(`[CONDITION] SQL evaluation failed: ${error.message}, query: ${query.substring(0, 100)}`);
    return false;
  }
}

/**
 * Evaluate state conditions against execution data
 */
function evaluateStateCondition(condition: Condition, executionData: Map<string, string>): boolean {
  if (!condition.condition_key) {
    console.error(`[CONDITION] No key provided for state condition: ${condition.id}`);
    return false;
  }
  
  const actualValue = executionData.get(condition.condition_key);
  
  if (condition.condition_value !== undefined) {
    const passes = actualValue === condition.condition_value;
    console.log(`[CONDITION] State condition ${condition.condition_key}=${actualValue} vs expected ${condition.condition_value}: ${passes}`);
    return passes;
  }
  
  // If no expected value, just check if key exists and has non-empty value
  const passes = actualValue !== undefined && actualValue !== null && actualValue !== '';
  console.log(`[CONDITION] State condition ${condition.condition_key} exists and non-empty: ${passes}`);
  return passes;
}

/**
 * Evaluate static conditions (always true)
 */
function evaluateStaticCondition(condition: Condition): boolean {
  console.log(`[CONDITION] Static condition always passes: ${condition.id}`);
  return true;
}

/**
 * Load execution data for a flow conversation
 */
export async function loadExecutionData(
  db: D1Database,
  flowId: string,
  conversationId: string
): Promise<Map<string, string>> {
  const data = new Map<string, string>();
  
  try {
    const result = await db.prepare(`
      SELECT key, value FROM flow_execution_data 
      WHERE flow_id = ? AND conversation_id = ?
      ORDER BY created_at DESC
    `).bind(flowId, conversationId).all();
    
    for (const row of result.results) {
      data.set(row.key, row.value);
    }
    
    console.log(`[CONDITION] Loaded ${data.size} execution data entries for ${flowId}/${conversationId}`);
  } catch (error: any) {
    console.error(`[CONDITION] Failed to load execution data: ${error.message}`);
  }
  
  return data;
}

/**
 * Save execution data
 */
export async function saveExecutionData(
  db: D1Database,
  flowId: string,
  conversationId: string,
  key: string,
  value: string
): Promise<void> {
  try {
    await db.prepare(`
      INSERT OR REPLACE INTO flow_execution_data 
      (id, flow_id, conversation_id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `${flowId}_${conversationId}_${key}`,
      flowId,
      conversationId,
      key,
      value,
      Date.now(),
      Date.now()
    ).run();
    
    console.log(`[CONDITION] Saved execution data: ${flowId}/${conversationId}/${key}=${value}`);
  } catch (error: any) {
    console.error(`[CONDITION] Failed to save execution data: ${error.message}`);
  }
}