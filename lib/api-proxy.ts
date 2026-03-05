/**
 * API Proxy Utility
 * 
 * Forwards requests from Next.js API routes to Cloudflare Worker backend.
 * This maintains backward compatibility while removing business logic from Next.js.
 */

const WORKER_BASE_URL = "https://deepseek-agent.alghamdimo89.workers.dev";

export async function proxyToWorker(
  path: string,
  request: Request,
  options?: {
    transformRequest?: (req: Request) => Promise<RequestInit>;
    transformResponse?: (res: Response) => Promise<Response>;
    params?: Record<string, string>; // For dynamic path parameters
  }
): Promise<Response> {
  const url = new URL(request.url);
  
  // Replace path parameters if provided
  let finalPath = path;
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      finalPath = finalPath.replace(`:${key}`, value);
    }
  }
  
  const workerUrl = `${WORKER_BASE_URL}${finalPath}${url.search}`;
  
  console.log(`[API Proxy] ${request.method} ${path} -> ${workerUrl}`);
  
  // Prepare request for worker
  const requestInit: RequestInit = {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(request.headers.entries())
    },
    // Don't forward body for GET/HEAD requests
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text()
  };
  
  // Apply custom request transformation if provided
  const finalRequestInit = options?.transformRequest 
    ? await options.transformRequest(request)
    : requestInit;
  
  try {
    // Forward request to worker
    const workerResponse = await fetch(workerUrl, finalRequestInit);
    
    // Apply custom response transformation if provided
    const finalResponse = options?.transformResponse
      ? await options.transformResponse(workerResponse)
      : workerResponse;
    
    console.log(`[API Proxy] Response: ${workerResponse.status} ${workerResponse.statusText}`);
    return finalResponse;
  } catch (error) {
    console.error(`[API Proxy] Error forwarding to worker:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Failed to forward request to backend: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: 'PROXY_ERROR'
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Helper to create proxy handlers for different HTTP methods
export const proxyHandlers = {
  GET: (path: string) => async (request: Request) => 
    proxyToWorker(path, request),
  
  POST: (path: string) => async (request: Request) => 
    proxyToWorker(path, request),
  
  PUT: (path: string) => async (request: Request) => 
    proxyToWorker(path, request),
  
  DELETE: (path: string) => async (request: Request) => 
    proxyToWorker(path, request),
  
  PATCH: (path: string) => async (request: Request) => 
    proxyToWorker(path, request)
};