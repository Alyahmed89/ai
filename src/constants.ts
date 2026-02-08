// Constants for DeepSeek Agent
export const MAX_ITERATIONS = 500;
export const END_FLOW_TOKEN = '[END_FLOW]';
export const END_FLOW_EARLY_TOKEN = '[END_FLOW_EARLY]';
export const ALARM_DELAY_INIT = 10; // 10ms for initial alarm (reduced from 100ms for faster startup)
export const ALARM_DELAY_WAITING = 250; // 250ms between checks (reduced from 1000ms for faster response)
export const DEEPSEEK_TIMEOUT = 10000; // 10 seconds for DeepSeek API (reduced from 15s)
export const OPENHANDS_TIMEOUT = 180000; // 3 minutes for long operations (restored from original)
export const NO_EVENT_TIMEOUT = 60000; // 1 minute without new events (reduced from 3 minutes)

// Aggressive mode constants (for forced conversation management)
export const AGGRESSIVE_MODE = true; // Enable aggressive mode
export const AGGRESSIVE_NO_EVENT_TIMEOUT = 300000; // 5 minutes without new events
export const AGGRESSIVE_OPENHANDS_TIMEOUT = 600000; // 10 minutes for long operations
export const STATIC_PROMPT_MODE = true; // Use static prompts instead of DeepSeek
export const FORCE_END_FLOW_AFTER_TIMEOUT = true; // Force end flow after timeout
export const AUTO_RESTART_CONVERSATION = true; // Auto-restart conversations
export const RESTART_DELAY = 10000; // 10 seconds between restarts
export const MAX_RESTARTS = 10; // Maximum number of auto-restarts

// Static prompts for aggressive mode
export const STATIC_PROMPTS = [
  "Please analyze the repository and provide a summary of the codebase structure.",
  "Identify any critical issues or security vulnerabilities in the code.",
  "Suggest improvements for code quality and performance.",
  "Create a deployment plan for the application.",
  "Generate documentation for the main components."
];

// Force end flow message
export const FORCE_END_FLOW_MESSAGE = '[END_FLOW] prompt: Please continue with the next task. deepseek_system: You are an AI assistant analyzing code repositories. branch: main';

// DeepSeek response timeout and checking prompt
export const DEEPSEEK_RESPONSE_TIMEOUT = 120000; // 2 minutes max for DeepSeek response
export const CHECKING_PROMPT = "Checking in: Are you still processing? Please provide a status update or continue with the analysis.";