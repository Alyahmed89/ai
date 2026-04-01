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
  
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DeepSeek] Attempt ${attempt}/${maxRetries}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT);
      
      console.log(`[DeepSeek] Making fetch request to DeepSeek API with timeout: ${DEEPSEEK_TIMEOUT}ms`);

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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      console.log(`[DeepSeek] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DeepSeek] API error ${response.status}: ${errorText}`);
        
        // Check if error is retryable (rate limit, timeout, server error)
        const isRetryable = response.status === 429 || response.status === 503 || 
                           response.status === 408 || (response.status >= 500 && response.status < 600);
        
        if (isRetryable && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[DeepSeek] Retryable error, waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
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
      console.error(`[DeepSeek] Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.error(`[DeepSeek] All ${maxRetries} attempts failed`);
        console.error(`[DeepSeek] Stack: ${error.stack}`);
        return {
          success: false,
          error: error.message || 'Unknown DeepSeek API error'
        };
      }
      
      // For network errors or timeouts, retry with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[DeepSeek] Waiting ${delay}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Should never reach here
  return {
    success: false,
    error: 'All retry attempts failed'
  };
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