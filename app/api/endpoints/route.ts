import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Define the endpoint schema based on the documentation
interface EndpointRequest {
  name: string;
  url: string;
  method: string;
  description?: string;
  auth_type?: 'none' | 'bearer' | 'basic' | 'api_key';
  auth_value?: string;
  headers?: Record<string, string>;
  body_template?: string;
  query_params?: Record<string, string>;
  response_path?: string;
  timeout_ms?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  cache_key?: string;
  cache_ttl_seconds?: number;
  encrypt_cache?: boolean;
  response_validator?: string;
  allowed_domains?: string[];
  require_https?: boolean;
  log_level?: string;
  created_by?: string;
  tags?: string[];
  ai_enabled?: boolean;
  endpoint_type?: string;
  parameter_schema?: Record<string, any>;
}

interface EndpointResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    message: string;
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
    // For now, return empty list - in production this would query the database
    const response: { success: boolean; data: any[] } = {
      success: true,
      data: []
    };
    
    return Response.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error fetching endpoints:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch endpoints' },
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

export async function POST(request: NextRequest) {
  try {
    const body: EndpointRequest = await request.json();
    
    // Validate required fields
    if (!body.name || !body.url || !body.method) {
      return Response.json(
        { success: false, error: 'Missing required fields: name, url, method' },
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
    
    // Generate a unique ID (in production this would come from database)
    const endpointId = `endpoint_${Date.now()}`;
    
    // Create the endpoint object with defaults
    const endpoint = {
      id: endpointId,
      name: body.name,
      url: body.url,
      method: body.method.toUpperCase(),
      description: body.description || '',
      auth_type: body.auth_type || 'none',
      auth_value: body.auth_value || '',
      headers: body.headers || {},
      body_template: body.body_template || '',
      query_params: body.query_params || {},
      response_path: body.response_path || '',
      timeout_ms: body.timeout_ms || 10000,
      max_retries: body.max_retries || 3,
      retry_delay_ms: body.retry_delay_ms || 1000,
      cache_key: body.cache_key || '',
      cache_ttl_seconds: body.cache_ttl_seconds || 0,
      encrypt_cache: body.encrypt_cache || false,
      response_validator: body.response_validator || '',
      allowed_domains: body.allowed_domains || [],
      require_https: body.require_https !== false, // default to true
      log_level: body.log_level || 'info',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: body.created_by || 'api',
      tags: body.tags || [],
      ai_enabled: body.ai_enabled || false,
      endpoint_type: body.endpoint_type || 'external_api',
      parameter_schema: body.parameter_schema || {}
    };
    
    // In production, this would save to a database
    // For now, we'll just return the created endpoint
    
    const response: EndpointResponse = {
      success: true,
      data: {
        id: endpointId,
        name: body.name,
        message: 'Endpoint created successfully'
      }
    };
    
    return Response.json(response, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error('Error creating endpoint:', error);
    return Response.json(
      { success: false, error: 'Failed to create endpoint' },
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