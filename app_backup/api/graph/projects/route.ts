import { NextRequest, NextResponse } from 'next/server';
import { getProjects } from '@/lib/cloudflare-d1';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit');

    let projects = await getProjects();

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      projects = projects.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch projects'
    }, { status: 500 });
  }
}

export const runtime = 'edge';