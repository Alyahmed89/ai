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

  // When [END_FLOW] is found, just end the flow without parsing further
  // No new flow should be started from [END_FLOW]
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