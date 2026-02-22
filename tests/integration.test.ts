// Integration tests for Dynamic API Data Fetching System
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecureVariableResolver } from '../src/services/secureVariableResolver';
import { resolveStepInstructions } from '../src/services/stepResolver';
import { SecureMigration } from '../src/services/secureMigration';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Integration: Full Dynamic API Data Fetching System', () => {
  let resolver: SecureVariableResolver;
  let migration: SecureMigration;
  
  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new SecureVariableResolver({
      API_TOKEN: 'test-token-123',
      GITHUB_TOKEN: 'ghp_test',
      USER_ID: '123'
    });
    
    migration = new SecureMigration();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('End-to-end variable resolution', () => {
    it('should resolve multiple dependent API calls', async () => {
      // Mock API responses
      const mockResponses = [
        { // First call: Get user
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ 
            data: { 
              user: { 
                id: 123, 
                name: 'John Doe',
                email: 'john@example.com'
              } 
            }
          }),
          headers: new Headers()
        },
        { // Second call: Get user's projects (depends on user.id)
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            data: {
              projects: [
                { id: 1, name: 'Project A', status: 'active' },
                { id: 2, name: 'Project B', status: 'completed' }
              ]
            }
          }),
          headers: new Headers()
        },
        { // Third call: Get project details (depends on projects[0].id)
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            data: {
              project: {
                id: 1,
                name: 'Project A',
                description: 'A test project',
                members: 5,
                budget: 10000
              }
            }
          }),
          headers: new Headers()
        }
      ];
      
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve(mockResponses[callCount++]);
      });
      
      // Step with multiple dependent API calls
      const step = {
        step_id: 'integration-step',
        instructions: `Hello {* user.name *}!

You have {* projects.length *} projects. 
Your first project "{* project.name *}" has a budget of ${'* project.budget *'}.

Please work on: {* project.description *}`,
        input_keys: JSON.stringify([
          {
            key: 'user',
            url: 'https://api.example.com/users/{env:USER_ID}',
            method: 'GET',
            auth_type: 'bearer',
            auth_value: 'env:API_TOKEN',
            response_path: 'data.user'
          },
          {
            key: 'projects',
            url: 'https://api.example.com/users/{user.id}/projects',
            method: 'GET',
            depends_on: ['user'],
            auth_type: 'bearer',
            auth_value: 'env:API_TOKEN',
            response_path: 'data.projects'
          },
          {
            key: 'project',
            url: 'https://api.example.com/projects/{projects.0.id}',
            method: 'GET',
            depends_on: ['projects'],
            auth_type: 'bearer',
            auth_value: 'env:API_TOKEN',
            response_path: 'data.project'
          }
        ]),
        auto_fail_on_error: true
      };
      
      const context = {
        env: {
          API_TOKEN: 'test-token-123',
          GITHUB_TOKEN: 'ghp_test',
          USER_ID: '123'
        },
        step,
        flow_id: 'test-flow',
        execution_id: 'test-exec'
      };
      
      // Resolve variables
      const result = await resolver.resolveStepVariables(step, context);
      
      // Verify results
      expect(result.instructions).toContain('Hello John Doe!');
      expect(result.instructions).toContain('You have 2 projects');
      expect(result.instructions).toContain('Your first project "Project A"');
      expect(result.instructions).toContain('has a budget of 10000');
      expect(result.instructions).toContain('Please work on: A test project');
      
      // Verify variables
      expect(result.variables.user).toEqual({
        id: 123,
        name: 'John Doe',
        email: 'john@example.com'
      });
      
      expect(result.variables.projects).toHaveLength(2);
      expect(result.variables.project).toEqual({
        id: 1,
        name: 'Project A',
        description: 'A test project',
        members: 5,
        budget: 10000
      });
      
      // Verify API responses
      expect(result.api_responses.user.success).toBe(true);
      expect(result.api_responses.projects.success).toBe(true);
      expect(result.api_responses.project.success).toBe(true);
      
      // Verify fetch was called 3 times
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
    
    it('should handle API failures gracefully', async () => {
      // Mock first API success, second API failure
      const mockResponses = [
        {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ data: { user: { id: 1, name: 'John' } } }),
          headers: new Headers()
        },
        {
          ok: false,
          status: 500,
          json: vi.fn().mockResolvedValue({ error: 'Internal server error' }),
          headers: new Headers()
        }
      ];
      
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve(mockResponses[callCount++]);
      });
      
      const step = {
        step_id: 'test-step',
        instructions: 'User: {* user.name *}, Projects: {* projects.status *}',
        input_keys: JSON.stringify([
          {
            key: 'user',
            url: 'https://api.example.com/users/1',
            method: 'GET',
            response_path: 'data.user'
          },
          {
            key: 'projects',
            url: 'https://api.example.com/users/{user.id}/projects',
            method: 'GET',
            depends_on: ['user']
          }
        ]),
        auto_fail_on_error: false // Non-fatal error
      };
      
      const context = {
        env: {},
        step,
        flow_id: 'test-flow',
        execution_id: 'test-exec'
      };
      
      const result = await resolver.resolveStepVariables(step, context);
      
      // Should still have user data
      expect(result.variables.user).toEqual({ id: 1, name: 'John' });
      
      // Projects should have error object
      expect(result.variables.projects).toHaveProperty('error');
      
      // Instructions should show user name but keep projects template
      expect(result.instructions).toContain('User: John');
      expect(result.instructions).toContain('Projects: {* projects.status *}');
      
      // API responses should show success for user, failure for projects
      expect(result.api_responses.user.success).toBe(true);
      expect(result.api_responses.projects.success).toBe(false);
    });
    
    it('should use cache for repeated API calls', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: { value: 'cached-data' } }),
        headers: new Headers()
      };
      
      (global.fetch as any).mockResolvedValue(mockResponse);
      
      const step1 = {
        step_id: 'step-1',
        instructions: 'Data: {* cached_data.value *}',
        input_keys: JSON.stringify([{
          key: 'cached_data',
          url: 'https://api.example.com/data',
          method: 'GET',
          cache_key: 'api_data_cache',
          cache_ttl_seconds: 300
        }])
      };
      
      const step2 = {
        step_id: 'step-2',
        instructions: 'Also: {* cached_data.value *}',
        input_keys: JSON.stringify([{
          key: 'cached_data',
          url: 'https://api.example.com/data',
          method: 'GET',
          cache_key: 'api_data_cache',
          cache_ttl_seconds: 300
        }])
      };
      
      const context = {
        env: {},
        step: step1,
        flow_id: 'test-flow',
        execution_id: 'test-exec'
      };
      
      // First call - should fetch from API
      const result1 = await resolver.resolveStepVariables(step1, context);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result1.variables.cached_data).toEqual({ value: 'cached-data' });
      
      // Update context for second step
      context.step = step2;
      
      // Second call - should use cache
      const result2 = await resolver.resolveStepVariables(step2, context);
      
      // fetch should still have been called only once (cached)
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result2.variables.cached_data).toEqual({ value: 'cached-data' });
      expect(result2.api_responses.cached_data.cached).toBe(true);
    });
  });
  
  describe('Integration with step resolver', () => {
    it('should resolve step with mixed input_keys and task_id', async () => {
      // Mock SecureVariableResolver for input_keys
      const { SecureVariableResolver } = await import('../src/services/secureVariableResolver');
      const mockResolver = {
        resolveStepVariables: vi.fn().mockResolvedValue({
          instructions: 'Resolved: User {* user.name *} has task: Implement login',
          variables: { user: { name: 'John' } },
          api_responses: { user: { success: true } }
        })
      };
      (SecureVariableResolver as any).mockImplementation(() => mockResolver);
      
      // Mock database for task_id
      const { getTaskData } = await import('../src/services/database');
      (getTaskData as any).mockResolvedValue({
        title: 'Implement login',
        description: 'Create login functionality with OAuth',
        payload: JSON.stringify({ priority: 'high' })
      });
      
      const step = {
        step_id: 'mixed-step',
        step_key: 'test',
        title: 'Test Step',
        description: 'Step with both systems',
        step_type: 'action',
        order_index: 1,
        page_key: null,
        blocking: true,
        auto_fail_on_error: false,
        retryable: false,
        task_id: 'task-123',
        input_keys: JSON.stringify([{
          key: 'user',
          url: 'https://api.example.com/users/current',
          method: 'GET'
        }])
      };
      
      const result = await resolveStepInstructions(
        step,
        {} as any, // mock db
        { API_TOKEN: 'test' },
        { flow_id: 'test-flow', execution_id: 'test-exec' }
      );
      
      // Should use input_keys system (new system takes precedence)
      expect(result.instructions).toBe('Resolved: User {* user.name *} has task: Implement login');
      expect(result.variables).toEqual({ user: { name: 'John' } });
      
      // SecureVariableResolver should have been called
      expect(mockResolver.resolveStepVariables).toHaveBeenCalled();
      
      // Database should not have been called (input_keys takes precedence)
      expect(getTaskData).not.toHaveBeenCalled();
    });
    
    it('should fall back to task_id when input_keys fails', async () => {
      // Mock SecureVariableResolver to fail
      const { SecureVariableResolver } = await import('../src/services/secureVariableResolver');
      (SecureVariableResolver as any).mockImplementation(() => ({
        resolveStepVariables: vi.fn().mockRejectedValue(new Error('API unavailable'))
      }));
      
      // Mock database for task_id
      const { getTaskData } = await import('../src/services/database');
      (getTaskData as any).mockResolvedValue({
        title: 'Backup Task',
        description: 'Use this when API fails',
        payload: null
      });
      
      const step = {
        step_id: 'fallback-step',
        step_key: 'test',
        title: 'Fallback Step',
        description: 'Step that falls back',
        step_type: 'action',
        order_index: 1,
        page_key: null,
        blocking: true,
        auto_fail_on_error: false, // Important: non-fatal
        retryable: false,
        task_id: 'task-backup',
        input_keys: JSON.stringify([{
          key: 'api_data',
          url: 'https://api.example.com/data',
          method: 'GET'
        }])
      };
      
      const result = await resolveStepInstructions(
        step,
        {} as any, // mock db
        { API_TOKEN: 'test' },
        { flow_id: 'test-flow', execution_id: 'test-exec' }
      );
      
      // Should have task data from fallback
      expect(result.instructions).toContain('=== TASK ===');
      expect(result.instructions).toContain('Backup Task');
      expect(result.task_data?.title).toBe('Backup Task');
    });
  });
  
  describe('Security integration', () => {
    it('should reject unauthorized domains', async () => {
      const step = {
        step_id: 'security-step',
        instructions: 'Test',
        input_keys: JSON.stringify([{
          key: 'malicious',
          url: 'https://evil-domain.com/data',
          method: 'GET'
        }]),
        auto_fail_on_error: true
      };
      
      const context = {
        env: {},
        step,
        flow_id: 'test-flow',
        execution_id: 'test-exec'
      };
      
      await expect(resolver.resolveStepVariables(step, context))
        .rejects
        .toThrow('Domain not allowed');
    });
    
    it('should enforce HTTPS for external APIs', async () => {
      const step = {
        step_id: 'security-step',
        instructions: 'Test',
        input_keys: JSON.stringify([{
          key: 'insecure',
          url: 'http://api.example.com/data', // HTTP not HTTPS
          method: 'GET'
        }]),
        auto_fail_on_error: true
      };
      
      const context = {
        env: {},
        step,
        flow_id: 'test-flow',
        execution_id: 'test-exec'
      };
      
      await expect(resolver.resolveStepVariables(step, context))
        .rejects
        .toThrow('External API must use HTTPS');
    });
    
    it('should allow HTTP for internal domains', async () => {
      // Mock successful response for internal API
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'internal' }),
        headers: new Headers()
      });
      
      const step = {
        step_id: 'security-step',
        instructions: 'Test',
        input_keys: JSON.stringify([{
          key: 'internal',
          url: 'http://localhost:3000/api/data',
          method: 'GET',
          require_https: false
        }]),
        auto_fail_on_error: true
      };
      
      const context = {
        env: {},
        step,
        flow_id: 'test-flow',
        execution_id: 'test-exec'
      };
      
      // Should not throw for internal HTTP
      await expect(resolver.resolveStepVariables(step, context))
        .resolves
        .toBeDefined();
    });
    
    it('should redact sensitive data in logs', async () => {
      // Mock response with sensitive data
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: {
            user: 'test',
            token: 'secret-token-123',
            password: 'super-secret',
            api_key: 'sk_test_abcdef'
          }
        }),
        headers: new Headers()
      });
      
      const step = {
        step_id: 'security-step',
        instructions: 'Test',
        input_keys: JSON.stringify([{
          key: 'sensitive',
          url: 'https://api.example.com/sensitive',
          method: 'GET',
          redact_fields: ['token', 'password', 'api_key']
        }]),
        auto_fail_on_error: true
      };
      
      const context = {
        env: {},
        step,
        flow_id: 'test-flow',
        execution_id: 'test-exec'
      };
      
      const result = await resolver.resolveStepVariables(step, context);
      
      // Check that sensitive fields are redacted in response
      const redactedResponse = result.api_responses.sensitive.redacted_response;
      expect(redactedResponse.data.token).toBe('[REDACTED]');
      expect(redactedResponse.data.password).toBe('[REDACTED]');
      expect(redactedResponse.data.api_key).toBe('[REDACTED]');
      expect(redactedResponse.data.user).toBe('test'); // Not redacted
    });
  });
});