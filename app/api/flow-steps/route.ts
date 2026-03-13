import { getFlowSteps } from '@/lib/api-client';
import { NextRequest } from 'next/server';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get('flow_id');
    
    let flowSteps = await getFlowSteps();
    
    // Filter by flow_id if provided
    if (flowId && flowSteps.data) {
      flowSteps.data = flowSteps.data.filter((step: any) => step.flow_id === flowId);
    }
    
    return Response.json(flowSteps);
  } catch (error) {
    console.error('Error fetching flow steps:', error);
    return Response.json(
      { error: 'Failed to fetch flow steps' },
      { status: 500 }
    );
  }
}