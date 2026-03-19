import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface TestRequest {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  url?: string; // Allow overriding URL for testing
  method?: string; // Allow overriding method for testing
}

interface TestResponse {
  success: boolean;
  data?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    duration_ms: number;
    request_details: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: any;
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

// Helper function to replace URL placeholders with parameters
function replaceUrlPlaceholders(url: string, params: Record<string, any>): string {
  let result = url;
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{${key}}`;
    if (result.includes(placeholder)) {
      result = result.replace(new RegExp(placeholder, 'g'), encodeURIComponent(String(value)));
    }
  }
  return result;
}

// Helper function to build query string from parameters
function buildQueryString(params: Record<string, any>): string {
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  }
  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  const startTime = Date.now();
  
  try {
    const params = await context.params;
    const { name } = params;
    const testRequest: TestRequest = await request.json();
    
    // Get endpoint configuration (in production, this would come from database)
    // For now, we'll use the test request or default to a test API
    const endpointUrl = testRequest.url || 'https://jsonplaceholder.typicode.com';
    const endpointMethod = testRequest.method?.toUpperCase() || 'GET';
    
    // Determine the actual URL to test
    let testUrl = endpointUrl;
    
    // If it's a GitHub API test, use a real GitHub endpoint
    if (name.toLowerCase().includes('github')) {
      testUrl = 'https://api.github.com';
      if (testRequest.params?.username) {
        testUrl = `https://api.github.com/users/${encodeURIComponent(testRequest.params.username)}`;
      }
    }
    
    // Replace URL placeholders with parameters
    if (testRequest.params) {
      testUrl = replaceUrlPlaceholders(testUrl, testRequest.params);
    }
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'EndpointRegistry-Test/1.0',
      ...testRequest.headers
    };
    
    // Add GitHub API specific headers if testing GitHub
    if (name.toLowerCase().includes('github')) {
      headers['Accept'] = 'application/vnd.github.v3+json';
      // Note: In production, auth headers would come from endpoint configuration
    }
    
    // Prepare request options
    const requestOptions: RequestInit = {
      method: endpointMethod,
      headers,
      redirect: 'follow'
    };
    
    // Add body for POST, PUT, PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(endpointMethod) && testRequest.body) {
      requestOptions.body = JSON.stringify(testRequest.body);
    }
    
    // Make the actual HTTP request
    const response = await fetch(testUrl, requestOptions);
    const duration_ms = Date.now() - startTime;
    
    // Try to parse response body
    let responseBody: any;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      // For binary or unknown content types, return info about the response
      responseBody = {
        message: `Response content type: ${contentType}`,
        size: response.headers.get('content-length') || 'unknown',
        type: contentType
      };
    }
    
    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    const testResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration_ms,
      request_details: {
        url: testUrl,
        method: endpointMethod,
        headers,
        body: testRequest.body
      }
    };
    
    const apiResponse: TestResponse = {
      success: response.ok,
      data: testResponse
    };
    
    return Response.json(apiResponse, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    console.error('Error testing endpoint:', error);
    
    const errorResponse: TestResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test endpoint',
      data: {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: null,
        duration_ms,
        request_details: {
          url: '',
          method: 'GET',
          headers: {},
          body: undefined
        }
      }
    };
    
    return Response.json(errorResponse, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}