// Unit tests for SecureVariableResolver
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecureVariableResolver } from '../src/services/secureVariableResolver';
import { SecurityError, CircuitBreakerError } from '../src/types/secureTypes';

// Mock fetch globally
global.fetch = vi.fn();

describe('SecureVariableResolver', () => {
  let resolver: SecureVariableResolver;
  
  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new SecureVariableResolver({
      API_TOKEN: 'test-token-123',
      GITHUB_TOKEN: 'ghp_test'
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('URL validation', () => {
    it('should reject non-HTTPS external URLs', () => {
      const configs = [{
        key: 'test',
        url: 'http://evil.com/api',
        method: 'GET' as const
      }];
      
      expect(() => resolver['validateUrls'](configs)).toThrow(SecurityError);
      expect(() => resolver['validateUrls'](configs)).toThrow('External API must use HTTPS');
    });
    
    it('should allow HTTPS external URLs in allowlist', () => {
      const configs = [{
        key: 'test',
        url: 'https://api.github.com/users',
        method: 'GET' as const
      }];
      
      expect(() => resolver['validateUrls'](configs)).not.toThrow();
    });
    
    it('should allow internal URLs', () => {
      const configs = [{
        key: 'test',
        url: 'http://localhost:3000/api',
        method: 'GET' as const,
        require_https: false
      }];
      
      expect(() => resolver['validateUrls'](configs)).not.toThrow();
    });
    
    it('should reject domains not in allowlist', () => {
      const configs = [{
        key: 'test',
        url: 'https://evil-domain.com/api',
        method: 'GET' as const
      }];
      
      expect(() => resolver['validateUrls'](configs)).toThrow(SecurityError);
      expect(() => resolver['validateUrls'](configs)).toThrow('Domain not allowed');
    });
  });
  
  describe('Environment variable resolution', () => {
    it('should resolve env: prefix in auth_value', () => {
      const configs = [{
        key: 'test',
        url: 'https://api.example.com/test',
        method: 'GET' as const,
        auth_type: 'bearer' as const,
        auth_value: 'env:API_TOKEN'
      }];
      
      const resolved = resolver['resolveEnvironmentVariables'](configs);
      expect(resolved[0].auth_value).toBe('test-token-123');
    });
    
    it('should throw error for missing environment variable', () => {
      const configs = [{
        key: 'test',
        url: 'https://api.example.com/test',
        method: 'GET' as const,
        auth_value: 'env:MISSING_TOKEN'
      }];
      
      expect(() => resolver['resolveEnvironmentVariables'](configs)).toThrow(SecurityError);
      expect(() => resolver['resolveEnvironmentVariables'](configs)).toThrow('Environment variable not found');
    });
  });
  
  describe('Template resolution', () => {
    it('should resolve variables in string template', () => {
      const template = 'Hello {user.name}, your project is {project.id}';
      const variables = {
        user: { name: 'John' },
        project: { id: '123' }
      };
      
      const result = resolver['resolveTemplate'](template, variables);
      expect(result).toBe('Hello John, your project is 123');
    });
    
    it('should handle missing variables gracefully', () => {
      const template = 'Hello {user.name}, your project is {project.id}';
      const variables = {
        user: { name: 'John' }
        // project is missing
      };
      
      const result = resolver['resolveTemplate'](template, variables);
      expect(result).toBe('Hello John, your project is {project.id}');
    });
    
    it('should resolve variables in nested objects', () => {
      const template = {
        url: 'https://api.example.com/users/{user.id}',
        headers: {
          'X-User-Id': '{user.id}',
          'Authorization': 'Bearer {token}'
        }
      };
      
      const variables = {
        user: { id: '123' },
        token: 'abc123'
      };
      
      const result = resolver['resolveTemplate'](template, variables);
      expect(result.url).toBe('https://api.example.com/users/123');
      expect(result.headers['X-User-Id']).toBe('123');
      expect(result.headers['Authorization']).toBe('Bearer abc123');
    });
  });
  
  describe('Safe template substitution', () => {
    it('should substitute variables with custom delimiters', () => {
      const template = 'Hello {* user.name *}, welcome to {* project.name *}';
      const variables = {
        user: { name: 'John' },
        project: { name: 'Test Project' }
      };
      
      const result = resolver['safeSubstitute'](template, variables);
      expect(result).toBe('Hello John, welcome to Test Project');
    });
    
    it('should sanitize HTML in string variables', () => {
      const template = 'Message: {* message *}';
      const variables = {
        message: '<script>alert("xss")</script>'
      };
      
      const result = resolver['safeSubstitute'](template, variables);
      expect(result).toBe('Message: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
    
    it('should keep original template for missing variables', () => {
      const template = 'Hello {* user.name *}';
      const variables = {};
      
      const result = resolver['resolveTemplate'](template, variables);
      expect(result).toBe('Hello {* user.name *}');
    });
  });
  
  describe('Circuit breaker', () => {
    it('should open circuit after failures', () => {
      const url = 'https://api.example.com/test';
      
      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        resolver['recordCircuitFailure'](url);
      }
      
      const isOpen = resolver['isCircuitOpen'](url);
      expect(isOpen).toBe(true);
    });
    
    it('should close circuit after success', () => {
      const url = 'https://api.example.com/test';
      
      // Record failures
      resolver['recordCircuitFailure'](url);
      resolver['recordCircuitFailure'](url);
      
      // Record success
      resolver['recordCircuitSuccess'](url);
      
      const isOpen = resolver['isCircuitOpen'](url);
      expect(isOpen).toBe(false);
    });
  });
  
  describe('Input keys validation', () => {
    it('should parse valid input_keys JSON', () => {
      const inputKeys = JSON.stringify([{
        key: 'user_data',
        url: 'https://api.example.com/users',
        method: 'GET'
      }]);
      
      const configs = resolver['validateAndParseInputKeys'](inputKeys);
      expect(configs).toHaveLength(1);
      expect(configs[0].key).toBe('user_data');
      expect(configs[0].url).toBe('https://api.example.com/users');
      expect(configs[0].method).toBe('GET');
    });
    
    it('should reject non-array input_keys', () => {
      const inputKeys = JSON.stringify({
        key: 'user_data',
        url: 'https://api.example.com/users',
        method: 'GET'
      });
      
      expect(() => resolver['validateAndParseInputKeys'](inputKeys)).toThrow(SecurityError);
      expect(() => resolver['validateAndParseInputKeys'](inputKeys)).toThrow('input_keys must be a JSON array');
    });
    
    it('should reject configs missing required fields', () => {
      const inputKeys = JSON.stringify([{
        url: 'https://api.example.com/users',
        method: 'GET'
        // missing key
      }]);
      
      expect(() => resolver['validateAndParseInputKeys'](inputKeys)).toThrow(SecurityError);
      expect(() => resolver['validateAndParseInputKeys'](inputKeys)).toThrow("missing or invalid 'key' property");
    });
    
    it('should set default values', () => {
      const inputKeys = JSON.stringify([{
        key: 'test',
        url: 'https://api.example.com/test',
        method: 'GET'
      }]);
      
      const configs = resolver['validateAndParseInputKeys'](inputKeys);
      expect(configs[0].timeout_ms).toBe(10000); // Default from security config
      expect(configs[0].max_retries).toBe(3);
      expect(configs[0].retry_delay_ms).toBe(1000);
    });
  });
});