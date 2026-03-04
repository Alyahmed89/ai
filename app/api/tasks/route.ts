import { NextRequest, NextResponse } from 'next/server';
import { getTasks, TaskFilters } from '@/lib/task-service';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    
    // Build filters
    const filters: TaskFilters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    
    // Get tasks using service
    const tasks = await getTasks({
      limit,
      offset,
      filters,
      orderBy: 'created_at',
      orderDirection: 'DESC'
    });
    
    return NextResponse.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    return NextResponse.json(
      { error: 'Failed to load tasks from database' },
      { status: 500 }
    );
  }
}