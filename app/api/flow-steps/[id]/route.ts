import { getFlowStep } from '@/lib/api-client';
export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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