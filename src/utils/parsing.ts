// Parsing utilities for DeepSeek Agent
import { END_FLOW_TOKEN, END_FLOW_EARLY_TOKEN } from '../constants';
import { DoneResponseData, CreateTaskData, SkipTaskData, CommandData } from '../types';

// Hardened regex patterns for AI tokens
const CREATE_TASK_REGEX = /\[CREATE_TASK\]\s+flow_id:\s*(\w+)\s+title:\s*([\s\S]+?)\s+description:\s*([\s\S]+?)\s+order_index:\s*(\d+)\s+priority:\s*(\d+)/;
const SKIP_TASK_REGEX = /\[SKIP_TASK\]\s+task_id:\s*([\w_-]+)\s+reason:\s*([\s\S]+)/;
const END_FLOW_REGEX = /\[END_FLOW\](?:\s+prompt:\s*([\s\S]+?))?(?:\s+branch:\s*([\s\S]+?))?/;
const END_FLOW_EARLY_REGEX = /\[END_FLOW_EARLY\](?:\s+reason:\s*([\s\S]+))?/;
const COMMAND_REGEX = /\[COMMAND:(\w+)\](?:\s+params:\s*(\{[^}]*\}))?/;

/**
 * Parse a DeepSeek response to check for [END_FLOW] or [END_FLOW_EARLY]
 * @param response The DeepSeek response string
 * @returns DoneResponseData with parsed information
 */
export function parseDoneResponse(response: string): DoneResponseData {
  // Check which token is present using regex
  const endFlowMatch = response.match(END_FLOW_REGEX);
  const endFlowEarlyMatch = response.match(END_FLOW_EARLY_REGEX);
  
  if (!endFlowMatch && !endFlowEarlyMatch) {
    return { done: false };
  }

  // Determine which token was found
  const isEndFlowEarly = !!endFlowEarlyMatch;
  
  if (isEndFlowEarly) {
    const [, stopReason] = endFlowEarlyMatch || [];
    return {
      done: true,
      is_end_flow_early: true,
      stop_reason: stopReason?.trim() || 'end_flow_early_no_reason'
    };
  }

  // For END_FLOW with next prompt, start new flow
  if (endFlowMatch) {
    const [, nextPrompt, nextBranch] = endFlowMatch;
    if (nextPrompt) {
      return {
        done: true,
        new_prompt: nextPrompt.trim(),
        new_branch: nextBranch?.trim() || undefined
      };
    }
  }

  // When [END_FLOW] is found without next flow info, just end the flow
  return { done: true };
}

/**
 * Parse [CREATE_TASK] token from AI response
 */
export function parseCreateTask(response: string): CreateTaskData | null {
  const match = response.match(CREATE_TASK_REGEX);
  if (!match) return null;
  
  const [, flowId, title, description, orderIndex, priority] = match;
  
  // Validate inputs
  const validFlows = ['etaflow', 'honoflow', 'honorch'];
  if (!validFlows.includes(flowId)) {
    console.warn(`[PARSING] Invalid flow_id in CREATE_TASK: ${flowId}`);
    return null;
  }
  
  const priorityNum = parseInt(priority);
  if (priorityNum < 0 || priorityNum > 2) {
    console.warn(`[PARSING] Invalid priority in CREATE_TASK: ${priority}`);
    return null;
  }
  
  const orderIndexNum = parseInt(orderIndex);
  if (orderIndexNum < 0 || orderIndexNum > 1000) {
    console.warn(`[PARSING] Invalid order_index in CREATE_TASK: ${orderIndex}`);
    return null;
  }
  
  return {
    flow_id: flowId,
    title: title.trim(),
    description: description.trim(),
    order_index: orderIndexNum,
    priority: priorityNum
  };
}

/**
 * Parse [SKIP_TASK] token from AI response
 */
export function parseSkipTask(response: string): SkipTaskData | null {
  const match = response.match(SKIP_TASK_REGEX);
  if (!match) return null;
  
  const [, taskId, reason] = match;
  
  // Validate task ID format (alphanumeric, underscores, hyphens)
  if (!/^[\w_-]+$/.test(taskId)) {
    console.warn(`[PARSING] Invalid task_id in SKIP_TASK: ${taskId}`);
    return null;
  }
  
  return {
    task_id: taskId,
    reason: reason.trim()
  };
}

/**
 * Parse [COMMAND: name] token from AI response
 */
export function parseCommand(response: string): CommandData | null {
  const match = response.match(COMMAND_REGEX);
  if (!match) return null;
  
  const [, name, paramsStr] = match;
  
  // Validate command name format
  if (!/^[\w_-]+$/.test(name)) {
    console.warn(`[PARSING] Invalid command name: ${name}`);
    return null;
  }
  
  let params: Record<string, any> | undefined;
  if (paramsStr) {
    try {
      params = JSON.parse(paramsStr);
    } catch (error) {
      console.warn(`[PARSING] Invalid JSON params for command ${name}: ${paramsStr}`);
      return null;
    }
  }
  
  return {
    name: name,
    params
  };
}

/**
 * Extract all AI tokens from response
 */
export function extractAllTokens(response: string): {
  createTask: CreateTaskData | null;
  skipTask: SkipTaskData | null;
  command: CommandData | null;
  done: DoneResponseData;
} {
  return {
    createTask: parseCreateTask(response),
    skipTask: parseSkipTask(response),
    command: parseCommand(response),
    done: parseDoneResponse(response)
  };
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

/**
 * Extract structured output from step response for payload propagation
 * @param response The step response string
 * @returns JSON string suitable for output_payload field, or null if no structured output can be extracted
 */
export function extractStructuredOutput(response: string): string | null {
  if (!response || response.trim().length === 0) {
    return null;
  }

  try {
    // Try to parse as JSON first (if response is already JSON)
    const parsed = JSON.parse(response);
    // If it's valid JSON, return it as a string
    return JSON.stringify(parsed);
  } catch {
    // Not valid JSON, wrap as simple text object
    return JSON.stringify({ text: response.trim() });
  }
}