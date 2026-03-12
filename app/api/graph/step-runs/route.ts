import { NextRequest, NextResponse } from 'next/server';
import { getStepRuns } from '@/lib/cloudflare-d1';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit');

    let stepRuns = await getStepRuns();

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      stepRuns = stepRuns.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      data: stepRuns
    });
  } catch (error) {
    console.error('Error fetching step runs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch step runs'
    }, { status: 500 });
  }
}

export const runtime = 'edge';