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
  validateSchema 
} from './schemas';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse
} from './response';

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
        id, flow_id, step_key, title, instructions, step_type, order_index,
        page_key, blocking, auto_fail_on_error, retryable, task_id,
        output_keys, output_url, output_payload_template, default_next_step,
        output_auth_token, input_keys, output, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    // Log bindings for debugging
    const bindings = [
      stepId,
      validatedData.flow_id,
      validatedData.step_key,
      validatedData.title,
      validatedData.instructions,
      validatedData.step_type,
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
      getBoolean(validatedData.output, false)
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
      flow_id, step_key, title, instructions, step_type, order_index,
      page_key, blocking, auto_fail_on_error, retryable, task_id,
      output_keys, output_url, output_payload_template, default_next_step,
      output_auth_token, input_keys, output
    } = validatedData;

    const sql = `
      UPDATE flow_steps SET 
        flow_id = ?, step_key = ?, title = ?, instructions = ?, step_type = ?, order_index = ?,
        page_key = ?, blocking = ?, auto_fail_on_error = ?, retryable = ?, task_id = ?,
        output_keys = ?, output_url = ?, output_payload_template = ?, default_next_step = ?,
        output_auth_token = ?, input_keys = ?, output = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(
      flow_id,
      step_key,
      title,
      instructions,
      step_type,
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
    const result = await db.prepare('DELETE FROM flow_steps WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json(notFoundResponse('Flow step not found'));
    }

    return c.json(successResponse({ message: 'Flow step deleted successfully' }));
  } catch (error) {
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
    const { id, flow_id, status, started_at, completed_at } = body;
    const created_at = Math.floor(Date.now() / 1000);

    // Generate ID if not provided
    const flowRunId = id || `flow-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO flow_runs (id, flow_id, status, started_at, completed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(flowRunId, flow_id, status || 'running', started_at, completed_at, created_at).run();
    
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

    const sql = `
      UPDATE flow_runs 
      SET status = ?, completed_at = ?
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(status, completed_at, id).run();

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
        created_at, updated_at, created_by, tags
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
        created_at, updated_at, created_by, tags
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

// 3️⃣ Introspect endpoint - extract available keys from sample response
crudApi.get('/endpoints/introspect', async (c) => {
  try {
    console.log("INTROSPECT HIT - Route is deployed");
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      console.log("ERROR: Database not configured");
      return c.json({ error: 'Database not configured' }, 500);
    }

    const endpointId = c.req.query('endpoint_id');
    console.log("INTROSPECT PARAM RAW:", endpointId, "type:", typeof endpointId);
    if (!endpointId) {
      console.log("ERROR: endpoint_id query parameter is required");
      return c.json({ error: 'endpoint_id query parameter is required' }, 400);
    }
    
    const trimmedId = endpointId.trim();
    console.log("INTROSPECT PARAM TRIMMED:", trimmedId, "length:", trimmedId.length);

    // STEP 1 & 2: HARDCODED TEST + STRING MATCH ANALYSIS
    console.log("STEP 1 & 2: Testing queries and analyzing string matches");
    console.log("trimmedId:", JSON.stringify(trimmedId), "length:", trimmedId.length);
    
    let endpoint;
    try {
      // STEP 7: Verify DB instance and count
      console.log("STEP 7: Verifying DB instance and count");
      console.log("DB INSTANCE:", c.env.FLOW_RUNS_DB ? "EXISTS" : "NULL");
      
      const countSql = `SELECT COUNT(*) as total FROM endpoint_registry`;
      console.log("Test 0 - Count SQL:", countSql);
      const countResult = await db.prepare(countSql).first();
      console.log("Test 0 - Total endpoints in DB:", countResult?.total || 0);
      
      // Test 1: Hardcoded query
      const hardcodedSql = `SELECT * FROM endpoint_registry WHERE id = 'endpoint_001'`;
      console.log("Test 1 - Hardcoded SQL:", hardcodedSql);
      const hardcodedResult = await db.prepare(hardcodedSql).first();
      console.log("Test 1 - Hardcoded result:", hardcodedResult ? "FOUND" : "NOT FOUND");
      
      if (hardcodedResult) {
        endpoint = hardcodedResult;
        console.log("STEP 1 RESULT: Hardcoded query WORKS - Parameter binding is the issue");
      } else {
        console.log("STEP 1 RESULT: Hardcoded query also fails - Different issue");
        
        // STEP 2: Analyze string matches - check for hidden characters
        console.log("STEP 2: Analyzing string matches in database");
        const analyzeSql = `SELECT id, LENGTH(id) as len, HEX(id) as hex FROM endpoint_registry`;
        console.log("Test 2 - Analyze SQL:", analyzeSql);
        const analyzeResults = await db.prepare(analyzeSql).all();
        console.log("Test 2 - Analyze results count:", analyzeResults.results?.length || 0);
        if (analyzeResults.results) {
          for (const row of analyzeResults.results) {
            console.log(`  ID: "${row.id}", Length: ${row.len}, Hex: ${row.hex}`);
          }
        }
        
        // Test 3: Original parameter binding for comparison
        const paramSql = `SELECT * FROM endpoint_registry WHERE id = ?`;
        console.log("Test 3 - Parameter SQL:", paramSql, "with param:", trimmedId);
        const paramResult = await db.prepare(paramSql).bind(trimmedId).first();
        console.log("Test 3 - Parameter result:", paramResult ? "FOUND" : "NOT FOUND");
        
        if (!paramResult) {
          // Test 4: Try with name instead of id
          const nameSql = `SELECT * FROM endpoint_registry WHERE name = ?`;
          console.log("Test 4 - Name SQL:", nameSql, "with param:", trimmedId);
          const nameResult = await db.prepare(nameSql).bind(trimmedId).first();
          console.log("Test 4 - Name result:", nameResult ? "FOUND" : "NOT FOUND");
          
          if (!nameResult) {
            // STEP 3: Force trim match with TRIM() function
            console.log("STEP 3: Testing TRIM() function match");
            const trimSql = `SELECT * FROM endpoint_registry WHERE TRIM(id) = TRIM(?)`;
            console.log("Test 5 - TRIM SQL:", trimSql, "with param:", trimmedId);
            const trimResult = await db.prepare(trimSql).bind(trimmedId).first();
            console.log("Test 5 - TRIM result:", trimResult ? "FOUND" : "NOT FOUND");
            
            if (!trimResult) {
              // STEP 4: Test CAST to TEXT
              console.log("STEP 4: Testing CAST to TEXT");
              const castSql = `SELECT * FROM endpoint_registry WHERE CAST(id AS TEXT) = ?`;
              console.log("Test 6 - CAST SQL:", castSql, "with param:", trimmedId);
              const castResult = await db.prepare(castSql).bind(trimmedId).first();
              console.log("Test 6 - CAST result:", castResult ? "FOUND" : "NOT FOUND");
              
              if (!castResult) {
                // STEP 5: Test LIKE operator (IMPORTANT)
                console.log("STEP 5: Testing LIKE operator");
                const likeSql = `SELECT * FROM endpoint_registry WHERE id LIKE ?`;
                console.log("Test 7 - LIKE SQL:", likeSql, "with param:", trimmedId);
                const likeResult = await db.prepare(likeSql).bind(trimmedId).first();
                console.log("Test 7 - LIKE result:", likeResult ? "FOUND" : "NOT FOUND");
                
                if (!likeResult) {
                  // STEP 6: Test no parameter binding with sanitized string interpolation
                  console.log("STEP 6: Testing sanitized string interpolation (TEMP FIX)");
                  
                  // Sanitize ID - allow only [a-zA-Z0-9_]
                  const sanitizedId = trimmedId.replace(/[^a-zA-Z0-9_]/g, '');
                  console.log("Sanitized ID:", sanitizedId, "original:", trimmedId);
                  
                  if (sanitizedId && sanitizedId === trimmedId) {
                    const rawSql = `SELECT * FROM endpoint_registry WHERE id = '${sanitizedId}' LIMIT 1`;
                    console.log("Test 8 - Raw SQL (sanitized):", rawSql);
                    const rawResult = await db.prepare(rawSql).first();
                    console.log("Test 8 - Raw result:", rawResult ? "FOUND" : "NOT FOUND");
                    endpoint = rawResult;
                  } else {
                    console.log("STEP 6: ID contains invalid characters, skipping raw SQL");
                  }
                } else {
                  endpoint = likeResult;
                }
              } else {
                endpoint = castResult;
              }
            } else {
              endpoint = trimResult;
            }
          } else {
            endpoint = nameResult;
          }
        } else {
          endpoint = paramResult;
        }
      }
      
      if (!endpoint) {
        console.log("STEP 1-7: Endpoint not found with any method");
        return c.json(notFoundResponse(`Endpoint not found: ${trimmedId}`));
      }
      
      console.log("STEP 1-7: Found endpoint:", endpoint.id, endpoint.name);
      
      // Return basic endpoint info for now
      const response = {
        id: endpoint.id,
        name: endpoint.name,
        description: endpoint.description,
        method: endpoint.method,
        url: endpoint.url,
        available_keys: ["id", "name", "description", "method", "url"]
      };
      
      return c.json(successResponse(response));
      
    } catch (queryError) {
      console.error("STEP 1-7: Query error:", queryError);
      return c.json(errorResponse(`Database query error: ${queryError.message}`, 500));
    }

  } catch (error: any) {
    console.error('Error introspecting endpoint:', error);
    return c.json(errorResponse(`Error introspecting endpoint: ${error.message}`, 500));
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
        ai_enabled, endpoint_type, parameter_schema
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
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
      endpointData.parameter_schema ? JSON.stringify(endpointData.parameter_schema) : null
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
      'ai_enabled', 'endpoint_type', 'parameter_schema'
    ];

    fields.forEach(field => {
      if (field in endpointData) {
        let value = endpointData[field];
        
        // Handle JSON fields
        if (['headers', 'query_params', 'allowed_domains', 'tags', 'parameter_schema'].includes(field) && value) {
          value = JSON.stringify(value);
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
      parameters: cmd.parameters ? JSON.parse(cmd.parameters) : null,
      tags: cmd.tags ? JSON.parse(cmd.tags) : []
    }));
    
    return c.json(successResponse({
      commands,
      count: commands.length
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
      parameters: result.parameters ? JSON.parse(result.parameters) : null,
      response_path: result.response_path,
      tags: result.tags ? JSON.parse(result.tags) : []
    };
    
    return c.json(successResponse(command));
    
  } catch (error: any) {
    console.error('Error fetching command schema:', error);
    return c.json(errorResponse(`Error fetching command: ${error.message}`, 500));
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
      INSERT INTO flow_definitions (id, name, description, max_iterations, repository, branch, next_flow_id, priority, agent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      flowDefinitionId,
      name,
      dbValue(description),
      max_iterations || 20,
      repository,
      branch || 'main',
      dbValue(next_flow_id),
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
    if (next_flow_id !== undefined) {
      updates.push('next_flow_id = ?');
      values.push(dbValue(next_flow_id));
    }
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
        step_type: step.step_type,
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
    
    // Call appropriate agent(s) based on configuration
    const { callDeepSeek } = await import('./services/deepseek');
    
    // Create messages with system instruction about available commands
    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant with access to backend commands.
Available commands: GET /api/commands
To execute a command:
1. Check /api/commands/:name for parameter schema
2. Use the format: [COMMAND:command_name] params: {JSON_parameters}
3. The system will execute the command and return results
4. Use the response in your work

Command Format Examples:
- [COMMAND:get_tasks] params: {"status": "pending"}
- [COMMAND:create_task] params: {"title": "Fix bug", "description": "Fix the critical bug"}
- [COMMAND:get_flow_definitions] params: {}

Common commands:
- create_task: Create a new task
- get_tasks: Get all tasks
- create_flow_step: Create a flow step
- get_flow_definitions: Get flow definitions
- start_conversation: Start a new conversation

You can discover all available commands at /api/commands`
      },
      { role: 'user', content: prompt }
    ];
    
    let deepseekResult = null;
    let openhandsResponse = null;
    
    // Determine which agents to call based on agent field
    if (agent === 'deepseek' || agent === 'both') {
      // Call DeepSeek for 'deepseek' or 'both' agents
      deepseekResult = await callDeepSeek(c.env.DEEPSEEK_API_KEY, messages);
      
      if (!deepseekResult.success) {
        return c.json(errorResponse(`DeepSeek failed: ${deepseekResult.error}`, 500));
      }
    }
    
    if ((agent === 'openhands' || agent === 'both') && c.env.OPENHANDS_API_URL) {
      // Call OpenHands for 'openhands' or 'both' agents (if configured)
      const { createOpenHandsConversation } = await import('./services/openhands');
      
      // If DeepSeek was called, use its response as input to OpenHands
      // Otherwise, use the original prompt
      const inputForOpenHands = deepseekResult?.response || prompt;
      
      const openhandsResult = await createOpenHandsConversation(
        c.env.OPENHANDS_API_URL,
        inputForOpenHands
      );
      
      if (openhandsResult.success) {
        openhandsResponse = openhandsResult;
      }
    } else if (agent === 'openhands' && !c.env.OPENHANDS_API_URL) {
      // If OpenHands is requested but not configured, return error
      return c.json(errorResponse('OpenHands agent requested but OPENHANDS_API_URL not configured', 400));
    }
    
    // If no agent was called (shouldn't happen with defaults)
    if (!deepseekResult && !openhandsResponse) {
      return c.json(errorResponse('No agent available to process request', 500));
    }

    return c.json(successResponse({
      step: stepInfo,
      user_prompt,
      prompt_sent: prompt,
      agent_used: agent,
      deepseek_response: deepseekResult?.response || null,
      openhands_response: openhandsResponse,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error executing step:', error);
    return c.json(errorResponse('Internal server error', 500));
  }
});


