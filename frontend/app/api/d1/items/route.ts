import { NextRequest, NextResponse } from 'next/server';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}`;

async function executeQuery(sql: string, params: any[] = []) {
  try {
    const response = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare D1 API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Cloudflare D1 query failed: ${JSON.stringify(data.errors)}`);
    }

    return data.result[0];
  } catch (error) {
    console.error('Error executing Cloudflare D1 query:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, data } = body;
    
    if (!table || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing table or data', statusCode: 400 },
        { status: 400 }
      );
    }
    
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    const result = await executeQuery(sql, values);
    
    return NextResponse.json({ 
      success: true, 
      id: result.meta?.last_row_id 
    });
    
  } catch (error) {
    console.error('Error inserting item:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to insert item', statusCode: 500 },
      { status: 500 }
    );
  }
}