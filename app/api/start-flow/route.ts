import { startFlow } from '@/lib/api-client';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flow_id, ...data } = body;
    
    if (!flow_id) {
      return Response.json(
        { error: 'flow_id is required' },
        { status: 400 }
      );
    }
    
    const result = await startFlow(flow_id, data);
    return Response.json(result);
  } catch (error) {
    console.error('Error starting flow:', error);
    return Response.json(
      { error: 'Failed to start flow' },
      { status: 500 }
    );
  }
}