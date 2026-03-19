import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface IntrospectResponse {
  success: boolean;
  data?: {
    total_endpoints: number;
    endpoints_by_type: Record<string, number>;
    endpoints_by_auth_type: Record<string, number>;
    ai_enabled_endpoints: number;
    recently_created: any[];
    statistics: {
      average_timeout_ms: number;
      average_retries: number;
      https_required_percentage: number;
    };
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

export async function GET(request: NextRequest) {
  try {
    // For now, return mock introspection data
    // In production, this would query the database for detailed statistics
    
    const mockIntrospectionData = {
      total_endpoints: 0,
      endpoints_by_type: {
        external_api: 0,
        internal_command: 0,
        webhook: 0
      },
      endpoints_by_auth_type: {
        none: 0,
        bearer: 0,
        basic: 0,
        api_key: 0
      },
      ai_enabled_endpoints: 0,
      recently_created: [],
      statistics: {
        average_timeout_ms: 10000,
        average_retries: 3,
        https_required_percentage: 100
      }
    };
    
    const response: IntrospectResponse = {
      success: true,
      data: mockIntrospectionData
    };
    
    return Response.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error('Error introspecting endpoints:', error);
    return Response.json(
      { success: false, error: 'Failed to introspect endpoints' },
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