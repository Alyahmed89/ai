import { NextRequest, NextResponse } from 'next/server';
import { getFlowDefinitions } from '@/lib/flow-service';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Get flow definitions using service
    const flows = await getFlowDefinitions({
      limit,
      orderBy: 'priority',
      orderDirection: 'DESC'
    });
    
    return NextResponse.json(flows);
  } catch (err) {
    console.error('Error fetching flow definitions:', err);
    return NextResponse.json(
      { error: 'Failed to load flow definitions from database' },
      { status: 500 }
    );
  }
}