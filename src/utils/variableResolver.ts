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
export function extractVariableTags(text: string): string[] {
  const regex = /ƐĐᜃ([^ƐĐᜃ]+)ƐĐᜃ/g;
  const matches: string[] = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[0]); // Full tag including ƐĐᜃ
  }
  
  return matches;
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
  
  for (const tag of tags) {
    // Extract spec from tag
    const specStr = tag.replace(/ƐĐᜃ/g, '');
    const spec = parseVariableSpec(specStr);
    
    // Resolve value
    const value = await resolveVariable(db, spec, context);
    
    // Replace tag with value (empty string if not found)
    resolvedText = resolvedText.replace(tag, value);
  }
  
  return resolvedText;
}