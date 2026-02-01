// Constants for DeepSeek Agent
export const MAX_ITERATIONS = 10;
export const STOP_TOKEN = '<<DONE>>';
export const ALARM_DELAY_INIT = 1000; // 1 second for initial alarm
export const ALARM_DELAY_WAITING = 5000; // 5 seconds between checks
export const DEEPSEEK_TIMEOUT = 30000; // 30 seconds
export const OPENHANDS_TIMEOUT = 30000; // 30 seconds (increased from 10s due to large event responses)

// Cooldown constants for event processing
export const EVENT_COOLDOWN_MS = 30000; // Wait 30 seconds with no new events before processing (reduced from 2 minutes)
export const MAX_COOLDOWN_WAIT_MS = 120000; // Maximum 2 minutes to wait even if events keep coming (reduced from 5 minutes)
export const ACTIVE_CHECK_INTERVAL = 5000; // Check every 5 seconds during cooldown period (reduced from 10 seconds)