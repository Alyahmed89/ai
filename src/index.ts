// Hono HTTP API only - NO business logic, NO API calls
import { Hono } from 'hono';
import { CloudflareBindings } from './types';
import { ConversationOrchestratorDO_2026A } from './durable/ConversationDO';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Rate limiting middleware with token bucket algorithm
const rateLimitMiddleware = async (c: any, next: any) => {
  // Skip rate limiting for health checks
  if (c.req.path === '/health') {
    return next();
  }
  
  // Get client IP (using CF-Connecting-IP header in Cloudflare Workers)
  const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  
  // Rate limiting configuration
  const RATE_LIMIT_WINDOW = 60000; // 1 minute window
  const MAX_REQUESTS_PER_MINUTE = 60; // 60 requests per minute per IP
  const MAX_CONCURRENT_CONVERSATIONS = 50; // Global limit
  
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
        error: 'Rate limit exceeded. Please try again later.',
        retry_after: retryAfterSeconds,
        limit: MAX_REQUESTS_PER_MINUTE,
        window: '1 minute'
      }, 429);
    }
    
    // Consume one token
    tokens -= 1;
    
    // Update bucket state with 1 minute expiration
    await kv.put(bucketKey, JSON.stringify({
      tokens,
      lastRefill
    }), { expirationTtl: 120 }); // 2 minutes TTL
    
    console.log(`[RATE_LIMIT] Request from ${clientIp} to ${c.req.path} - ${tokens} tokens remaining`);
    
  } catch (error) {
    console.error(`[RATE_LIMIT] Error processing rate limit for ${clientIp}: ${error}`);
    // If KV fails, allow the request to proceed
  }
  
  return next();
};

// Apply rate limiting middleware to all routes
app.use('*', rateLimitMiddleware);

// Root endpoint - documentation only
app.get('/', (c) => {
  return c.json({ 
    message: 'DeepSeek Agent for OpenHands - Durable Object Controller',
    endpoints: [
      'POST /start - Start new conversation (creates new OpenHands conversation)',
      'POST /attach - Attach to existing OpenHands conversation',
      'GET /status/:id - Check conversation status',
      'POST /stop/:id - Force stop a conversation',
      'POST /api/conversations/:conversation_id/stop - API: Stop conversation',
      'GET /health - Health check with database connection test'
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

// Health check endpoint with database test
app.get('/health', async (c) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'pending'
      }
    };
    
    // Test database connection
    try {
      const db = c.env.FLOW_RUNS_DB;
      if (!db) {
        health.checks.database = 'not_configured';
        health.status = 'degraded';
      } else {
        // Simple query to test connection
        const result = await db.prepare('SELECT 1 as test').first();
        health.checks.database = result?.test === 1 ? 'connected' : 'error';
        if (health.checks.database === 'error') {
          health.status = 'degraded';
        }
      }
    } catch (dbError: any) {
      health.checks.database = `error: ${dbError.message}`;
      health.status = 'degraded';
    }
    
    return c.json(health);
    
  } catch (error: any) {
    return c.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Start endpoint - MUST return immediately (no awaits to external APIs)
app.post('/start', async (c) => {
  try {
    const body = await c.req.json() as {
      repository: string;
      branch?: string;
      initial_user_prompt: string;
      max_iterations?: number;
      deepseek_system?: string;
    };
    const { repository, branch, initial_user_prompt, max_iterations, deepseek_system } = body;
    
    // Validate required fields
    if (!repository || !initial_user_prompt) {
      return c.json({ error: 'Need repository and initial_user_prompt (branch is optional)' }, 400);
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
        deepseek_system
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
      note: 'DeepSeek will process first, then OpenHands, then back to DeepSeek, etc.',
      check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}`
    });
    
  } catch (error: any) {
    console.error(`[HTTP:START] Endpoint error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Attach to existing OpenHands conversation
app.post('/attach', async (c) => {
  try {
    const body = await c.req.json() as {
      openhands_conversation_id: string;
      deepseek_system?: string;
      max_iterations?: number;
    };
    const { openhands_conversation_id, deepseek_system, max_iterations } = body;
    
    // Validate required field
    if (!openhands_conversation_id) {
      return c.json({ error: 'Need openhands_conversation_id' }, 400);
    }

    console.log(`[HTTP:ATTACH] Attaching to existing OpenHands conversation: ${openhands_conversation_id}`);
    
    // Create a new Durable Object for this attachment
    const id = c.env.CONVERSATIONS.newUniqueId();
    const conversationDo = c.env.CONVERSATIONS.get(id);
    
    // Initialize with existing OpenHands conversation ID
    const initResponse = await conversationDo.fetch('http://placeholder/attach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        openhands_conversation_id,
        max_iterations: max_iterations || 20,
        deepseek_system
      })
    });
    
    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error(`[HTTP:ATTACH] Durable Object attach failed: ${initResponse.status} - ${errorText}`);
      return c.json({ error: `Failed to attach to conversation: ${initResponse.status}` }, 500);
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
    
    // Return immediately - monitoring happens in alarms
    return c.json({
      success: true,
      message: 'Attached to existing OpenHands conversation. DeepSeek will monitor and respond.',
      conversation_id: id.toString(),
      openhands_conversation_id: openhands_conversation_id,
      check_status_url: `${new URL(c.req.url).origin}/status/${id.toString()}`
    });
    
  } catch (error: any) {
    console.error(`[HTTP:ATTACH] Endpoint error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Check conversation status
app.get('/status/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Get the Durable Object
    const conversationDo = c.env.CONVERSATIONS.get(c.env.CONVERSATIONS.idFromString(id));
    
    // Get conversation state
    const stateResponse = await conversationDo.fetch('http://placeholder/get-state', {
      method: 'GET'
    });
    
    if (!stateResponse.ok) {
      return c.json({ error: 'Failed to get conversation state' }, 500);
    }
    
    const stateData = await stateResponse.json() as any;
    
    return c.json({
      success: true,
      conversation: stateData.conversation
    });
    
  } catch (error: any) {
    console.error(`[HTTP:STATUS] Endpoint error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Force stop a conversation
app.post('/stop/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Get the Durable Object
    const conversationDo = c.env.CONVERSATIONS.get(c.env.CONVERSATIONS.idFromString(id));
    
    // Stop the conversation
    const stopResponse = await conversationDo.fetch('http://placeholder/stop', {
      method: 'POST'
    });
    
    if (!stopResponse.ok) {
      return c.json({ error: 'Failed to stop conversation' }, 500);
    }
    
    const stopData = await stopResponse.json() as any;
    
    return c.json({
      success: true,
      message: stopData.message
    });
    
  } catch (error: any) {
    console.error(`[HTTP:STOP] Endpoint error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// Delete a specific Durable Object
app.post('/delete/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Get the Durable Object
    const conversationDo = c.env.CONVERSATIONS.get(c.env.CONVERSATIONS.idFromString(id));
    
    // Delete the Durable Object
    const deleteResponse = await conversationDo.fetch('http://placeholder/delete', {
      method: 'POST'
    });
    
    if (!deleteResponse.ok) {
      return c.json({ error: 'Failed to delete Durable Object' }, 500);
    }
    
    const deleteData = await deleteResponse.json() as any;
    
    return c.json({
      success: true,
      message: deleteData.message,
      id: deleteData.id
    });
    
  } catch (error: any) {
    console.error(`[HTTP:DELETE] Endpoint error: ${error.message}`);
    return c.json({ error: error.message }, 500);
  }
});

// API namespace: Stop conversation
app.post('/api/conversations/:conversation_id/stop', async (c) => {
  try {
    const conversationId = c.req.param('conversation_id');
    
    // Get the Durable Object
    const conversationDo = c.env.CONVERSATIONS.get(c.env.CONVERSATIONS.idFromString(conversationId));
    
    // Stop the conversation
    const stopResponse = await conversationDo.fetch('http://placeholder/stop', {
      method: 'POST'
    });
    
    if (!stopResponse.ok) {
      return c.json({ error: 'Failed to stop conversation' }, 500);
    }
    
    const stopData = await stopResponse.json() as any;
    
    return c.json({
      success: true,
      message: stopData.message,
      conversation_id: conversationId,
      stopped_at: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error(`[HTTP:API_STOP] Endpoint error: ${error.message}`);
    return c.json({ 
      error: error.message,
      conversation_id: c.req.param('conversation_id')
    }, 500);
  }
});

export default app;
export { ConversationOrchestratorDO_2026A };
// Export old class names for reference (not used)
export { ConversationOrchestratorDO_2026A as ConversationDO_v2 };
export { ConversationOrchestratorDO_2026A as ConversationDO };