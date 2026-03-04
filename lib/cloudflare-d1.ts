// Cloudflare D1 Database Service
// Centralized service for all D1 database operations

// Configuration from environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;

// Check if we're in a build context (Next.js build time)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                    process.env.NODE_ENV === 'production' && 
                    typeof window === 'undefined' && 
                    !process.env.CLOUDFLARE_ACCOUNT_ID;

// Validate required environment variables
if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !DATABASE_ID) {
  console.warn('Missing required Cloudflare D1 environment variables');
  
  // During build time, we should not throw errors but return mock data
  if (isBuildTime) {
    console.log('Build time detected - using mock configuration');
  } else if (process.env.NODE_ENV === 'production' && !isBuildTime) {
    throw new Error('Missing required Cloudflare D1 environment variables');
  }
}

// Use mock values during build time or when environment variables are missing
const effectiveAccountId = CLOUDFLARE_ACCOUNT_ID || 'mock-account-id';
const effectiveApiToken = CLOUDFLARE_API_TOKEN || 'mock-api-token';
const effectiveDatabaseId = DATABASE_ID || 'mock-database-id';

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${effectiveAccountId}/d1/database/${effectiveDatabaseId}`;

const headers = {
  'Authorization': `Bearer ${effectiveApiToken}`,
  'Content-Type': 'application/json',
};

export interface D1QueryResult {
  success: boolean;
  result: any[];
  meta: any;
  errors: any[];
}

export interface D1ExecuteResult {
  success: boolean;
  result: {
    meta: any;
    results: any[];
  };
  errors: any[];
}

export async function executeQuery(sql: string, params: any[] = []): Promise<D1QueryResult> {
  // During build time, return mock data
  if (isBuildTime || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !DATABASE_ID) {
    console.log(`Build time or missing env vars - returning mock data for query: ${sql.substring(0, 50)}...`);
    return {
      success: true,
      result: [{
        results: [],
        meta: {}
      }],
      meta: {},
      errors: []
    };
  }

  try {
    const response = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sql,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing D1 query:', error);
    throw error;
  }
}

export async function executeStatement(sql: string, params: any[] = []): Promise<D1ExecuteResult> {
  // During build time, return mock data
  if (isBuildTime || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !DATABASE_ID) {
    console.log(`Build time or missing env vars - returning mock data for statement: ${sql.substring(0, 50)}...`);
    return {
      success: true,
      result: {
        meta: {},
        results: []
      },
      errors: []
    };
  }

  try {
    // For D1 API, we use the same /query endpoint for both queries and statements
    const response = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sql,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Transform the response to match the expected D1ExecuteResult format
    return {
      success: result.success,
      result: {
        meta: result.result?.[0]?.meta || {},
        results: result.result?.[0]?.results || []
      },
      errors: result.errors || []
    };
  } catch (error) {
    console.error('Error executing D1 statement:', error);
    throw error;
  }
}

// Helper functions for common operations
export async function createTableIfNotExists() {
  // During build time, skip table creation
  if (isBuildTime || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !DATABASE_ID) {
    console.log('Build time or missing env vars - skipping table creation');
    return {
      success: true,
      result: {
        meta: {},
        results: []
      },
      errors: []
    };
  }

  const sql = `
    CREATE TABLE IF NOT EXISTS test_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  const result = await executeStatement(sql);
  
  // Check if the table was created successfully
  if (result.success) {
    console.log('Table created or already exists');
  } else {
    console.error('Failed to create table:', result.errors);
  }
  
  return result;
}

export async function getAllItems() {
  const sql = `SELECT * FROM test_items ORDER BY created_at DESC`;
  const result = await executeQuery(sql);
  // The result structure is different - we need to extract the results from the first element
  return result.result?.[0]?.results || [];
}

export async function getItemById(id: number) {
  const sql = `SELECT * FROM test_items WHERE id = ?`;
  const result = await executeQuery(sql, [id]);
  return result.result?.[0]?.results?.[0] || null;
}

export async function createItem(name: string, description: string = '') {
  const sql = `INSERT INTO test_items (name, description) VALUES (?, ?)`;
  const result = await executeStatement(sql, [name, description]);
  
  if (result.success && result.result.meta.last_row_id) {
    return await getItemById(result.result.meta.last_row_id);
  }
  
  return null;
}

export async function updateItem(id: number, name: string, description: string = '') {
  const sql = `UPDATE test_items SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const result = await executeStatement(sql, [name, description, id]);
  
  if (result.success) {
    return await getItemById(id);
  }
  
  return null;
}

export async function deleteItem(id: number) {
  const sql = `DELETE FROM test_items WHERE id = ?`;
  const result = await executeStatement(sql, [id]);
  return result.success;
}

// Generic database operations that can be used by all services
export async function queryDatabase(sql: string, params: any[] = []): Promise<any[]> {
  try {
    const result = await executeQuery(sql, params);
    if (result.success) {
      return result.result?.[0]?.results || [];
    }
    throw new Error(`Database query failed: ${JSON.stringify(result.errors)}`);
  } catch (error) {
    console.error('Error in queryDatabase:', error);
    throw error;
  }
}

export async function executeDatabase(sql: string, params: any[] = []): Promise<D1ExecuteResult> {
  return await executeStatement(sql, params);
}

// Helper to build WHERE clauses dynamically
export function buildWhereClause(filters: Record<string, any>): { sql: string, params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        conditions.push(`${key} IN (${value.map(() => '?').join(',')})`);
        params.push(...value);
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }
  });
  
  const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { sql, params };
}

// Helper to build pagination
export function buildPagination(limit?: number, offset?: number): string {
  if (limit !== undefined) {
    return `LIMIT ${limit}${offset !== undefined ? ` OFFSET ${offset}` : ''}`;
  }
  return '';
}