import { getNodeLinks } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const links = await getNodeLinks(id);
    return Response.json(links);
  } catch (error) {
    console.error('Error fetching node links:', error);
    return Response.json(
      { error: 'Failed to fetch node links' },
      { status: 500 }
    );
  }
}