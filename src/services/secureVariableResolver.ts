// Secure Variable Resolver for Dynamic API Data Fetching
// ============================================================================

import {
  SecureApiConfig,
  SecurityError,
  CircuitBreakerError,
  ExecutionError,
  ErrorSeverity,
  ResolvedStep,
  CircuitBreakerState,
  CacheEntry,
  ApiResponse,
  SecurityConfig
} from '../types/secureTypes';

// Default security configuration
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowed_domains: [
    'localhost',
    '127.0.0.1',
    'api.cloudflare.com',
    'api.github.com',
    'hono.alghamdimo89.workers.dev'
  ],
  require_https: true,
  max_request_size_kb: 1024,
  timeout_default_ms: 10000,
  circuit_breaker: {
    failure_threshold: 5,
    reset_timeout_ms: 60000
  },
  logging: {
    redact_fields: ['password', 'token', 'secret', 'key', 'auth', 'bearer', 'api_key'],
    level: 'info'
  },
  variables: {
    delimiters: {
      start: '{*',
      end: '*}'
    },
    environment_prefix: 'env:'
  }
};

// Step data interface (compatible with existing StepData)
interface StepData {
  step_id: string;
  instructions: string;
  input_keys?: string;
  auto_fail_on_error?: boolean;
}

// Execution context
interface ExecutionContext {
  env: Record<string, string>;
  step: StepData;
  flow_id?: string;
  execution_id?: string;
}

export class SecureVariableResolver {
  private allowedDomains: Set<string>;
  private env: Record<string, string>;
  private securityConfig: SecurityConfig;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private logs: any[] = [];
  
  constructor(
    env: Record<string, string> = {},
    securityConfig: Partial<SecurityConfig> = {}
  ) {
    this.env = env;
    this.securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...securityConfig };
    this.allowedDomains = new Set(this.securityConfig.allowed_domains);
    
    // Auto-cleanup cache every minute
    setInterval(() => this.cleanupCache(), 60000);
  }
  
  /**
   * Resolve variables for a step by fetching data from APIs
   */
  async resolveStepVariables(
    step: StepData,
    context: ExecutionContext
  ): Promise<ResolvedStep> {
    const startTime = Date.now();
    this.log('info', `Starting variable resolution for step ${step.step_id}`);
    
    try {
      // 1. Validate and parse input_keys
      const apiConfigs = this.validateAndParseInputKeys(step.input_keys);
      
      if (apiConfigs.length === 0) {
        this.log('info', `No input_keys found for step ${step.step_id}`);
        return {
          instructions: step.instructions,
          variables: {},
          api_responses: {}
        };
      }
      
      // 2. Security: Validate URLs and check for SSRF vulnerabilities
      this.validateUrls(apiConfigs);
      
      // 3. Resolve environment variables (securely)
      const resolvedConfigs = this.resolveEnvironmentVariables(apiConfigs);
      
      // 4. Execute API calls with security controls
      const { variables, apiResponses } = await this.executeApiCalls(
        resolvedConfigs,
        step,
        context
      );
      
      // 5. Sanitize variables before substitution
      const sanitizedVars = this.sanitizeVariables(variables);
      
      // 6. Perform safe template substitution
      const instructions = this.safeSubstitute(
        step.instructions,
        sanitizedVars
      );
      
      const duration = Date.now() - startTime;
      this.log('info', `Variable resolution completed for step ${step.step_id} in ${duration}ms`);
      
      return {
        instructions,
        variables: sanitizedVars,
        api_responses: apiResponses
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', `Variable resolution failed for step ${step.step_id} after ${duration}ms: ${error.message}`);
      
      if (step.auto_fail_on_error) {
        throw new ExecutionError(
          `Variable resolution failed: ${error.message}`,
          ErrorSeverity.FATAL,
          step.step_id,
          undefined,
          { error: error.message, duration_ms: duration }
        );
      }
      
      // Return empty variables on non-fatal error
      return {
        instructions: step.instructions,
        variables: {},
        api_responses: {}
      };
    }
  }
  
  /**
   * Validate and parse input_keys JSON
   */
  private validateAndParseInputKeys(inputKeys?: string): SecureApiConfig[] {
    if (!inputKeys || inputKeys.trim() === '') {
      return [];
    }
    
    try {
      const parsed = JSON.parse(inputKeys);
      
      if (!Array.isArray(parsed)) {
        throw new SecurityError('input_keys must be a JSON array');
      }
      
      // Validate each config
      return parsed.map((config, index) => {
        if (!config.key || typeof config.key !== 'string') {
          throw new SecurityError(`Config at index ${index} missing or invalid 'key' property`);
        }
        
        if (!config.url || typeof config.url !== 'string') {
          throw new SecurityError(`Config at index ${index} missing or invalid 'url' property`);
        }
        
        if (!config.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].includes(config.method)) {
          throw new SecurityError(`Config at index ${index} missing or invalid 'method' property`);
        }
        
        // Set defaults
        return {
          timeout_ms: this.securityConfig.timeout_default_ms,
          max_retries: 3,
          retry_delay_ms: 1000,
          max_response_size_kb: this.securityConfig.max_request_size_kb,
          require_https: this.securityConfig.require_https,
          ...config
        };
      });
      
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError(`Invalid input_keys JSON: ${error.message}`);
    }
  }
  
  /**
   * Validate URLs for security
   */
  private validateUrls(configs: SecureApiConfig[]): void {
    for (const config of configs) {
      try {
        const url = new URL(config.url);
        
        // Skip validation for internal URLs
        if (url.protocol === 'internal:') {
          continue;
        }
        
        // Security: Reject non-HTTPS for external domains if required
        if (config.require_https !== false && 
            url.protocol !== 'https:' && 
            !this.isInternalDomain(url.hostname)) {
          throw new SecurityError(
            `External API must use HTTPS: ${config.url}`,
            'https_required',
            { url: config.url, hostname: url.hostname }
          );
        }
        
        // Security: Check against domain allowlist
        if (!this.isDomainAllowed(url.hostname)) {
          throw new SecurityError(
            `Domain not allowed: ${url.hostname}`,
            'domain_not_allowed',
            { url: config.url, hostname: url.hostname }
          );
        }
        
      } catch (error) {
        if (error instanceof SecurityError) {
          throw error;
        }
        throw new SecurityError(`Invalid URL: ${config.url}`, 'invalid_url', { url: config.url });
      }
    }
  }
  
  /**
   * Check if domain is internal
   */
  private isInternalDomain(hostname: string): boolean {
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname === '::1' ||
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.');
  }
  
  /**
   * Check if domain is allowed
   */
  private isDomainAllowed(hostname: string): boolean {
    // Allow internal domains
    if (this.isInternalDomain(hostname)) {
      return true;
    }
    
    // Check against allowlist
    return this.allowedDomains.has(hostname);
  }
  
  /**
   * Resolve environment variables in config
   */
  private resolveEnvironmentVariables(configs: SecureApiConfig[]): SecureApiConfig[] {
    return configs.map(config => {
      const resolved = { ...config };
      
      // Resolve env:VAR_NAME references in auth_value
      if (config.auth_value?.startsWith(this.securityConfig.variables.environment_prefix)) {
        const envVar = config.auth_value.substring(this.securityConfig.variables.environment_prefix.length);
        if (!this.env[envVar]) {
          throw new SecurityError(
            `Environment variable not found: ${envVar}`,
            'env_var_not_found',
            { env_var: envVar }
          );
        }
        resolved.auth_value = this.env[envVar];
      }
      
      // Resolve env vars in URL, headers, body, query_params
      resolved.url = this.resolveEnvInTemplate(config.url);
      
      if (config.headers) {
        resolved.headers = Object.fromEntries(
          Object.entries(config.headers).map(([k, v]) => [
            k, this.resolveEnvInTemplate(v)
          ])
        );
      }
      
      if (config.body) {
        resolved.body = this.resolveEnvInTemplate(config.body);
      }
      
      if (config.query_params) {
        resolved.query_params = Object.fromEntries(
          Object.entries(config.query_params).map(([k, v]) => [
            k, this.resolveEnvInTemplate(v)
          ])
        );
      }
      
      return resolved;
    });
  }
  
  /**
   * Resolve environment variables in a template
   */
  private resolveEnvInTemplate(template: any): any {
    if (typeof template === 'string') {
      return template.replace(
        new RegExp(`\\{${this.securityConfig.variables.environment_prefix}(\\w+)\\}`, 'g'),
        (match, envVar) => {
          if (!this.env[envVar]) {
            throw new SecurityError(
              `Environment variable not found: ${envVar}`,
              'env_var_not_found',
              { env_var: envVar }
            );
          }
          return this.env[envVar];
        }
      );
    }
    
    if (Array.isArray(template)) {
      return template.map(item => this.resolveEnvInTemplate(item));
    }
    
    if (template && typeof template === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.resolveEnvInTemplate(value);
      }
      return result;
    }
    
    return template;
  }
  
  /**
   * Execute API calls with dependency resolution
   */
  private async executeApiCalls(
    configs: SecureApiConfig[],
    step: StepData,
    context: ExecutionContext
  ): Promise<{ variables: Record<string, any>; apiResponses: ResolvedStep['api_responses'] }> {
    const variables: Record<string, any> = {};
    const apiResponses: ResolvedStep['api_responses'] = {};
    const errors: Record<string, Error> = {};
    
    // Group by dependency level
    const independentConfigs = configs.filter(config => 
      !config.depends_on || config.depends_on.length === 0
    );
    
    const dependentConfigs = configs.filter(config => 
      config.depends_on && config.depends_on.length > 0
    );
    
    // Execute independent calls in parallel
    await Promise.allSettled(
      independentConfigs.map(config => 
        this.executeSingleApiCall(config, variables, apiResponses, errors, step, context)
      )
    );
    
    // Execute dependent calls sequentially
    for (const config of dependentConfigs) {
      // Check if all dependencies are resolved
      const missingDeps = (config.depends_on || []).filter(dep => 
        variables[dep] === undefined
      );
      
      if (missingDeps.length > 0) {
        const error = new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
        errors[config.key] = error;
        apiResponses[config.key] = {
          success: false,
          error: error.message
        };
        variables[config.key] = null;
        continue;
      }
      
      await this.executeSingleApiCall(config, variables, apiResponses, errors, step, context);
    }
    
    // Handle errors
    if (Object.keys(errors).length > 0) {
      this.log('error', `API call errors for step ${step.step_id}:`, errors);
      
      if (step.auto_fail_on_error) {
        throw new AggregateError(Object.values(errors));
      }
    }
    
    return { variables, apiResponses };
  }
  
  /**
   * Execute a single API call with retry logic
   */
  private async executeSingleApiCall(
    config: SecureApiConfig,
    variables: Record<string, any>,
    apiResponses: ResolvedStep['api_responses'],
    errors: Record<string, Error>,
    step: StepData,
    context: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check circuit breaker
      if (this.isCircuitOpen(config.url)) {
        throw new CircuitBreakerError(config.url);
      }
      
      // Check cache
      if (config.cache_key) {
        const cached = await this.getFromCache(config.cache_key);
        if (cached !== null) {
          this.log('debug', `Cache hit for ${config.key} with key ${config.cache_key}`);
          variables[config.key] = cached;
          apiResponses[config.key] = {
            success: true,
            duration_ms: Date.now() - startTime,
            cached: true
          };
          return;
        }
      }
      
      // Resolve template variables in URL, headers, body
      const resolvedUrl = this.resolveTemplate(config.url, variables);
      const resolvedHeaders = this.resolveTemplate(config.headers, variables);
      const resolvedBody = this.resolveTemplate(config.body, variables);
      const resolvedQueryParams = this.resolveTemplate(config.query_params, variables);
      
      // Add query parameters to URL
      let finalUrl = resolvedUrl;
      if (resolvedQueryParams && Object.keys(resolvedQueryParams).length > 0) {
        const urlObj = new URL(finalUrl);
        Object.entries(resolvedQueryParams).forEach(([key, value]) => {
          urlObj.searchParams.append(key, String(value));
        });
        finalUrl = urlObj.toString();
      }
      
      // Add authentication
      const authHeaders = this.addAuthentication(config, resolvedHeaders);
      
      // Make API call with retry logic
      const response = await this.fetchWithRetry(
        finalUrl,
        {
          method: config.method,
          headers: authHeaders,
          body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
          timeout: config.timeout_ms
        },
        config.max_retries || 3,
        config.retry_delay_ms || 1000
      );
      
      // Validate response
      this.validateResponse(response, config.response_validator);
      
      // Extract data
      const data = config.response_path
        ? this.extractByPath(response.data, config.response_path)
        : response.data;
      
      // Store in variables
      variables[config.key] = data;
      
      // Cache if configured
      if (config.cache_key) {
        await this.setInCache(
          config.cache_key,
          data,
          config.cache_ttl_seconds,
          config.encrypt_cache
        );
      }
      
      // Record success
      this.recordCircuitSuccess(config.url);
      
      // Log response (redacted)
      const redactedResponse = this.redactSensitiveData(response.data, config.redact_fields);
      apiResponses[config.key] = {
        success: true,
        status: response.status,
        duration_ms: Date.now() - startTime,
        redacted_response: redactedResponse
      };
      
      this.log('info', `API call successful for ${config.key}`, {
        url: finalUrl,
        method: config.method,
        status: response.status,
        duration_ms: Date.now() - startTime
      });
      
    } catch (error) {
      // Update circuit breaker
      this.recordCircuitFailure(config.url);
      
      // Store error
      errors[config.key] = error;
      
      // Set variable based on configuration
      if (step.auto_fail_on_error) {
        variables[config.key] = null;
      } else {
        variables[config.key] = { error: error.message };
      }
      
      apiResponses[config.key] = {
        success: false,
        duration_ms: Date.now() - startTime,
        error: error.message
      };
      
      this.log('error', `API call failed for ${config.key}: ${error.message}`, {
        url: config.url,
        method: config.method,
        error: error.message
      });
    }
  }
  
  /**
   * Resolve template variables in an object
   */
  private resolveTemplate(template: any, variables: Record<string, any>): any {
    if (typeof template === 'string') {
      return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, varPath) => {
        const value = this.getNestedValue(variables, varPath);
        return value !== undefined ? String(value) : match;
      });
    }
    
    if (Array.isArray(template)) {
      return template.map(item => this.resolveTemplate(item, variables));
    }
    
    if (template && typeof template === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.resolveTemplate(value, variables);
      }
      return result;
    }
    
    return template;
  }
  
  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return current[key];
      }
      return undefined;
    }, obj);
  }
  
  /**
   * Add authentication to headers
   */
  private addAuthentication(config: SecureApiConfig, headers: Record<string, string> = {}): Record<string, string> {
    const result = { ...headers };
    
    if (!config.auth_type || config.auth_type === 'none' || !config.auth_value) {
      return result;
    }
    
    switch (config.auth_type) {
      case 'bearer':
        result['Authorization'] = `Bearer ${config.auth_value}`;
        break;
      case 'basic':
        result['Authorization'] = `Basic ${config.auth_value}`;
        break;
      case 'api_key':
        result['X-API-Key'] = config.auth_value;
        break;
      case 'custom':
        // Custom auth - assume auth_value is a header string like "X-Api-Key: value"
        const [headerName, headerValue] = config.auth_value.split(':').map(s => s.trim());
        if (headerName && headerValue) {
          result[headerName] = headerValue;
        }
        break;
    }
    
    return result;
  }
  
  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit & { timeout?: number },
    maxRetries: number,
    retryDelay: number
  ): Promise<ApiResponse> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        const data = await response.json().catch(() => ({}));
        
        return {
          success: response.ok,
          status: response.status,
          data,
          headers: Object.fromEntries(response.headers.entries()),
          duration_ms: duration,
          cached: false
        };
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          this.log('debug', `Retry ${attempt + 1}/${maxRetries} for ${url} after error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }
    
    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
  }
  
  /**
   * Validate API response
   */
  private validateResponse(response: ApiResponse, validator?: SecureApiConfig['response_validator']): void {
    if (!response.success) {
      throw new Error(`API returned error status: ${response.status}`);
    }
    
    if (validator) {
      // Check status codes
      if (validator.status_codes && !validator.status_codes.includes(response.status)) {
        throw new Error(`Unexpected status code: ${response.status}. Expected: ${validator.status_codes.join(', ')}`);
      }
      
      // Check required fields
      if (validator.required_fields) {
        const missingFields = validator.required_fields.filter(field => 
          this.getNestedValue(response.data, field) === undefined
        );
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
      }
      
      // TODO: Add JSON schema validation if needed
    }
  }
  
  /**
   * Extract data by JSON path
   */
  private extractByPath(data: any, path: string): any {
    if (!path || path === '.') return data;
    
    // Simple dot notation extraction
    return this.getNestedValue(data, path);
  }
  
  /**
   * Circuit breaker methods
   */
  private isCircuitOpen(url: string): boolean {
    const state = this.circuitBreakers.get(url);
    if (!state) return false;
    
    if (state.state === 'open') {
      if (Date.now() >= state.nextAttempt) {
        state.state = 'half_open';
        state.nextAttempt = Date.now() + 10000; // 10 second half-open window
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  private recordCircuitSuccess(url: string): void {
    const state = this.circuitBreakers.get(url) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed' as const,
      nextAttempt: 0
    };
    
    state.failures = 0;
    state.state = 'closed';
    this.circuitBreakers.set(url, state);
  }
  
  private recordCircuitFailure(url: string): void {
    let state = this.circuitBreakers.get(url);
    if (!state) {
      state = {
        failures: 0,
        lastFailure: 0,
        state: 'closed' as const,
        nextAttempt: 0
      };
    }
    
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= (this.securityConfig.circuit_breaker.failure_threshold || 5)) {
      state.state = 'open';
      state.nextAttempt = Date.now() + (this.securityConfig.circuit_breaker.reset_timeout_ms || 60000);
    }
    
    this.circuitBreakers.set(url, state);
  }
  
  /**
   * Cache methods
   */
  private async getFromCache(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    // TODO: Add decryption if entry.encrypted is true
    return entry.data;
  }
  
  private async setInCache(key: string, data: any, ttlSeconds?: number, encrypt: boolean = false): Promise<void> {
    const entry: CacheEntry = {
      data,
      expires: Date.now() + (ttlSeconds || 300) * 1000,
      encrypted
    };
    
    // TODO: Add encryption if encrypt is true
    this.cache.set(key, entry);
  }
  
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Sanitize variables for safe substitution
   */
  private sanitizeVariables(variables: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeHtml(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? this.sanitizeHtml(item) : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeVariables(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  /**
   * Safe HTML sanitization
   */
  private sanitizeHtml(str: string): string {
    // Basic HTML sanitization
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  /**
   * Safe template substitution with custom delimiters
   */
  private safeSubstitute(
    template: string,
    variables: Record<string, any>
  ): string {
    const { start, end } = this.securityConfig.variables.delimiters;
    
    // Escape regex special characters in delimiters
    const startEscaped = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const endEscaped = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const pattern = new RegExp(
      `${startEscaped}\\s*([\\w.]+)\\s*${endEscaped}`,
      'g'
    );
    
    return template.replace(pattern, (match, varPath) => {
      const value = this.getNestedValue(variables, varPath);
      
      // Convert to string safely
      if (value === undefined || value === null) {
        return match; // Keep original template if variable not found
      }
      
      return String(value);
    });
  }
  
  /**
   * Redact sensitive data from responses
   */
  private redactSensitiveData(data: any, redactFields?: string[]): any {
    if (!data || !redactFields || redactFields.length === 0) {
      return data;
    }
    
    const redacted = JSON.parse(JSON.stringify(data));
    
    const redactRecursive = (obj: any) => {
      if (Array.isArray(obj)) {
        return obj.map(item => redactRecursive(item));
      }
      
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (redactFields.some(pattern => 
            new RegExp(pattern, 'i').test(key)
          )) {
            obj[key] = '[REDACTED]';
          } else {
            obj[key] = redactRecursive(obj[key]);
          }
        }
      }
      
      return obj;
    };
    
    return redactRecursive(redacted);
  }
  
  /**
   * Logging utility
   */
  private log(level: 'debug' | 'info' | 'error', message: string, context?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.redactSensitiveData(context, this.securityConfig.logging.redact_fields)
    };
    
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
    
    // Output based on log level
    if (level === 'error') {
      console.error(`[SecureVariableResolver] ${message}`, logEntry.context);
    } else if (level === 'info' && this.securityConfig.logging.level !== 'none') {
      console.log(`[SecureVariableResolver] ${message}`, logEntry.context);
    } else if (level === 'debug' && this.securityConfig.logging.level === 'debug') {
      console.debug(`[SecureVariableResolver] ${message}`, logEntry.context);
    }
  }
  
  /**
   * Get logs for debugging
   */
  getLogs(): any[] {
    return [...this.logs];
  }
  
  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}