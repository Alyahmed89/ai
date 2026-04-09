// CRUD API for Cloudflare D1 database
import { Hono } from 'hono';
import { CloudflareBindings } from './types';
import { 
  flowStepCreateSchema, 
  flowStepUpdateSchema,
  flowDefinitionCreateSchema,
  flowDefinitionUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  flowStepConditionCreateSchema,
  flowStepConditionUpdateSchema,
  flowConditionCreateSchema,
  flowConditionUpdateSchema,
  flowEdgeCreateSchema,
  flowEdgeUpdateSchema,
  flowStepsUpdatePayloadSchema,
  variableCreateSchema,
  variableUpdateSchema,
  validateSchema 
} from './schemas';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse
} from './response';
import { StepExecutor } from './core/step-executor';
import { createExecutionContext } from './core/execution-context';
import { generateId, saveVariable } from './services/database';
import { ApiCaller } from './services/ApiCaller';

// Helper function to handle database errors
function handleDbError(error: any) {
  console.error('Database error:', error);
  return {
    success: false,
    error: error.message || 'Database error'
  };
}

// Helper function to convert undefined to null for database
function dbValue(value: any): any {
  return value === undefined ? null : value;
}

// Helper function to get boolean value with default
function getBoolean(value: any, defaultValue: boolean): number {
  if (value === undefined || value === null) return defaultValue ? 1 : 0;
  return Boolean(value) ? 1 : 0;
}

// Global protection: ensure no undefined values in database binds
function normalizeForDb(value: unknown): any {
  return value === undefined ? null : value;
}

// Helper function for consistent API responses
function apiResponse(success: boolean, data?: any, error?: string, statusCode: number = 200) {
  return {
    success,
    data,
    error,
    statusCode
  };
}

// Helper function to extract all keys from an object (including nested)
function extractKeysFromObject(obj: any, prefix: string = ''): string[] {
  const keys: string[] = [];
  
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...extractKeysFromObject(obj[key], fullKey));
      }
    }
  }
  
  return keys;
}

// Helper function to parse sample response and extract keys
function extractKeysFromSampleResponse(sampleResponse: string | null): string[] {
  if (!sampleResponse) {
    return [];
  }
  
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(sampleResponse);
    return extractKeysFromObject(parsed);
  } catch (e) {
    // If not valid JSON, try to extract JSON from text
    const jsonMatches = sampleResponse.match(/\{[\s\S]*?\}/g);
    if (jsonMatches) {
      const allKeys: string[] = [];
      for (const match of jsonMatches) {
        try {
          const obj = JSON.parse(match);
          allKeys.push(...extractKeysFromObject(obj));
        } catch (e2) {
          // Skip invalid JSON
        }
      }
      return [...new Set(allKeys)]; // Remove duplicates
    }
  }
  
  return [];
}

// Helper function to parse sample request and extract keys (cosmetic wrapper)
function extractKeysFromSampleRequest(sampleRequest: string | null): string[] {
  return extractKeysFromSampleResponse(sampleRequest);
}

// Create CRUD API router
export const crudApi = new Hono<{ Bindings: CloudflareBindings }>();



// Test request endpoint (for API testing from frontend)
crudApi.post('/test-request', async (c) => {
  try {
    // Security check: require x-admin-key header
    const adminKey = c.req.header('x-admin-key');
    const expectedAdminKey = c.env.ADMIN_KEY;
    
    if (!adminKey || !expectedAdminKey || adminKey !== expectedAdminKey) {
      return c.json({ 
        error: 'Unauthorized',
        message: 'Valid x-admin-key header is required'
      }, 401);
    }
    
    const { url, method = 'GET', headers = {}, body: requestBody = null } = await c.req.json();
    
    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }
    
    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return c.json({ error: 'Invalid URL' }, 400);
    }
    
    // Start timing the request
    const startTime = Date.now();
    
    // Make the actual HTTP request
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    // Add body for appropriate methods
    if (requestBody && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(requestBody);
    }
    
    const response = await fetch(url, fetchOptions);
    
    // Get response body and try to parse as JSON, fall back to text
    let responseBody: any;
    const responseText = await response.text();
    
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
    
    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Calculate request duration
    const endTime = Date.now();
    const timeMs = endTime - startTime;
    
    return c.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      time_ms: timeMs
    });
    
  } catch (error) {
    console.error('Error making test request:', error);
    return c.json({ 
      error: 'Failed to make request',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});





// Get all tasks
crudApi.get('/tasks', async (c) => {
  console.log("Tasks route hit");
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Check for flowId query parameter
    const flowId = c.req.query('flowId');
    
    let query = 'SELECT * FROM tasks';
    let params: any[] = [];
    
    // Only filter if flowId is provided and not empty
    if (flowId && flowId.trim() !== '') {
      query += ' WHERE flow_id = ?';
      params.push(flowId.trim());
    }
    
    query += ' ORDER BY order_index';
    
    const result = await db.prepare(query).bind(...params).all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get task by ID
crudApi.get('/tasks/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Create new task
crudApi.post('/tasks', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(taskCreateSchema, body);
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }
    const validatedData = validation.data!;

    // Generate ID if not provided
    const taskId = validatedData.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO tasks (id, flow_id, title, description, status, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    // TEMPORARY: Log for production validation
    console.log('INSERT TASK - validatedData:', JSON.stringify(validatedData, null, 2));
    
    await db.prepare(sql).bind(
      taskId, 
      validatedData.flow_id, 
      validatedData.title, 
      dbValue(validatedData.description), 
      validatedData.status || 'pending', 
      validatedData.order_index
    ).run();
    
    return c.json({ message: 'Task created successfully', id: taskId }, 201);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Update task
crudApi.put('/tasks/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(taskUpdateSchema, { ...body, id });
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }
    const validatedData = validation.data!;

    const sql = `
      UPDATE tasks 
      SET title = ?, description = ?, status = ?, order_index = ?
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(
      validatedData.title, 
      dbValue(validatedData.description), 
      validatedData.status, 
      validatedData.order_index, 
      id
    ).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json({ message: 'Task updated successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Delete task
crudApi.delete('/tasks/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json({ message: 'Task deleted successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// ============================================================================
// PROJECTS ENDPOINTS
// ============================================================================

// Get all projects
crudApi.get('/projects', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const result = await db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    return c.json(successResponse(result.results || []));
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get project by ID
crudApi.get('/projects/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json(notFoundResponse('Project not found'));
    }

    return c.json(successResponse(result));
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Create project
crudApi.post('/projects', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const body = await c.req.json();
    const validation = validateSchema(projectCreateSchema, body);
    
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.errors), 400);
    }

    const validatedData = validation.data!;
    const projectId = validatedData.id || `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO projects (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      projectId,
      validatedData.name,
      dbValue(validatedData.description)
    ).run();

    const createdProject = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    return c.json(successResponse(createdProject), 201);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Update project
crudApi.put('/projects/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = validateSchema(projectUpdateSchema, body);
    
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.errors), 400);
    }

    const validatedData = validation.data!;
    const { name, description } = validatedData;

    // Check if project exists
    const existing = await db.prepare('SELECT id FROM projects WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json(notFoundResponse('Project not found'));
    }

    const sql = `
      UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.prepare(sql).bind(
      dbValue(name),
      dbValue(description),
      id
    ).run();

    const updatedProject = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
    return c.json(successResponse(updatedProject));
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Delete project
crudApi.delete('/projects/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json(notFoundResponse('Project not found'));
    }

    return c.json({ message: 'Project deleted successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get all flow steps
crudApi.get('/flow-steps', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const flowId = c.req.query('flow_id');
    let query = 'SELECT * FROM flow_steps';
    const params: any[] = [];
    
    if (flowId) {
      query += ' WHERE flow_id = ?';
      params.push(flowId);
    }
    
    query += ' ORDER BY order_index';
    
    const result = await db.prepare(query).bind(...params).all();
    return c.json(successResponse(result.results || []));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Get flow step by ID
crudApi.get('/flow-steps/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT * FROM flow_steps WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Flow step not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching flow step:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new flow step
crudApi.post('/flow-steps', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowStepCreateSchema, body);
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    
    // Generate ID if not provided
    const stepId = validatedData.id || `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO flow_steps (
        id, flow_id, step_key, title, instructions, order_index,
        page_key, blocking, auto_fail_on_error, retryable, task_id,
        requires_task, output_url, output_payload_template, default_next_step,
        output_auth_token, output, next_flow_id,
        use_endpoints, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    // Log bindings for debugging
    const bindings = [
      stepId,
      validatedData.flow_id,
      validatedData.step_key,
      validatedData.title,
      validatedData.instructions,
      validatedData.order_index,
      dbValue(validatedData.page_key),
      getBoolean(validatedData.blocking, true),
      getBoolean(validatedData.auto_fail_on_error, true),
      getBoolean(validatedData.retryable, false),
      dbValue(validatedData.task_id),
      getBoolean(validatedData.requires_task, false),
      dbValue(validatedData.output_url),
      dbValue(validatedData.output_payload_template),
      dbValue(validatedData.default_next_step),
      dbValue(validatedData.output_auth_token),
      getBoolean(validatedData.output, false),
      dbValue(validatedData.next_flow_id),
      dbValue(validatedData.use_endpoints)
    ];
    
    // Final safety check: ensure no undefined values
    const safeBindings = bindings.map(normalizeForDb);
    
    // TEMPORARY: Log for production validation
    console.log('INSERT FLOW STEP - validatedData:', JSON.stringify(validatedData, null, 2));
    console.log('INSERT FLOW STEP - safeBindings:', JSON.stringify(safeBindings, null, 2));
    console.log('INSERT FLOW STEP - bindings count:', safeBindings.length);
    console.log('INSERT FLOW STEP - undefined check:', safeBindings.filter(v => v === undefined).length);
    
    await db.prepare(sql).bind(...safeBindings).run();
    
    return c.json(successResponse({ 
      message: 'Flow step created successfully', 
      id: stepId 
    }, 201));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Update flow step
crudApi.put('/flow-steps/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowStepUpdateSchema, { ...body, id });
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    
    // Build dynamic SQL update
    const updates: string[] = [];
    const bindings: any[] = [];
    
    // Helper to add field to update if provided
    const addUpdate = (field: string, value: any, transform?: (v: any) => any) => {
      if (value !== undefined) {
        updates.push(`${field} = ?`);
        bindings.push(transform ? transform(value) : value);
      }
    };
    
    // Add all fields that might be in the update
    addUpdate('flow_id', validatedData.flow_id);
    addUpdate('step_key', validatedData.step_key);
    addUpdate('title', validatedData.title);
    addUpdate('instructions', validatedData.instructions);
    addUpdate('order_index', validatedData.order_index);
    addUpdate('page_key', validatedData.page_key, dbValue);
    addUpdate('blocking', validatedData.blocking, (v) => getBoolean(v, true));
    addUpdate('auto_fail_on_error', validatedData.auto_fail_on_error, (v) => getBoolean(v, true));
    addUpdate('retryable', validatedData.retryable, (v) => getBoolean(v, false));
    addUpdate('task_id', validatedData.task_id, dbValue);
    addUpdate('requires_task', validatedData.requires_task, (v) => getBoolean(v, false));
    addUpdate('output_url', validatedData.output_url, dbValue);
    addUpdate('output_payload_template', validatedData.output_payload_template, dbValue);
    addUpdate('default_next_step', validatedData.default_next_step, dbValue);
    addUpdate('output_auth_token', validatedData.output_auth_token, dbValue);
    addUpdate('output', validatedData.output, (v) => getBoolean(v, false));
    addUpdate('next_flow_id', validatedData.next_flow_id, dbValue);
    
    // New fields (only those that exist in the database)
    addUpdate('use_endpoints', validatedData.use_endpoints, dbValue);
    
    // Always update updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updates.length <= 1) { // Only updated_at
      return c.json(errorResponse('No fields to update', 400));
    }
    
    const sql = `UPDATE flow_steps SET ${updates.join(', ')} WHERE id = ?`;
    bindings.push(id);
    
    const result = await db.prepare(sql).bind(...bindings.map(normalizeForDb)).run();

    if (result.meta.changes === 0) {
      return c.json(notFoundResponse('Flow step not found'));
    }

    return c.json(successResponse({ message: 'Flow step updated successfully' }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Delete flow step
crudApi.delete('/flow-steps/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const id = c.req.param('id');
    
    // Try to delete the step
    const result = await db.prepare('DELETE FROM flow_steps WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json(notFoundResponse('Flow step not found'));
    }

    return c.json(successResponse({ message: 'Flow step deleted successfully' }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Endpoint removed: GET /flow-steps/:id/input
// Reason: input_keys column has been removed from flow_steps table

// Endpoint removed: PUT /flow-steps/:id/input
// Reason: input_keys column has been removed from flow_steps table

// Get flow step output schema (without output_keys)
crudApi.get('/flow-steps/:id/output', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT output_url, output_payload_template, output_auth_token, output FROM flow_steps WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Flow step not found' }, 404);
    }

    return c.json({ 
      output_schema: null, // output_keys column removed
      output_url: result.output_url,
      output_payload_template: result.output_payload_template,
      output_auth_token: result.output_auth_token,
      output: result.output
    });
  } catch (error) {
    console.error('Error fetching flow step output:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update flow step output schema
crudApi.put('/flow-steps/:id/output', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const stepId = c.req.param('id');
    const body = await c.req.json();
    
    // Check if step exists
    const existing = await db.prepare('SELECT id FROM flow_steps WHERE id = ?').bind(stepId).first();
    if (!existing) {
      return c.json(errorResponse('Flow step not found', 404));
    }
    
    // Prepare update fields (output_keys removed)
    const updates: { [key: string]: any } = {};
    const params: any[] = [];
    
    if (body.output_url !== undefined) {
      updates.output_url = body.output_url;
      params.push(updates.output_url);
    }
    
    if (body.output_payload_template !== undefined) {
      updates.output_payload_template = body.output_payload_template;
      params.push(updates.output_payload_template);
    }
    
    if (body.output_auth_token !== undefined) {
      updates.output_auth_token = body.output_auth_token;
      params.push(updates.output_auth_token);
    }
    
    if (body.output !== undefined) {
      updates.output = body.output;
      params.push(updates.output);
    }
    
    // If no output fields provided, return error
    if (Object.keys(updates).length === 0) {
      return c.json(errorResponse('At least one output field must be provided', 400));
    }
    
    // Build SQL query
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const sql = `UPDATE flow_steps SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    params.push(stepId);
    await db.prepare(sql).bind(...params).run();
    
    return c.json(successResponse({ 
      message: 'Flow step output schema updated successfully' 
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Get flow step conditions
crudApi.get('/flow-steps/:id/conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    let conditions: any = { results: [] };
    try {
      conditions = await db.prepare(
        'SELECT * FROM flow_step_conditions WHERE flow_step_id = ? ORDER BY id'
      ).bind(id).all();
    } catch (error) {
      const errorMessage = error.message || '';
      if (errorMessage.includes('no such column: flow_step_id')) {
        console.log("flow_step_conditions table has different schema, returning empty conditions");
        // Return empty array if column doesn't exist
        conditions = { results: [] };
      } else {
        throw error;
      }
    }

    // Get next step information for each condition
    const conditionsWithNextStep = await Promise.all(
      (conditions.results || []).map(async (condition: any) => {
        // Try to get next step by next_step_id first (new system)
        if (condition.next_step_id && condition.next_step_id !== 'TERMINATE_FLOW') {
          try {
            const nextStep = await db.prepare(
              'SELECT id, title FROM flow_steps WHERE id = ?'
            ).bind(condition.next_step_id).first();
            
            return {
              ...condition,
              next_step_title: nextStep?.title || null,
              next_step_id: condition.next_step_id
            };
          } catch (e) {
            console.error('Error fetching next step by ID:', e);
            // Fall through to legacy lookup
          }
        }
        
        // Fall back to legacy next_step (index-based) lookup
        if (condition.next_step && condition.next_step !== -1) {
          try {
            // Get current step to find its flow_id
            const currentStep = await db.prepare(
              'SELECT flow_id FROM flow_steps WHERE id = ?'
            ).bind(id).first();
            
            if (currentStep) {
              const nextStep = await db.prepare(
                'SELECT id, title FROM flow_steps WHERE flow_id = ? AND order_index = ?'
              ).bind(currentStep.flow_id, condition.next_step).first();
              
              return {
                ...condition,
                next_step_title: nextStep?.title || null,
                next_step_id: nextStep?.id || null
              };
            }
          } catch (e) {
            console.error('Error fetching next step by index:', e);
          }
        }
        
        // Handle termination case
        if (condition.next_step === -1 || condition.next_step_id === 'TERMINATE_FLOW') {
          return {
            ...condition,
            next_step_title: 'TERMINATE_FLOW',
            next_step_id: 'TERMINATE_FLOW'
          };
        }
        
        return {
          ...condition,
          next_step_title: null,
          next_step_id: null
        };
      })
    );

    return c.json(conditionsWithNextStep);
  } catch (error) {
    console.error('Error fetching flow step conditions:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new flow step condition
crudApi.post('/flow-step-conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowStepConditionCreateSchema, body);
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    const { 
      flow_step_id, condition_type, condition_value, condition_operator,
      next_step, next_step_id, next_flow_id 
    } = validatedData;
    
    // Generate ID if not provided
    const conditionId = validatedData.id || `cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate that we have at least one transition target
    if (!next_step && !next_step_id && !next_flow_id) {
      return c.json(errorResponse('At least one of next_step, next_step_id, or next_flow_id must be provided', 400));
    }
    
    // For next_flow_id conditions, set next_step to -1 (terminate current flow)
    let finalNextStep = next_step;
    let finalNextStepId = next_step_id;
    
    if (next_flow_id) {
      // When transitioning to another flow, we terminate the current flow
      finalNextStep = -1;
      finalNextStepId = 'TERMINATE_FLOW';
    }
    
    const sql = `
      INSERT INTO flow_step_conditions (
        id, flow_step_id, condition_type, condition_value, condition_operator,
        next_step, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      conditionId,
      flow_step_id,
      condition_type,
      condition_value,
      condition_operator || 'equals',
      dbValue(finalNextStep)
    ).run();
    
    return c.json(successResponse({ 
      message: 'Flow step condition created successfully', 
      id: conditionId 
    }, 201));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Update flow step condition
crudApi.put('/flow-step-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const conditionId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowStepConditionUpdateSchema, { ...body, id: conditionId });
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    const { 
      flow_step_id, condition_type, condition_value, condition_operator,
      next_step, next_step_id, next_flow_id 
    } = validatedData;
    
    // Validate that we have at least one transition target if any transition fields are provided
    if ((next_step !== undefined || next_step_id !== undefined || next_flow_id !== undefined) && 
        !next_step && !next_step_id && !next_flow_id) {
      return c.json(errorResponse('At least one of next_step, next_step_id, or next_flow_id must be provided', 400));
    }
    
    // For next_flow_id conditions, set next_step to -1 (terminate current flow)
    let finalNextStep = next_step;
    let finalNextStepId = next_step_id;
    
    if (next_flow_id) {
      // When transitioning to another flow, we terminate the current flow
      finalNextStep = -1;
      finalNextStepId = 'TERMINATE_FLOW';
    }
    
    // Check if condition exists
    const existing = await db.prepare('SELECT id FROM flow_step_conditions WHERE id = ?').bind(conditionId).first();
    if (!existing) {
      return c.json(errorResponse('Flow step condition not found', 404));
    }
    
    const sql = `
      UPDATE flow_step_conditions SET
        flow_step_id = COALESCE(?, flow_step_id),
        condition_type = COALESCE(?, condition_type),
        condition_value = COALESCE(?, condition_value),
        condition_operator = COALESCE(?, condition_operator),
        next_step = COALESCE(?, next_step),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.prepare(sql).bind(
      dbValue(flow_step_id),
      dbValue(condition_type),
      dbValue(condition_value),
      dbValue(condition_operator),
      dbValue(finalNextStep),
      conditionId
    ).run();
    
    return c.json(successResponse({ 
      message: 'Flow step condition updated successfully', 
      id: conditionId 
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Delete flow step condition
crudApi.delete('/flow-step-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const conditionId = c.req.param('id');
    
    // Check if condition exists
    const existing = await db.prepare('SELECT id FROM flow_step_conditions WHERE id = ?').bind(conditionId).first();
    if (!existing) {
      return c.json(errorResponse('Flow step condition not found', 404));
    }
    
    await db.prepare('DELETE FROM flow_step_conditions WHERE id = ?').bind(conditionId).run();
    
    return c.json(successResponse({ 
      message: 'Flow step condition deleted successfully' 
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Alias endpoints for backward compatibility: /api/steps -> /api/flow-steps
crudApi.get('/steps', async (c) => {
  // Forward to /api/flow-steps handler
  return crudApi.fetch(new Request(c.req.url.replace('/steps', '/flow-steps'), c.req));
});

crudApi.get('/steps/:id', async (c) => {
  // Forward to /api/flow-steps/:id handler
  return crudApi.fetch(new Request(c.req.url.replace('/steps', '/flow-steps'), c.req));
});

crudApi.post('/steps', async (c) => {
  // Forward to /api/flow-steps handler
  return crudApi.fetch(new Request(c.req.url.replace('/steps', '/flow-steps'), c.req));
});

crudApi.put('/steps/:id', async (c) => {
  // Forward to /api/flow-steps/:id handler
  return crudApi.fetch(new Request(c.req.url.replace('/steps', '/flow-steps'), c.req));
});

crudApi.delete('/steps/:id', async (c) => {
  // Forward to /api/flow-steps/:id handler
  return crudApi.fetch(new Request(c.req.url.replace('/steps', '/flow-steps'), c.req));
});

// Get all flow step conditions
crudApi.get('/flow-step-conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before querying

    const result = await db.prepare('SELECT * FROM flow_step_conditions ORDER BY id').all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get specific flow step condition
crudApi.get('/flow-step-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const conditionId = c.req.param('id');
    const result = await db.prepare('SELECT * FROM flow_step_conditions WHERE id = ?').bind(conditionId).first();
    
    if (!result) {
      return c.json({ error: 'Flow step condition not found' }, 404);
    }
    
    return c.json(result);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Create flow step condition
crudApi.post('/flow-step-conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowStepConditionCreateSchema, body);
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    const { 
      id, flow_step_id, condition_type, condition_value, condition_operator, next_step
    } = validatedData;
    
    // Generate ID if not provided
    const conditionId = id || `flow-step-cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO flow_step_conditions (
        id, flow_step_id, condition_type, condition_value, condition_operator, next_step, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      conditionId,
      flow_step_id,
      condition_type,
      condition_value,
      condition_operator || 'equals',
      next_step
    ).run();
    
    return c.json(successResponse({ 
      message: 'Flow step condition created successfully', 
      id: conditionId 
    }, 201));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Update flow step condition
crudApi.put('/flow-step-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const conditionId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowStepConditionUpdateSchema, { ...body, id: conditionId });
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    const { 
      flow_id, flow_step_id, condition_type, condition_engine,
      condition_key, condition_value, condition_query, next_flow_id
    } = validatedData;
    
    // Check if condition exists
    const existing = await db.prepare('SELECT id FROM flow_step_conditions WHERE id = ?').bind(conditionId).first();
    if (!existing) {
      return c.json(errorResponse('Flow step condition not found', 404));
    }
    
    const sql = `
      UPDATE flow_step_conditions SET
        flow_step_id = COALESCE(?, flow_step_id),
        condition_type = COALESCE(?, condition_type),
        condition_value = COALESCE(?, condition_value),
        condition_operator = COALESCE(?, condition_operator),
        next_step = COALESCE(?, next_step),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.prepare(sql).bind(
      dbValue(flow_step_id),
      dbValue(condition_type),
      dbValue(condition_value),
      dbValue(condition_operator),
      dbValue(next_step),
      conditionId
    ).run();
    
    return c.json(successResponse({ 
      message: 'Flow step condition updated successfully', 
      id: conditionId 
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Delete flow step condition
crudApi.delete('/flow-step-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const conditionId = c.req.param('id');
    
    // Check if condition exists
    const existing = await db.prepare('SELECT id FROM flow_step_conditions WHERE id = ?').bind(conditionId).first();
    if (!existing) {
      return c.json(errorResponse('Flow step condition not found', 404));
    }
    
    await db.prepare('DELETE FROM flow_step_conditions WHERE id = ?').bind(conditionId).run();
    
    return c.json(successResponse({ 
      message: 'Flow step condition deleted successfully' 
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Create flow run
crudApi.post('/flow-runs', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const body = await c.req.json();
    const { id, flow_id, conversation_id, status, started_at, completed_at } = body;
    const created_at = Math.floor(Date.now() / 1000);

    // Generate ID if not provided
    const flowRunId = id || `flow-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Use normalizeForDb to convert undefined to null
    const normalizedStartedAt = normalizeForDb(started_at);
    const normalizedCompletedAt = normalizeForDb(completed_at);
    const normalizedFlowId = normalizeForDb(flow_id);
    const normalizedConversationId = normalizeForDb(conversation_id);

    const sql = `
      INSERT INTO flow_runs (
        id, flow_id, conversation_id, step_id, input_prompt, output_response,
        status, duration_ms, started_at, completed_at, created_at, next_flow_id, stop_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(
      flowRunId,
      normalizedFlowId,
      normalizedConversationId, // Use normalized value from request
      null, // step_id
      null, // input_prompt
      null, // output_response
      status || 'running',
      0, // duration_ms
      normalizedStartedAt,
      normalizedCompletedAt,
      created_at,
      null, // next_flow_id
      null // stop_reason
    ).run();
    
    return c.json({ message: 'Flow run created successfully', id: flowRunId }, 201);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Update flow run
crudApi.put('/flow-runs/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const { status, completed_at } = body;

    // Use normalizeForDb to convert undefined to null
    const normalizedCompletedAt = normalizeForDb(completed_at);

    const sql = `
      UPDATE flow_runs 
      SET status = ?, completed_at = ?
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(status, normalizedCompletedAt, id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Flow run not found' }, 404);
    }

    return c.json({ message: 'Flow run updated successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Delete flow run
crudApi.delete('/flow-runs/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    
    if (!id || !/^[0-9a-zA-Z_-]+$/.test(id)) {
      return c.json(apiResponse(false, undefined, 'Invalid id', 400));
    }

    const sql = `
      DELETE FROM flow_runs 
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(id).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Flow run not found', 404));
    }

    return c.json(apiResponse(true, { message: 'Flow run deleted successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// Get all iterations for a flow run
crudApi.get('/flow-runs/:flowRunId/iterations', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const flowRunId = c.req.param('flowRunId');
    const result = await db.prepare(
      'SELECT * FROM iterations WHERE flow_run_id = ? ORDER BY iteration_number'
    ).bind(flowRunId).all();
    
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Create iteration
crudApi.post('/flow-runs/:flowRunId/iterations', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const flowRunId = c.req.param('flowRunId');
    const body = await c.req.json();
    const { id, iteration_number, status } = body;
    const created_at = Math.floor(Date.now() / 1000);

    // Generate ID if not provided
    const iterationId = id || `iteration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO iterations (id, flow_run_id, iteration_number, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(iterationId, flowRunId, iteration_number, status || 'running', created_at).run();
    
    return c.json({ message: 'Iteration created successfully', id: iterationId }, 201);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// ==========================================================================

// ==========================================================================
// Core Observability Endpoints (5 endpoints only)
// ==========================================================================

// ============================================
// Endpoint Registry Management
// ============================================

// 1️⃣ Get all endpoints
crudApi.get('/endpoints', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    const tag = c.req.query('tag');

    let whereClause = '';
    let params: any[] = [];

    if (tag) {
      whereClause = 'WHERE tags LIKE ?';
      params.push(`%${tag}%`);
    }

    const sql = `
      SELECT 
        id, name, description, url, method, auth_type, auth_value,
        headers, body_template, query_params, response_path,
        timeout_ms, max_retries, retry_delay_ms, cache_key,
        cache_ttl_seconds, encrypt_cache, response_validator,
        allowed_domains, require_https, log_level,
        created_at, updated_at, created_by, tags,
        sample_response, ai_enabled, endpoint_type, sample_request
      FROM endpoint_registry
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const endpoints = await db.prepare(sql).bind(...params).all();

    return c.json(successResponse({
      endpoints: endpoints.results,
      total: endpoints.results.length,
      limit,
      offset
    }));

  } catch (error: any) {
    console.error('Error fetching endpoints:', error);
    return c.json(errorResponse(`Error fetching endpoints: ${error.message}`, 500));
  }
});

// 3️⃣ Introspect endpoint - extract available keys from sample response
crudApi.get('/endpoints/introspect', async (c) => {
  try {
    console.log("INTROSPECT ENDPOINT CALLED");
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      console.log("ERROR: Database not configured");
      return c.json({ error: 'Database not configured' }, 500);
    }

    const endpointId = c.req.query('endpoint_id');
    console.log("Endpoint ID from query:", endpointId);
    if (!endpointId) {
      console.log("ERROR: endpoint_id query parameter is required");
      return c.json({ error: 'endpoint_id query parameter is required' }, 400);
    }
    
    const trimmedId = endpointId.trim();
    console.log("Trimmed ID:", trimmedId);
    
    // Use the same SELECT query as the GET endpoint for consistency
    const sql = `
      SELECT 
        id, name, description, url, method, auth_type, auth_value,
        headers, body_template, query_params, response_path,
        timeout_ms, max_retries, retry_delay_ms, cache_key,
        cache_ttl_seconds, encrypt_cache, response_validator,
        allowed_domains, require_https, log_level,
        created_at, updated_at, created_by, tags,
        sample_response, ai_enabled, endpoint_type, sample_request
      FROM endpoint_registry
      WHERE name = ?
      LIMIT 1
    `;
    
    console.log("SQL query:", sql);
    console.log("Binding parameters:", trimmedId);
    
    // Try to find endpoint by ID or name
    const endpoint = await db.prepare(sql).bind(trimmedId).first();
    console.log("Query result:", endpoint ? "FOUND" : "NOT FOUND");
    
    if (!endpoint) {
      console.log("Endpoint not found with ID/name:", trimmedId);
      return c.json(notFoundResponse(`Endpoint not found: ${trimmedId}`));
    }
    
    console.log("Found endpoint:", endpoint.id, endpoint.name);
    console.log("Sample response exists:", !!endpoint.sample_response);
    console.log("Sample request exists:", !!endpoint.sample_request);
    
    // Extract keys from sample request
    let requestKeys: string[] = [];
    let parsedSampleRequest: any = null;
    
    if (endpoint.sample_request) {
      console.log("Sample request:", endpoint.sample_request);
      requestKeys = extractKeysFromSampleRequest(endpoint.sample_request);
      console.log("Extracted request keys:", requestKeys);
      
      // Try to parse sample request for display
      try {
        parsedSampleRequest = JSON.parse(endpoint.sample_request);
      } catch (e) {
        console.log("Failed to parse sample request as JSON:", e.message);
        parsedSampleRequest = endpoint.sample_request;
      }
    }
    
    // Extract keys from sample response
    let responseKeys: string[] = [];
    let parsedSampleResponse: any = null;
    
    if (endpoint.sample_response) {
      console.log("Sample response:", endpoint.sample_response);
      responseKeys = extractKeysFromSampleResponse(endpoint.sample_response);
      console.log("Extracted response keys:", responseKeys);
      
      // Try to parse sample response for display
      try {
        parsedSampleResponse = JSON.parse(endpoint.sample_response);
      } catch (e) {
        console.log("Failed to parse sample response as JSON:", e.message);
        parsedSampleResponse = endpoint.sample_response;
      }
    } else {
      // Default keys if no sample response
      console.log("No sample response, using default keys");
      responseKeys = ["id", "name", "description", "method", "url"];
    }
    
    // Return endpoint info with extracted keys
    const response = {
      id: endpoint.id,
      name: endpoint.name,
      description: endpoint.description,
      method: endpoint.method,
      url: endpoint.url,
      request_keys: requestKeys,
      response_keys: responseKeys,
      sample_request: parsedSampleRequest,
      sample_response: parsedSampleResponse
    };
    
    console.log("Returning response");
    return c.json(successResponse(response));

  } catch (error: any) {
    console.error('Error introspecting endpoint:', error);
    return c.json(errorResponse(`Error introspecting endpoint: ${error.message}`, 500));
  }
});


// 2️⃣ Get endpoint by name
crudApi.get('/endpoints/:name', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const name = c.req.param('name');
    const testMode = c.req.query('test') === 'true';

    const sql = `
      SELECT 
        id, name, description, url, method, auth_type, auth_value,
        headers, body_template, query_params, response_path,
        timeout_ms, max_retries, retry_delay_ms, cache_key,
        cache_ttl_seconds, encrypt_cache, response_validator,
        allowed_domains, require_https, log_level,
        created_at, updated_at, created_by, tags,
        sample_response, ai_enabled, endpoint_type, sample_request
      FROM endpoint_registry
      WHERE name = ?
    `;

    const endpoint = await db.prepare(sql).bind(name).first();

    if (!endpoint) {
      return c.json(notFoundResponse('Endpoint not found'));
    }

    // Parse JSON fields for response
    const parsedEndpoint = { ...endpoint };
    
    // Parse JSON fields if they exist
    if (parsedEndpoint.headers) {
      try {
        parsedEndpoint.headers = JSON.parse(parsedEndpoint.headers);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    
    if (parsedEndpoint.query_params) {
      try {
        parsedEndpoint.query_params = JSON.parse(parsedEndpoint.query_params);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    
    if (parsedEndpoint.allowed_domains) {
      try {
        parsedEndpoint.allowed_domains = JSON.parse(parsedEndpoint.allowed_domains);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    
    if (parsedEndpoint.tags) {
      try {
        parsedEndpoint.tags = JSON.parse(parsedEndpoint.tags);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    


    // If test mode is requested, provide test information but don't make actual request
    if (testMode) {
      // Analyze endpoint for template variables
      const url = parsedEndpoint.url;
      const urlVariableRegex = /\{([^}]+)\}/g;
      const urlVariables: string[] = [];
      let match;
      
      while ((match = urlVariableRegex.exec(url)) !== null) {
        urlVariables.push(match[1]);
      }
      
      // Check body template for variables
      const bodyVariables: string[] = [];
      if (parsedEndpoint.body_template) {
        const bodyVarRegex = /\{([^}]+)\}/g;
        let bodyMatch;
        while ((bodyMatch = bodyVarRegex.exec(parsedEndpoint.body_template)) !== null) {
          bodyVariables.push(bodyMatch[1]);
        }
      }
      
      // Check query params for variables
      const queryVariables: string[] = [];
      if (parsedEndpoint.query_params && typeof parsedEndpoint.query_params === 'object') {
        Object.values(parsedEndpoint.query_params).forEach(value => {
          if (typeof value === 'string') {
            const queryVarRegex = /\{([^}]+)\}/g;
            let queryMatch;
            while ((queryMatch = queryVarRegex.exec(value)) !== null) {
              queryVariables.push(queryMatch[1]);
            }
          }
        });
      }
      
      // Combine all unique variables
      const allVariables = [...new Set([...urlVariables, ...bodyVariables, ...queryVariables])];
      
      return c.json({
        ...successResponse(parsedEndpoint),
        test_info: {
          can_test: true,
          test_endpoint: `POST /api/endpoints/${name}/test`,
          required_parameters: allVariables,
          example_test_request: {
            method: 'POST',
            url: `/api/endpoints/${name}/test`,
            body: allVariables.reduce((acc, param) => {
              acc[param] = "example_value";
              return acc;
            }, {} as Record<string, string>)
          },
          notes: [
            'Use POST /api/endpoints/{name}/test to make actual test requests with parameters.',
            'URL template variables like {username} must be provided in test parameters.',
            'Authentication values starting with "env:" reference environment variables.'
          ]
        }
      });
    }

    return c.json(successResponse(parsedEndpoint));

  } catch (error: any) {
    console.error('Error fetching endpoint:', error);
    return c.json(errorResponse(`Error fetching endpoint: ${error.message}`, 500));
  }
});


// 4️⃣ Create new endpoint
crudApi.post('/endpoints', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const endpointData = await c.req.json();
    
    // Validate required fields
    if (!endpointData.name || !endpointData.url || !endpointData.method) {
      return c.json({ error: 'Missing required fields: name, url, method' }, 400);
    }

    // Generate ID if not provided
    const id = endpointData.id || `endpoint_${Date.now()}`;
    const now = Math.floor(Date.now() / 1000);

    const sql = `
      INSERT INTO endpoint_registry (
        id, name, description, url, method, auth_type, auth_value,
        headers, body_template, query_params, response_path,
        timeout_ms, max_retries, retry_delay_ms, cache_key,
        cache_ttl_seconds, encrypt_cache, response_validator,
        allowed_domains, require_https, log_level,
        created_at, updated_at, created_by, tags,
        ai_enabled, endpoint_type, sample_request, sample_response,
        request_keys
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const params = [
      id,
      endpointData.name,
      endpointData.description || null,
      endpointData.url,
      endpointData.method.toUpperCase(),
      endpointData.auth_type || 'none',
      endpointData.auth_value || null,
      endpointData.headers ? JSON.stringify(endpointData.headers) : null,
      endpointData.body_template || null,
      endpointData.query_params ? JSON.stringify(endpointData.query_params) : null,
      endpointData.response_path || null,
      endpointData.timeout_ms || 10000,
      endpointData.max_retries || 3,
      endpointData.retry_delay_ms || 1000,
      endpointData.cache_key || null,
      endpointData.cache_ttl_seconds || null,
      endpointData.encrypt_cache ? 1 : 0,
      endpointData.response_validator || null,
      endpointData.allowed_domains ? JSON.stringify(endpointData.allowed_domains) : null,
      endpointData.require_https !== false ? 1 : 0,
      endpointData.log_level || 'info',
      now,
      now,
      endpointData.created_by || 'api',
      endpointData.tags ? JSON.stringify(endpointData.tags) : null,
      endpointData.ai_enabled ? 1 : 0,
      endpointData.endpoint_type || 'external_api',
      endpointData.sample_request ? JSON.stringify(endpointData.sample_request) : null,
      endpointData.sample_response ? (typeof endpointData.sample_response === 'string' ? endpointData.sample_response : JSON.stringify(endpointData.sample_response)) : null,
      // Calculate request_keys from sample_request if provided
      endpointData.sample_request ? JSON.stringify(extractKeysFromSampleRequest(JSON.stringify(endpointData.sample_request))) : null
    ];

    await db.prepare(sql).bind(...params).run();

    return c.json(successResponse({
      id,
      name: endpointData.name,
      message: 'Endpoint created successfully'
    }), 201);

  } catch (error: any) {
    console.error('Error creating endpoint:', error);
    
    // Check for unique constraint violation
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Endpoint with this name already exists' }, 409);
    }
    
    return c.json(errorResponse('Internal server error', 500));
  }
});

// 4️⃣ Update endpoint
crudApi.put('/endpoints/:name', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const name = c.req.param('name');
    const endpointData = await c.req.json();
    const now = Math.floor(Date.now() / 1000);

    // Check if endpoint exists
    const checkSql = 'SELECT id FROM endpoint_registry WHERE name = ?';
    const existing = await db.prepare(checkSql).bind(name).first();
    
    if (!existing) {
      return c.json(notFoundResponse('Endpoint not found'));
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    // Fields that can be updated
    const fields = [
      'description', 'url', 'method', 'auth_type', 'auth_value',
      'headers', 'body_template', 'query_params', 'response_path',
      'timeout_ms', 'max_retries', 'retry_delay_ms', 'cache_key',
      'cache_ttl_seconds', 'encrypt_cache', 'response_validator',
      'allowed_domains', 'require_https', 'log_level', 'tags',
      'ai_enabled', 'endpoint_type', 'sample_request', 'sample_response',
      'request_keys'
    ];

    fields.forEach(field => {
      if (field in endpointData) {
        let value = endpointData[field];
        
        // Handle JSON fields
        if (['headers', 'query_params', 'allowed_domains', 'tags', 'sample_request'].includes(field) && value) {
          value = JSON.stringify(value);
        }
        
        // Handle sample_response specially - don't double-stringify
        if (field === 'sample_response' && value) {
          if (typeof value !== 'string') {
            value = JSON.stringify(value);
          }
          // If it's already a string, keep it as is
        }
        
        // Handle boolean fields
        if (['encrypt_cache', 'require_https', 'ai_enabled'].includes(field)) {
          value = value ? 1 : 0;
        }
        
        // Handle method case
        if (field === 'method' && value) {
          value = value.toUpperCase();
        }
        
        updates.push(`${field} = ?`);
        params.push(value);
      }
    });
    
    // If sample_request is being updated, automatically calculate request_keys
    if ('sample_request' in endpointData) {
      const sampleRequestValue = endpointData.sample_request;
      const requestKeys = sampleRequestValue ? extractKeysFromSampleRequest(JSON.stringify(sampleRequestValue)) : [];
      
      // Add or update request_keys in the updates
      const requestKeysIndex = updates.findIndex(update => update.startsWith('request_keys ='));
      if (requestKeysIndex !== -1) {
        // Replace existing request_keys value
        params[requestKeysIndex] = JSON.stringify(requestKeys);
      } else {
        // Add new request_keys update
        updates.push('request_keys = ?');
        params.push(JSON.stringify(requestKeys));
      }
    }

    // Always update updated_at
    updates.push('updated_at = ?');
    params.push(now);

    if (updates.length === 1) { // Only updated_at was added
      return c.json({ error: 'No fields to update' }, 400);
    }

    const updateSql = `
      UPDATE endpoint_registry
      SET ${updates.join(', ')}
      WHERE name = ?
    `;

    params.push(name);

    await db.prepare(updateSql).bind(...params).run();

    return c.json(successResponse({
      name,
      message: 'Endpoint updated successfully'
    }));

  } catch (error) {
    console.error('Error updating endpoint:', error);
    return c.json(errorResponse('Internal server error', 500));
  }
});

// 5️⃣ Delete endpoint
crudApi.delete('/endpoints/:name', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const name = c.req.param('name');

    // Check if endpoint exists
    const checkSql = 'SELECT id FROM endpoint_registry WHERE name = ?';
    const existing = await db.prepare(checkSql).bind(name).first();
    
    if (!existing) {
      return c.json(notFoundResponse('Endpoint not found'));
    }

    const deleteSql = 'DELETE FROM endpoint_registry WHERE name = ?';
    await db.prepare(deleteSql).bind(name).run();

    return c.json(successResponse({
      name,
      message: 'Endpoint deleted successfully'
    }));

  } catch (error) {
    console.error('Error deleting endpoint:', error);
    return c.json(errorResponse('Internal server error', 500));
  }
});

// 6️⃣ Test endpoint and get available variables
crudApi.post('/endpoints/:name/test', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const name = c.req.param('name');
    const testParams = await c.req.json().catch(() => ({}));

    // Get endpoint configuration
    const endpointSql = `
      SELECT
        id, name, description, url, method, auth_type, auth_value,
        headers, body_template, query_params, response_path,
        timeout_ms, max_retries, retry_delay_ms, cache_key,
        cache_ttl_seconds, encrypt_cache, response_validator,
        allowed_domains, require_https, log_level,
        created_at, updated_at, created_by, tags
      FROM endpoint_registry
      WHERE name = ?
    `;

    const endpoint = await db.prepare(endpointSql).bind(name).first();

    if (!endpoint) {
      return c.json(notFoundResponse('Endpoint not found'));
    }

    // Use ApiCaller to test the endpoint
    const apiCaller = new ApiCaller(db);
    
    const result = await apiCaller.callEndpoint(
      name,
      {
        parameters: testParams
      },
      'input', // Test endpoints are considered 'input' type
      endpoint.method // Pass the actual HTTP method from the endpoint config
    );

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || 'Request failed',
        message: 'The test request failed to execute.',
        endpoint: {
          id: endpoint.id,
          name: endpoint.name
        },
        test: {
          parameters: testParams
        }
      }, 500);
    }

    // Parse JSON fields for response
    const headers = endpoint.headers ? JSON.parse(endpoint.headers) : {};
    const queryParams = endpoint.query_params ? JSON.parse(endpoint.query_params) : {};
    const allowedDomains = endpoint.allowed_domains ? JSON.parse(endpoint.allowed_domains) : [];
    const tags = endpoint.tags ? JSON.parse(endpoint.tags) : [];
    
    // Build authentication headers
    const authHeaders: Record<string, string> = {};
    if (endpoint.auth_type && endpoint.auth_value) {
      if (endpoint.auth_type === 'bearer') {
        authHeaders['Authorization'] = `Bearer ${endpoint.auth_value}`;
      } else if (endpoint.auth_type === 'basic') {
        authHeaders['Authorization'] = `Basic ${btoa(endpoint.auth_value)}`;
      } else if (endpoint.auth_type === 'api_key') {
        authHeaders['X-API-Key'] = endpoint.auth_value;
      }
    }
    
    // Prepare request body if needed
    let requestBody = null;
    if (endpoint.body_template && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)) {
      let bodyTemplate = endpoint.body_template;
      
      // Replace template variables in body
      const bodyVarRegex = /\{([^}]+)\}/g;
      let bodyMatch;
      while ((bodyMatch = bodyVarRegex.exec(bodyTemplate)) !== null) {
        const bodyVarName = bodyMatch[1];
        if (testParams[bodyVarName] !== undefined) {
          bodyTemplate = bodyTemplate.replace(`{${bodyVarName}}`, JSON.stringify(testParams[bodyVarName]));
        }
      }
      
      try {
        requestBody = JSON.parse(bodyTemplate);
      } catch (e) {
        requestBody = bodyTemplate;
      }
    }

    // Make the test request
    const startTime = Date.now();
    const url = endpoint.url;
    const fetchOptions: RequestInit = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...authHeaders
      }
    };

    if (requestBody) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    let response;
    let responseText;
    let responseJson;
    let statusCode;
    let responseTime;

    try {
      response = await fetch(url, fetchOptions);
      statusCode = response.status;
      responseText = await response.text();
      responseTime = Date.now() - startTime;
      
      // Try to parse as JSON
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {
        responseJson = null;
      }
    } catch (error: any) {
      return c.json({
        success: false,
        error: 'Request failed',
        message: error.message,
        url,
        method: endpoint.method,
        request_headers: authHeaders,
        request_body: requestBody
      }, 500);
    }

    // Extract variables based on response_path if specified
    let extractedVariables = {};
    if (endpoint.response_path && responseJson) {
      try {
        // Simple JSON path extraction (supports dot notation)
        const pathParts = endpoint.response_path.split('.');
        let current = responseJson;
        for (const part of pathParts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            current = null;
            break;
          }
        }
        
        if (current !== null) {
          extractedVariables = { [endpoint.response_path]: current };
        }
      } catch (e) {
        // Ignore extraction errors
      }
    }

    // Also extract top-level fields from JSON response
    if (responseJson && typeof responseJson === 'object') {
      Object.entries(responseJson).forEach(([key, value]) => {
        if (!extractedVariables[key]) {
          extractedVariables[key] = value;
        }
      });
    }

    return c.json({
      success: true,
      endpoint: {
        name: endpoint.name,
        description: endpoint.description,
        url: endpoint.url,
        method: endpoint.method,
        auth_type: endpoint.auth_type,
        endpoint_type: endpoint.endpoint_type,
        response_path: endpoint.response_path
      },
      test_request: {
        actual_url: url,
        method: endpoint.method,
        status_code: statusCode,
        response_time_ms: responseTime,
        request_headers: authHeaders,
        request_body: requestBody
      },
      response: {
        status: statusCode,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseJson || responseText,
        size_bytes: responseText.length
      },
      extracted_variables: extractedVariables,
      available_variables: Object.keys(extractedVariables),
      notes: [
        'Variables can be used in other endpoints using {variable_name} syntax.',
        'For nested values, use dot notation in response_path field.',
        'Authentication values starting with "env:" reference environment variables.'
      ]
    });

  } catch (error: any) {
    console.error('Error testing endpoint:', error);
    return c.json(errorResponse(`Error testing endpoint: ${error.message}`, 500));
  }
});

// ============================================
// AI Command Discovery Endpoint
// ============================================

// Get all AI-enabled commands
crudApi.get('/commands', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Get query parameters for filtering
    const tagFilter = c.req.query('tag');
    
    let query = `
      SELECT 
        name,
        description,
        method,
        url as endpoint,
        sample_request,
        tags
      FROM endpoint_registry 
    `;
    
    const params: any[] = [];
    
    if (tagFilter) {
      query += ' AND tags LIKE ?';
      params.push(`%${tagFilter}%`);
    }
    
    query += ' ORDER BY name';
    
    const result = await db.prepare(query).bind(...params).all();
    
    // Parse JSON fields
    const commands = result.results.map((cmd: any) => {
      // Helper function to parse JSON that might be double-stringified
      const parseJsonField = (field: string | null) => {
        if (!field) return null;
        try {
          // First try to parse as JSON
          return JSON.parse(field);
        } catch (e) {
          // If that fails, try to parse it as a string that might contain JSON
          try {
            // Remove surrounding quotes if present
            let cleaned = field.trim();
            if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
              cleaned = cleaned.slice(1, -1);
              // Unescape escaped quotes
              cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            return JSON.parse(cleaned);
          } catch (e2) {
            console.error('Failed to parse JSON field:', field, e2);
            return null;
          }
        }
      };

      return {
        name: cmd.name,
        description: cmd.description,
        method: cmd.method,
        endpoint: cmd.endpoint,
        parameters: parseJsonField(cmd.sample_request),
        parameter_keys: cmd.sample_request ? extractKeysFromSampleRequest(cmd.sample_request) : [],
        tags: cmd.tags ? parseJsonField(cmd.tags) : []
      };
    });
    
    return c.json(successResponse({
      commands,
      count: commands.length,
      note: 'Use [COMMAND:name] params: {JSON_parameters} format to execute commands. Test with POST /api/test-command/:name'
    }));
    
  } catch (error: any) {
    console.error('Error fetching AI commands:', error);
    return c.json(errorResponse(`Error fetching commands: ${error.message}`, 500));
  }
});

// Get specific command schema for AI function calling
crudApi.get('/commands/:name', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const name = c.req.param('name');
    
    const query = `
      SELECT 
        name,
        description,
        method,
        url as endpoint,
        sample_request,
        response_path,
        tags
      FROM endpoint_registry 
      WHERE name = ? 
    `;
    
    const result = await db.prepare(query).bind(name).first();
    
    if (!result) {
      return c.json(notFoundResponse(`AI command not found or not enabled: ${name}`));
    }
    
    // Helper function to parse JSON that might be double-stringified
    const parseJsonField = (field: string | null) => {
      if (!field) return null;
      try {
        // First try to parse as JSON
        return JSON.parse(field);
      } catch (e) {
        // If that fails, try to parse it as a string that might contain JSON
        try {
          // Remove surrounding quotes if present
          let cleaned = field.trim();
          if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
            // Unescape escaped quotes
            cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          return JSON.parse(cleaned);
        } catch (e2) {
          console.error('Failed to parse JSON field:', field, e2);
          return null;
        }
      }
    };

    // Parse JSON fields
    const command = {
      name: result.name,
      description: result.description,
      method: result.method,
      endpoint: result.endpoint,
      parameters: parseJsonField(result.sample_request),
      parameter_keys: result.sample_request ? extractKeysFromSampleRequest(result.sample_request) : [],
      response_path: result.response_path,
      tags: parseJsonField(result.tags)
    };
    
    return c.json(successResponse({
      ...command,
      note: 'Use [COMMAND:name] params: {JSON_parameters} format to execute commands. Test with POST /api/test-command/:name'
    }));
    
  } catch (error: any) {
    console.error('Error fetching command schema:', error);
    return c.json(errorResponse(`Error fetching command: ${error.message}`, 500));
  }
});

// Test command execution endpoint
crudApi.post('/test-command/:name', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ 
        error: 'Database not configured',
        success: false
      }, 200);
    }

    const name = c.req.param('name');
    const params = await c.req.json().catch(() => ({}));
    
    // Import and use CommandExecutor
    const { CommandExecutor } = await import('./services/commandExecutor');
    
    const commandExecutor = new CommandExecutor({
      env: c.env,
      db: db,
      baseUrl: 'https://deepseek-agent.alghamdimo89.workers.dev'
    });
    
    // Execute the command
    const result = await commandExecutor.executeCommand({
      name: name,
      params: params
    });
    
    return c.json({
      success: result.success,
      data: result.data,
      error: result.error,
      commandName: result.commandName,
      executionTime: result.executionTime,
      note: 'This is a test endpoint for executing commands. For production use, use the conversation endpoints.'
    });
    
  } catch (error: any) {
    console.error('Error testing command:', error);
    return c.json({ 
      error: `Error testing command: ${error.message}`,
      success: false
    }, 200);
  }
});

// ============================================
// Core Observability Endpoints
// ============================================

// 1️⃣ Health check endpoint
crudApi.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Cloudflare D1 CRUD API is running',
    timestamp: new Date().toISOString()
  });
});

// 2️⃣ List flow runs with filtering
crudApi.get('/flow-runs', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Get query parameters
    const status = c.req.query('status');
    const flowId = c.req.query('flow_id');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Build query with filters
    let whereClauses = [];
    let params = [];
    
    if (status) {
      whereClauses.push('fr.status = ?');
      params.push(status);
    }
    
    if (flowId) {
      whereClauses.push('fr.flow_id = ?');
      params.push(flowId);
    }
    
    const whereClause = whereClauses.length > 0 
      ? 'WHERE ' + whereClauses.join(' AND ')
      : '';
    
    const sql = `
      SELECT 
        fr.id,
        fr.flow_id,
        fr.status,
        fr.created_at,
        fr.completed_at,
        fr.output_response,
        COUNT(sr.id) as step_count,
        MAX(sr.created_at) as last_step_at
      FROM flow_runs fr
      LEFT JOIN step_runs sr ON fr.id = sr.flow_run_id
      ${whereClause}
      GROUP BY fr.id
      ORDER BY fr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    
    const result = await db.prepare(sql).bind(...params).all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// 3️⃣ Get flow run with conversation (replaces /conversation, /step-runs, /detailed)
crudApi.get('/flow-runs/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    
    // Get flow run details
    const flowRunResult = await db.prepare(
      'SELECT * FROM flow_runs WHERE id = ?'
    ).bind(id).first();
    
    if (!flowRunResult) {
      return c.json({ error: 'Flow run not found' }, 404);
    }
    
    // Get all step runs for this flow run, ordered by iteration and attempt
    const stepRunsResult = await db.prepare(
      `SELECT 
        id, step_id, iteration, attempt, 
        prompt, response, 
        input_payload, output_payload,
        status, created_at, duration_ms
       FROM step_runs 
       WHERE flow_run_id = ? 
       ORDER BY iteration, attempt, created_at`
    ).bind(id).all();
    
    return c.json({
      flow_run: flowRunResult,
      step_runs: stepRunsResult.results || [],
      total_steps: stepRunsResult.results?.length || 0
    });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// 4️⃣ Step runs only (with optional flow_run_id filter)
crudApi.get('/step-runs', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Get query parameters
    const flowRunId = c.req.query('flow_run_id');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    
    let sql = '';
    let params = [];
    
    if (flowRunId) {
      sql = `
        SELECT * FROM step_runs 
        WHERE flow_run_id = ? 
        ORDER BY iteration, attempt, created_at
        LIMIT ? OFFSET ?
      `;
      params = [flowRunId, limit, offset];
    } else {
      sql = `
        SELECT * FROM step_runs 
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }
    
    const result = await db.prepare(sql).bind(...params).all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// 5️⃣ All conversations (export) - flat dataset for analytics/CSV export
crudApi.get('/conversations', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Get query parameters
    const flowId = c.req.query('flow_id');
    const limit = parseInt(c.req.query('limit') || '1000');
    const offset = parseInt(c.req.query('offset') || '0');
    
    let whereClause = '';
    let params = [];
    
    if (flowId) {
      whereClause = 'WHERE fr.flow_id = ?';
      params.push(flowId);
    }
    
    const sql = `
      SELECT 
        fr.id as flow_run_id,
        fr.flow_id,
        fr.status as flow_status,
        fr.created_at as flow_created_at,
        fr.output_response as flow_output,
        sr.step_id,
        sr.iteration,
        sr.attempt,
        sr.prompt,
        sr.response,
        sr.status as step_status,
        sr.created_at as step_created_at
      FROM flow_runs fr
      INNER JOIN step_runs sr ON fr.id = sr.flow_run_id
      ${whereClause}
      ORDER BY fr.created_at DESC, sr.iteration, sr.attempt
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    
    const result = await db.prepare(sql).bind(...params).all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});
// Get all flow definitions
crudApi.get('/flow-definitions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const result = await db.prepare('SELECT * FROM flow_definitions ORDER BY priority DESC, created_at DESC').all();
    return c.json(result.results || []);
  } catch (error) {
    console.error('Error fetching flow definitions:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get flow definition by ID
crudApi.get('/flow-definitions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT * FROM flow_definitions WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Flow definition not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching flow definition:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new flow definition
crudApi.post('/flow-definitions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowDefinitionCreateSchema, body);
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { id, name, description, max_iterations, repository, branch, next_flow_id, priority, agent, system_message, memory_prompt, resume_step } = validatedData;
    
    // Generate ID if not provided
    const flowDefinitionId = id || `flow-def-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO flow_definitions (id, name, description, max_iterations, repository, branch, priority, agent, system_message, memory_prompt, resume_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      flowDefinitionId,
      name,
      dbValue(description),
      max_iterations || 20,
      repository,
      branch || 'main',
      priority || 0,
      agent,
      dbValue(system_message),
      dbValue(memory_prompt),
      dbValue(resume_step)
    ).run();
    
    return c.json(apiResponse(true, { id: flowDefinitionId, message: 'Flow definition created successfully' }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// Update flow definition
crudApi.put('/flow-definitions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowDefinitionUpdateSchema, { ...body, id });
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { name, description, max_iterations, repository, branch, next_flow_id, priority, agent, system_message, memory_prompt, resume_step } = validatedData;

    // Build dynamic SQL for partial updates
    const updates: string[] = [];
    const values: any[] = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(dbValue(description));
    }
    if (max_iterations !== undefined) {
      updates.push('max_iterations = ?');
      values.push(max_iterations);
    }
    if (repository !== undefined) {
      updates.push('repository = ?');
      values.push(repository);
    }
    if (branch !== undefined) {
      updates.push('branch = ?');
      values.push(branch);
    }
    // next_flow_id column removed from flow_definitions table
    // Step-level chaining uses flow_steps.next_flow_id instead
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (agent !== undefined) {
      updates.push('agent = ?');
      values.push(agent);
    }
    if (system_message !== undefined) {
      updates.push('system_message = ?');
      values.push(dbValue(system_message));
    }
    if (memory_prompt !== undefined) {
      updates.push('memory_prompt = ?');
      values.push(dbValue(memory_prompt));
    }
    if (resume_step !== undefined) {
      updates.push('resume_step = ?');
      values.push(dbValue(resume_step));
    }
    
    // Always update the updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updates.length === 1) { // Only updated_at was added
      return c.json(apiResponse(false, undefined, 'No fields to update', 400));
    }
    
    const sql = `UPDATE flow_definitions SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);
    
    const result = await db.prepare(sql).bind(...values).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Flow definition not found', 404));
    }

    return c.json(apiResponse(true, { id, message: 'Flow definition updated successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// Delete flow definition
crudApi.delete('/flow-definitions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    const id = c.req.param('id');
    
    const result = await db.prepare('DELETE FROM flow_definitions WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Flow definition not found', 404));
    }

    return c.json(apiResponse(true, { id, message: 'Flow definition deleted successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// Execute a step with optional user prompt (for chat mode)
crudApi.post('/execute-step', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    // Extract DeepSeek API key from headers or body
    const deepseekApiKeyFromHeader = c.req.header('X-DeepSeek-API-Key');
    
    const { flow_id, step_id, user_prompt, include_step_instructions = true, deepseek_api_key } = await c.req.json();
    
    // Use passed API key if available, otherwise use env variable
    const effectiveDeepSeekApiKey = deepseekApiKeyFromHeader || deepseek_api_key || c.env.DEEPSEEK_API_KEY;
    
    if (!user_prompt) {
      return c.json(errorResponse('user_prompt is required', 400));
    }

    let prompt = user_prompt;
    let stepInfo = null;

    // If step_id provided, fetch step instructions
    if (step_id) {
      if (!flow_id) {
        return c.json(errorResponse('flow_id is required when step_id is provided', 400));
      }
      
      const step = await db.prepare(
        'SELECT * FROM flow_steps WHERE id = ? AND flow_id = ?'
      ).bind(step_id, flow_id).first();

      if (!step) {
        return c.json(errorResponse('Step not found for this flow', 404));
      }

      stepInfo = {
        id: step.id,
        title: step.title,
        instructions: step.instructions,
        step_type: 'default',
        order_index: step.order_index
      };

      if (include_step_instructions && step.instructions) {
        // Format similar to handleSendingStepState: user prompt + step instructions
        prompt = `${user_prompt}\n\n=== STEP: ${step.title} ===\n${step.instructions}`;
      }
    }

    // Determine which agent to use
    let agent = 'deepseek'; // Default agent (changed from openhands)
    
    // Fetch flow definition to get agent field if flow_id is provided
    if (flow_id) {
      const flowDef = await db.prepare(
        'SELECT agent FROM flow_definitions WHERE id = ?'
      ).bind(flow_id).first();
      
      if (flowDef?.agent) {
        agent = flowDef.agent;
      }
    }
    
    console.log(`[execute-step] Using agent: ${agent} for flow: ${flow_id || 'none'}`);
    
    // Create execution context
    const context = createExecutionContext(flow_id || 'standalone', step_id || 'standalone')
    context.ai_input = prompt
    
    // Execute step using StepExecutor
    const executor = new StepExecutor(c.env, effectiveDeepSeekApiKey)
    
    const updatedContext = await executor.executeStep(
      context,
      stepInfo || { id: step_id || 'standalone' },
      agent
    )
    
    // Get the AI response from context
    const ai_response = updatedContext.ai_output?.response || ''
    
    // Map responses EXACTLY as specified
    let deepseek_response = null
    let openhands_response = null
    
    if (agent === 'deepseek') {
      deepseek_response = ai_response
    } else if (agent === 'openhands') {
      // For OpenHands, reconstruct the result object
      openhands_response = {
        success: true,
        conversationId: ai_response,
        message: 'OpenHands conversation created'
      }
    } else if (agent === 'both') {
      // For 'both': deepseek_response = null, openhands_response = ai_response
      deepseek_response = null
      openhands_response = {
        success: true,
        conversationId: ai_response,
        message: 'OpenHands conversation created'
      }
    }
    
    // Create final response data
    const responseData = {
      step: stepInfo,
      user_prompt,
      prompt_sent: prompt,
      agent_used: agent,
      deepseek_response,
      openhands_response,
      timestamp: new Date().toISOString(),
      ai_response: ai_response  // Add ai_response field
    };
    
    // Add persistence test tag at final point
    responseData.ai_response = "[PERSIST_TEST]" + responseData.ai_response;
    
    // Also update the mapped fields for consistency
    if (agent === 'deepseek' && responseData.deepseek_response) {
      responseData.deepseek_response = "[PERSIST_TEST]" + responseData.deepseek_response;
    } else if ((agent === 'openhands' || agent === 'both') && responseData.openhands_response) {
      responseData.openhands_response.conversationId = "[PERSIST_TEST]" + responseData.openhands_response.conversationId;
    }
    
    return c.json(successResponse(responseData));

  } catch (error) {
    console.error('Error executing step:', error);
    return c.json(errorResponse('Internal server error', 500));
  }
});

// Helper function to recalculate step order based on edges (topological sort)
async function recalculateStepOrder(db: any, flowId: string): Promise<void> {
  // Get all steps for this flow
  const stepsResult = await db.prepare('SELECT id FROM flow_steps WHERE flow_id = ? ORDER BY order_index').bind(flowId).all();
  const steps = stepsResult.results || [];
  
  // flow_edges table doesn't exist, use empty edges array
  const edges = [];
  console.log("flow_edges table doesn't exist, using empty edges array");
  
  // Build adjacency list
  const graph: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  
  // Initialize
  for (const step of steps) {
    graph[step.id] = [];
    inDegree[step.id] = 0;
  }
  
  // Build graph
  for (const edge of edges) {
    if (graph[edge.source_step_id] && graph[edge.target_step_id]) {
      graph[edge.source_step_id].push(edge.target_step_id);
      inDegree[edge.target_step_id]++;
    }
  }
  
  // Find nodes with no incoming edges (sources)
  const queue: string[] = [];
  for (const step of steps) {
    if (inDegree[step.id] === 0) {
      queue.push(step.id);
    }
  }
  
  // Topological sort
  const sortedSteps: string[] = [];
  let orderIndex = 0;
  const updateStatements = [];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    sortedSteps.push(current);
    
    // Update order_index in database (collect for batch execution)
    updateStatements.push(db.prepare('UPDATE flow_steps SET order_index = ? WHERE id = ?').bind(orderIndex, current));
    orderIndex++;
    
    // Decrease in-degree of neighbors
    for (const neighbor of graph[current] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }
  
  // Handle cycles or disconnected nodes (assign high order_index)
  for (const step of steps) {
    if (!sortedSteps.includes(step.id)) {
      updateStatements.push(db.prepare('UPDATE flow_steps SET order_index = ? WHERE id = ?').bind(orderIndex + 1000, step.id));
      orderIndex++;
    }
  }
  
  // Execute all updates in a batch
  if (updateStatements.length > 0) {
    await db.batch(updateStatements);
  }
}

// Bulk update flow steps and edges (for FlowReact)
crudApi.put('/flows/:flowId/steps', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const flowId = c.req.param('flowId');
    console.log("ENTER SAVE HANDLER", flowId);
    const body = await c.req.json();
    
    // Transform frontend data to match backend schema
    const transformedBody = {
      ...body,
      flow_id: flowId,
      edges: body.edges?.map((edge: any) => ({
        ...edge,
        flow_id: flowId, // Add flow_id from URL param
        // Convert condition object to string if needed
        condition: typeof edge.condition === 'object' && edge.condition !== null 
          ? JSON.stringify(edge.condition) 
          : edge.condition,
        // Convert route object to string if needed
        route: typeof edge.route === 'object' && edge.route !== null
          ? JSON.stringify(edge.route)
          : edge.route,
        // Map 'type' to 'edge_type' if needed
        edge_type: edge.edge_type || (edge.type === 'default' ? 'next' : edge.type) || 'next'
      })) || []
    };
    
    // Validate with Zod
    const validation = validateSchema(flowStepsUpdatePayloadSchema, transformedBody);
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    const { steps, edges, deleted_step_ids = [], deleted_edge_ids = [] } = validatedData;
    
    // Log for debugging
    console.log("DELETING STEPS", deleted_step_ids);
    console.log("DELETING EDGES", deleted_edge_ids);
    console.log("REMAINING STEPS COUNT", steps.length);
    console.log("NEW EDGES COUNT", edges.length);
    
    // Collect all statements for batch execution
    const statements = [];
    // Track which statements are step deletions (critical operations)
    const stepDeletionStatements = new Set();
    
    // CRITICAL FIX: Delete ALL related data first to avoid foreign key constraints
    // This must happen before deleting steps
    // Note: Some tables might not exist in some databases
    // Check if tables exist before trying to delete
    
    // flow_edges table doesn't exist, skip edge deletion
    console.log("flow_edges table doesn't exist, skipping edge deletion");
    
    // 2. Delete from flow_step_conditions if table exists (we fixed the schema, but check anyway)
    // Note: flow_step_conditions table doesn't have flow_id column, so we can't delete by flow_id directly
    // Conditions will be deleted for specific steps in the deleted_step_ids section below
    try {
      db.prepare('SELECT 1 FROM flow_step_conditions LIMIT 1');
      console.log("flow_step_conditions table exists, conditions will be deleted for specific steps below");
    } catch (error) {
      const errorMessage = error.message || '';
      if (errorMessage.includes('no such table: flow_step_conditions')) {
        console.log("flow_step_conditions table doesn't exist, no conditions to delete");
      } else {
        throw error;
      }
    }
    
    // Delete related data for deleted steps BEFORE deleting the steps themselves
    // This avoids foreign key constraint issues
    if (deleted_step_ids.length > 0) {
      // Delete from flow_step_conditions for deleted steps
      try {
        db.prepare('SELECT 1 FROM flow_step_conditions LIMIT 1');
        const placeholders = deleted_step_ids.map(() => '?').join(',');
        // Try both columns: step_id (old) and flow_step_id (new)
        statements.push(db.prepare(`DELETE FROM flow_step_conditions WHERE step_id IN (${placeholders}) OR flow_step_id IN (${placeholders})`).bind(...deleted_step_ids, ...deleted_step_ids));
        console.log("Deleting flow_step_conditions for", deleted_step_ids.length, "steps");
      } catch (error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('no such table: flow_step_conditions')) {
          console.log("flow_step_conditions table doesn't exist, no conditions to delete");
        } else if (errorMessage.includes('no such column: flow_step_id') || errorMessage.includes('no such column: step_id')) {
          console.log("flow_step_conditions table exists but has different schema, trying alternative deletion");
          // Try deleting by step_id only (older schema)
          try {
            const placeholders = deleted_step_ids.map(() => '?').join(',');
            statements.push(db.prepare(`DELETE FROM flow_step_conditions WHERE step_id IN (${placeholders})`).bind(...deleted_step_ids));
            console.log("Deleting flow_step_conditions using step_id column");
          } catch (innerError) {
            console.log("Could not delete flow_step_conditions, skipping");
          }
        } else {
          throw error;
        }
      }
      

    }
    
    // 1. Delete orphaned steps (edges already deleted, so no foreign key issues)
    if (deleted_step_ids.length > 0) {
      const placeholders = deleted_step_ids.map(() => '?').join(',');
      const deleteStatement = db.prepare(`DELETE FROM flow_steps WHERE id IN (${placeholders})`).bind(...deleted_step_ids);
      statements.push(deleteStatement);
      stepDeletionStatements.add(deleteStatement);
    }
    
    // Note: deleted_edge_ids is not needed since we delete all edges above
    // Edges will be recreated from the edges array later
    
    // First, check which steps already exist
    const stepIds = steps.filter(step => step.id).map(step => step.id);
    let existingStepIds: string[] = [];
    
    console.log("Checking existing steps from IDs:", stepIds);
    
    if (stepIds.length > 0) {
      const placeholders = stepIds.map(() => '?').join(',');
      const existingStepsResult = await db.prepare(`SELECT id FROM flow_steps WHERE id IN (${placeholders})`).bind(...stepIds).all();
      existingStepIds = (existingStepsResult.results || []).map((row: any) => row.id);
      console.log("Found existing step IDs:", existingStepIds);
    }
    
    // 3. Update existing steps and create new ones
    for (const step of steps) {
      if (step.id) {
        if (existingStepIds.includes(step.id)) {
          // Update existing step
          const updates: string[] = [];
          const bindings: any[] = [];
          
          if (step.flow_id !== undefined) {
            updates.push('flow_id = ?');
            bindings.push(step.flow_id);
          }
          if (step.step_key !== undefined) {
            updates.push('step_key = ?');
            bindings.push(step.step_key);
          }
          if (step.title !== undefined) {
            updates.push('title = ?');
            bindings.push(step.title);
          }
          if (step.instructions !== undefined) {
            updates.push('instructions = ?');
            bindings.push(step.instructions);
          }
          // step_type removed - not needed for current implementation
          if (step.order_index !== undefined) {
            updates.push('order_index = ?');
            bindings.push(step.order_index);
          }
          if (step.page_key !== undefined) {
            updates.push('page_key = ?');
            bindings.push(dbValue(step.page_key));
          }
          if (step.blocking !== undefined) {
            updates.push('blocking = ?');
            bindings.push(getBoolean(step.blocking, true));
          }
          if (step.auto_fail_on_error !== undefined) {
            updates.push('auto_fail_on_error = ?');
            bindings.push(getBoolean(step.auto_fail_on_error, true));
          }
          if (step.retryable !== undefined) {
            updates.push('retryable = ?');
            bindings.push(getBoolean(step.retryable, false));
          }
          if (step.task_id !== undefined) {
            updates.push('task_id = ?');
            bindings.push(dbValue(step.task_id));
          }
          if (step.output_url !== undefined) {
            updates.push('output_url = ?');
            bindings.push(dbValue(step.output_url));
          }
          if (step.output_payload_template !== undefined) {
            updates.push('output_payload_template = ?');
            bindings.push(dbValue(step.output_payload_template));
          }
          if (step.default_next_step !== undefined) {
            updates.push('default_next_step = ?');
            bindings.push(dbValue(step.default_next_step));
          }
          if (step.output_auth_token !== undefined) {
            updates.push('output_auth_token = ?');
            bindings.push(dbValue(step.output_auth_token));
          }
          if (step.output !== undefined) {
            updates.push('output = ?');
            bindings.push(getBoolean(step.output, false));
          }
          if (step.requires_task !== undefined) {
            updates.push('requires_task = ?');
            bindings.push(getBoolean(step.requires_task, false));
          }
          
          // New fields (only those that exist in the database)
          if (step.use_endpoints !== undefined) {
            updates.push('use_endpoints = ?');
            bindings.push(dbValue(step.use_endpoints));
          }
          
          // Always update updated_at
          updates.push('updated_at = CURRENT_TIMESTAMP');
          
          if (updates.length > 1) { // More than just updated_at
            const sql = `UPDATE flow_steps SET ${updates.join(', ')} WHERE id = ?`;
            bindings.push(step.id);
            statements.push(db.prepare(sql).bind(...bindings.map(normalizeForDb)));
          }
        } else {
          // Create new step
          const stepId = step.id;
          const sql = `
            INSERT INTO flow_steps (
              id, flow_id, step_key, title, instructions, order_index,
              page_key, blocking, auto_fail_on_error, retryable, task_id,
              requires_task, output_url, output_payload_template, default_next_step,
              output_auth_token, output, next_flow_id,
              use_endpoints, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;

          const bindings = [
            stepId,
            step.flow_id || flowId,
            step.step_key || `step-${Date.now()}`,
            step.title || 'Untitled Step',
            step.instructions || '',
            step.order_index || 0,
            dbValue(step.page_key),
            getBoolean(step.blocking, true),
            getBoolean(step.auto_fail_on_error, true),
            getBoolean(step.retryable, false),
            dbValue(step.task_id),
            getBoolean(step.requires_task, false),
            dbValue(step.output_url),
            dbValue(step.output_payload_template),
            dbValue(step.default_next_step),
            dbValue(step.output_auth_token),
            getBoolean(step.output, false),
            dbValue(step.next_flow_id),
            dbValue(step.use_endpoints)
          ];
          
          statements.push(db.prepare(sql).bind(...bindings.map(normalizeForDb)));
        }
      }
    }
    
    // 4. Skip edge insertion - flow_edges table doesn't exist
    console.log("Skipping edge insertion - flow_edges table doesn't exist");
    
    // 5. Recalculate order_index based on edges (topological sort)
    // Note: recalculateStepOrder needs to be modified to return statements instead of executing them
    // For now, we'll execute it separately after the batch
    // We need to modify recalculateStepOrder or handle it differently
    
    try {
      // Execute statements individually to handle missing tables gracefully
      let stepDeletionFailed = false;
      let stepDeletionError = null;
      
      for (const statement of statements) {
        try {
          await statement.run();
        } catch (error) {
          const errorMessage = error.message || '';
          
          // Check if this is a step deletion statement
          const isStepDeletion = stepDeletionStatements.has(statement);
          
          // Check if error is due to missing flow_edges table
          if (errorMessage.includes('no such table: flow_edges')) {
            console.log("flow_edges table doesn't exist, skipping edge operations");
            // Continue without this statement
            continue;
          }
          // Check if error is due to missing flows table (foreign key constraint)
          else if (errorMessage.includes('no such table: main.flows') || errorMessage.includes('no such table: flows')) {
            console.log("flows table doesn't exist, foreign key constraint error");
            
            if (isStepDeletion) {
              // Step deletion failed due to foreign key constraint
              stepDeletionFailed = true;
              stepDeletionError = error;
              console.error("CRITICAL: Step deletion failed due to foreign key constraint:", errorMessage);
              // Try an alternative approach: delete steps one by one with individual transactions
              // This might work if the constraint is per-row
              console.log("Attempting alternative deletion approach...");
              
              // Don't continue the loop - we'll handle this after
              break;
            } else {
              // For non-step-deletion statements, we can skip
              continue;
            }
          }
          // Re-throw other errors
          else {
            throw error;
          }
        }
      }
      
      // If step deletion failed, try alternative approach
      if (stepDeletionFailed && deleted_step_ids.length > 0) {
        console.log("Trying alternative step deletion approach...");
        let successfullyDeleted = 0;
        
        for (const stepId of deleted_step_ids) {
          try {
            // Try to delete step individually
            await db.prepare('DELETE FROM flow_steps WHERE id = ?').bind(stepId).run();
            successfullyDeleted++;
            console.log(`Successfully deleted step ${stepId}`);
          } catch (individualError) {
            const errorMessage = individualError.message || '';
            console.error(`Failed to delete step ${stepId}:`, errorMessage);
          }
        }
        
        if (successfullyDeleted < deleted_step_ids.length) {
          console.error(`Only deleted ${successfullyDeleted} out of ${deleted_step_ids.length} steps`);
          // We'll continue and let verification handle reporting the error
        }
      }
      
      // Execute recalculateStepOrder separately (it does its own database operations)
      await recalculateStepOrder(db, flowId);
      
      // Verify that steps were actually deleted
      if (deleted_step_ids.length > 0) {
        const placeholders = deleted_step_ids.map(() => '?').join(',');
        const checkResult = await db.prepare(`SELECT COUNT(*) as count FROM flow_steps WHERE id IN (${placeholders})`).bind(...deleted_step_ids).first();
        const stillExist = checkResult?.count || 0;
        
        if (stillExist > 0) {
          console.error(`Failed to delete ${stillExist} steps. They still exist in the database.`);
          // We should throw an error or at least report this
          return c.json(errorResponse(`Failed to delete ${stillExist} steps. Foreign key constraint may be preventing deletion.`, 500));
        }
      }
      
      return c.json(successResponse({ 
        message: 'Flow steps and edges updated successfully',
        steps_updated: steps.length,
        edges_updated: edges.length,
        steps_deleted: deleted_step_ids.length,
        edges_deleted: edges.length, // All edges are recreated, so count of new edges
        verified_deletion: deleted_step_ids.length > 0 // Indicate we verified deletion
      }));
      
    } catch (error) {
      throw error;
    }
    
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});



// Unified query endpoint for flows, steps, runs, and variables
crudApi.post('/query', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const body = await c.req.json();
    const { flow_id, flow_run_id, step_id, type = 'full', sort_by = 'step_order', order = 'asc' } = body;

    // Validate parameters
    if (!flow_id && !flow_run_id && !step_id && type !== 'full') {
      return c.json({ error: 'At least one filter parameter (flow_id, flow_run_id, step_id) is required when type is not "full"' }, 400);
    }

    // Build base queries based on type
    let flowQuery = '';
    let stepsQuery = '';
    let stepRunsQuery = '';
    let variablesQuery = '';
    let flowExecutionDataQuery = '';
    let params = [];

    // Get flow definition
    if (flow_id) {
      flowQuery = 'SELECT * FROM flow_definitions WHERE id = ?';
      params.push(flow_id);
    } else if (flow_run_id) {
      flowQuery = `
        SELECT fd.* FROM flow_definitions fd
        INNER JOIN flow_runs fr ON fd.id = fr.flow_id
        WHERE fr.id = ?
      `;
      params.push(flow_run_id);
    } else if (step_id) {
      flowQuery = `
        SELECT fd.* FROM flow_definitions fd
        INNER JOIN flow_steps fs ON fd.id = fs.flow_id
        WHERE fs.id = ?
      `;
      params.push(step_id);
    }

    // Get flow steps with ordering
    let stepsWhereClause = '';
    let stepsParams = [];
    
    if (flow_id) {
      stepsWhereClause = 'WHERE flow_id = ?';
      stepsParams.push(flow_id);
    } else if (flow_run_id) {
      stepsWhereClause = `
        WHERE flow_id = (
          SELECT flow_id FROM flow_runs WHERE id = ?
        )
      `;
      stepsParams.push(flow_run_id);
    } else if (step_id) {
      stepsWhereClause = 'WHERE id = ?';
      stepsParams.push(step_id);
    }

    // Determine sort order for steps
    const stepOrderField = sort_by === 'step_order' ? 'COALESCE(step_number, order_index)' : 'created_at';
    const stepOrderDirection = order === 'asc' ? 'ASC' : 'DESC';
    
    stepsQuery = `
      SELECT * FROM flow_steps
      ${stepsWhereClause}
      ORDER BY ${stepOrderField} ${stepOrderDirection}
    `;

    // Get step runs
    let stepRunsWhereClause = '';
    let stepRunsParams = [];
    
    if (flow_run_id) {
      stepRunsWhereClause = 'WHERE flow_run_id = ?';
      stepRunsParams.push(flow_run_id);
    } else if (step_id) {
      stepRunsWhereClause = 'WHERE step_id = ?';
      stepRunsParams.push(step_id);
    } else if (flow_id) {
      stepRunsWhereClause = `
        WHERE flow_run_id IN (
          SELECT id FROM flow_runs WHERE flow_id = ?
        )
      `;
      stepRunsParams.push(flow_id);
    }

    // Add limit for step_id queries to prevent huge responses
    const stepRunsLimit = step_id ? 'LIMIT 50' : '';
    
    stepRunsQuery = `
      SELECT * FROM step_runs
      ${stepRunsWhereClause}
      ORDER BY iteration ${order === 'asc' ? 'ASC' : 'DESC'}, attempt ${order === 'asc' ? 'ASC' : 'DESC'}
      ${stepRunsLimit}
    `;

    // Get variables from variables table (legacy - table is empty)
    let variablesWhereClause = '';
    let variablesParams = [];
    
    if (step_id) {
      variablesWhereClause = 'WHERE step_id = ?';
      variablesParams.push(step_id);
    } else if (flow_id) {
      variablesWhereClause = 'WHERE flow_id = ?';
      variablesParams.push(flow_id);
    }

    variablesQuery = `
      SELECT * FROM variables
      ${variablesWhereClause}
      ORDER BY created_at ${order === 'asc' ? 'ASC' : 'DESC'}
    `;

    // Get flow execution data (actual variable storage)
    let flowExecutionDataWhereClause = '';
    let flowExecutionDataParams = [];
    
    if (flow_run_id) {
      // Direct query by flow_run_id (once column is added)
      flowExecutionDataWhereClause = 'WHERE flow_run_id = ?';
      flowExecutionDataParams.push(flow_run_id);
    } else if (flow_id) {
      flowExecutionDataWhereClause = 'WHERE flow_id = ?';
      flowExecutionDataParams.push(flow_id);
    }

    flowExecutionDataQuery = `
      SELECT * FROM flow_execution_data
      ${flowExecutionDataWhereClause}
      ORDER BY created_at ${order === 'asc' ? 'ASC' : 'DESC'}
    `;

    // Execute all queries
    const [flowResult, stepsResult, stepRunsResult, variablesResult, flowExecutionDataResult] = await Promise.all([
      flowQuery ? db.prepare(flowQuery).bind(...params).first() : Promise.resolve(null),
      stepsQuery ? db.prepare(stepsQuery).bind(...stepsParams).all() : Promise.resolve({ results: [] }),
      stepRunsQuery ? db.prepare(stepRunsQuery).bind(...stepRunsParams).all() : Promise.resolve({ results: [] }),
      variablesQuery ? db.prepare(variablesQuery).bind(...variablesParams).all() : Promise.resolve({ results: [] }),
      flowExecutionDataQuery ? db.prepare(flowExecutionDataQuery).bind(...flowExecutionDataParams).all() : Promise.resolve({ results: [] })
    ]);

    // Get flow run data if flow_run_id is provided
    let flowRunData = null;
    if (flow_run_id) {
      flowRunData = await db.prepare('SELECT * FROM flow_runs WHERE id = ?').bind(flow_run_id).first();
    }

    // Organize variables by type
    const organizedVariables = {
      input: {},
      ai: {},
      step: {},
      flow: {}
    };

    // Process input variables from flow_runs
    if (flowRunData?.input_payload) {
      try {
        const inputPayload = JSON.parse(flowRunData.input_payload);
        organizedVariables.input = inputPayload;
      } catch (e) {
        organizedVariables.input = { raw: flowRunData.input_payload };
      }
    } else if (flowRunData?.input_prompt) {
      try {
        const inputPrompt = JSON.parse(flowRunData.input_prompt);
        organizedVariables.input = inputPrompt;
      } catch (e) {
        organizedVariables.input = { raw: flowRunData.input_prompt };
      }
    }

    // Process AI output variables from step_runs
    stepRunsResult.results.forEach((stepRun: any) => {
      if (stepRun.response) {
        const stepKey = `step_${stepRun.step_id}_iteration_${stepRun.iteration}_attempt_${stepRun.attempt}`;
        organizedVariables.ai[stepKey] = stepRun.response;
      }
    });

    // Process step output variables from step_runs
    stepRunsResult.results.forEach((stepRun: any) => {
      if (stepRun.output_payload) {
        try {
          const outputPayload = JSON.parse(stepRun.output_payload);
          const stepKey = `step_${stepRun.step_id}_output`;
          organizedVariables.step[stepKey] = outputPayload;
        } catch (e) {
          const stepKey = `step_${stepRun.step_id}_output_raw`;
          organizedVariables.step[stepKey] = stepRun.output_payload;
        }
      }
    });

    // Process variables from variables table
    variablesResult.results.forEach((variable: any) => {
      try {
        const value = JSON.parse(variable.value);
        organizedVariables.flow[variable.key] = value;
      } catch (e) {
        organizedVariables.flow[variable.key] = variable.value;
      }
    });

    // Process flow execution data
    flowExecutionDataResult.results.forEach((data: any) => {
      organizedVariables.flow[data.key] = data.value;
    });

    // Build response based on type
    let response: any = {};
    
    if (type === 'full' || type === 'flow') {
      response.flow = flowResult || null;
    }
    
    if (type === 'full' || type === 'step') {
      response.steps = stepsResult.results || [];
    }
    
    if (type === 'full' || type === 'run') {
      response.step_runs = stepRunsResult.results || [];
    }
    
    if (type === 'full' || type === 'variable') {
      response.variables = organizedVariables;
    }

    // For backward compatibility, always include flow_run if flow_run_id is provided
    if (flow_run_id) {
      response.flow_run = flowRunData;
    }

    return c.json(response);

  } catch (error) {
    console.error('Query endpoint error:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Variable retrieval endpoint for condition evaluation
crudApi.get('/variables', async (c) => {
  try {
    const { flow_id, flow_run_id, step_id, step_run_id, key, source, variable_type } = c.req.query();
    const db = c.env.FLOW_RUNS_DB;
    
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    let sql = 'SELECT * FROM variables WHERE 1=1';
    const bindings: any[] = [];

    if (flow_id) {
      sql += ' AND flow_id = ?';
      bindings.push(flow_id);
    }
    if (flow_run_id) {
      sql += ' AND flow_run_id = ?';
      bindings.push(flow_run_id);
    }
    if (step_id) {
      sql += ' AND step_id = ?';
      bindings.push(step_id);
    }
    if (step_run_id) {
      sql += ' AND step_run_id = ?';
      bindings.push(step_run_id);
    }
    if (key) {
      sql += ' AND key = ?';
      bindings.push(key);
    }
    if (source) {
      sql += ' AND source = ?';
      bindings.push(source);
    }
    if (variable_type) {
      sql += ' AND variable_type = ?';
      bindings.push(variable_type);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.prepare(sql).bind(...bindings).all();
    
    // Parse JSON values
    const variables = result.results.map((v: any) => {
      try {
        return {
          ...v,
          value: v.value ? JSON.parse(v.value) : null
        };
      } catch (e) {
        return v;
      }
    });

    return c.json({
      success: true,
      count: variables.length,
      variables
    });

  } catch (error: any) {
    console.error('Variables endpoint error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, 500);
  }
});

// Advanced variable query endpoint with dot notation support
crudApi.get('/variables/query', async (c) => {
  try {
    const { 
      flow_id, 
      flow_run_id, 
      step_id, 
      step_run_id, 
      key, 
      source, 
      variable_type,
      key_pattern,
      value_contains,
      created_after,
      created_before,
      limit = '100',
      offset = '0'
    } = c.req.query();
    
    const db = c.env.FLOW_RUNS_DB;
    
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    let sql = 'SELECT * FROM variables WHERE 1=1';
    const bindings: any[] = [];

    if (flow_id) {
      sql += ' AND flow_id = ?';
      bindings.push(flow_id);
    }
    if (flow_run_id) {
      sql += ' AND flow_run_id = ?';
      bindings.push(flow_run_id);
    }
    if (step_id) {
      sql += ' AND step_id = ?';
      bindings.push(step_id);
    }
    if (step_run_id) {
      sql += ' AND step_run_id = ?';
      bindings.push(step_run_id);
    }
    if (key) {
      sql += ' AND key = ?';
      bindings.push(key);
    }
    if (source) {
      sql += ' AND source = ?';
      bindings.push(source);
    }
    if (variable_type) {
      sql += ' AND variable_type = ?';
      bindings.push(variable_type);
    }
    if (key_pattern) {
      sql += ' AND key LIKE ?';
      bindings.push(`%${key_pattern}%`);
    }
    if (created_after) {
      sql += ' AND created_at >= ?';
      bindings.push(parseInt(created_after));
    }
    if (created_before) {
      sql += ' AND created_at <= ?';
      bindings.push(parseInt(created_before));
    }

    sql += ' ORDER BY created_at DESC';
    sql += ' LIMIT ? OFFSET ?';
    bindings.push(parseInt(limit), parseInt(offset));

    const result = await db.prepare(sql).bind(...bindings).all();
    
    // Parse JSON values and filter by value_contains if specified
    const variables = result.results.map((v: any) => {
      try {
        const parsedValue = v.value ? JSON.parse(v.value) : null;
        return {
          ...v,
          value: parsedValue
        };
      } catch (e) {
        return v;
      }
    }).filter((v: any) => {
      // Filter by value_contains if specified
      if (value_contains && v.value) {
        const valueStr = typeof v.value === 'object' 
          ? JSON.stringify(v.value).toLowerCase()
          : String(v.value).toLowerCase();
        return valueStr.includes(value_contains.toLowerCase());
      }
      return true;
    });

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM variables WHERE 1=1';
    const countBindings: any[] = [];
    
    // Rebuild conditions for count query
    const conditions = [
      { condition: flow_id, sql: ' AND flow_id = ?', value: flow_id },
      { condition: flow_run_id, sql: ' AND flow_run_id = ?', value: flow_run_id },
      { condition: step_id, sql: ' AND step_id = ?', value: step_id },
      { condition: step_run_id, sql: ' AND step_run_id = ?', value: step_run_id },
      { condition: key, sql: ' AND key = ?', value: key },
      { condition: source, sql: ' AND source = ?', value: source },
      { condition: variable_type, sql: ' AND variable_type = ?', value: variable_type },
      { condition: key_pattern, sql: ' AND key LIKE ?', value: key_pattern ? `%${key_pattern}%` : null },
      { condition: created_after, sql: ' AND created_at >= ?', value: created_after ? parseInt(created_after) : null },
      { condition: created_before, sql: ' AND created_at <= ?', value: created_before ? parseInt(created_before) : null }
    ];
    
    for (const cond of conditions) {
      if (cond.condition) {
        countSql += cond.sql;
        countBindings.push(cond.value);
      }
    }
    
    const countResult = await db.prepare(countSql).bind(...countBindings).first();
    const total = countResult ? (countResult as any).total : 0;

    return c.json({
      success: true,
      count: variables.length,
      total,
      page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
      total_pages: Math.ceil(total / parseInt(limit)),
      variables
    });

  } catch (error: any) {
    console.error('Variables query endpoint error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, 500);
  }
});

// Variable creation endpoint
crudApi.post('/variables', async (c) => {
  try {
    const body = await c.req.json();
    const db = c.env.FLOW_RUNS_DB;
    
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Validate input
    const validation = validateSchema(variableCreateSchema, body);
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }

    const variable = validation.data;
    
    // Generate ID if not provided
    const id = variable.id || generateId();
    
    // Use the saveVariable function
    const result = await saveVariable(db, {
      id,
      flow_id: variable.flow_id,
      flow_run_id: variable.flow_run_id || null,
      step_id: variable.step_id || null,
      step_run_id: variable.step_run_id || null,
      key: variable.key,
      value: variable.value,
      source: variable.source || 'api',
      variable_type: variable.source === 'user' ? 'user_input' : 'system'
    });

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error || 'Failed to save variable' 
      }, 500);
    }

    // If variable is user-created and requires input, create a step
    if (variable.source === 'user' && !variable.value) {
      // Create a step to collect user input
      const stepId = `step-input-${id}`;
      const stepTitle = `Input for variable: ${variable.key}`;
      const stepInstructions = `Please provide value for variable: ${variable.key}`;
      
      await db.prepare(`
        INSERT INTO flow_steps (id, flow_id, step_key, title, instructions, order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 
          (SELECT COALESCE(MAX(order_index), -1) + 1 FROM flow_steps WHERE flow_id = ?), 
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        stepId,
        variable.flow_id,
        `input-${variable.key}`,
        stepTitle,
        stepInstructions,
        variable.flow_id
      ).run();
      
      // Return both variable and step info
      return c.json({
        success: true,
        variable: { ...variable, id, value: variable.value },
        requires_input: true,
        input_step_id: stepId,
        message: 'Variable created. User input required via step.'
      }, 201);
    }

    return c.json({
      success: true,
      variable: { ...variable, id, value: variable.value },
      requires_input: false
    }, 201);

  } catch (error: any) {
    console.error('Variable creation error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, 500);
  }
});

// Update variable with user input (when step completes)
crudApi.put('/variables/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = c.env.FLOW_RUNS_DB;
    
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Validate input
    const validation = validateSchema(variableUpdateSchema, { ...body, id });
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }

    const updates = validation.data;
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const bindings: any[] = [];
    
    if (updates.value !== undefined) {
      updateFields.push('value = ?');
      bindings.push(JSON.stringify(updates.value));
    }
    if (updates.source !== undefined) {
      updateFields.push('source = ?');
      bindings.push(updates.source);
    }
    if (updates.flow_run_id !== undefined) {
      updateFields.push('flow_run_id = ?');
      bindings.push(updates.flow_run_id);
    }
    if (updates.step_id !== undefined) {
      updateFields.push('step_id = ?');
      bindings.push(updates.step_id);
    }
    if (updates.step_run_id !== undefined) {
      updateFields.push('step_run_id = ?');
      bindings.push(updates.step_run_id);
    }
    
    if (updateFields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }
    
    bindings.push(id);
    
    const result = await db.prepare(`
      UPDATE variables 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...bindings).run();

    return c.json({
      success: true,
      updated: result.meta.changes > 0,
      message: 'Variable updated successfully'
    });

  } catch (error: any) {
    console.error('Variable update error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, 500);
  }
});

// New endpoint for resolving variables with ƐĐᜃ syntax
crudApi.get('/resolve', async (c) => {
  try {
    const { tag, flow_id, flow_run_id, step_id, step_run_id } = c.req.query();
    const db = c.env.FLOW_RUNS_DB;
    
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }
    
    if (!tag) {
      return c.json({ 
        success: false, 
        error: 'Missing required parameter: tag' 
      }, 400);
    }
    
    // Import the variable resolver
    const { parseVariableSpec, resolveVariable } = await import('./utils/variableResolver');
    
    // Parse the variable specification
    const spec = parseVariableSpec(tag);
    
    // Resolve the variable
    const value = await resolveVariable(db, spec, {
      flow_id,
      flow_run_id,
      step_id,
      step_run_id
    });
    
    return c.json({
      success: true,
      tag,
      spec,
      value,
      resolved: value !== ''
    });
    
  } catch (error: any) {
    console.error('Resolve endpoint error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, 500);
  }
});

// Endpoint to resolve multiple variables in text
crudApi.post('/resolve/text', async (c) => {
  try {
    const { text, flow_id, flow_run_id, step_id, step_run_id, table } = await c.req.json();
    const db = c.env.FLOW_RUNS_DB;
    
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }
    
    if (!text) {
      return c.json({ 
        success: false, 
        error: 'Missing required parameter: text' 
      }, 400);
    }
    
    // Import the variable resolver
    const { resolveTextVariables, extractVariableTags } = await import('./utils/variableResolver');
    
    // Extract all variable tags
    const tagObjects = extractVariableTags(text);
    const tags = tagObjects.map(obj => obj.tag);
    
    // Resolve the text with optional table parameter
    const resolvedText = await resolveTextVariables(db, text, {
      flow_id,
      flow_run_id,
      step_id,
      step_run_id,
      table
    });
    
    return c.json({
      success: true,
      original_text: text,
      resolved_text: resolvedText,
      tags_found: tags.length,
      tags: tagObjects.map(obj => ({
        tag: obj.tag,
        variable_name: obj.variableName,
        query_params: obj.queryParams,
        spec: obj.tag ? obj.tag.replace(/ƐĐᜃ/g, '') : ''
      }))
    });
    
  } catch (error: any) {
    console.error('Resolve text endpoint error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, 500);
  }
});

// Simple query endpoint: Get last value from table column
crudApi.get('/query', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const table = c.req.query('table');
    const column = c.req.query('column');
    const jsonPath = c.req.query('json_path'); // Optional: for JSON columns like api_calls
    
    if (!table || !column) {
      return c.json({ 
        success: false, 
        error: 'Missing required parameters: table and column' 
      }, 400);
    }

    let sql = `SELECT ${column} FROM ${table} ORDER BY created_at DESC LIMIT 1`;
    let result: any;
    
    try {
      result = await db.prepare(sql).first();
      
      if (!result) {
        return c.json({ 
          success: true, 
          value: null,
          message: 'No rows found in table' 
        });
      }

      let value = result[column];
      
      // If json_path provided and value is JSON string, extract nested value
      if (jsonPath && value && typeof value === 'string') {
        try {
          const jsonValue = JSON.parse(value);
          // Simple dot notation path extraction
          const pathParts = jsonPath.split('.');
          let current = jsonValue;
          for (const part of pathParts) {
            if (current && typeof current === 'object' && part in current) {
              current = current[part];
            } else {
              current = undefined;
              break;
            }
          }
          value = current;
        } catch (e) {
          // Not valid JSON, keep original value
        }
      }

      return c.json({ 
        success: true, 
        value,
        table,
        column,
        json_path: jsonPath || null
      });
      
    } catch (dbError: any) {
      return c.json({ 
        success: false, 
        error: 'Database query error',
        details: dbError.message 
      }, 500);
    }

  } catch (error: any) {
    console.error('Query endpoint error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error', 
      details: error.message 
    }, 500);
  }
});
