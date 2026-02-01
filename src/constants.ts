// Constants for DeepSeek Agent
export const MAX_ITERATIONS = 10;
export const STOP_TOKEN = '<<DONE>>';
export const ALARM_DELAY_INIT = 1000; // 1 second for initial alarm
export const ALARM_DELAY_WAITING = 5000; // 5 seconds between checks
export const DEEPSEEK_TIMEOUT = 30000; // 30 seconds
export const OPENHANDS_TIMEOUT = 30000; // 30 seconds (increased from 10s due to large event responses)

// Cooldown constants for event processing - SIMPLE RULE: 10 seconds with no new events
export const EVENT_COOLDOWN_MS = 10000; // Wait 10 seconds with no new events before processing
export const MAX_COOLDOWN_WAIT_MS = 10000; // Same as EVENT_COOLDOWN_MS - no extended waiting
export const ACTIVE_CHECK_INTERVAL = 2000; // Check every 2 seconds during cooldown period