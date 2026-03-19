import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface TestRequest {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
}

interface TestResponse {
  success: boolean;
  data?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    duration_ms: number;
  };
  error?: string;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const params = await context.params;
    const { name } = params;
    const testRequest: TestRequest = await request.json();
    
    // For now, return a mock test response
    // In production, this would:
    // 1. Look up the endpoint by name
    // 2. Apply authentication and headers
    // 3. Replace URL placeholders with parameters
    // 4. Make the actual HTTP request
    // 5. Return the response
    
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'x-powered-by': 'mock-api'
      },
      body: {
        message: 'Test request successful',
        endpoint: name,
        params: testRequest.params || {},
        timestamp: new Date().toISOString()
      },
      duration_ms: 150
    };
    
    const response: TestResponse = {
      success: true,
      data: mockResponse
    };
    
    return Response.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error('Error testing endpoint:', error);
    return Response.json(
      { success: false, error: 'Failed to test endpoint' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}