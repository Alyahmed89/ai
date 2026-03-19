import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface EndpointResponse {
  success: boolean;
  data?: any;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const params = await context.params;
    const { name } = params;
    
    // For now, return a mock endpoint - in production this would query the database
    const mockEndpoint = {
      id: `endpoint_${Date.now()}`,
      name: name,
      url: 'https://api.example.com/{param}',
      method: 'GET',
      description: 'Example endpoint',
      auth_type: 'none' as const,
      auth_value: '',
      headers: {},
      body_template: '',
      query_params: {},
      response_path: '',
      timeout_ms: 10000,
      max_retries: 3,
      retry_delay_ms: 1000,
      cache_key: '',
      cache_ttl_seconds: 0,
      encrypt_cache: false,
      response_validator: '',
      allowed_domains: [],
      require_https: true,
      log_level: 'info',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'api',
      tags: ['example'],
      ai_enabled: false,
      endpoint_type: 'external_api',
      parameter_schema: {}
    };
    
    const response: EndpointResponse = {
      success: true,
      data: mockEndpoint
    };
    
    return Response.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error fetching endpoint:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch endpoint' },
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const params = await context.params;
    const { name } = params;
    const body = await request.json();
    
    // Validate required fields
    if (!body.url || !body.method) {
      return Response.json(
        { success: false, error: 'Missing required fields: url, method' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }
    
    // Validate method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(body.method.toUpperCase())) {
      return Response.json(
        { success: false, error: `Invalid method: ${body.method}. Must be one of: ${validMethods.join(', ')}` },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }
    
    // In production, this would update the endpoint in the database
    const response: EndpointResponse = {
      success: true,
      data: {
        id: `endpoint_${Date.now()}`,
        name: name,
        message: 'Endpoint updated successfully'
      }
    };
    
    return Response.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error('Error updating endpoint:', error);
    return Response.json(
      { success: false, error: 'Failed to update endpoint' },
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const params = await context.params;
    const { name } = params;
    
    // In production, this would delete the endpoint from the database
    const response: EndpointResponse = {
      success: true,
      data: {
        name: name,
        message: 'Endpoint deleted successfully'
      }
    };
    
    return Response.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error('Error deleting endpoint:', error);
    return Response.json(
      { success: false, error: 'Failed to delete endpoint' },
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