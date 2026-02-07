// Constants for DeepSeek Agent
export const MAX_ITERATIONS = 500;
export const END_FLOW_TOKEN = '[END_FLOW]';
export const END_FLOW_EARLY_TOKEN = '[END_FLOW_EARLY]';
export const ALARM_DELAY_INIT = 100; // 100ms for initial alarm (reduced from 500ms)
export const ALARM_DELAY_WAITING = 1000; // 1 second between checks (reduced from 5s)
export const DEEPSEEK_TIMEOUT = 10000; // 10 seconds for DeepSeek API (reduced from 15s)
export const OPENHANDS_TIMEOUT = 180000; // 3 minutes for long operations (restored from original)
export const NO_EVENT_TIMEOUT = 60000; // 1 minute without new events (reduced from 3 minutes)