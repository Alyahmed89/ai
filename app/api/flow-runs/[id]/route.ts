import { getFlowRun, getStepRuns } from '@/lib/api-client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const [flowRun, stepRuns] = await Promise.all([
      getFlowRun(id),
      getStepRuns(id)
    ]);
    
    // Combine flow run with its step runs
    const flowRunWithSteps = {
      ...flowRun,
      stepRuns
    };
    
    return Response.json(flowRunWithSteps);
  } catch (error) {
    console.error('Error fetching flow run:', error);
    return Response.json(
      { error: 'Failed to fetch flow run' },
      { status: 500 }
    );
  }
}