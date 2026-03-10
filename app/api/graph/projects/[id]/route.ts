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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = id;
  
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    return NextResponse.json(
      { success: false, error: 'Project not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: project
  });
}

export const runtime = 'edge';