// Hono HTTP API with CRUD endpoints
import { Hono } from 'hono';
import { CloudflareBindings } from './types';
import { StrictConversationDO } from './durable/StrictConversationDO';
import { crudApi } from './crud-api';
import { graphApi } from './graph-api';
import { successResponse, errorResponse, notFoundResponse } from './response';

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
      attach: '/attach',
      status: '/status/:id'
    }
  });
});

// Commands endpoint for AI discovery
app.get('/commands', async (c) => {
  try {
    const db = c.env.FLOW_RUNS_DB;
    if (!db) {
      return c.json({ 
        error: 'Database not configured',
        commands: [],
        count: 0
      }, 200); // Return 200 with empty commands instead of 500
    }

    // Get all AI-enabled commands
    const query = `
      SELECT 
        name,
        description,
        method,
        url as endpoint,
        parameter_schema,
        tags
      FROM endpoint_registry 
      WHERE ai_enabled = TRUE
      ORDER BY name
    `;
    
    const result = await db.prepare(query).all();
    
    // Parse JSON fields
    const commands = result.results.map((cmd: any) => ({
      name: cmd.name,
      description: cmd.description,
      method: cmd.method,
      endpoint: cmd.endpoint,
      parameters: cmd.parameter_schema ? JSON.parse(cmd.parameter_schema) : null,
      tags: cmd.tags ? JSON.parse(cmd.tags) : []
    }));
    
    return c.json({
      commands,
      count: commands.length,
      note: 'Use [COMMAND:name] params: {JSON_parameters} format to execute commands'
    });
    
  } catch (error: any) {
    console.error('Error fetching AI commands:', error);
    return c.json({ 
      error: `Error fetching commands: ${error.message}`,
      commands: [],
      count: 0
    }, 200); // Return 200 with error instead of 500
  }
});



// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================
app.get('/health', async (c) => {
  const healthChecks: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
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
    const { repository, branch, initial_user_prompt, max_iterations, flow_id } = body;
    
    // FLOW-BASED EXECUTION
    if (flow_id) {
      console.log(`[HTTP:START:FLOW] Starting flow execution for flow_id: ${flow_id}`);
      
      // Validate flow_id exists in database
      if (c.env.FLOW_RUNS_DB) {
        try {
          // Try flow_definitions table first (has priority column and real data)
          let flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions WHERE id = ?').bind(flow_id).first();
          
          // If not found in flow_definitions, try flows table (for backward compatibility)
          if (!flowResult) {
            try {
              flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flows WHERE id = ?').bind(flow_id).first();
            } catch (flowsError: any) {
              // flows table might not exist, that's OK - just continue with null
              console.log(`[HTTP:START:FLOW] flows table not available: ${flowsError.message}`);
              flowResult = null;
            }
          }
          
          if (!flowResult) {
            return c.json(notFoundResponse(`Flow not found: ${flow_id}`));
          }
          
          // Use flow definition values if not provided in request
          const targetFlowId = flow_id;
          const targetRepository = repository || (flowResult as any).repository || (flowResult as any).repo;
          const targetBranch = branch || (flowResult as any).branch;
          const targetInitialUserPrompt = initial_user_prompt || (flowResult as any).description || (flowResult as any).name;
          const targetMaxIterations = max_iterations || (flowResult as any).max_iterations;
          
          console.log(`[HTTP:START:FLOW] Using flow definition: ${targetFlowId}, repo: ${targetRepository}, branch: ${targetBranch}`);
          
          // Create a new Durable Object for this conversation
          const id = c.env.CONVERSATIONS.newUniqueId();
          const conversationDo = c.env.CONVERSATIONS.get(id);
          
          // Use flow execution mode (start-flow endpoint) for proper step execution with task injection
          const initResponse = await conversationDo.fetch('http://placeholder/start-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flow_id: targetFlowId
            })
          });
          
          if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error(`[HTTP:START:FLOW] Durable Object start-flow failed: ${initResponse.status} - ${errorText}`);
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
          return c.json(successResponse({ message: 'Flow execution started. Work will happen in background via alarms.', conversation_id: id.toString(), flow_id: targetFlowId, note: 'Flow execution: DeepSeek → OpenHands → API validation → Next step', check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}` }));
          
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
        console.log(`[HTTP:START] No flow_id provided and no repository/initial_user_prompt - starting highest priority flow`);
        
        // Start highest priority flow (same logic as GET /start)
        if (!c.env.FLOW_RUNS_DB) {
          return c.json(errorResponse('Database not configured for flow execution', 500));
        }
        
        try {
          // Get the flow with highest priority - try flow_definitions first (has priority column)
          let flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions ORDER BY priority DESC, created_at DESC LIMIT 1').first();
          
          // If no flows in flow_definitions, try flows table (without priority ordering)
          if (!flowResult) {
            try {
              flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flows ORDER BY created_at DESC LIMIT 1').first();
            } catch (flowsError: any) {
              // flows table might not exist, that's OK - just continue with null
              console.log(`[HTTP:START] flows table not available: ${flowsError.message}`);
              flowResult = null;
            }
          }
          
          if (!flowResult) {
            return c.json(notFoundResponse('No flows found in database'));
          }
          
          const targetFlowId = (flowResult as any).id;
          const targetRepository = (flowResult as any).repository || (flowResult as any).repo;
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
      }
      
      // ORIGINAL REPOSITORY-BASED CONVERSATION
      // Validate required fields
      if (!repository || !initial_user_prompt) {
        return c.json(errorResponse('Need repository and initial_user_prompt (branch is optional), provide flow ID, or send empty JSON {} to start highest priority flow', 400));
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
// GET /start - Start a flow by priority (default: highest priority)
// ============================================================================
app.get('/start', async (c) => {
  try {
    // Check for optional priority query parameter
    const priorityParam = c.req.query('priority');
    const targetPriority = priorityParam ? parseInt(priorityParam) : null;
    
    console.log(`[HTTP:START:GET] Starting flow${targetPriority !== null ? ` with priority ${targetPriority}` : ' with highest priority'}`);
    
    if (!c.env.FLOW_RUNS_DB) {
      return c.json(errorResponse('Database not configured for flow execution', 500));
    }
    
    try {
      let flowResult;
      
      if (targetPriority !== null) {
        // Get a flow with specific priority - only flow_definitions has priority column
        flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions WHERE priority = ? ORDER BY created_at DESC LIMIT 1').bind(targetPriority).first();
        
        if (!flowResult) {
          return c.json(notFoundResponse(`No flows found with priority ${targetPriority}`));
        }
      } else {
        // Get the flow with highest priority - try flow_definitions first (has priority column)
        flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flow_definitions ORDER BY priority DESC, created_at DESC LIMIT 1').first();
        
        // If no flows in flow_definitions, try flows table (without priority ordering)
        if (!flowResult) {
          try {
            flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flows ORDER BY created_at DESC LIMIT 1').first();
          } catch (flowsError: any) {
            // flows table might not exist, that's OK - just continue with null
            console.log(`[HTTP:START:GET] flows table not available: ${flowsError.message}`);
            flowResult = null;
          }
        }
        
        if (!flowResult) {
          return c.json(notFoundResponse('No flows found in database'));
        }
      }
      
      const targetFlowId = (flowResult as any).id;
      const targetRepository = (flowResult as any).repository || (flowResult as any).repo;
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
    
    // Call the Durable Object's get-state endpoint
    const doResponse = await conversationDo.fetch('http://placeholder/get-state');
    
    if (!doResponse.ok) {
      const errorText = await doResponse.text();
      console.error(`[HTTP:STATUS] Durable Object error: ${doResponse.status} - ${errorText}`);
      return c.json(errorResponse(`Failed to get conversation status: ${doResponse.status}`, 500));
    }
    
    const state = await doResponse.json();
    return c.json(successResponse(state));
    
  } catch (error: any) {
    console.error(`[HTTP:STATUS] Endpoint error: ${error.message}`);
    return c.json(errorResponse(error.message, 500));
  }
});

export default app;
export { StrictConversationDO };
// Export old class names for reference (not used)
export { StrictConversationDO as ConversationDO_v2 };
export { StrictConversationDO as ConversationDO };