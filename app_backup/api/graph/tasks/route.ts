import { NextRequest, NextResponse } from 'next/server';
import { getTasks } from '@/lib/cloudflare-d1';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit');
    const projectId = searchParams.get('project_id');

    let tasks = await getTasks(projectId || undefined);

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      tasks = tasks.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tasks'
    }, { status: 500 });
  }
}

export const runtime = 'edge';