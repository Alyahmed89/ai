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

    return data.result[0]?.results || [];
  } catch (error) {
    console.error('Error executing Cloudflare D1 query:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const sql = "SELECT name FROM sqlite_master WHERE type='table'";
    const tables = await executeQuery(sql);
    
    return NextResponse.json({ 
      success: true, 
      initialized: true, 
      timestamp: new Date().toISOString(),
      tables: tables.map((t: any) => t.name)
    });
    
  } catch (error) {
    console.error('Error checking D1 initialization:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check database initialization', statusCode: 500 },
      { status: 500 }
    );
  }
}