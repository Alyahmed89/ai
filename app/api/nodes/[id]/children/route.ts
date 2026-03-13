import { getNodeChildren } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const children = await getNodeChildren(id);
    return Response.json(children);
  } catch (error) {
    console.error('Error fetching node children:', error);
    return Response.json(
      { error: 'Failed to fetch node children' },
      { status: 500 }
    );
  }
}