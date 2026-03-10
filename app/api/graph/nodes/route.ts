import { NextRequest, NextResponse } from 'next/server';
import { nodes, addNode, getNodesByProjectId } from '../shared-data';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('project_id');
  const limit = searchParams.get('limit');

  let filteredNodes = nodes;

  // Filter by project ID if provided
  if (projectId) {
    filteredNodes = getNodesByProjectId(projectId);
  }

  // Apply limit if provided
  if (limit) {
    const limitNum = parseInt(limit, 10);
    filteredNodes = filteredNodes.slice(0, limitNum);
  }

  return NextResponse.json({
    success: true,
    data: filteredNodes
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.project_id || !data.title || !data.type || !data.status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create new node
    const newNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      project_id: data.project_id,
      type: data.type,
      title: data.title,
      content: data.content || JSON.stringify({ description: '' }),
      status: data.status,
      metadata: data.metadata || JSON.stringify({}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    addNode(newNode);

    return NextResponse.json({
      success: true,
      data: newNode
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating node:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create node' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';