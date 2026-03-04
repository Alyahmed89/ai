import { NextRequest, NextResponse } from 'next/server';
import { getFlowStepById } from '@/lib/step-service';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stepId } = await params;
    
    // Get flow step using service
    const step = await getFlowStepById(stepId);
    
    if (step) {
      return NextResponse.json(step);
    } else {
      return NextResponse.json(
        { error: `Step with ID "${stepId}" not found` },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('Error fetching step:', err);
    return NextResponse.json(
      { error: 'Failed to load step data from database' },
      { status: 500 }
    );
  }
}