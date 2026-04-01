// Hono HTTP API with CRUD endpoints
import { Hono } from 'hono';
import { CloudflareBindings } from './types';
import { ConversationOrchestratorDO_2026A } from './durable/ConversationDO';
import { crudApi } from './crud-api';
import { graphApi } from './graph-api';
import { successResponse, errorResponse, notFoundResponse } from './response';
import { VERSION, BUILD_TIME } from './version';

// Dummy FlowControllerDO to satisfy existing binding
export class FlowControllerDO {
  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
  }
  
  async fetch(request: Request) {
    return new Response('FlowControllerDO: Not implemented', { status: 501 });
  }
  
  state: any;
  env: any;
}

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Add top-level request logging
app.use('*', async (c, next) => {
  console.log("Request:", c.req.method, new URL(c.req.url).pathname);
  await next();
});

// CORS middleware
app.use('*', async (c, next) => {
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // Set CORS headers for other requests
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  c.header('Access-Control-Max-Age', '86400');
  
  await next();
});

// Mount CRUD API at /api
app.route('/api', crudApi);

// Mount Graph API at /graph
app.route('/graph', graphApi);

// Rate limiting middleware with token bucket algorithm
const rateLimitMiddleware = async (c: any, next: any) => {
  // Skip rate limiting for health checks and CRUD API
  if (c.req.path === '/health' || c.req.path.startsWith('/api/')) {
    return next();
  }
  
  // Get client IP (using CF-Connecting-IP header in Cloudflare Workers)
  const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  
  // Rate limiting configuration
  const RATE_LIMIT_WINDOW = 60000; // 1 minute window
  const MAX_REQUESTS_PER_MINUTE = 60; // 60 requests per minute per IP
  const MAX_CONCURRENT_CONVERSATIONS = 20; // Global limit (reduced from 50 for 24-hour operation)
  
  // Check if KV is available
  if (!c.env.RATE_LIMIT_KV) {
    console.log(`[RATE_LIMIT] KV not available, skipping rate limiting for ${clientIp} to ${c.req.path}`);
    return next();
  }
  
  const kv = c.env.RATE_LIMIT_KV;
  
  // ==========================================================================
  // 1. Check global concurrent conversation limit
  // ==========================================================================
  if (c.req.path === '/start' || c.req.path === '/attach') {
    try {
      const activeConversationsKey = 'global:active_conversations';
      const activeConversations = await kv.get(activeConversationsKey);
      const currentCount = parseInt(activeConversations || '0');
      
      if (currentCount >= MAX_CONCURRENT_CONVERSATIONS) {
        console.log(`[RATE_LIMIT] Global conversation limit reached: ${currentCount}/${MAX_CONCURRENT_CONVERSATIONS}`);
        return c.json(errorResponse('Too many active conversations. Please try again later.', 429));
      }
    } catch (error) {
      console.error(`[RATE_LIMIT] Error checking global limit: ${error}`);
      // Continue if KV fails
    }
  }
  
  // ==========================================================================
  // 2. Check per-IP rate limit using token bucket algorithm
  // ==========================================================================
  const bucketKey = `rate_limit:${clientIp}`;
  
  try {
    // Get current bucket state
    const bucketData = await kv.get(bucketKey, 'json');
    let tokens = MAX_REQUESTS_PER_MINUTE;
    let lastRefill = now;
    
    if (bucketData) {
      tokens = bucketData.tokens;
      lastRefill = bucketData.lastRefill;
      
      // Refill tokens based on time passed
      const timePassed = now - lastRefill;
      const refillAmount = Math.floor(timePassed / RATE_LIMIT_WINDOW) * MAX_REQUESTS_PER_MINUTE;
      
      if (refillAmount > 0) {
        tokens = Math.min(MAX_REQUESTS_PER_MINUTE, tokens + refillAmount);
        lastRefill = now;
      }
    }
    
    // Check if we have tokens
    if (tokens <= 0) {
      console.log(`[RATE_LIMIT] Rate limit exceeded for ${clientIp}: ${tokens} tokens remaining`);
      
      // Calculate retry-after time
      const timeUntilNextToken = RATE_LIMIT_WINDOW - (now - lastRefill);
      const retryAfterSeconds = Math.ceil(timeUntilNextToken / 1000);
      
      return c.json(errorResponse('Rate limit exceeded', 429));
    }
    
    // Consume one token
    tokens -= 1;
    
    // Save updated bucket state
    await kv.put(bucketKey, JSON.stringify({
      tokens,
      lastRefill
    }), { expirationTtl: 120 }); // 2 minute TTL
    
    console.log(`[RATE_LIMIT] ${clientIp} has ${tokens} tokens remaining`);
    
  } catch (error) {
    console.error(`[RATE_LIMIT] Error processing rate limit for ${clientIp}: ${error}`);
    // Continue if KV fails
  }
  
  return next();
};

// Apply rate limiting middleware to all routes except CRUD API
// TODO: Re-enable after debugging
// app.use('*', rateLimitMiddleware);

// Root endpoint - redirect to API documentation or return simple message
app.get('/', (c) => {
  return c.json({
    message: 'DeepSeek Agent API',
    version: '1.0.0',
    endpoints: {
      api: '/api/*',
      commands: '/commands',
      health: '/health',
      start: '/start',
      resume: '/resume',
      attach: '/attach',
      status: '/status/:id'
    }
  });
});






// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================
app.get('/health', async (c) => {
  const healthChecks: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: VERSION,
    build_time: BUILD_TIME,
    services: {}
  };
  
  // Check D1 database if available
  if (c.env.FLOW_RUNS_DB) {
    try {
      const result = await c.env.FLOW_RUNS_DB.prepare('SELECT 1 as test').first();
      healthChecks.services.d1_database = 'connected';
      healthChecks.services.d1_test_result = result;
    } catch (error: any) {
      healthChecks.services.d1_database = 'error';
      healthChecks.services.d1_error = error.message;
      healthChecks.status = 'degraded';
    }
  } else {
    healthChecks.services.d1_database = 'not_configured';
  }
  
  // Check KV if available
  if (c.env.RATE_LIMIT_KV) {
    try {
      await c.env.RATE_LIMIT_KV.get('health_test');
      healthChecks.services.kv = 'connected';
    } catch (error: any) {
      healthChecks.services.kv = 'error';
      healthChecks.services.kv_error = error.message;
      healthChecks.status = 'degraded';
    }
  } else {
    healthChecks.services.kv = 'not_configured';
  }
  
  // Check Durable Objects if available
  if (c.env.CONVERSATIONS) {
    healthChecks.services.durable_objects = 'available';
  } else {
    healthChecks.services.durable_objects = 'not_configured';
  }
  
  // Check environment variables
  healthChecks.services.deepseek_api_key = c.env.DEEPSEEK_API_KEY ? 'configured' : 'missing';
  healthChecks.services.openhands_api_url = c.env.OPENHANDS_API_URL ? 'configured' : 'missing';
  
  return c.json(successResponse(healthChecks));
});

// ============================================================================
// CONVERSATION ENDPOINTS (existing functionality)
// ============================================================================

// Start a new conversation
app.post('/start', async (c) => {
  try {
    const body = await c.req.json();
    const { repository, branch, initial_user_prompt, max_iterations, flow_id, inputs, callback_url } = body;
    
    // FLOW-BASED EXECUTION
    if (flow_id) {
      console.log(`[HTTP:START:FLOW] Starting flow execution for flow_id: ${flow_id}`);
      
      // Validate flow_id exists in database
      if (c.env.FLOW_RUNS_DB) {
        try {
          // Use flow_definitions table (primary table)
          const flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions WHERE id = ?').bind(flow_id).first();
          
          if (!flowResult) {
            return c.json(notFoundResponse(`Flow not found: ${flow_id}`));
          }
          
          // Use flow definition values if not provided in request
          const targetFlowId = flow_id;
          const targetRepository = repository || (flowResult as any).repository;
          const targetBranch = branch || (flowResult as any).branch;
          const targetInitialUserPrompt = initial_user_prompt || (flowResult as any).description || (flowResult as any).name;
          const targetMaxIterations = max_iterations || (flowResult as any).max_iterations;
          
          console.log(`[HTTP:START:FLOW] Using flow definition: ${targetFlowId}, repo: ${targetRepository}, branch: ${targetBranch}`);
          
          // VALIDATE DEEPSEEK API KEY BEFORE STARTING FLOW
          console.log(`[HTTP:START:FLOW] Validating DeepSeek API key configuration...`);
          console.log(`[HTTP:START:FLOW] DEEPSEEK_API_KEY present in worker env: ${!!c.env.DEEPSEEK_API_KEY}`);
          console.log(`[HTTP:START:FLOW] DEEPSEEK_API_KEY first 10 chars: ${c.env.DEEPSEEK_API_KEY ? c.env.DEEPSEEK_API_KEY.substring(0, 10) + '...' : 'MISSING'}`);
          console.log(`[HTTP:START:FLOW] DEEPSEEK_API_KEY format check: ${c.env.DEEPSEEK_API_KEY ? (c.env.DEEPSEEK_API_KEY.startsWith('sk-') ? 'VALID (starts with sk-)' : 'INVALID (does not start with sk-)') : 'MISSING'}`);
          
          // Log DeepSeek API request details that will be sent
          console.log(`[HTTP:START:FLOW] DeepSeek API endpoint: https://api.deepseek.com/chat/completions`);
          console.log(`[HTTP:START:FLOW] DeepSeek API headers: Authorization: Bearer ${c.env.DEEPSEEK_API_KEY ? c.env.DEEPSEEK_API_KEY.substring(0, 8) + '...' : 'MISSING'}, Content-Type: application/json`);
          console.log(`[HTTP:START:FLOW] DeepSeek API model: deepseek-chat, temperature: 0.7, max_tokens: 2000`);
          console.log(`[HTTP:START:FLOW] Note: Flow may make multiple DeepSeek API calls (6 potential call sites in code)`);
          
          // Create a new Durable Object for this conversation
          const id = c.env.CONVERSATIONS.newUniqueId();
          const conversationDo = c.env.CONVERSATIONS.get(id);
          
          // Use flow execution mode (start-flow endpoint) for proper step execution with task injection
          // PASS DEEPSEEK API KEY TO DURABLE OBJECT to ensure it has the correct key
          console.log(`[HTTP:START:FLOW] Passing DEEPSEEK_API_KEY to Durable Object...`);
          const initResponse = await conversationDo.fetch('http://placeholder/start-flow', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-DeepSeek-API-Key': c.env.DEEPSEEK_API_KEY || ''
            },
            body: JSON.stringify({
              flow_id: targetFlowId,
              inputs: inputs || {},
              callback_url: callback_url,
              deepseek_api_key: c.env.DEEPSEEK_API_KEY // Pass in body too for redundancy
            })
          });
          
          if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error(`[HTTP:START:FLOW] Durable Object start-flow failed: ${initResponse.status} - ${errorText}`);
            
            try {
              // Try to parse the error response as JSON to get detailed error info
              const errorJson = JSON.parse(errorText);
              return c.json(errorResponse(`Failed to start flow execution: ${errorJson.error || errorJson.message || 'Unknown error'}`, 500));
            } catch (parseError) {
              // If not JSON, return the raw error text
              return c.json(errorResponse(`Failed to start flow execution: ${errorText.substring(0, 200)}`, 500));
            }
          }
          
          // Parse the Durable Object response to get flow_run_id
          const doResponse = await initResponse.json();
          const flowRunId = doResponse.flow_run_id;
          
          // Track active conversation count
          try {
            if (c.env.RATE_LIMIT_KV) {
              const activeConversationsKey = 'global:active_conversations';
              const currentCount = await c.env.RATE_LIMIT_KV.get(activeConversationsKey);
              const newCount = parseInt(currentCount || '0') + 1;
              await c.env.RATE_LIMIT_KV.put(activeConversationsKey, newCount.toString(), { expirationTtl: 3600 }); // 1 hour TTL
              console.log(`[RATE_LIMIT] Active conversations: ${newCount}`);
            }
          } catch (error) {
            console.error(`[RATE_LIMIT] Error tracking active conversation: ${error}`);
          }
          
          // Return IMMEDIATELY - work happens in alarms
          return c.json(successResponse({ 
            message: 'Flow execution started. Work will happen in background via alarms.', 
            conversation_id: id.toString(), 
            flow_id: targetFlowId, 
            flow_run_id: flowRunId,
            note: 'Flow execution: DeepSeek → OpenHands → API validation → Next step', 
            check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}` 
          }));
          
        } catch (dbError: any) {
          console.error(`[HTTP:START:FLOW] Database error checking flow: ${dbError.message}`);
          return c.json(errorResponse(`Database error checking flow: ${dbError.message}`, 500));
        }
      } else {
        return c.json(errorResponse('Database not configured for flow execution', 500));
      }
      
    } else {
      // Check if we should start highest priority flow (when no parameters provided)
      if (!repository && !initial_user_prompt) {
        console.log(`[HTTP:START] No flow_id provided and no repository/initial_user_prompt - automatic flow start temporarily disabled`);
        
        // TEMPORARILY DISABLED: Automatic flow start
        // Return error instead of starting flow automatically
        return c.json(errorResponse('Automatic flow start is temporarily disabled. Please provide flow_id, repository, and initial_user_prompt parameters.', 400));
        
        // Original code commented out:
        /*
        // Start highest priority flow (same logic as GET /start)
        if (!c.env.FLOW_RUNS_DB) {
          return c.json(errorResponse('Database not configured for flow execution', 500));
        }
        
        try {
          // Get the flow with highest priority from flow_definitions table
          const flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions ORDER BY priority DESC, created_at DESC LIMIT 1').first();
          
          if (!flowResult) {
            return c.json(notFoundResponse('No flows found in database'));
          }
          
          const targetFlowId = (flowResult as any).id;
          const targetRepository = (flowResult as any).repository;
          const targetBranch = (flowResult as any).branch || 'main';
          const targetInitialUserPrompt = (flowResult as any).name || (flowResult as any).description || `Execute flow: ${targetFlowId}`;
          const targetMaxIterations = (flowResult as any).max_iterations || 20;
          const flowPriority = (flowResult as any).priority || 0;
          
          console.log(`[HTTP:START] Starting highest priority flow: ${targetFlowId} (priority: ${flowPriority}), repo: ${targetRepository}, branch: ${targetBranch}`);
          
          // Create a new Durable Object for this conversation
          const id = c.env.CONVERSATIONS.newUniqueId();
          const conversationDo = c.env.CONVERSATIONS.get(id);
          
          // Initialize the Durable Object with flow context
          const initResponse = await conversationDo.fetch('http://placeholder/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repository: targetRepository,
              branch: targetBranch,
              initial_user_prompt: targetInitialUserPrompt,
              max_iterations: targetMaxIterations
            })
          });
          
          if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error(`[HTTP:START] Durable Object init failed: ${initResponse.status} - ${errorText}`);
            return c.json(errorResponse(`Failed to start flow execution: ${initResponse.status}`, 500));
          }
          
          // Track active conversation count
          try {
            if (c.env.RATE_LIMIT_KV) {
              const activeConversationsKey = 'global:active_conversations';
              const currentCount = await c.env.RATE_LIMIT_KV.get(activeConversationsKey);
              const newCount = parseInt(currentCount || '0') + 1;
              await c.env.RATE_LIMIT_KV.put(activeConversationsKey, newCount.toString(), { expirationTtl: 3600 }); // 1 hour TTL
              console.log(`[RATE_LIMIT] Active conversations: ${newCount}`);
            }
          } catch (error) {
            console.error(`[RATE_LIMIT] Error tracking active conversation: ${error}`);
          }
          
          // Return IMMEDIATELY - work happens in alarms
          return c.json(successResponse({ 
            message: 'Highest priority flow execution started. Work will happen in background via alarms.',
            conversation_id: id.toString(), 
            flow_id: targetFlowId,
            flow_name: (flowResult as any).name,
            flow_priority: flowPriority,
            note: 'Flow execution: DeepSeek → OpenHands → API validation → Next step', 
            check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}` 
          }));
          
        } catch (dbError: any) {
          console.error(`[HTTP:START] Database error: ${dbError.message}`);
          return c.json(errorResponse(`Database error: ${dbError.message}`, 500));
        }
        */
      }
      
      // ORIGINAL REPOSITORY-BASED CONVERSATION
      // Validate required fields
      if (!repository || !initial_user_prompt) {
        return c.json(errorResponse('Need repository and initial_user_prompt (branch is optional), or provide flow ID. Automatic flow start is temporarily disabled.', 400));
      }

      console.log(`[HTTP:START] Creating conversation for repository: ${repository}`);
      
      // Create a new Durable Object for this conversation
      const id = c.env.CONVERSATIONS.newUniqueId();
      const conversationDo = c.env.CONVERSATIONS.get(id);
      
      // Initialize the Durable Object - NO AWAIT to external APIs
      const initResponse = await conversationDo.fetch('http://placeholder/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository,
          branch: branch || 'main',
          initial_user_prompt,
          max_iterations: max_iterations || 20
        })
      });
      
      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error(`[HTTP:START] Durable Object init failed: ${initResponse.status} - ${errorText}`);
        return c.json(errorResponse(`Failed to start conversation: ${initResponse.status}`, 500));
      }
      
      // Track active conversation count
      try {
        if (c.env.RATE_LIMIT_KV) {
          const activeConversationsKey = 'global:active_conversations';
          const currentCount = await c.env.RATE_LIMIT_KV.get(activeConversationsKey);
          const newCount = parseInt(currentCount || '0') + 1;
          await c.env.RATE_LIMIT_KV.put(activeConversationsKey, newCount.toString(), { expirationTtl: 3600 }); // 1 hour TTL
          console.log(`[RATE_LIMIT] Active conversations: ${newCount}`);
        }
      } catch (error) {
        console.error(`[RATE_LIMIT] Error tracking active conversation: ${error}`);
      }
      
      // Return IMMEDIATELY - work happens in alarms
      return c.json(successResponse({ message: 'Conversation started. Work will happen in background via alarms.', conversation_id: id.toString(), note: 'Flow: DeepSeek → OpenHands → DeepSeek → OpenHands → ...', check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}` }));
    }
    
  } catch (error: any) {
    console.error(`[HTTP:START] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

// ============================================================================
// GET /start - Start a flow by priority (default: highest priority) - TEMPORARILY DISABLED
// ============================================================================
app.get('/start', async (c) => {
  try {
    // Check for optional priority query parameter
    const priorityParam = c.req.query('priority');
    const targetPriority = priorityParam ? parseInt(priorityParam) : null;
    
    console.log(`[HTTP:START:GET] GET /start endpoint temporarily disabled`);
    
    // TEMPORARILY DISABLED: Automatic flow start via GET
    return c.json(errorResponse('GET /start endpoint is temporarily disabled. Use POST /start with flow_id parameter instead.', 400));
    
    // Original code commented out:
    /*
    if (!c.env.FLOW_RUNS_DB) {
      return c.json(errorResponse('Database not configured for flow execution', 500));
    }
    
    try {
      let flowResult;
      
      if (targetPriority !== null) {
        // Get a flow with specific priority - try flow_definitions first (has priority column)
        flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions WHERE priority = ? ORDER BY created_at DESC LIMIT 1').bind(targetPriority).first();
        
        if (!flowResult) {
          return c.json(notFoundResponse(`No flows found with priority ${targetPriority}`));
        }
      } else {
        // Get the flow with highest priority from flow_definitions table
        flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions ORDER BY priority DESC, created_at DESC LIMIT 1').first();
        
        if (!flowResult) {
          return c.json(notFoundResponse('No flows found in database'));
        }
      }
      
      const targetFlowId = (flowResult as any).id;
      const targetRepository = (flowResult as any).repository;
      const targetBranch = (flowResult as any).branch || 'main';
      const targetInitialUserPrompt = (flowResult as any).name || (flowResult as any).description || `Execute flow: ${targetFlowId}`;
      const targetMaxIterations = (flowResult as any).max_iterations || 20;
      const flowPriority = (flowResult as any).priority || 0;
      
      console.log(`[HTTP:START:GET] Starting flow: ${targetFlowId} (priority: ${flowPriority}), repo: ${targetRepository}, branch: ${targetBranch}`);
      
      // Create a new Durable Object for this conversation
      const id = c.env.CONVERSATIONS.newUniqueId();
      const conversationDo = c.env.CONVERSATIONS.get(id);
      
      // Initialize the Durable Object with flow context
      const initResponse = await conversationDo.fetch('http://placeholder/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: targetRepository,
          branch: targetBranch,
          initial_user_prompt: targetInitialUserPrompt,
          max_iterations: targetMaxIterations
        })
      });
      
      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error(`[HTTP:START:GET] Durable Object init failed: ${initResponse.status} - ${errorText}`);
        return c.json(errorResponse(`Failed to start flow execution: ${initResponse.status}`, 500));
      }
      
      // Track active conversation count
      try {
        if (c.env.RATE_LIMIT_KV) {
          const activeConversationsKey = 'global:active_conversations';
          const currentCount = await c.env.RATE_LIMIT_KV.get(activeConversationsKey);
          const newCount = parseInt(currentCount || '0') + 1;
          await c.env.RATE_LIMIT_KV.put(activeConversationsKey, newCount.toString(), { expirationTtl: 3600 }); // 1 hour TTL
          console.log(`[RATE_LIMIT] Active conversations: ${newCount}`);
        }
      } catch (error) {
        console.error(`[RATE_LIMIT] Error tracking active conversation: ${error}`);
      }
      
      // Return IMMEDIATELY - work happens in alarms
      const message = targetPriority !== null 
        ? `Flow with priority ${targetPriority} execution started. Work will happen in background via alarms.`
        : 'Highest priority flow execution started. Work will happen in background via alarms.';
      
      return c.json(successResponse({ 
        message,
        conversation_id: id.toString(), 
        flow_id: targetFlowId,
        flow_name: (flowResult as any).name,
        flow_priority: flowPriority,
        requested_priority: targetPriority,
        note: 'Flow execution: DeepSeek → OpenHands → API validation → Next step', 
        check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}` 
      }));
      
    } catch (dbError: any) {
      console.error(`[HTTP:START:GET] Database error: ${dbError.message}`);
      return c.json(errorResponse(`Database error: ${dbError.message}`, 500));
    }
    */
    
  } catch (error: any) {
    console.error(`[HTTP:START:GET] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

// ============================================================================
// STATUS ENDPOINT (missing implementation)
// ============================================================================
app.get('/status/:id', async (c) => {
  try {
    const conversationId = c.req.param('id');
    
    if (!c.env.CONVERSATIONS) {
      return c.json(errorResponse('Durable Objects not configured', 500));
    }
    
    // Get the Durable Object
    let id;
    try {
      id = c.env.CONVERSATIONS.idFromString(conversationId);
    } catch (error) {
      return c.json(errorResponse('Invalid conversation ID', 400));
    }
    
    const conversationDo = c.env.CONVERSATIONS.get(id);
    
    // Call the Durable Object's status endpoint
    const doResponse = await conversationDo.fetch('http://placeholder/status');
    
    if (!doResponse.ok) {
      const errorText = await doResponse.text();
      console.error(`[HTTP:STATUS] Durable Object error: ${doResponse.status} - ${errorText}`);
      return c.json(errorResponse(`Failed to get conversation status: ${doResponse.status}`, 500));
    }
    
    const data = await doResponse.json();
    
    // Return enriched conversation data with execution results
    return new Response(JSON.stringify({
      success: true,
      data: {
        conversation: {
          state: data.conversation.state,
          flow_completed: data.conversation.flow_completed,
          flow_steps: (data.conversation.flow_steps || []).map((step: any) => ({
            id: step.step_id, // Use step_id from StepData interface
            title: step.title,
            instructions: step.rendered_instructions || step.description || '', // Use rendered instructions first, fallback to description
            // 🔥 REQUIRED FIELDS
            response: step.response || null,
            status: step.status || "pending"
          }))
        }
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error(`[HTTP:STATUS] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

// ============================================================================
// STOP ENDPOINT - Stop a running conversation/flow
// ============================================================================
app.post('/stop', async (c) => {
  try {
    const body = await c.req.json();
    const { conversation_id } = body;
    
    if (!conversation_id) {
      return c.json(errorResponse('Missing conversation_id parameter', 400));
    }
    
    if (!c.env.CONVERSATIONS) {
      return c.json(errorResponse('Durable Objects not configured', 500));
    }
    
    // Get the Durable Object
    let id;
    try {
      id = c.env.CONVERSATIONS.idFromString(conversation_id);
    } catch (error) {
      return c.json(errorResponse('Invalid conversation ID', 400));
    }
    
    const conversationDo = c.env.CONVERSATIONS.get(id);
    
    // Call the Durable Object's stop endpoint
    const doResponse = await conversationDo.fetch('http://placeholder/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!doResponse.ok) {
      const errorText = await doResponse.text();
      console.error(`[HTTP:STOP] Durable Object error: ${doResponse.status} - ${errorText}`);
      return c.json(errorResponse(`Failed to stop conversation: ${doResponse.status}`, 500));
    }
    
    // Decrement active conversation count
    try {
      if (c.env.RATE_LIMIT_KV) {
        const activeConversationsKey = 'global:active_conversations';
        const currentCount = await c.env.RATE_LIMIT_KV.get(activeConversationsKey);
        const newCount = Math.max(0, parseInt(currentCount || '0') - 1);
        await c.env.RATE_LIMIT_KV.put(activeConversationsKey, newCount.toString(), { expirationTtl: 3600 }); // 1 hour TTL
        console.log(`[RATE_LIMIT] Active conversations after stop: ${newCount}`);
      }
    } catch (error) {
      console.error(`[RATE_LIMIT] Error updating active conversation count: ${error}`);
    }
    
    const result = await doResponse.json();
    return c.json(successResponse(result));
    
  } catch (error: any) {
    console.error(`[HTTP:STOP] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

// ============================================================================
// RESUME ENDPOINT - Resume a conversation waiting for input
// ============================================================================
app.post('/resume', async (c) => {
  try {
    const body = await c.req.json();
    const { conversation_id, input, source } = body;
    
    if (!conversation_id) {
      return c.json(errorResponse('Missing conversation_id parameter', 400));
    }
    
    if (!c.env.CONVERSATIONS) {
      return c.json(errorResponse('Durable Objects not configured', 500));
    }
    
    // Get the Durable Object
    let id;
    try {
      id = c.env.CONVERSATIONS.idFromString(conversation_id);
    } catch (error) {
      return c.json(errorResponse('Invalid conversation ID', 400));
    }
    
    const conversationDo = c.env.CONVERSATIONS.get(id);
    
    // Call the Durable Object's resume endpoint
    const doResponse = await conversationDo.fetch('http://placeholder/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, source })
    });
    
    if (!doResponse.ok) {
      const errorText = await doResponse.text();
      console.error(`[HTTP:RESUME] Durable Object error: ${doResponse.status} - ${errorText}`);
      return c.json(errorResponse(`Failed to resume conversation: ${doResponse.status}`, 500));
    }
    
    const result = await doResponse.json();
    return c.json(successResponse('Conversation resumed successfully', result));
    
  } catch (error: any) {
    console.error(`[HTTP:RESUME] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

// ============================================================================
// DELETE ENDPOINT - Delete a conversation/flow (permanent removal)
// ============================================================================
app.delete('/conversation/:id', async (c) => {
  try {
    const conversationId = c.req.param('id');
    
    if (!c.env.CONVERSATIONS) {
      return c.json(errorResponse('Durable Objects not configured', 500));
    }
    
    // Get the Durable Object
    let id;
    try {
      id = c.env.CONVERSATIONS.idFromString(conversationId);
    } catch (error) {
      return c.json(errorResponse('Invalid conversation ID', 400));
    }
    
    const conversationDo = c.env.CONVERSATIONS.get(id);
    
    // Call the Durable Object's delete endpoint
    const doResponse = await conversationDo.fetch('http://placeholder/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!doResponse.ok) {
      const errorText = await doResponse.text();
      console.error(`[HTTP:DELETE] Durable Object error: ${doResponse.status} - ${errorText}`);
      return c.json(errorResponse(`Failed to delete conversation: ${doResponse.status}`, 500));
    }
    
    // Decrement active conversation count
    try {
      if (c.env.RATE_LIMIT_KV) {
        const activeConversationsKey = 'global:active_conversations';
        const currentCount = await c.env.RATE_LIMIT_KV.get(activeConversationsKey);
        const newCount = Math.max(0, parseInt(currentCount || '0') - 1);
        await c.env.RATE_LIMIT_KV.put(activeConversationsKey, newCount.toString(), { expirationTtl: 3600 }); // 1 hour TTL
        console.log(`[RATE_LIMIT] Active conversations after delete: ${newCount}`);
      }
    } catch (error) {
      console.error(`[RATE_LIMIT] Error updating active conversation count: ${error}`);
    }
    
    const result = await doResponse.json();
    return c.json(successResponse(result));
    
  } catch (error: any) {
    console.error(`[HTTP:DELETE] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

// ============================================================================
// SSE STREAMING ENDPOINT FOR EXECUTION EVENTS
// ============================================================================
app.get('/execution-events/:flowRunId', async (c) => {
  try {
    const flowRunId = c.req.param('flowRunId');
    
    if (!flowRunId) {
      return c.json(errorResponse('Missing flowRunId parameter', 400));
    }
    
    console.log(`[HTTP:SSE] Starting SSE stream for flowRunId: ${flowRunId}`);
    
    // Create a TransformStream for the SSE response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Write SSE headers
    writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', flowRunId, timestamp: Date.now() })}\n\n`));
    
    // Store the writer for event emission (in a real implementation, this would be in a global store)
    // For now, we'll just return the stream and events will be emitted to all active streams
    // In production, you'd want to manage this with a proper event bus
    
    // Set up response with SSE headers
    const response = new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
    // Store the writer in a global map (simplified - in production use proper event bus)
    // This is a simplified implementation - in a real app you'd use a proper event bus
    const streamId = `${flowRunId}-${Date.now()}`;
    console.log(`[HTTP:SSE] Created SSE stream ${streamId} for flowRunId: ${flowRunId}`);
    
    // Clean up when connection closes
    c.req.signal.addEventListener('abort', () => {
      console.log(`[HTTP:SSE] SSE stream ${streamId} closed`);
      writer.close();
    });
    
    return response;

  } catch (error: any) {
    console.error(`[HTTP:SSE] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

// Proxy endpoint for DeepSeek API calls (to avoid 403 errors from Durable Objects)
app.post('/proxy/deepseek', async (c) => {
  const body = await c.req.json()

  console.log("PROXY DS CALL", {
    messagesLength: body.messages?.length
  })

  // Use API key from request if provided, otherwise use env variable
  const apiKeyFromRequest = body.api_key || c.req.header('X-DeepSeek-API-Key');
  const apiKey = apiKeyFromRequest || c.env.DEEPSEEK_API_KEY;
  
  // Remove api_key from body before forwarding to DeepSeek API
  const { api_key, ...forwardBody } = body;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(forwardBody)
  })

  const text = await res.text()

  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' }
  })
})

// Test endpoint for DeepSeek API
app.get('/test-deepseek', async (c) => {
  try {
    console.log(`[HTTP:TEST-DEEPSEEK] Testing DeepSeek API`);
    
    // Import the callDeepSeek function
    const { callDeepSeek } = await import('./services/deepseek');
    
    // Simple test message
    const messages = [
      {
        role: 'user',
        content: 'hi'
      }
    ];
    
    console.log(`[HTTP:TEST-DEEPSEEK] Calling DeepSeek with message: "hi"`);
    console.log(`[HTTP:TEST-DEEPSEEK] API Key from env: ${c.env.DEEPSEEK_API_KEY ? 'Present' : 'Missing'}`);
    console.log(`[HTTP:TEST-DEEPSEEK] API Key first 8 chars: ${c.env.DEEPSEEK_API_KEY ? c.env.DEEPSEEK_API_KEY.substring(0, 8) + '...' : 'MISSING'}`);
    
    console.log("DS CALL", {
      key: c.env.DEEPSEEK_API_KEY?.slice(0,5),
      path: "test-deepseek-endpoint"
    });
    
    const result = await callDeepSeek(c.env.DEEPSEEK_API_KEY, messages);
    
    if (!result.success) {
      console.error(`[HTTP:TEST-DEEPSEEK] DeepSeek API call failed: ${result.error}`);
      return c.json({
        success: false,
        error: result.error,
        errorDetails: result.errorDetails,
        message: 'DeepSeek API call failed'
      }, 500);
    }
    
    console.log(`[HTTP:TEST-DEEPSEEK] DeepSeek API call successful`);
    return c.json({
      success: true,
      response: result.response,
      message: 'DeepSeek API test successful'
    });
    
  } catch (error: any) {
    console.error(`[HTTP:TEST-DEEPSEEK] Endpoint error: ${error.message}`);
    return c.json({
      success: false,
      error: error.message,
      message: 'Test endpoint error'
    }, 500);
  }
});

export default app;
export { ConversationOrchestratorDO_2026A };
// Export old class names for reference (not used)
export { ConversationOrchestratorDO_2026A as ConversationDO_v2 };
export { ConversationOrchestratorDO_2026A as ConversationDO };
