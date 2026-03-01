// Rate limiting middleware with token bucket algorithm
import { Context, Next } from 'hono';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const MAX_REQUESTS_PER_MINUTE = 60; // 60 requests per minute per IP
const MAX_CONCURRENT_CONVERSATIONS = 20; // Global limit (reduced from 50 for 24-hour operation)

export const rateLimitMiddleware = async (c: Context, next: Next) => {
  // Skip rate limiting for health checks and CRUD API
  if (c.req.path === '/health' || c.req.path.startsWith('/api/')) {
    return next();
  }
  
  // Get client IP (using CF-Connecting-IP header in Cloudflare Workers)
  const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  
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