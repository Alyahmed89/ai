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
  flowStepConditionCreateSchema,
  flowStepConditionUpdateSchema,
  flowConditionCreateSchema,
  flowConditionUpdateSchema,
  flowEdgeCreateSchema,
  flowEdgeUpdateSchema,
  flowStepsUpdatePayloadSchema,
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
        output_keys, output_url, output_payload_template, default_next_step,
        output_auth_token, input_keys, output, next_flow_id, created_at, updated_at
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
      dbValue(validatedData.output_keys),
      dbValue(validatedData.output_url),
      dbValue(validatedData.output_payload_template),
      dbValue(validatedData.default_next_step),
      dbValue(validatedData.output_auth_token),
      dbValue(validatedData.input_keys),
      getBoolean(validatedData.output, false),
      dbValue(validatedData.next_flow_id)
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
    const { 
      flow_id, step_key, title, instructions, order_index,
      page_key, blocking, auto_fail_on_error, retryable, task_id,
      output_keys, output_url, output_payload_template, default_next_step,
      output_auth_token, input_keys, output, next_flow_id
    } = validatedData;

    const sql = `
      UPDATE flow_steps SET 
        flow_id = ?, step_key = ?, title = ?, instructions = ?, order_index = ?,
        page_key = ?, blocking = ?, auto_fail_on_error = ?, retryable = ?, task_id = ?,
        output_keys = ?, output_url = ?, output_payload_template = ?, default_next_step = ?,
        output_auth_token = ?, input_keys = ?, output = ?, next_flow_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(
      flow_id,
      step_key,
      title,
      instructions,
      order_index,
      dbValue(page_key),
      getBoolean(blocking, true),
      getBoolean(auto_fail_on_error, true),
      getBoolean(retryable, false),
      dbValue(task_id),
      dbValue(output_keys),
      dbValue(output_url),
      dbValue(output_payload_template),
      dbValue(default_next_step),
      dbValue(output_auth_token),
      dbValue(input_keys),
      getBoolean(output, false),
      dbValue(next_flow_id),
      id
    ).run();

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
    // Check if the error is due to missing flows table (foreign key constraint)
    const errorMessage = error.message || '';
    if (errorMessage.includes('no such table: main.flows') || errorMessage.includes('no such table: flows')) {
      // Try workaround: create dummy flows table, delete step, then drop dummy table
      try {
        const db = c.env.FLOW_RUNS_DB;
        const id = c.req.param('id');
        
        // Create dummy flows table if it doesn't exist
        await db.prepare('CREATE TABLE IF NOT EXISTS flows (id TEXT PRIMARY KEY)').run();
        
        // Delete step
        const result = await db.prepare('DELETE FROM flow_steps WHERE id = ?').bind(id).run();
        
        // Drop dummy flows table
        await db.prepare('DROP TABLE IF EXISTS flows').run();
        
        if (result.meta.changes === 0) {
          return c.json(notFoundResponse('Flow step not found'));
        }

        return c.json(successResponse({ message: 'Flow step deleted successfully (using workaround)' }));
      } catch (innerError) {
        return c.json(errorResponse(`Cannot delete step due to database schema issue. Foreign key constraint references non-existent flows table. Error: ${innerError.message}`, 500));
      }
    }
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Get flow step input schema
crudApi.get('/flow-steps/:id/input', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT input_keys FROM flow_steps WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Flow step not found' }, 404);
    }

    // Parse input_keys JSON if it exists
    let input_schema = null;
    let input_validation_rules = null;
    
    if (result.input_keys) {
      try {
        const inputKeys = JSON.parse(result.input_keys);
        // Use input_keys as input_schema for compatibility
        input_schema = inputKeys;
        // Create basic validation rules based on input_keys structure
        input_validation_rules = {
          required: Array.isArray(inputKeys) ? inputKeys.map((item: any) => item.key) : [],
          types: {}
        };
      } catch (e) {
        // If input_keys is not valid JSON, return it as-is
        input_schema = result.input_keys;
        input_validation_rules = { required: [], types: {} };
      }
    }

    return c.json({ 
      input_schema, 
      input_validation_rules 
    });
  } catch (error) {
    console.error('Error fetching flow step input:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update flow step input schema
crudApi.put('/flow-steps/:id/input', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const stepId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate that input_keys is provided
    if (!body.input_keys) {
      return c.json(errorResponse('input_keys is required', 400));
    }
    
    // Check if step exists
    const existing = await db.prepare('SELECT id FROM flow_steps WHERE id = ?').bind(stepId).first();
    if (!existing) {
      return c.json(errorResponse('Flow step not found', 404));
    }
    
    // Convert input_keys to JSON string if it's an object/array
    const inputKeys = typeof body.input_keys === 'string' ? body.input_keys : JSON.stringify(body.input_keys);
    
    await db.prepare('UPDATE flow_steps SET input_keys = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(inputKeys, stepId)
      .run();
    
    return c.json(successResponse({ 
      message: 'Flow step input schema updated successfully' 
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Get flow step output schema
crudApi.get('/flow-steps/:id/output', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT output_keys, output_url, output_payload_template, output_auth_token, output FROM flow_steps WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Flow step not found' }, 404);
    }

    // Parse output_keys JSON if it exists
    let output_schema = null;
    if (result.output_keys) {
      try {
        output_schema = JSON.parse(result.output_keys);
      } catch (e) {
        // If output_keys is not valid JSON, return it as-is
        output_schema = result.output_keys;
      }
    }

    return c.json({ 
      output_schema,
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
    
    // Prepare update fields
    const updates: { [key: string]: any } = {};
    const params: any[] = [];
    
    if (body.output_keys !== undefined) {
      updates.output_keys = typeof body.output_keys === 'string' ? body.output_keys : JSON.stringify(body.output_keys);
      params.push(updates.output_keys);
    }
    
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
    const conditions = await db.prepare(
      'SELECT * FROM flow_step_conditions WHERE flow_step_id = ? ORDER BY id'
    ).bind(id).all();

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
        next_step, next_step_id, next_flow_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      conditionId,
      flow_step_id,
      condition_type,
      condition_value,
      condition_operator || 'equals',
      dbValue(finalNextStep),
      dbValue(finalNextStepId),
      dbValue(next_flow_id)
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
        next_step_id = COALESCE(?, next_step_id),
        next_flow_id = COALESCE(?, next_flow_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.prepare(sql).bind(
      dbValue(flow_step_id),
      dbValue(condition_type),
      dbValue(condition_value),
      dbValue(condition_operator),
      dbValue(finalNextStep),
      dbValue(finalNextStepId),
      dbValue(next_flow_id),
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

// Get all flow conditions
crudApi.get('/flow-conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before querying

    const result = await db.prepare('SELECT * FROM flow_conditions ORDER BY flow_id, step_id').all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get specific flow condition
crudApi.get('/flow-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const conditionId = c.req.param('id');
    const result = await db.prepare('SELECT * FROM flow_conditions WHERE id = ?').bind(conditionId).first();
    
    if (!result) {
      return c.json({ error: 'Flow condition not found' }, 404);
    }
    
    return c.json(result);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Create flow condition
crudApi.post('/flow-conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowConditionCreateSchema, body);
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    const { 
      id, flow_id, step_id, condition_type, condition_engine,
      condition_key, condition_value, condition_query, next_flow_id
    } = validatedData;
    
    // Generate ID if not provided
    const conditionId = id || `flow-cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO flow_conditions (
        id, flow_id, step_id, condition_type, condition_engine,
        condition_key, condition_value, condition_query, next_flow_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      conditionId,
      flow_id,
      step_id,
      condition_type,
      condition_engine || 'static',
      dbValue(condition_key),
      dbValue(condition_value),
      dbValue(condition_query),
      dbValue(next_flow_id)
    ).run();
    
    return c.json(successResponse({ 
      message: 'Flow condition created successfully', 
      id: conditionId 
    }, 201));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Update flow condition
crudApi.put('/flow-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const conditionId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowConditionUpdateSchema, { ...body, id: conditionId });
    if (!validation.success) {
      return c.json(validationErrorResponse(validation.error));
    }
    
    const validatedData = validation.data!;
    const { 
      flow_id, step_id, condition_type, condition_engine,
      condition_key, condition_value, condition_query, next_flow_id
    } = validatedData;
    
    // Check if condition exists
    const existing = await db.prepare('SELECT id FROM flow_conditions WHERE id = ?').bind(conditionId).first();
    if (!existing) {
      return c.json(errorResponse('Flow condition not found', 404));
    }
    
    const sql = `
      UPDATE flow_conditions SET
        flow_id = COALESCE(?, flow_id),
        step_id = COALESCE(?, step_id),
        condition_type = COALESCE(?, condition_type),
        condition_engine = COALESCE(?, condition_engine),
        condition_key = COALESCE(?, condition_key),
        condition_value = COALESCE(?, condition_value),
        condition_query = COALESCE(?, condition_query),
        next_flow_id = COALESCE(?, next_flow_id)
      WHERE id = ?
    `;

    await db.prepare(sql).bind(
      dbValue(flow_id),
      dbValue(step_id),
      dbValue(condition_type),
      dbValue(condition_engine),
      dbValue(condition_key),
      dbValue(condition_value),
      dbValue(condition_query),
      dbValue(next_flow_id),
      conditionId
    ).run();
    
    return c.json(successResponse({ 
      message: 'Flow condition updated successfully', 
      id: conditionId 
    }));
  } catch (error) {
    return c.json(errorResponse(handleDbError(error).error, 500));
  }
});

// Delete flow condition
crudApi.delete('/flow-conditions/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(errorResponse('Database not configured', 500));
    }

    const conditionId = c.req.param('id');
    
    // Check if condition exists
    const existing = await db.prepare('SELECT id FROM flow_conditions WHERE id = ?').bind(conditionId).first();
    if (!existing) {
      return c.json(errorResponse('Flow condition not found', 404));
    }
    
    await db.prepare('DELETE FROM flow_conditions WHERE id = ?').bind(conditionId).run();
    
    return c.json(successResponse({ 
      message: 'Flow condition deleted successfully' 
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
        sample_response, ai_enabled, endpoint_type, parameter_schema
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
        sample_response, ai_enabled, endpoint_type, parameter_schema
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
    
    // Extract keys from sample response
    let availableKeys: string[] = [];
    let parsedSampleResponse: any = null;
    
    if (endpoint.sample_response) {
      console.log("Sample response:", endpoint.sample_response);
      availableKeys = extractKeysFromSampleResponse(endpoint.sample_response);
      console.log("Extracted keys:", availableKeys);
      
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
      availableKeys = ["id", "name", "description", "method", "url"];
    }
    
    // Return endpoint info with extracted keys
    const response = {
      id: endpoint.id,
      name: endpoint.name,
      description: endpoint.description,
      method: endpoint.method,
      url: endpoint.url,
      available_keys: availableKeys,
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
        sample_response, ai_enabled, endpoint_type, parameter_schema
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
        ai_enabled, endpoint_type, parameter_schema, sample_response
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?
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
      endpointData.parameter_schema ? JSON.stringify(endpointData.parameter_schema) : null,
      endpointData.sample_response ? (typeof endpointData.sample_response === 'string' ? endpointData.sample_response : JSON.stringify(endpointData.sample_response)) : null
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
      'ai_enabled', 'endpoint_type', 'parameter_schema', 'sample_response'
    ];

    fields.forEach(field => {
      if (field in endpointData) {
        let value = endpointData[field];
        
        // Handle JSON fields
        if (['headers', 'query_params', 'allowed_domains', 'tags', 'parameter_schema'].includes(field) && value) {
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

    // Parse JSON fields
    const headers = endpoint.headers ? JSON.parse(endpoint.headers) : {};
    const queryParams = endpoint.query_params ? JSON.parse(endpoint.query_params) : {};
    const allowedDomains = endpoint.allowed_domains ? JSON.parse(endpoint.allowed_domains) : [];
    const tags = endpoint.tags ? JSON.parse(endpoint.tags) : [];

    // Build the actual URL with template variables
    let url = endpoint.url;
    
    // Replace URL template variables with test parameters
    const urlVariableRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = urlVariableRegex.exec(url)) !== null) {
      const varName = match[1];
      if (testParams[varName]) {
        url = url.replace(`{${varName}}`, encodeURIComponent(testParams[varName]));
      } else {
        // If variable not provided, return error
        return c.json({
          success: false,
          error: `Missing required URL parameter: ${varName}`,
          message: `The endpoint URL requires the parameter '${varName}' which was not provided in test parameters.`,
          required_parameters: [varName],
          example_test_parameters: { [varName]: "example_value" }
        }, 400);
      }
    }

    // Add query parameters
    if (Object.keys(queryParams).length > 0) {
      const urlObj = new URL(url);
      Object.entries(queryParams).forEach(([key, value]) => {
        // Replace template variables in query param values
        let paramValue = String(value);
        const paramVarRegex = /\{([^}]+)\}/g;
        let paramMatch;
        while ((paramMatch = paramVarRegex.exec(paramValue)) !== null) {
          const paramVarName = paramMatch[1];
          if (testParams[paramVarName]) {
            paramValue = paramValue.replace(`{${paramVarName}}`, testParams[paramVarName]);
          }
        }
        urlObj.searchParams.append(key, paramValue);
      });
      url = urlObj.toString();
    }

    // Handle authentication
    let authHeaders = { ...headers };
    if (endpoint.auth_type !== 'none' && endpoint.auth_value) {
      let authValue = endpoint.auth_value;
      
      // Check if auth value is an environment variable reference
      if (authValue.startsWith('env:')) {
        const envVarName = authValue.substring(4);
        authValue = c.env[envVarName] || '';
        
        if (!authValue) {
          return c.json({
            success: false,
            error: `Environment variable not found: ${envVarName}`,
            message: `The authentication requires environment variable '${envVarName}' which is not set.`,
            note: 'Environment variables are not available in test mode for security reasons.'
          }, 400);
        }
      }
      
      switch (endpoint.auth_type) {
        case 'bearer':
          authHeaders['Authorization'] = `Bearer ${authValue}`;
          break;
        case 'basic':
          // btoa is available in Cloudflare Workers environment
          authHeaders['Authorization'] = `Basic ${btoa(authValue)}`;
          break;
        case 'api_key':
          // API key can be in header or query param - default to header
          authHeaders['X-API-Key'] = authValue;
          break;
        case 'custom':
          // Custom auth - assume it's already in the headers
          break;
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
    const fetchOptions: RequestInit = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
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
        parameter_schema,
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
    const commands = result.results.map((cmd: any) => ({
      name: cmd.name,
      description: cmd.description,
      method: cmd.method,
      endpoint: cmd.endpoint,
      parameters: cmd.parameter_schema ? JSON.parse(cmd.parameter_schema) : null,
      tags: cmd.tags ? JSON.parse(cmd.tags) : []
    }));
    
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
        parameter_schema,
        response_path,
        tags
      FROM endpoint_registry 
      WHERE name = ? 
    `;
    
    const result = await db.prepare(query).bind(name).first();
    
    if (!result) {
      return c.json(notFoundResponse(`AI command not found or not enabled: ${name}`));
    }
    
    // Parse JSON fields
    const command = {
      name: result.name,
      description: result.description,
      method: result.method,
      endpoint: result.endpoint,
      parameters: result.parameter_schema ? JSON.parse(result.parameter_schema) : null,
      response_path: result.response_path,
      tags: result.tags ? JSON.parse(result.tags) : []
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
    const { id, name, description, max_iterations, repository, branch, next_flow_id, priority, agent } = validatedData;
    
    // Generate ID if not provided
    const flowDefinitionId = id || `flow-def-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO flow_definitions (id, name, description, max_iterations, repository, branch, priority, agent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      flowDefinitionId,
      name,
      dbValue(description),
      max_iterations || 20,
      repository,
      branch || 'main',
      priority || 0,
      agent
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
    const { name, description, max_iterations, repository, branch, next_flow_id, priority, agent } = validatedData;

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

    const { flow_id, step_id, user_prompt, include_step_instructions = true } = await c.req.json();
    
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
    const executor = new StepExecutor(c.env)
    
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
  
  // Get all edges for this flow
  let edges = [];
  try {
    const edgesResult = await db.prepare('SELECT source_step_id, target_step_id FROM flow_edges WHERE flow_id = ? AND edge_type = ?').bind(flowId, 'next').all();
    edges = edgesResult.results || [];
  } catch (error) {
    // If flow_edges table doesn't exist, just use empty edges array
    const errorMessage = error.message || '';
    if (errorMessage.includes('no such table: flow_edges')) {
      console.log("flow_edges table doesn't exist, using empty edges array");
      edges = [];
    } else {
      throw error;
    }
  }
  
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
    
    // 1. Delete from flow_edges if table exists
    try {
      db.prepare('SELECT 1 FROM flow_edges LIMIT 1');
      statements.push(db.prepare('DELETE FROM flow_edges WHERE flow_id = ?').bind(flowId));
      console.log("flow_edges table exists, will delete edges for flow", flowId);
    } catch (error) {
      const errorMessage = error.message || '';
      if (errorMessage.includes('no such table: flow_edges')) {
        console.log("flow_edges table doesn't exist, no edges to delete");
      } else {
        throw error;
      }
    }
    
    // 2. Delete from flow_conditions if table exists (we fixed the schema, but check anyway)
    try {
      db.prepare('SELECT 1 FROM flow_conditions LIMIT 1');
      statements.push(db.prepare('DELETE FROM flow_conditions WHERE flow_id = ?').bind(flowId));
      console.log("flow_conditions table exists, will delete conditions for flow", flowId);
    } catch (error) {
      const errorMessage = error.message || '';
      if (errorMessage.includes('no such table: flow_conditions')) {
        console.log("flow_conditions table doesn't exist, no conditions to delete");
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
        statements.push(db.prepare(`DELETE FROM flow_step_conditions WHERE flow_step_id IN (${placeholders})`).bind(...deleted_step_ids));
        console.log("Deleting flow_step_conditions for", deleted_step_ids.length, "steps");
      } catch (error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('no such table: flow_step_conditions')) {
          console.log("flow_step_conditions table doesn't exist, no conditions to delete");
        } else {
          throw error;
        }
      }
      
      // Delete from flow_step_tags for deleted steps
      try {
        db.prepare('SELECT 1 FROM flow_step_tags LIMIT 1');
        const placeholders = deleted_step_ids.map(() => '?').join(',');
        statements.push(db.prepare(`DELETE FROM flow_step_tags WHERE step_id IN (${placeholders})`).bind(...deleted_step_ids));
        console.log("Deleting flow_step_tags for", deleted_step_ids.length, "steps");
      } catch (error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('no such table: flow_step_tags')) {
          console.log("flow_step_tags table doesn't exist, no tags to delete");
        } else {
          throw error;
        }
      }
    }
    
    // 1. Delete orphaned steps (edges already deleted, so no foreign key issues)
    if (deleted_step_ids.length > 0) {
      const placeholders = deleted_step_ids.map(() => '?').join(',');
      try {
        const deleteStatement = db.prepare(`DELETE FROM flow_steps WHERE id IN (${placeholders})`).bind(...deleted_step_ids);
        statements.push(deleteStatement);
        stepDeletionStatements.add(deleteStatement);
      } catch (error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('no such table: main.flows') || errorMessage.includes('no such table: flows')) {
          console.log("flows table doesn't exist, foreign key constraint error when preparing DELETE statement");
          console.log("Using workaround: create dummy flows table, delete steps, then drop dummy table");
          
          // Workaround: create dummy flows table, insert the flow ID, delete steps, then drop dummy table
          try {
            // Create dummy flows table if it doesn't exist
            statements.push(
              db.prepare("CREATE TABLE IF NOT EXISTS flows (id TEXT PRIMARY KEY)")
            );
            
            // Insert the flow ID into the dummy table to satisfy foreign key constraint
            // Use INSERT OR IGNORE in case the flow ID already exists (from previous attempt)
            statements.push(
              db.prepare("INSERT OR IGNORE INTO flows (id) VALUES (?)").bind(flowId)
            );
            
            // Delete steps
            const deleteStatement = db.prepare(`DELETE FROM flow_steps WHERE id IN (${placeholders})`).bind(...deleted_step_ids);
            statements.push(deleteStatement);
            stepDeletionStatements.add(deleteStatement);
            
            // Drop dummy flows table
            statements.push(
              db.prepare("DROP TABLE IF EXISTS flows")
            );
            
            console.log("Using dummy flows table workaround for foreign key constraint");
          } catch (innerError) {
            console.log("Dummy flows table workaround also failed:", innerError.message);
            // If this also fails, we can't delete the steps
            // We'll continue without deleting them
          }
        } else {
          throw error;
        }
      }
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
          if (step.output_keys !== undefined) {
            updates.push('output_keys = ?');
            bindings.push(dbValue(step.output_keys));
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
          if (step.input_keys !== undefined) {
            updates.push('input_keys = ?');
            bindings.push(dbValue(step.input_keys));
          }
          if (step.output !== undefined) {
            updates.push('output = ?');
            bindings.push(getBoolean(step.output, false));
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
              output_keys, output_url, output_payload_template, default_next_step,
              output_auth_token, input_keys, output, next_flow_id, created_at, updated_at
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
            dbValue(step.output_keys),
            dbValue(step.output_url),
            dbValue(step.output_payload_template),
            dbValue(step.default_next_step),
            dbValue(step.output_auth_token),
            dbValue(step.input_keys),
            getBoolean(step.output, false),
            dbValue(step.next_flow_id)
          ];
          
          statements.push(db.prepare(sql).bind(...bindings.map(normalizeForDb)));
        }
      }
    }
    
    // 4. Insert new edges (all old edges were already deleted at the beginning)
    // Only insert edges if flow_edges table exists
    if (edges.length > 0) {
      for (const edge of edges) {
        const edgeId = edge.id || `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const sql = `
          INSERT INTO flow_edges (
            id, flow_id, source_step_id, target_step_id, edge_type,
            condition, route, weight, metadata, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        // Data is already transformed before validation
        // Use the transformed values directly
        const edgeType = edge.edge_type || 'next';
        const conditionValue = dbValue(edge.condition);
        const routeValue = dbValue(edge.route);

        const bindings = [
          edgeId,
          flowId, // flow_id from URL param
          edge.source_step_id,
          edge.target_step_id,
          edgeType,
          conditionValue,
          routeValue,
          edge.weight || 1.0,
          dbValue(edge.metadata)
        ];
        
        try {
          statements.push(db.prepare(sql).bind(...bindings.map(normalizeForDb)));
        } catch (error) {
          const errorMessage = error.message || '';
          if (errorMessage.includes('no such table: flow_edges')) {
            console.log("flow_edges table doesn't exist, skipping edge insertion");
            break; // Stop trying to insert edges
          } else {
            throw error;
          }
        }
      }
    }
    
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
            
            // If it's a foreign key constraint error, try the dummy table approach directly
            if (errorMessage.includes('no such table: main.flows') || errorMessage.includes('no such table: flows')) {
              try {
                // Create dummy flows table
                await db.prepare("CREATE TABLE IF NOT EXISTS flows (id TEXT PRIMARY KEY)").run();
                // Insert flow ID
                await db.prepare("INSERT OR IGNORE INTO flows (id) VALUES (?)").bind(flowId).run();
                // Delete step
                await db.prepare('DELETE FROM flow_steps WHERE id = ?').bind(stepId).run();
                // Drop dummy table
                await db.prepare("DROP TABLE IF EXISTS flows").run();
                successfullyDeleted++;
                console.log(`Successfully deleted step ${stepId} using direct dummy table approach`);
              } catch (dummyError) {
                console.error(`Even dummy table approach failed for step ${stepId}:`, dummyError.message);
              }
            }
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
    const { flow_id, flow_run_id, step_id, step_run_id, key, source } = c.req.query();
    const db = c.env.FLOW_RUNS_DB;

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
