import { getFlowDefinitions } from '@/lib/api-client';
export const runtime = 'edge';

export async function GET() {
  try {
    const flowDefinitions = await getFlowDefinitions();
    return Response.json(flowDefinitions);
  } catch (error) {
    console.error('Error fetching flow definitions:', error);
    return Response.json(
      { error: 'Failed to fetch flow definitions' },
      { status: 500 }
    );
  }
}