const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 48647;

// Cloudflare D1 configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'e39371fc55a5c9ef7ed83e16660bd7bb';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL';
const DATABASE_ID = process.env.DATABASE_ID || 'ce8f2a2c-6e4b-4398-b73e-ba8f204f609a';

const CLOUDFLARE_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}`;

app.use(cors());
app.use(express.json());

// Helper function to make Cloudflare D1 API calls
async function queryD1(sql, params = []) {
  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error querying D1:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Cloudflare D1 API is running' });
});

// Get all flows
app.get('/api/flows', async (req, res) => {
  try {
    const result = await queryD1('SELECT * FROM flows ORDER BY created_at DESC');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get flow by ID
app.get('/api/flows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryD1('SELECT * FROM flows WHERE id = ?', [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Flow not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new flow
app.post('/api/flows', async (req, res) => {
  try {
    const { id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps } = req.body;
    const created_at = Math.floor(Date.now() / 1000);
    
    const sql = `
      INSERT INTO flows (id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await queryD1(sql, [id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at]);
    res.status(201).json({ message: 'Flow created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update flow
app.put('/api/flows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, first_prompt, deepseek_system, repo, branch, max_iterations, steps } = req.body;
    
    const sql = `
      UPDATE flows 
      SET name = ?, first_prompt = ?, deepseek_system = ?, repo = ?, branch = ?, max_iterations = ?, steps = ?
      WHERE id = ?
    `;
    
    await queryD1(sql, [name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, id]);
    res.json({ message: 'Flow updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete flow
app.delete('/api/flows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await queryD1('DELETE FROM flows WHERE id = ?', [id]);
    res.json({ message: 'Flow deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all flow steps for a flow
app.get('/api/flows/:flowId/steps', async (req, res) => {
  try {
    const { flowId } = req.params;
    const result = await queryD1('SELECT * FROM flow_steps WHERE flow_id = ? ORDER BY step_number', [flowId]);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all flow steps (all steps across all flows)
app.get('/api/flow-steps', async (req, res) => {
  try {
    const result = await queryD1('SELECT * FROM flow_steps ORDER BY flow_id, step_number');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get flow step by ID
app.get('/api/flow-steps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryD1('SELECT * FROM flow_steps WHERE id = ?', [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Flow step not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new flow step
app.post('/api/flow-steps', async (req, res) => {
  try {
    const { id, flow_id, step_number, prompt } = req.body;
    
    const sql = `
      INSERT INTO flow_steps (id, flow_id, step_number, prompt)
      VALUES (?, ?, ?, ?)
    `;
    
    await queryD1(sql, [id, flow_id, step_number, prompt]);
    res.status(201).json({ message: 'Flow step created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update flow step
app.put('/api/flow-steps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { flow_id, step_number, prompt } = req.body;
    
    const sql = `
      UPDATE flow_steps 
      SET flow_id = ?, step_number = ?, prompt = ?
      WHERE id = ?
    `;
    
    await queryD1(sql, [flow_id, step_number, prompt, id]);
    res.json({ message: 'Flow step updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete flow step
app.delete('/api/flow-steps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await queryD1('DELETE FROM flow_steps WHERE id = ?', [id]);
    res.json({ message: 'Flow step deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await queryD1('SELECT * FROM tasks ORDER BY order_index');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task by ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryD1('SELECT * FROM tasks WHERE id = ?', [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { id, flow_id, title, description, status, order_index } = req.body;
    
    const sql = `
      INSERT INTO tasks (id, flow_id, title, description, status, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await queryD1(sql, [id, flow_id, title, description, status || 'pending', order_index]);
    res.status(201).json({ message: 'Task created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, order_index } = req.body;
    
    const sql = `
      UPDATE tasks 
      SET title = ?, description = ?, status = ?, order_index = ?
      WHERE id = ?
    `;
    
    await queryD1(sql, [title, description, status, order_index, id]);
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await queryD1('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all flow conditions
app.get('/api/flow-conditions', async (req, res) => {
  try {
    const result = await queryD1('SELECT * FROM flow_conditions ORDER BY flow_id, step_id');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get flow conditions for a specific flow and step
app.get('/api/flows/:flowId/steps/:stepId/conditions', async (req, res) => {
  try {
    const { flowId, stepId } = req.params;
    const result = await queryD1(
      'SELECT * FROM flow_conditions WHERE flow_id = ? AND step_id = ? ORDER BY condition_type',
      [flowId, stepId]
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get flow condition by ID
app.get('/api/flow-conditions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryD1('SELECT * FROM flow_conditions WHERE id = ?', [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Flow condition not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new flow condition
app.post('/api/flow-conditions', async (req, res) => {
  try {
    const { id, flow_id, step_id, condition_type, condition_value } = req.body;
    
    const sql = `
      INSERT INTO flow_conditions (id, flow_id, step_id, condition_type, condition_value)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await queryD1(sql, [id, flow_id, step_id, condition_type, condition_value]);
    res.status(201).json({ message: 'Flow condition created successfully', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update flow condition
app.put('/api/flow-conditions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { flow_id, step_id, condition_type, condition_value } = req.body;
    
    const sql = `
      UPDATE flow_conditions 
      SET flow_id = ?, step_id = ?, condition_type = ?, condition_value = ?
      WHERE id = ?
    `;
    
    await queryD1(sql, [flow_id, step_id, condition_type, condition_value, id]);
    res.json({ message: 'Flow condition updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete flow condition
app.delete('/api/flow-conditions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await queryD1('DELETE FROM flow_conditions WHERE id = ?', [id]);
    res.json({ message: 'Flow condition deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all flow runs
app.get('/api/flow-runs', async (req, res) => {
  try {
    const result = await queryD1('SELECT * FROM flow_runs ORDER BY created_at DESC');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Cloudflare D1 API server running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
});