import { getFlowRuns } from '@/lib/api-client';
export const runtime = "edge";

export async function GET() {
  try {
    const flowRuns = await getFlowRuns();
    return Response.json(flowRuns);
  } catch (error) {
    console.error('Error fetching flow runs:', error);
    return Response.json(
      { error: 'Failed to fetch flow runs' },
      { status: 500 }
    );
  }
}