// CRUD API for Cloudflare D1 database
import { Hono } from 'hono';
import { CloudflareBindings } from './types';
import { 
  flowStepCreateSchema, 
  flowStepUpdateSchema,
  flowCreateSchema,
  flowUpdateSchema,
  flowDefinitionCreateSchema,
  flowDefinitionUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
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

// Health check endpoint
crudApi.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Cloudflare D1 CRUD API is running',
    timestamp: new Date().toISOString()
  });
});

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

// Get all flows
crudApi.get('/flows', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const result = await db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all();
    return c.json(result.results || []);
  } catch (error) {
    console.error('Error fetching flows:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get flow by ID
crudApi.get('/flows/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT * FROM flows WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Flow not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching flow:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new flow
crudApi.post('/flows', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    // Ensure tables exist before inserting

    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowCreateSchema, body);
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { id, name, repo, branch, max_iterations, steps } = validatedData;
    
    // Generate ID if not provided
    const flowId = id || `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO flows (id, name, repo, branch, max_iterations, steps, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      flowId,
      name,
      dbValue(repo),
      dbValue(branch),
      max_iterations || 5,
      dbValue(steps)
    ).run();
    
    return c.json(apiResponse(true, { id: flowId, message: 'Flow created successfully' }, undefined, 201));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// Update flow
crudApi.put('/flows/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    // Ensure tables exist before updating

    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate with Zod
    const validation = validateSchema(flowUpdateSchema, { ...body, id });
    if (!validation.success) {
      return c.json(apiResponse(false, undefined, validation.error, 400));
    }
    
    const validatedData = validation.data!;
    const { name, repo, branch, max_iterations, steps } = validatedData;

    const sql = `
      UPDATE flows 
      SET name = ?, repo = ?, branch = ?, max_iterations = ?, steps = ?
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(
      name,
      dbValue(repo),
      dbValue(branch),
      max_iterations,
      dbValue(steps),
      id
    ).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Flow not found', 404));
    }

    return c.json(apiResponse(true, { message: 'Flow updated successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// Delete flow
crudApi.delete('/flows/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json(apiResponse(false, undefined, 'Database not configured', 500));
    }

    // Ensure tables exist before deleting

    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM flows WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json(apiResponse(false, undefined, 'Flow not found', 404));
    }

    return c.json(apiResponse(true, { message: 'Flow deleted successfully' }));
  } catch (error) {
    return c.json(apiResponse(false, undefined, handleDbError(error).error, 500));
  }
});

// Get all flow steps for a flow
crudApi.get('/flows/:flowId/steps', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const flowId = c.req.param('flowId');
    const result = await db.prepare('SELECT * FROM flow_steps WHERE flow_id = ? ORDER BY order_index').bind(flowId).all();
    
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
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

    const result = await db.prepare('SELECT * FROM tasks ORDER BY order_index').all();
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

    const sql = `
      INSERT INTO tasks (id, flow_id, title, description, status, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    // TEMPORARY: Log for production validation
    console.log('INSERT TASK - validatedData:', JSON.stringify(validatedData, null, 2));
    
    await db.prepare(sql).bind(
      validatedData.id, 
      validatedData.flow_id, 
      validatedData.title, 
      dbValue(validatedData.description), 
      validatedData.status || 'pending', 
      validatedData.order_index
    ).run();
    
    return c.json({ message: 'Task created successfully', id: validatedData.id }, 201);
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

    const result = await db.prepare('SELECT * FROM flow_steps ORDER BY flow_id, order_index').all();
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

// Get flow conditions for a specific flow and step
crudApi.get('/flows/:flowId/steps/:stepId/conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before querying

    const flowId = c.req.param('flowId');
    const stepId = c.req.param('stepId');
    
    const result = await db.prepare(
      'SELECT * FROM flow_conditions WHERE flow_id = ? AND step_id = ? ORDER BY condition_type'
    ).bind(flowId, stepId).all();
    
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get all flow runs
crudApi.get('/flow-runs', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const result = await db.prepare('SELECT * FROM flow_runs ORDER BY created_at DESC').all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get flow run by ID
crudApi.get('/flow-runs/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('SELECT * FROM flow_runs WHERE id = ?').bind(id).first();

    if (!result) {
      return c.json({ error: 'Flow run not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
    return c.json(handleDbError(error), 500);
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

    const sql = `
      INSERT INTO flow_runs (id, flow_id, status, started_at, completed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(id, flow_id, status || 'running', started_at, completed_at, created_at).run();
    
    return c.json({ message: 'Flow run created successfully', id }, 201);
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

    const sql = `
      INSERT INTO iterations (id, flow_run_id, iteration_number, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(id, flowRunId, iteration_number, status || 'running', created_at).run();
    
    return c.json({ message: 'Iteration created successfully', id }, 201);
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
    const { id, name, description, max_iterations, repository, branch, next_flow_id, priority } = validatedData;
    
    const sql = `
      INSERT INTO flow_definitions (id, name, description, max_iterations, repository, branch, next_flow_id, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await db.prepare(sql).bind(
      id,
      name,
      dbValue(description),
      max_iterations || 20,
      repository,
      branch || 'main',
      dbValue(next_flow_id),
      priority || 0
    ).run();
    
    return c.json(apiResponse(true, { id, message: 'Flow definition created successfully' }, undefined, 201));
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
    const { name, description, max_iterations, repository, branch, next_flow_id, priority } = validatedData;

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


