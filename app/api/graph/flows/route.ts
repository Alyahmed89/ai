import { NextRequest, NextResponse } from 'next/server';
import { getFlows } from '@/lib/cloudflare-d1';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit');

    let flows = await getFlows();

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      flows = flows.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      data: flows
    });
  } catch (error) {
    console.error('Error fetching flows:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch flows'
    }, { status: 500 });
  }
}

export const runtime = 'edge';