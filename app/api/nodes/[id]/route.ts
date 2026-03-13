import { getNode } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const node = await getNode(id);
    return Response.json(node);
  } catch (error) {
    console.error('Error fetching node:', error);
    return Response.json(
      { error: 'Failed to fetch node' },
      { status: 500 }
    );
  }
}