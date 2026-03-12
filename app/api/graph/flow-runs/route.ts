import { NextRequest, NextResponse } from 'next/server';
import { getFlowRuns } from '@/lib/cloudflare-d1';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit');

    let flowRuns = await getFlowRuns();

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      flowRuns = flowRuns.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      data: flowRuns
    });
  } catch (error) {
    console.error('Error fetching flow runs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch flow runs'
    }, { status: 500 });
  }
}

export const runtime = 'edge';