import { getFlowStepInput } from '@/lib/api-client';
export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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