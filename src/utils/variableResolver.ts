/**
 * Variable Resolution Engine
 * Supports ƐĐᜃ tags for dynamic variable resolution from multiple sources
 */

/**
 * Parse a variable specification
 * Formats:
 * - ƐĐᜃtitleƐĐᜃ                    // Simple variable
 * - ƐĐᜃuser:nameƐĐᜃ                // User variable
 * - ƐĐᜃsystem:titleƐĐᜃ             // System variable
 * - ƐĐᜃapi:onepost:raw.titleƐĐᜃ    // API response field
 * - ƐĐᜃapi:latest:data.user.nameƐĐᜃ // Latest API response
 * - ƐĐᜃstep:step-1:responseƐĐᜃ     // Step response
 */
export interface VariableSpec {
  type: 'simple' | 'user' | 'system' | 'api' | 'step' | 'env';
  source: string;  // variable name, endpoint name, step id, etc.
  path?: string;   // dot notation path for nested values
}

/**
 * Parse a variable specification from ƐĐᜃ tag
 */
export function parseVariableSpec(spec: string): VariableSpec {
  // Remove ƐĐᜃ tags if present
  const cleanSpec = spec.replace(/ƐĐᜃ/g, '');
  
  // Check if it has query format: variable_nameƐĐᜃtable=X/column=Y/json_path=Z
  // Actually, the format is: ƐĐᜃvariable_nameƐĐᜃquery_params
  // So spec is just "variable_name", query params are handled separately
  
  if (cleanSpec.includes(':')) {
    const parts = cleanSpec.split(':');
    
    if (parts.length >= 3) {
      // Format: type:source:path
      const [type, source, ...pathParts] = parts;
      const path = pathParts.join('.');
      
      // Validate type
      const validTypes = ['user', 'system', 'api', 'step', 'env'];
      if (validTypes.includes(type)) {
        return { type: type as VariableSpec['type'], source, path };
      }
    } else if (parts.length === 2) {
      // Format: type:source (no path)
      const [type, source] = parts;
      const validTypes = ['user', 'system', 'api', 'step', 'env'];
      if (validTypes.includes(type)) {
        return { type: type as VariableSpec['type'], source, path: '' };
      }
    }
  }
  
  // Simple variable
  return { type: 'simple', source: cleanSpec };
}

/**
 * Get value from object by dot notation path
 */
export function getValueByPath(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Resolve a variable specification to a value
 */
export async function resolveVariable(
  db: D1Database,
  spec: VariableSpec,
  context?: {
    flow_id?: string;
    flow_run_id?: string;
    step_id?: string;
    step_run_id?: string;
    table?: string;
  }
): Promise<string> {
  try {
    switch (spec.type) {
      case 'simple':
        // Check variables table (any type)
        return await resolveFromVariablesTable(db, spec.source, context);
        
      case 'user':
        // User variables from variables table
        return await resolveFromVariablesTable(db, spec.source, context, 'user_input');
        
      case 'system':
        // System variables from variables table
        return await resolveFromVariablesTable(db, spec.source, context, 'system');
        
      case 'api':
        // API response from api_calls table
        return await resolveFromApiResponse(db, spec.source, spec.path || '', context);
        
      case 'step':
        // Step response from step_runs table
        return await resolveFromStepResponse(db, spec.source, spec.path || '', context);
        
      case 'env':
        // Environment variable
        return await resolveEnvVariable(spec.source);
        
      default:
        return '';
    }
  } catch (error) {
    console.error(`[VariableResolver] Error resolving variable ${spec.source}:`, error);
    return '';
  }
}

/**
 * Resolve variable from variables table
 */
async function resolveFromVariablesTable(
  db: D1Database,
  key: string,
  context?: {
    flow_id?: string;
    flow_run_id?: string;
    step_id?: string;
  },
  variable_type?: string
): Promise<string> {
  try {
    // Build query to find variable
    const conditions: string[] = ['key = ?'];
    const bindings: any[] = [key];
    
    if (variable_type) {
      conditions.push('variable_type = ?');
      bindings.push(variable_type);
    }
    
    // Order by recency
    const query = `
      SELECT value FROM variables 
      WHERE ${conditions.join(' AND ')} 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await db.prepare(query).bind(...bindings).first();
    
    if (result && result.value) {
      try {
        // Parse JSON if stored as string
        const parsed = JSON.parse(result.value);
        return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      } catch {
        // Return as-is if not JSON
        return result.value;
      }
    }
    
    return '';
  } catch (error) {
    console.error(`[VariableResolver] Error querying variables table:`, error);
    return '';
  }
}

/**
 * Resolve variable from API response
 */
async function resolveFromApiResponse(
  db: D1Database,
  endpointName: string,
  path: string,
  context?: {
    flow_id?: string;
    flow_run_id?: string;
    step_id?: string;
  }
): Promise<string> {
  try {
    const conditions: string[] = ['endpoint_name = ?'];
    const bindings: any[] = [endpointName];
    
    if (context?.flow_run_id) {
      conditions.push('flow_run_id = ?');
      bindings.push(context.flow_run_id);
    }
    
    // Get latest API response
    const query = `
      SELECT response FROM api_calls 
      WHERE ${conditions.join(' AND ')} 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await db.prepare(query).bind(...bindings).first();
    
    if (result && result.response) {
      try {
        const response = JSON.parse(result.response);
        
        // Try to extract value from response
        let value: any;
        
        if (path) {
          // Use specified path
          value = getValueByPath(response, path);
        } else if (response.data !== undefined) {
          // Use data field if no path specified
          value = response.data;
        } else if (response.raw !== undefined) {
          // Use raw field
          value = response.raw;
        } else {
          // Use entire response
          value = response;
        }
        
        if (value !== undefined && value !== null) {
          return typeof value === 'string' ? value : JSON.stringify(value);
        }
      } catch (parseError) {
        console.error(`[VariableResolver] Error parsing API response:`, parseError);
      }
    }
    
    return '';
  } catch (error) {
    console.error(`[VariableResolver] Error querying API response:`, error);
    return '';
  }
}

/**
 * Resolve variable from step response
 */
async function resolveFromStepResponse(
  db: D1Database,
  stepId: string,
  path: string,
  context?: {
    flow_id?: string;
    flow_run_id?: string;
  }
): Promise<string> {
  try {
    const conditions: string[] = ['step_id = ?'];
    const bindings: any[] = [stepId];
    
    if (context?.flow_run_id) {
      conditions.push('flow_run_id = ?');
      bindings.push(context.flow_run_id);
    }
    
    // Get step response
    const query = `
      SELECT response FROM step_runs 
      WHERE ${conditions.join(' AND ')} 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await db.prepare(query).bind(...bindings).first();
    
    if (result && result.response) {
      try {
        const response = JSON.parse(result.response);
        
        if (path) {
          const value = getValueByPath(response, path);
          if (value !== undefined && value !== null) {
            return typeof value === 'string' ? value : JSON.stringify(value);
          }
        } else {
          // Return entire response if no path
          return typeof response === 'string' ? response : JSON.stringify(response);
        }
      } catch (parseError) {
        console.error(`[VariableResolver] Error parsing step response:`, parseError);
      }
    }
    
    return '';
  } catch (error) {
    console.error(`[VariableResolver] Error querying step response:`, error);
    return '';
  }
}

/**
 * Resolve environment variable
 */
async function resolveEnvVariable(key: string): Promise<string> {
  // In Cloudflare Workers, env vars are available globally
  // This would need to be adapted based on your environment setup
  try {
    // Try to get from global env or process.env
    const env = (globalThis as any).env || (globalThis as any).process?.env;
    if (env && env[key] !== undefined) {
      return env[key];
    }
    
    // Fallback: query from variables table with source='env'
    return '';
  } catch (error) {
    console.error(`[VariableResolver] Error resolving env variable ${key}:`, error);
    return '';
  }
}

/**
 * Extract all variable tags from text
 */
export function extractVariableTags(text: string): { tag: string; variableName: string; queryParams?: string }[] {
  // Updated regex to capture query format: ƐĐᜃvariable_nameƐĐᜃquery_params
  // The query_params should be until next ƐĐᜃ, whitespace, or end of string
  const regex = /ƐĐᜃ([^ƐĐᜃ]+)ƐĐᜃ([^\sƐĐᜃ]*)/g;
  const matches: { tag: string; variableName: string; queryParams?: string }[] = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const fullTag = match[0];
    const variableName = match[1];
    const queryParams = match[2];
    
    matches.push({
      tag: fullTag,
      variableName,
      queryParams: queryParams || undefined
    });
  }
  
  return matches;
}



/**
 * Execute query directly using database
 */
/**
 * Extract value from JSON using dot notation path
 */
function extractJsonPath(jsonValue: any, path: string): any {
  try {
    const parts = path.split('.');
    let current = jsonValue;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  } catch (e) {
    return undefined;
  }
}

/**
 * Find value in JSON using common paths
 */
function findValueInJson(jsonValue: any, key: string): any {
  // Try common paths
  const commonPaths = [
    `data.${key}`,
    `raw.${key}`,
    key,
    `response.${key}`,
    `body.${key}`
  ];
  
  for (const path of commonPaths) {
    const value = extractJsonPath(jsonValue, path);
    if (value !== undefined) {
      return value;
    }
  }
  
  return undefined;
}

async function executeQuery(db: D1Database, queryParams: string): Promise<string> {
  try {
    // Parse query params: table=api_calls/column=response/json_path=data.stdout/keys=stdout,stderr
    const params = new URLSearchParams(queryParams.replace(/\//g, '&'));
    
    const table = params.get('table');
    const column = params.get('column');
    const jsonPath = params.get('json_path');
    const keysParam = params.get('keys'); // New: comma-separated keys
    
    if (!table || !column) {
      return '';
    }
    
    // Direct database query (same logic as /api/query endpoint)
    let sql = `SELECT ${column} FROM ${table} ORDER BY created_at DESC LIMIT 1`;
    
    const result = await db.prepare(sql).first();
    
    if (!result || result[column] === null || result[column] === undefined) {
      return '';
    }
    
    let value = result[column];
    
    // Parse JSON value
    let jsonValue;
    try {
      jsonValue = typeof value === 'string' ? JSON.parse(value) : value;
    } catch (e) {
      console.error(`[VariableResolver] Error parsing JSON:`, e);
      return '';
    }
    
    // If keys specified, extract multiple values
    if (keysParam) {
      const keys = keysParam.split(',').map(k => k.trim());
      const extracted: Record<string, any> = {};
      
      for (const key of keys) {
        // Try to find key in common paths
        const foundValue = findValueInJson(jsonValue, key);
        
        // If any key is null, return empty string (fail flow)
        if (foundValue === null) {
          console.log(`[VariableResolver] Key "${key}" is null, failing flow`);
          return '';
        }
        
        extracted[key] = foundValue !== undefined ? foundValue : '';
      }
      
      return JSON.stringify(extracted);
    }
    
    // Single key extraction (backward compatible)
    if (jsonPath) {
      const foundValue = extractJsonPath(jsonValue, jsonPath);
      // If value is null, fail flow
      if (foundValue === null) {
        console.log(`[VariableResolver] Path "${jsonPath}" is null, failing flow`);
        return '';
      }
      return foundValue !== undefined ? String(foundValue) : '';
    }
    
    // No path specified, return raw value
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch (error) {
    console.error(`[VariableResolver] Error executing query:`, error);
    return '';
  }
}

/**
 * Save variable to database
 */
async function saveVariableValue(
  db: D1Database,
  variableName: string,
  value: string,
  context?: {
    flow_id?: string;
    flow_run_id?: string;
    step_id?: string;
    step_run_id?: string;
  }
): Promise<void> {
  try {
    // ALWAYS UPSERT: Create if doesn't exist, update if it does
    // Priority: flow_run_id + flow_id > flow_id > no context
    
    if (context?.flow_run_id && context?.flow_id) {
      // Check if exists with flow_run_id
      const existing = await db.prepare(
        'SELECT id FROM variables WHERE key = ? AND flow_id = ? AND flow_run_id = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(variableName, context.flow_id, context.flow_run_id).first();
      
      if (!existing) {
        // Create new variable for this flow run
        await db.prepare(`
          INSERT INTO variables (id, key, value, flow_id, flow_run_id, step_id, step_run_id, source, variable_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          variableName,
          value,
          context.flow_id,
          context.flow_run_id,
          context?.step_id || null,
          context?.step_run_id || null,
          'query',
          'system'
        ).run();
      } else {
        // Update existing variable for this flow run
        await db.prepare(`
          UPDATE variables 
          SET value = ?, updated_at = CURRENT_TIMESTAMP
          WHERE key = ? AND flow_id = ? AND flow_run_id = ?
        `).bind(
          value,
          variableName,
          context.flow_id,
          context.flow_run_id
        ).run();
      }
    } else if (context?.flow_id) {
      // Flow-level variable (no specific run)
      const existing = await db.prepare(
        'SELECT id FROM variables WHERE key = ? AND flow_id = ? AND flow_run_id IS NULL ORDER BY created_at DESC LIMIT 1'
      ).bind(variableName, context.flow_id).first();
      
      if (!existing) {
        // Create new flow-level variable
        await db.prepare(`
          INSERT INTO variables (id, key, value, flow_id, flow_run_id, step_id, step_run_id, source, variable_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          variableName,
          value,
          context.flow_id,
          null,
          context?.step_id || null,
          context?.step_run_id || null,
          'query',
          'system'
        ).run();
      } else {
        // Update existing flow-level variable
        await db.prepare(`
          UPDATE variables 
          SET value = ?, updated_at = CURRENT_TIMESTAMP
          WHERE key = ? AND flow_id = ? AND flow_run_id IS NULL
        `).bind(
          value,
          variableName,
          context.flow_id
        ).run();
      }
    } else {
      // No context - check if exists without any context
      const existing = await db.prepare(
        'SELECT id FROM variables WHERE key = ? AND flow_id IS NULL AND flow_run_id IS NULL ORDER BY created_at DESC LIMIT 1'
      ).bind(variableName).first();
      
      if (!existing) {
        // Create new global variable
        await db.prepare(`
          INSERT INTO variables (id, key, value, flow_id, flow_run_id, step_id, step_run_id, source, variable_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          variableName,
          value,
          null,
          null,
          null,
          null,
          'query',
          'system'
        ).run();
      } else {
        // Update existing global variable
        await db.prepare(`
          UPDATE variables 
          SET value = ?, updated_at = CURRENT_TIMESTAMP
          WHERE key = ? AND flow_id IS NULL AND flow_run_id IS NULL
        `).bind(
          value,
          variableName
        ).run();
      }
    }
  } catch (error) {
    console.error(`[VariableResolver] Error saving variable:`, error);
  }
}

/**
 * Resolve all variables in text
 */
export async function resolveTextVariables(
  db: D1Database,
  text: string,
  context?: {
    flow_id?: string;
    flow_run_id?: string;
    step_id?: string;
    step_run_id?: string;
    table?: string;
  }
): Promise<string> {
  const tags = extractVariableTags(text);
  
  if (tags.length === 0) {
    return text;
  }
  
  let resolvedText = text;
  
  for (const tagInfo of tags) {
    const { tag, variableName, queryParams } = tagInfo;
    
    let value = '';
    
    if (queryParams) {
      // Execute query to get value
      value = await executeQuery(db, queryParams);
      
      // ALWAYS save variable (create or update) when query is used
      await saveVariableValue(db, variableName, value || '', context);
    } else {
      // Regular variable resolution
      const spec = parseVariableSpec(variableName);
      value = await resolveVariable(db, spec, context);
    }
    
    // Replace tag with value (empty string if not found)
    resolvedText = resolvedText.replace(tag, value);
  }
  
  return resolvedText;
}