// Parsing utilities for DeepSeek Agent
import { STOP_TOKEN } from '../constants';
import { DoneResponseData } from '../types';

/**
 * Parse a DeepSeek response to check for [END_FLOW]
 * @param response The DeepSeek response string
 * @returns DoneResponseData with parsed information
 */
export function parseDoneResponse(response: string): DoneResponseData {
  // Check if response contains the stop token
  if (!response.includes(STOP_TOKEN)) {
    return { done: false };
  }

  // Try to parse the new flow information from the response
  // Expected format: [END_FLOW] prompt: xxx deepseek_system: xxx branch: xxx
  const lines = response.split('\n');
  let nextPrompt = '';
  let nextDeepseekSystem = '';
  let nextBranch = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('prompt:')) {
      nextPrompt = trimmed.substring('prompt:'.length).trim();
    } else if (trimmed.startsWith('deepseek_system:')) {
      nextDeepseekSystem = trimmed.substring('deepseek_system:'.length).trim();
    } else if (trimmed.startsWith('branch:')) {
      nextBranch = trimmed.substring('branch:'.length).trim();
    }
  }

  // If we have a next prompt, return the parsed data
  if (nextPrompt) {
    return {
      done: true,
      new_prompt: nextPrompt,
      new_deepseek_system: nextDeepseekSystem || undefined,
      new_branch: nextBranch || undefined
    };
  }

  // When [END_FLOW] is found without next flow info, just end the flow
  return { done: true };
}

/**
 * Extract conversation history for storage
 * @param conversation_messages Array of conversation messages
 * @returns JSON string of prompts and responses
 */
export function extractPromptsAndResponses(conversation_messages: Array<{role: string; content: string}>): string {
  const history = [];
  
  for (let i = 0; i < conversation_messages.length; i++) {
    const message = conversation_messages[i];
    history.push({
      role: message.role,
      content: message.content,
      timestamp: Date.now() - (conversation_messages.length - i) * 1000 // Simulate timestamps
    });
  }
  
  return JSON.stringify(history);
}