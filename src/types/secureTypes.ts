// Secure API Data Fetching Type Definitions
// ============================================================================

// Error severity levels
export enum ErrorSeverity {
  FATAL = 'fatal',
  NON_FATAL = 'non_fatal',
  WARNING = 'warning'
}

// HTTP methods supported
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

// Authentication types
export type AuthType = 'none' | 'bearer' | 'basic' | 'api_key' | 'env_var' | 'custom';

// Secure API Configuration
export interface SecureApiConfig {
  // Core configuration
  key: string;                    // Variable name (e.g., "user_data")
  url: string;                    // API endpoint (can contain variables: {project_id})
  method: HttpMethod;             // HTTP method
  
  // Request configuration
  headers?: Record<string, string>;  // Can contain variables
  body?: any;                      // For POST/PUT requests
  query_params?: Record<string, string>; // URL query parameters
  
  // Security controls
  auth_type?: AuthType;           // Authentication type
  auth_value?: string;            // Can be "env:VAR_NAME" or direct token
  allowed_domains?: string[];     // Domain allowlist for this config
  require_https?: boolean;        // Enforce HTTPS (default: true for external)
  
  // Operational controls
  timeout_ms?: number;            // Request timeout in ms (default: 10000)
  max_retries?: number;           // Maximum retry attempts (default: 3)
  retry_delay_ms?: number;        // Delay between retries in ms (default: 1000)
  max_response_size_kb?: number;  // Maximum response size (default: 1024)
  
  // Response handling
  response_path?: string;         // JSONPath or dot notation to extract data
  response_validator?: {          // Optional response validation
    schema?: any;                 // JSON schema
    required_fields?: string[];   // Required fields in response
    status_codes?: number[];      // Allowed HTTP status codes (default: [200])
  };
  
  // Dependencies
  depends_on?: string[];          // Variables this API depends on
  
  // Caching
  cache_key?: string;             // For shared caching between steps
  cache_ttl_seconds?: number;     // Cache time-to-live in seconds
  encrypt_cache?: boolean;        // Encrypt sensitive data in cache
  
  // Security logging
  log_level?: 'none' | 'error' | 'info' | 'debug';
  redact_fields?: string[];       // Fields to redact in logs
  
  // Circuit breaker
  circuit_breaker?: {
    failure_threshold?: number;   // Failures before opening circuit (default: 5)
    reset_timeout_ms?: number;    // Time before attempting reset (default: 60000)
  };
}

// Resolved step data
export interface ResolvedStep {
  instructions: string;           // Instructions with variables substituted
  variables: Record<string, any>; // All resolved variables
  api_responses: Record<string, {  // Detailed API response info
    success: boolean;
    status?: number;
    duration_ms?: number;
    error?: string;
    redacted_response?: any;      // Response with sensitive data redacted
  }>;
}

// Security error class
export class SecurityError extends Error {
  constructor(
    message: string,
    public violationType: string = 'security_violation',
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Circuit breaker error
export class CircuitBreakerError extends Error {
  constructor(
    public url: string,
    message: string = `Circuit breaker is open for ${url}`
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// Execution error with severity
export class ExecutionError extends Error {
  constructor(
    message: string,
    public severity: ErrorSeverity,
    public stepId: string,
    public variableName?: string,
    public context?: Record<string, any> // Sanitized
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
  
  toLogEntry(): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      step_id: this.stepId,
      severity: this.severity,
      message: this.message,
      variable: this.variableName,
      context: this.redactSensitiveFields(this.context),
      stack: this.stack
    };
  }
  
  private redactSensitiveFields(context?: Record<string, any>): any {
    if (!context) return undefined;
    
    const redacted = { ...context };
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i,
      /bearer/i,
      /api[_-]?key/i
    ];
    
    for (const key in redacted) {
      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        redacted[key] = '[REDACTED]';
      }
      // Also redact values that look like tokens
      if (typeof redacted[key] === 'string' && 
          (redacted[key].length > 20 || /^[A-Za-z0-9_-]{20,}$/.test(redacted[key]))) {
        redacted[key] = '[REDACTED]';
      }
    }
    
    return redacted;
  }
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  step_id: string;
  severity: ErrorSeverity | 'info' | 'debug' | 'security';
  message: string;
  variable?: string;
  context?: any;
  stack?: string;
}

// Migration report
export interface MigrationReport {
  migrated: number;
  skipped: number;
  errors: Array<{
    step_id: string;
    error: string;
    task_id?: string;
  }>;
  security_warnings: Array<{
    step_id: string;
    warning: string;
    task_id?: string;
  }>;
  recommendations: string[];
  timestamp: string;
}

// Security configuration
export interface SecurityConfig {
  allowed_domains: string[];
  require_https: boolean;
  max_request_size_kb: number;
  timeout_default_ms: number;
  circuit_breaker: {
    failure_threshold: number;
    reset_timeout_ms: number;
  };
  logging: {
    redact_fields: string[];
    level: 'none' | 'error' | 'info' | 'debug';
  };
  variables: {
    delimiters: {
      start: string;
      end: string;
    };
    environment_prefix: string;
  };
}

// Step data with secure extensions
export interface SecureStepData {
  step_id: string;
  step_key: string;
  title: string;
  description: string | null;
  step_type: string;
  order_index: number;
  page_key: string | null;
  blocking: boolean;
  auto_fail_on_error: boolean;
  retryable: boolean;
  task_id?: string;
  requires_task?: boolean;
  input_keys?: string;  // JSON string of SecureApiConfig[]
  output?: number;
  output_url?: string;
  output_auth_token?: string;
}

// Circuit breaker state
export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half_open';
  nextAttempt: number;
}

// Cache entry
export interface CacheEntry {
  data: any;
  expires: number;
  encrypted: boolean;
}

// API response with metadata
export interface ApiResponse {
  success: boolean;
  status: number;
  data: any;
  headers: Record<string, string>;
  duration_ms: number;
  cached: boolean;
}