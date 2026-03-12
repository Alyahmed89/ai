import { NextRequest, NextResponse } from 'next/server';
import { getNodes } from '@/lib/cloudflare-d1';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');
    const limit = searchParams.get('limit');

    let nodes = await getNodes(projectId || undefined);

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      nodes = nodes.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      data: nodes
    });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch nodes'
    }, { status: 500 });
  }
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