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
    const { searchParams } = new URL(request.url);
    const stepId = searchParams.get('stepId');
    
    if (!stepId) {
      return NextResponse.json(
        { error: 'stepId query parameter is required' },
        { status: 400 }
      );
    }

    const sql = `
      SELECT * FROM flow_step_conditions 
      WHERE flow_step_id = ? 
      ORDER BY id
    `;
    
    const conditions = await executeQuery(sql, [stepId]);
    
    return NextResponse.json({ data: conditions });
    
  } catch (error) {
    console.error('Error fetching step conditions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch step conditions' },
      { status: 500 }
    );
  }
}