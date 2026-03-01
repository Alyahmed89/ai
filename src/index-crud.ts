// Hono HTTP API with CRUD endpoints
import { Hono } from 'hono';
import { CloudflareBindings } from './types';
import { ConversationOrchestratorDO_2026A } from './durable/ConversationDO';
import { crudApi } from './crud-api';

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

// Mount CRUD API at /api
app.route('/api', crudApi);

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
        return c.json({
          error: 'Too many active conversations. Please try again later.',
          limit: MAX_CONCURRENT_CONVERSATIONS,
          current: currentCount
        }, 429);
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
      
      return c.json({
        error: 'Rate limit exceeded',
        retry_after: retryAfterSeconds,
        limit: MAX_REQUESTS_PER_MINUTE,
        window_ms: RATE_LIMIT_WINDOW
      }, 429);
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
app.use('*', rateLimitMiddleware);

// ============================================================================
// ROOT ENDPOINT - Show available endpoints
// ============================================================================
app.get('/', (c) => {
  return c.json({
    message: 'DeepSeek Agent for OpenHands - Durable Object Controller with CRUD API',
    endpoints: [
      'POST /start - Start new conversation (creates new OpenHands conversation)',
      'POST /attach - Attach to existing OpenHands conversation',
      'GET /status/:id - Check conversation status',
      'POST /stop/:id - Force stop a conversation',
      'POST /api/conversations/:conversation_id/stop - API: Stop conversation',
      'GET /health - Health check with database connection test',
      'CRUD API at /api/* - Cloudflare D1 database operations'
    ],
    crud_endpoints: [
      'GET /api/health - CRUD API health check',
      'GET /api/flows - List all flows',
      'GET /api/flows/:id - Get flow by ID',
      'POST /api/flows - Create new flow',
      'PUT /api/flows/:id - Update flow',
      'DELETE /api/flows/:id - Delete flow',
      'GET /api/tasks - List all tasks',
      'GET /api/tasks/:id - Get task by ID',
      'POST /api/tasks - Create new task',
      'PUT /api/tasks/:id - Update task',
      'DELETE /api/tasks/:id - Delete task',
      'GET /api/flow-runs - List all flow runs',
      'GET /api/flow-conditions - List all flow conditions'
    ],
    flow: 'User → /start → DO alarm: DeepSeek → OpenHands → DO alarm: DeepSeek → ...',
    rules: [
      'NO simulated OpenHands responses',
      'NO resending same messages',
      'STRICT alternation',
      'HARD STOP on ANY error or [END_FLOW]',
      'MAX 500 iterations by default (configurable via max_iterations parameter)'
    ]
  });
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
  
  return c.json(healthChecks);
});

// ============================================================================
// CONVERSATION ENDPOINTS (existing functionality)
// ============================================================================

// Start a new conversation
app.post('/start', async (c) => {
  try {
    const body = await c.req.json();
    const { repository, branch, initial_user_prompt, max_iterations, deepseek_system, flow_id } = body;
    
    // FLOW-BASED EXECUTION
    if (flow_id) {
      console.log(`[HTTP:START:FLOW] Starting flow execution for flow_id: ${flow_id}`);
      
      // Validate flow_id exists in database
      if (c.env.FLOW_RUNS_DB) {
        try {
          const flowResult = await c.env.FLOW_RUNS_DB.prepare('SELECT * FROM flows WHERE id = ?').bind(flow_id).first();
          if (!flowResult) {
            return c.json({ error: `Flow not found: ${flow_id}` }, 404);
          }
          
          // Use flow definition values if not provided in request
          const targetFlowId = flow_id;
          const targetRepository = repository || (flowResult as any).repo;
          const targetBranch = branch || (flowResult as any).branch;
          const targetInitialUserPrompt = initial_user_prompt || (flowResult as any).first_prompt;
          const targetMaxIterations = max_iterations || (flowResult as any).max_iterations;
          const targetDeepseekSystem = deepseek_system || (flowResult as any).deepseek_system;
          
          console.log(`[HTTP:START:FLOW] Using flow definition: ${targetFlowId}, repo: ${targetRepository}, branch: ${targetBranch}`);
          
          // Create a new Durable Object for this conversation
          const id = c.env.CONVERSATIONS.newUniqueId();
          const conversationDo = c.env.CONVERSATIONS.get(id);
          
          // Initialize the Durable Object with flow context
          const initResponse = await conversationDo.fetch('http://placeholder/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repository: targetRepository,
              branch: targetBranch, // Don't provide default - let flow definition determine it
              initial_user_prompt: targetInitialUserPrompt || `Execute flow: ${targetFlowId}`,
              max_iterations: targetMaxIterations || 20,
              deepseek_system: targetDeepseekSystem // Don't provide default - let flow definition determine it
            })
          });
          
          if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error(`[HTTP:START:FLOW] Durable Object init failed: ${initResponse.status} - ${errorText}`);
            return c.json({ error: `Failed to start flow execution: ${initResponse.status}` }, 500);
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
          return c.json({
            success: true,
            message: 'Flow execution started. Work will happen in background via alarms.',
            conversation_id: id.toString(),
            flow_id: targetFlowId,
            note: 'Flow execution: DeepSeek → OpenHands → API validation → Next step',
            check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}`
          });
          
        } catch (dbError: any) {
          console.error(`[HTTP:START:FLOW] Database error checking flow: ${dbError.message}`);
          return c.json({ error: `Database error checking flow: ${dbError.message}` }, 500);
        }
      } else {
        return c.json({ error: 'Database not configured for flow execution' }, 500);
      }
      
    } else {
      // ORIGINAL REPOSITORY-BASED CONVERSATION
      // Validate required fields
      if (!repository || !initial_user_prompt) {
        return c.json({ error: 'Need repository and initial_user_prompt (branch is optional), or provide flow ID' }, 400);
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
          max_iterations: max_iterations || 20,
          deepseek_system: deepseek_system || 'You are a helpful assistant.'
        })
      });
      
      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error(`[HTTP:START] Durable Object init failed: ${initResponse.status} - ${errorText}`);
        return c.json({ error: `Failed to start conversation: ${initResponse.status}` }, 500);
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
      return c.json({
        success: true,
        message: 'Conversation started. Work will happen in background via alarms.',
        conversation_id: id.toString(),
        note: 'Flow: DeepSeek → OpenHands → DeepSeek → OpenHands → ...',
        check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}`
      });
    }
    
  } catch (error: any) {
    console.error(`[HTTP:START] Endpoint error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});