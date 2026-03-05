import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    return NextResponse.json({ 
      success: true, 
      received: body,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing test request:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request', statusCode: 400 },
      { status: 400 }
    );
  }
}