import { NextRequest, NextResponse } from 'next/server';
import { getTaskById } from '@/lib/task-service';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    
    // Get task using service
    const task = await getTaskById(taskId);
    
    if (task) {
      return NextResponse.json(task);
    } else {
      return NextResponse.json(
        { error: `Task with ID "${taskId}" not found` },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('Error fetching task:', err);
    return NextResponse.json(
      { error: 'Failed to load task data from database' },
      { status: 500 }
    );
  }
}