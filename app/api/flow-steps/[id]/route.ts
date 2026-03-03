import { NextRequest, NextResponse } from 'next/server';

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
    const { id: stepId } = await params;
    
    // Make API call to Cloudflare D1
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT id, title, instructions, step_type, order_index, created_at, updated_at FROM flow_steps WHERE id = "${stepId}"`
      })
    });

    const data = await response.json();
    
    if (data.success && data.result[0].results.length > 0) {
      const stepData = data.result[0].results[0];
      return NextResponse.json({
        id: stepData.id,
        title: stepData.title,
        description: stepData.instructions || 'No description available',
        step_type: stepData.step_type,
        order: stepData.order_index,
        created_at: stepData.created_at,
        updated_at: stepData.updated_at
      });
    } else {
      return NextResponse.json(
        { error: `Step with ID "${stepId}" not found` },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('Error fetching step:', err);
    return NextResponse.json(
      { error: 'Failed to load step data from Cloudflare D1 database' },
      { status: 500 }
    );
  }
}