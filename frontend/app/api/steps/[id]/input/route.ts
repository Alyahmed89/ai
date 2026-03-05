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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing step ID', statusCode: 400 },
        { status: 400 }
      );
    }
    
    const sql = `
      SELECT input_schema, input_validation_rules 
      FROM flow_steps 
      WHERE id = ?
    `;
    
    const results = await executeQuery(sql, [id]);
    
    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Step not found', statusCode: 404 },
        { status: 404 }
      );
    }
    
    const step = results[0];
    
    return NextResponse.json({ 
      success: true, 
      input_schema: step.input_schema,
      input_validation_rules: step.input_validation_rules
    });
    
  } catch (error) {
    console.error('Error fetching step input:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch step input', statusCode: 500 },
      { status: 500 }
    );
  }
}