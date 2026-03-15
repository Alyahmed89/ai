// Secure Types for Variable Resolver

export interface SecureApiConfig {
  key: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  timeout_ms?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  max_response_size_kb?: number;
  require_https?: boolean;
  auth_type?: 'bearer' | 'basic' | 'api_key' | 'custom';
  auth_value?: string;
  auth_header?: string;
  headers?: Record<string, string>;
  body?: any;
  query_params?: Record<string, string>;
  depends_on?: string[];
  response_path?: string;
  response_validator?: (data: any) => boolean;
  cache_key?: string;
  cache_ttl_seconds?: number;
  encrypt_cache?: boolean;
  redact_fields?: string[];
  // NEW: Support for endpoint references
  endpoint_ref?: string; // Reference to endpoint_registry.name
  endpoint_overrides?: Partial<SecureApiConfig>; // Overrides for referenced endpoint
}

export class SecurityError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class CircuitBreakerError extends Error {
  constructor(public url: string) {
    super(`Circuit breaker open for ${url}`);
    this.name = 'CircuitBreakerError';
  }
}

export class ExecutionError extends Error {
  constructor(
    message: string,
    public severity: ErrorSeverity,
    public stepId: string,
    public configKey?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

export enum ErrorSeverity {
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface ResolvedStep {
  instructions: string;
  variables: Record<string, any>;
  api_responses: Record<string, ApiResponse>;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export interface CacheEntry {
  value: any;
  expiresAt: number;
  encrypted?: boolean;
}

export interface ApiResponse {
  success: boolean;
  status?: number;
  error?: string;
  duration_ms?: number;
  cached?: boolean;
  redacted_response?: any;
}

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
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  variables: {
    delimiters: {
      start: string;
      end: string;
    };
    environment_prefix: string;
  };
}