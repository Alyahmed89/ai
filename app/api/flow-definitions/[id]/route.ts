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
    
    // Make API call to Cloudflare D1 to get flow definition
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT id, name, description, repository, branch, max_iterations, created_at, updated_at, next_flow_id, priority FROM flow_definitions WHERE id = "${flowId}"`
      })
    });

    const data = await response.json();
    
    if (data.success && data.result[0].results.length > 0) {
      const flowData = data.result[0].results[0];
      return NextResponse.json({
        id: flowData.id,
        name: flowData.name,
        description: flowData.description,
        repository: flowData.repository,
        branch: flowData.branch,
        max_iterations: flowData.max_iterations,
        created_at: flowData.created_at,
        updated_at: flowData.updated_at,
        next_flow_id: flowData.next_flow_id,
        priority: flowData.priority
      });
    } else {
      return NextResponse.json(
        { error: `Flow definition with ID "${flowId}" not found` },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('Error fetching flow definition:', err);
    return NextResponse.json(
      { error: 'Failed to load flow definition from Cloudflare D1 database' },
      { status: 500 }
    );
  }
}