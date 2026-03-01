// CRUD API for Cloudflare D1 database
import { Hono } from 'hono';
import { CloudflareBindings } from './types';

// Helper function to handle database errors
function handleDbError(error: any) {
  console.error('Database error:', error);
  return {
    success: false,
    error: error.message || 'Database error'
  };
}

// Helper function to create tables if they don't exist
async function ensureTablesExist(db: any) {
  try {
    // Create flows table if it doesn't exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        first_prompt TEXT,
        deepseek_system TEXT,
        repo TEXT,
        branch TEXT,
        max_iterations INTEGER DEFAULT 5,
        steps TEXT, -- JSON string of steps
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create flow_conditions table if it doesn't exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS flow_conditions (
        id TEXT PRIMARY KEY,
        flow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        condition_value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        FOREIGN KEY (step_id) REFERENCES flow_steps(id) ON DELETE CASCADE
      )
    `).run();

    console.log('Tables ensured to exist');
  } catch (error) {
    console.error('Error ensuring tables exist:', error);
    // Don't throw - we'll try to continue anyway
  }
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

// Get all flows
crudApi.get('/flows', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before querying
    await ensureTablesExist(db);

    const result = await db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
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
    return c.json(handleDbError(error), 500);
  }
});

// Create new flow
crudApi.post('/flows', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before inserting
    await ensureTablesExist(db);

    const body = await c.req.json();
    const { id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps } = body;
    const created_at = Math.floor(Date.now() / 1000);

    const sql = `
      INSERT INTO flows (id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at).run();
    
    return c.json({ message: 'Flow created successfully', id }, 201);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Update flow
crudApi.put('/flows/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before updating
    await ensureTablesExist(db);

    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, first_prompt, deepseek_system, repo, branch, max_iterations, steps } = body;

    const sql = `
      UPDATE flows 
      SET name = ?, first_prompt = ?, deepseek_system = ?, repo = ?, branch = ?, max_iterations = ?, steps = ?
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Flow not found' }, 404);
    }

    return c.json({ message: 'Flow updated successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Delete flow
crudApi.delete('/flows/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before deleting
    await ensureTablesExist(db);

    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM flows WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Flow not found' }, 404);
    }

    return c.json({ message: 'Flow deleted successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
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
    const result = await db.prepare('SELECT * FROM flow_steps WHERE flow_id = ? ORDER BY step_number').bind(flowId).all();
    
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get all tasks
crudApi.get('/tasks', async (c) => {
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
    const { id, flow_id, title, description, status, order_index } = body;

    const sql = `
      INSERT INTO tasks (id, flow_id, title, description, status, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(id, flow_id, title, description, status || 'pending', order_index).run();
    
    return c.json({ message: 'Task created successfully', id }, 201);
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
    const { title, description, status, order_index } = body;

    const sql = `
      UPDATE tasks 
      SET title = ?, description = ?, status = ?, order_index = ?
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(title, description, status, order_index, id).run();

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
      return c.json({ error: 'Database not configured' }, 500);
    }

    const result = await db.prepare('SELECT * FROM flow_steps ORDER BY flow_id, order_index').all();
    return c.json(result.results || []);
  } catch (error) {
    return c.json(handleDbError(error), 500);
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
    return c.json(handleDbError(error), 500);
  }
});

// Create new flow step
crudApi.post('/flow-steps', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const body = await c.req.json();
    const { 
      id, flow_id, step_key, title, type, order_index, instructions,
      expected_output, success_criteria, failure_criteria, timeout_seconds,
      retry_count, retry_delay, depends_on, parallelizable, required_inputs,
      output_schema, metadata, created_at, updated_at 
    } = body;
    
    const created = created_at || Math.floor(Date.now() / 1000);
    const updated = updated_at || created;

    const sql = `
      INSERT INTO flow_steps (
        id, flow_id, step_key, title, type, order_index, instructions,
        expected_output, success_criteria, failure_criteria, timeout_seconds,
        retry_count, retry_delay, depends_on, parallelizable, required_inputs,
        output_schema, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(sql).bind(
      id, flow_id, step_key, title, type, order_index, instructions,
      expected_output || null, success_criteria || null, failure_criteria || null, timeout_seconds || null,
      retry_count || null, retry_delay || null, depends_on || null, parallelizable || null, required_inputs || null,
      output_schema || null, metadata || null, created, updated
    ).run();
    
    return c.json({ message: 'Flow step created successfully', id }, 201);
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Update flow step
crudApi.put('/flow-steps/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const { 
      flow_id, step_key, title, type, order_index, instructions,
      expected_output, success_criteria, failure_criteria, timeout_seconds,
      retry_count, retry_delay, depends_on, parallelizable, required_inputs,
      output_schema, metadata, updated_at 
    } = body;
    
    const updated = updated_at || Math.floor(Date.now() / 1000);

    const sql = `
      UPDATE flow_steps SET 
        flow_id = ?, step_key = ?, title = ?, type = ?, order_index = ?, instructions = ?,
        expected_output = ?, success_criteria = ?, failure_criteria = ?, timeout_seconds = ?,
        retry_count = ?, retry_delay = ?, depends_on = ?, parallelizable = ?, required_inputs = ?,
        output_schema = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `;

    const result = await db.prepare(sql).bind(
      flow_id, step_key, title, type, order_index, instructions,
      expected_output || null, success_criteria || null, failure_criteria || null, timeout_seconds || null,
      retry_count || null, retry_delay || null, depends_on || null, parallelizable || null, required_inputs || null,
      output_schema || null, metadata || null, updated, id
    ).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Flow step not found' }, 404);
    }

    return c.json({ message: 'Flow step updated successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Delete flow step
crudApi.delete('/flow-steps/:id', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM flow_steps WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Flow step not found' }, 404);
    }

    return c.json({ message: 'Flow step deleted successfully' });
  } catch (error) {
    return c.json(handleDbError(error), 500);
  }
});

// Get all flow conditions
crudApi.get('/flow-conditions', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Ensure tables exist before querying
    await ensureTablesExist(db);

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
    await ensureTablesExist(db);

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