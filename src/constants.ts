// Constants for DeepSeek Agent
export const MAX_ITERATIONS = 500;
export const END_FLOW_TOKEN = '[END_FLOW]';
export const END_FLOW_EARLY_TOKEN = '[END_FLOW_EARLY]';
export const ALARM_DELAY_INIT = 1000; // 1 second for initial alarm (increased from 100ms)
export const ALARM_DELAY_WAITING = 10000; // 10 seconds between checks (increased from 1s - 90% reduction)
export const ALARM_DELAY_ACTIVE = 3000; // 3 seconds when we expect immediate response (increased from 500ms - 83% reduction)
export const DEEPSEEK_TIMEOUT = 10000; // 10 seconds for DeepSeek API
export const OPENHANDS_TIMEOUT = 180000; // 3 minutes for long operations
export const NO_EVENT_TIMEOUT = 120000; // 2 minutes without new events (increased from 1 minute)

// Aggressive mode constants (for forced conversation management)
export const AGGRESSIVE_MODE = true; // Enable aggressive mode
export const AGGRESSIVE_NO_EVENT_TIMEOUT = 300000; // 5 minutes without new events
export const AGGRESSIVE_OPENHANDS_TIMEOUT = 600000; // 10 minutes for long operations
export const STATIC_PROMPT_MODE = false; // Use static prompts instead of DeepSeek
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

// Adaptive polling optimization
export const ADAPTIVE_POLLING_ENABLED = true;
export const MIN_POLL_INTERVAL = 5000; // 5 seconds minimum
export const MAX_POLL_INTERVAL = 60000; // 60 seconds maximum
export const POLL_INTERVAL_INCREMENT = 5000; // Increase by 5 seconds each time
export const POLL_INTERVAL_RESET = 10000; // Reset to 10 seconds on activity

// Request optimization
export const ENABLE_REQUEST_CACHING = true;
export const CACHE_TTL = 10000; // 10 seconds cache TTL
export const MAX_CONCURRENT_CONVERSATIONS = 50; // Limit concurrent conversations

// Durable Object lifecycle optimization
export const MAX_DO_LIFETIME = 3600000; // 1 hour maximum lifetime
export const IDLE_TIMEOUT = 1800000; // 30 minutes idle timeout (reduced from default)
export const COMPLETED_CLEANUP_DELAY = 300000; // 5 minutes delay before cleaning up completed conversations