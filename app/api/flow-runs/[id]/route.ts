import { getFlowRun, getStepRuns } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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