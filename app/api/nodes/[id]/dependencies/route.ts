import { getNodeDependencies } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dependencies = await getNodeDependencies(id);
    return Response.json(dependencies);
  } catch (error) {
    console.error('Error fetching node dependencies:', error);
    return Response.json(
      { error: 'Failed to fetch node dependencies' },
      { status: 500 }
    );
  }
}