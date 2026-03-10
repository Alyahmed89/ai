import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for projects
let projects: any[] = [
  {
    id: 'project-1773001482796-aw8u81apk',
    name: 'Test Project from Python',
    status: 'active',
    metadata: JSON.stringify({ description: 'A test project created from Python' }),
    created_at: 1773001482796,
    updated_at: 1773001482796
  }
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit');

  let filteredProjects = projects;

  // Apply limit if provided
  if (limit) {
    const limitNum = parseInt(limit, 10);
    filteredProjects = filteredProjects.slice(0, limitNum);
  }

  return NextResponse.json({
    success: true,
    data: filteredProjects
  });
}

export const runtime = 'edge';