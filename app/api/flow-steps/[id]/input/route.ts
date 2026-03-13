import { getFlowStepInput } from '@/lib/api-client';
import { NextRequest } from 'next/server';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const flowStepInput = await getFlowStepInput(id);
    return Response.json(flowStepInput);
  } catch (error) {
    console.error('Error fetching flow step input:', error);
    return Response.json(
      { error: 'Failed to fetch flow step input' },
      { status: 500 }
    );
  }
}