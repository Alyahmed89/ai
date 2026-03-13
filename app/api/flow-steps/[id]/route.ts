import { getFlowStep } from '@/lib/api-client';
import { NextRequest } from 'next/server';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const flowStep = await getFlowStep(id);
    return Response.json(flowStep);
  } catch (error) {
    console.error('Error fetching flow step:', error);
    return Response.json(
      { error: 'Failed to fetch flow step' },
      { status: 500 }
    );
  }
}