import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BACKEND_URL = process.env.BACKEND_URL || 'https://deepseek-agent.alghamdimo89.workers.dev';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const { path } = params;
    const { searchParams } = new URL(request.url);
    
    // Construct the backend URL
    const backendPath = `/${path.join('/')}`;
    const queryString = searchParams.toString();
    const backendUrl = `${BACKEND_URL}${backendPath}${queryString ? `?${queryString}` : ''}`;
    
    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error in proxy API:', error);
    return Response.json(
      { error: 'Failed to fetch data from backend' },
      { status: 500 }
    );
  }
}