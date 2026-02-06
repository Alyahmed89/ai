// Constants for DeepSeek Agent
export const MAX_ITERATIONS = 500;
export const END_FLOW_TOKEN = '[END_FLOW]';
export const END_FLOW_EARLY_TOKEN = '[END_FLOW_EARLY]';
export const ALARM_DELAY_INIT = 1000; // 1 second for initial alarm
export const ALARM_DELAY_WAITING = 30000; // 30 seconds between checks (increased from 5s)
export const DEEPSEEK_TIMEOUT = 30000; // 30 seconds
export const OPENHANDS_TIMEOUT = 180000; // 3 minutes for long operations (increased from 30s)