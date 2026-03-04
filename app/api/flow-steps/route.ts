import { NextRequest, NextResponse } from 'next/server';
import { getFlowSteps, StepFilters } from '@/lib/step-service';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const step_type = searchParams.get('step_type') || undefined;
    
    // Build filters
    const filters: StepFilters = {};
    if (step_type) filters.step_type = step_type;
    
    // Get flow steps using service
    const steps = await getFlowSteps({
      limit,
      offset,
      filters,
      orderBy: 'order_index',
      orderDirection: 'ASC'
    });
    
    return NextResponse.json(steps);
  } catch (err) {
    console.error('Error fetching flow steps:', err);
    return NextResponse.json(
      { error: 'Failed to load flow steps from database' },
      { status: 500 }
    );
  }
}