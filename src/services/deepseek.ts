// DeepSeek API service - pure, stateless wrapper
import { DEEPSEEK_TIMEOUT } from '../constants';
import { DeepSeekMessage } from '../types';
import { DeepSeekResult } from '../types';

/**
 * Call DeepSeek API with messages
 * @param apiKey DeepSeek API key
 * @param messages The conversation messages to send (including system, user, assistant messages)
 * @returns DeepSeekResult with response or error
 */
export async function callDeepSeek(
  apiKey: string,
  messages: Array<{role: string; content: string}>
): Promise<DeepSeekResult> {
  console.log(`[DeepSeek] Starting API call with ${messages.length} messages`);
  console.log(`[DeepSeek] First message preview: ${messages[0]?.content?.substring(0, 100)}...`);
  console.log(`[DeepSeek] API key parameter received (for backward compatibility): ${apiKey ? 'present' : 'missing'}`);
  console.log(`[DeepSeek] API key first 5 chars: ${apiKey ? apiKey.substring(0, 5) + '...' : 'MISSING'}`);
  
  // Note: API key validation removed since proxy endpoint will handle authentication
  // The apiKey parameter is kept for backward compatibility but not used
  
  // Check if any message has content
  const hasContent = messages.some(msg => msg.content?.trim());
  if (!hasContent) {
    console.error(`[DeepSeek] No content in messages`);
    return {
      success: false,
      error: "No content in messages",
      errorDetails: { status: 400, statusText: "Bad Request", body: "Empty message content" }
    };
  }
  
  try {
    console.log(`[DeepSeek] Making fetch request to DeepSeek API via proxy`);
    console.log("DS BODY", JSON.stringify(messages).slice(0,500));
    console.log(`[DeepSeek] Request body (first 500 chars):`, JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      }).substring(0, 500));

    // Use proxy endpoint instead of direct API call
    // Note: We need to get the worker URL from somewhere - for now using hardcoded domain
    // In production, this should be configurable or derived from request context
    const workerDomain = 'https://deepseek-agent.alghamdimo89.workers.dev';
    const proxyUrl = `${workerDomain}/proxy/deepseek`;
    
    console.log(`[DeepSeek] Using proxy URL: ${proxyUrl}`);
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass API key in header for proxy endpoint
        ...(apiKey ? { 'X-DeepSeek-API-Key': apiKey } : {})
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        // Also pass API key in body for backward compatibility
        ...(apiKey ? { api_key: apiKey } : {})
      })
    });
    
    console.log(`[DeepSeek] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DeepSeek] Proxy API error ${response.status}: ${errorText}`);
      
      // Try to parse error as JSON
      try {
        const errorJson = JSON.parse(errorText);
        return {
          success: false,
          error: `DeepSeek API error via proxy: ${response.status} - ${errorJson.error || errorText}`,
          errorDetails: {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            requestBodyPreview: JSON.stringify({
              model: 'deepseek-chat',
              messages,
              temperature: 0.7,
              max_tokens: 2000
            }).substring(0, 500)
          }
        };
      } catch {
        return {
          success: false,
          error: `DeepSeek API error via proxy: ${response.status} - ${errorText}`,
          errorDetails: {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            requestBodyPreview: JSON.stringify({
              model: 'deepseek-chat',
              messages,
              temperature: 0.7,
              max_tokens: 2000
            }).substring(0, 500)
          }
        };
      }
    }

    const data = await response.json() as any;
    const result = data.choices[0].message.content;
    
    console.log(`[DeepSeek] Success via proxy! Response length: ${result.length} chars`);
    console.log(`[DeepSeek] Response preview: ${result.substring(0, 100)}...`);

    return {
      success: true,
      response: result
    };

  } catch (error: any) {
    console.error(`[DeepSeek] Exception: ${error.message}`);
    console.error(`[DeepSeek] Stack: ${error.stack}`);
    return {
      success: false,
      error: error.message || 'Unknown DeepSeek API error',
      errorDetails: {
        status: 0,
        statusText: 'Exception',
        headers: {},
        body: error.message || 'Unknown error',
        requestBodyPreview: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.7,
          max_tokens: 2000
        }).substring(0, 500)
      }
    };
  }
}

/**
 * Build initial conversation messages for DeepSeek
 * @param userPrompt The initial user prompt
 * @param context Additional context (repository, iteration, etc.)
 * @param systemMessage Optional custom system message
 * @returns Array of DeepSeekMessage objects
 */
export function buildInitialMessages(
  userPrompt: string,
  context: {
    repository: string;
    branch?: string;
    iteration: number;
    max_iterations: number;
  },
  systemMessage?: string
): DeepSeekMessage[] {
  const messages: DeepSeekMessage[] = [];
  
  // Add system message ONLY if provided (no default)
  if (systemMessage && systemMessage.trim()) {
    messages.push({ role: 'system', content: systemMessage });
  }
  
  // Add iteration context to the user prompt
  const userPromptWithContext = `[Iteration ${context.iteration + 1} of ${context.max_iterations}]
${userPrompt}`;
  
  // Add user message with iteration context
  messages.push({ role: 'user', content: userPromptWithContext });
  
  return messages;
}