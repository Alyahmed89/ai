import { getNodes } from '@/lib/api-client';
export const runtime = 'edge';

export async function GET() {
  try {
    const nodes = await getNodes();
    return Response.json(nodes);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return Response.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}