import { getFlows } from '@/lib/api-client';
export const runtime = 'edge';

export async function GET() {
  try {
    const flows = await getFlows();
    return Response.json(flows);
  } catch (error) {
    console.error('Error fetching flows:', error);
    return Response.json(
      { error: 'Failed to fetch flows' },
      { status: 500 }
    );
  }
}