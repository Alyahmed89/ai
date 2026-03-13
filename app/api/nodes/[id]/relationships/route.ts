import { getNodeRelationships } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const relationships = await getNodeRelationships(id);
    return Response.json(relationships);
  } catch (error) {
    console.error('Error fetching node relationships:', error);
    return Response.json(
      { error: 'Failed to fetch node relationships' },
      { status: 500 }
    );
  }
}