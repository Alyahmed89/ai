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
    const { id: taskId } = await params;
    
    // Make API call to Cloudflare D1
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `SELECT id, title, description, status, priority, task_type, created_at FROM tasks WHERE id = "${taskId}"`
      })
    });

    const data = await response.json();
    
    if (data.success && data.result[0].results.length > 0) {
      const taskData = data.result[0].results[0];
      return NextResponse.json({
        id: taskData.id,
        title: taskData.title,
        description: taskData.description || 'No description available',
        status: taskData.status || 'pending',
        priority: taskData.priority || 'medium',
        task_type: taskData.task_type || 'unknown',
        created_at: taskData.created_at
      });
    } else {
      return NextResponse.json(
        { error: `Task with ID "${taskId}" not found` },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('Error fetching task:', err);
    return NextResponse.json(
      { error: 'Failed to load task data from Cloudflare D1 database' },
      { status: 500 }
    );
  }
}