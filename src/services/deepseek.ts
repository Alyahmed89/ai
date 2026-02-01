// DeepSeek API service - pure, stateless wrapper
import { DEEPSEEK_TIMEOUT, STOP_TOKEN } from '../constants';
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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT);

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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const result = data.choices[0].message.content;

    return {
      success: true,
      response: result
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown DeepSeek API error'
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