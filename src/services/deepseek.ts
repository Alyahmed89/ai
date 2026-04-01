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
  console.log(`[DeepSeek] API key present: ${!!apiKey}`);
  console.log(`[DeepSeek] API key starts with 'sk-': ${apiKey?.startsWith('sk-')}`);
  console.log(`[DeepSeek] API key length: ${apiKey?.length}`);
  console.log(`[DeepSeek] API key first 5 chars: ${apiKey ? apiKey.substring(0, 5) + '...' : 'MISSING'}`);
  
  // Validate API key
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    console.error(`[DeepSeek] Invalid or missing API key`);
    return {
      success: false,
      error: "Invalid or missing API key",
      errorDetails: { status: 401, statusText: "Unauthorized", body: "API key is required" }
    };
  }
  
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
    console.log(`[DeepSeek] Making fetch request to DeepSeek API`);
    console.log(`[DeepSeek] Request body (first 500 chars):`, JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      }).substring(0, 500));

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    console.log(`[DeepSeek] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      const errorHeaders = Object.fromEntries(response.headers.entries());
      console.error(`[DeepSeek] API error ${response.status}: ${errorText}`);
      console.error(`[DeepSeek] Full error response headers:`, errorHeaders);
      console.error(`[DeepSeek] Error response first 1000 chars:`, errorText.substring(0, 1000));
      
      // Return detailed error information
      return {
        success: false,
        error: `DeepSeek API error: ${response.status} - ${errorText}`,
        errorDetails: {
          status: response.status,
          statusText: response.statusText,
          headers: errorHeaders,
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

    const data = await response.json() as any;
    const result = data.choices[0].message.content;
    
    console.log(`[DeepSeek] Success! Response length: ${result.length} chars`);
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