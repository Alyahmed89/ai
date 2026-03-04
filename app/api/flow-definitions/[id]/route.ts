import { NextRequest, NextResponse } from 'next/server';
import { getFlowDefinitionById } from '@/lib/flow-service';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flowId } = await params;
    
    // Get flow definition using service
    const flow = await getFlowDefinitionById(flowId);
    
    if (flow) {
      return NextResponse.json(flow);
    } else {
      return NextResponse.json(
        { error: `Flow definition with ID "${flowId}" not found` },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('Error fetching flow definition:', err);
    return NextResponse.json(
      { error: 'Failed to load flow definition from database' },
      { status: 500 }
    );
  }
}