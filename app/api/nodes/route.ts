import { getNodes } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id') || undefined;
    const nodes = await getNodes(projectId);
    return Response.json(nodes);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return Response.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}