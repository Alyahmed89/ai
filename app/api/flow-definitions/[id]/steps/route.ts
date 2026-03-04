import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Cloudflare D1 API configuration
const CLOUDFLARE_ACCOUNT_ID = 'e39371fc55a5c9ef7ed83e16660bd7bb';
const CLOUDFLARE_API_TOKEN = 'H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL';
const DATABASE_ID = 'ce8f2a2c-6e4b-4398-b73e-ba8f204f609a';
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flowId } = await params;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    
    // Make API call to Cloudflare D1 to get steps for this flow
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT id, title, step_type, order_index, instructions, output, created_at, updated_at FROM flow_steps WHERE flow_id = "${flowId}" ORDER BY order_index LIMIT ${limit}`
      })
    });

    const data = await response.json();
    
    if (data.success) {
      const steps = data.result[0].results || [];
      return NextResponse.json(steps);
    } else {
      return NextResponse.json(
        { error: 'Failed to fetch steps for flow from database' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Error fetching flow steps:', err);
    return NextResponse.json(
      { error: 'Failed to load flow steps from Cloudflare D1 database' },
      { status: 500 }
    );
  }
}