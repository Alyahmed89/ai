import { getFlowStepConditions } from '@/lib/api-client';
export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const flowStepConditions = await getFlowStepConditions(id);
    return Response.json(flowStepConditions);
  } catch (error) {
    console.error('Error fetching flow step conditions:', error);
    return Response.json(
      { error: 'Failed to fetch flow step conditions' },
      { status: 500 }
    );
  }
}