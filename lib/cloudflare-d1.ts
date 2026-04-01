// Cloudflare D1 utility
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'e39371fc55a5c9ef7ed83e16660bd7bb';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL';
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || 'ce8f2a2c-6e4b-4398-b73e-ba8f204f609a';

export async function queryD1(sql: string, params: any[] = []) {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      }
    );

    const data = await response.json();
    
    if (!data.success) {
      console.error('Cloudflare D1 query error:', data.errors);
      throw new Error(data.errors?.[0]?.message || 'D1 query failed');
    }

    return data.result[0]?.results || [];
  } catch (error) {
    console.error('Error querying Cloudflare D1:', error);
    throw error;
  }
}

export async function getProjects() {
  const sql = 'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC';
  return await queryD1(sql);
}

export async function getFlows() {
  const sql = 'SELECT * FROM flows ORDER BY created_at DESC';
  return await queryD1(sql);
}

export async function getFlowRuns() {
  const sql = 'SELECT * FROM flow_runs ORDER BY created_at DESC LIMIT 50';
  return await queryD1(sql);
}

export async function getStepRuns() {
  const sql = 'SELECT * FROM step_runs ORDER BY created_at DESC LIMIT 50';
  return await queryD1(sql);
}

export async function getNodes(projectId?: string) {
  let sql = 'SELECT * FROM nodes WHERE deleted_at IS NULL';
  const params: any[] = [];
  
  if (projectId) {
    sql += ' AND project_id = ?';
    params.push(projectId);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT 50';
  
  return await queryD1(sql, params);
}