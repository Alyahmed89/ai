import { NextRequest, NextResponse } from 'next/server';
import { createTableIfNotExists } from '@/lib/cloudflare-d1';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const result = await createTableIfNotExists();
    
    return NextResponse.json({
      success: true,
      message: 'Table created or already exists',
      data: result
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to initialize database',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}