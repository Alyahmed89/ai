import { getNodeParent } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parent = await getNodeParent(id);
    return Response.json(parent);
  } catch (error) {
    console.error('Error fetching node parent:', error);
    return Response.json(
      { error: 'Failed to fetch node parent' },
      { status: 500 }
    );
  }
}