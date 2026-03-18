// Unit tests for StepResolver
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { resolveStepInstructions, validateStepConfiguration, generateExampleInputKeys } from '../src/services/stepResolver';

// Mock the SecureVariableResolver to avoid actual API calls
vi.mock('../src/services/secureVariableResolver', () => ({
  SecureVariableResolver: vi.fn().mockImplementation(() => ({
    resolveStepVariables: vi.fn().mockResolvedValue({
      instructions: 'Resolved instructions with variables',
      variables: { user_data: { name: 'John' } },
      api_responses: { user_data: { success: true } }
    })
  }))
}));

// Mock database functions
vi.mock('../src/services/database', () => ({
  getTaskData: vi.fn().mockResolvedValue({
    title: 'Test Task',
    description: 'Task description',
    payload: JSON.stringify({ instructions: 'Do something' })
  })
}));

describe('StepResolver', () => {
  describe('resolveStepInstructions', () => {
    it('should resolve step with use_endpoints using unified endpoint system', async () => {
      const step = {
        step_id: 'test-step',
        step_key: 'test',
        title: 'Test Step',
        description: 'Step with {api.user_data.response.name}',
        step_type: 'action',
        order_index: 1,
        page_key: null,
        blocking: true,
        auto_fail_on_error: false,
        retryable: false,
        use_endpoints: JSON.stringify([{
          endpoint_id: 'test-endpoint-123',
          phase: 'input',
          map: {
            'response.name': 'user_data.name'
          }
        }])
      };
      
      // Mock the executeUnifiedEndpoints function
      const { executeUnifiedEndpoints } = await import('../src/services/stepResolver');
      vi.mocked(executeUnifiedEndpoints).mockResolvedValue({
        api_calls: [{
          endpoint_id: 'test-endpoint-123',
          endpoint_name: 'user_data',
          phase: 'input',
          request: { url: 'https://api.example.com/users/1', method: 'GET' },
          response: { data: { name: 'John', email: 'john@example.com' } }
        }],
        variables: {
          api: {
            user_data: {
              response: { name: 'John', email: 'john@example.com' }
            }
          },
          env: { API_TOKEN: 'test' },
          previous_step: {}
        }
      });
      
      const result = await resolveStepInstructions(
        step,
        {} as any, // mock db
        { API_TOKEN: 'test' },
        { flow_id: 'test-flow', execution_id: 'test-exec' }
      );
      
      expect(result.instructions).toContain('John');
      expect(result.variables?.api?.user_data?.response?.name).toBe('John');
      expect(result.api_responses?.['test-endpoint-123']?.name).toBe('John');
    });
    
    it('should fall back to task_id system when input_keys fails', async () => {
      // Mock SecureVariableResolver to throw error
      const { SecureVariableResolver } = await import('../src/services/secureVariableResolver');
      (SecureVariableResolver as any).mockImplementationOnce(() => ({
        resolveStepVariables: vi.fn().mockRejectedValue(new Error('API failed'))
      }));
      
      const step = {
        step_id: 'test-step',
        step_key: 'test',
        title: 'Test Step',
        description: 'Step description',
        step_type: 'action',
        order_index: 1,
        page_key: null,
        blocking: true,
        auto_fail_on_error: false,
        retryable: false,
        task_id: 'task-123',
        input_keys: JSON.stringify([{
          key: 'user_data',
          url: 'https://api.example.com/users/1',
          method: 'GET'
        }])
      };
      
      const result = await resolveStepInstructions(
        step,
        {} as any, // mock db
        { API_TOKEN: 'test' },
        { flow_id: 'test-flow', execution_id: 'test-exec' }
      );
      
      // Should fall back to task data
      expect(result.instructions).toContain('=== TASK ===');
      expect(result.task_data).toBeDefined();
    });
    
    it('should use task_id system when no input_keys', async () => {
      const step = {
        step_id: 'test-step',
        step_key: 'test',
        title: 'Test Step',
        description: 'Step description',
        step_type: 'action',
        order_index: 1,
        page_key: null,
        blocking: true,
        auto_fail_on_error: false,
        retryable: false,
        task_id: 'task-123'
        // no input_keys
      };
      
      const result = await resolveStepInstructions(
        step,
        {} as any, // mock db
        { API_TOKEN: 'test' },
        { flow_id: 'test-flow', execution_id: 'test-exec' }
      );
      
      expect(result.instructions).toContain('=== TASK ===');
      expect(result.task_data).toBeDefined();
      expect(result.task_data?.title).toBe('Test Task');
    });
  });
  
  describe('validateStepConfiguration', () => {
    it('should validate step with valid input_keys', () => {
      const step = {
        step_id: 'test-step',
        input_keys: JSON.stringify([{
          key: 'user_data',
          url: 'https://api.example.com/users',
          method: 'GET'
        }])
      } as any;
      
      const result = validateStepConfiguration(step);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should invalidate step with invalid input_keys JSON', () => {
      const step = {
        step_id: 'test-step',
        input_keys: 'invalid json'
      } as any;
      
      const result = validateStepConfiguration(step);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid input_keys JSON');
    });
    
    it('should warn about deprecated requires_task', () => {
      const step = {
        step_id: 'test-step',
        requires_task: true
      } as any;
      
      const result = validateStepConfiguration(step);
      expect(result.warnings[0]).toContain('requires_task is deprecated');
    });
    
    it('should warn about task_id without input_keys', () => {
      const step = {
        step_id: 'test-step',
        task_id: 'task-123'
        // no input_keys
      } as any;
      
      const result = validateStepConfiguration(step);
      expect(result.warnings[0]).toContain('task_id without input_keys');
    });
  });
  
  describe('generateExampleInputKeys', () => {
    it('should generate example configs for a step', () => {
      const step = {
        step_id: 'test-step',
        task_id: 'task-123'
      } as any;
      
      const examples = generateExampleInputKeys(step);
      const parsed = JSON.parse(examples);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      
      // Should include internal task lookup example
      const internalTaskConfig = parsed.find((c: any) => c.url.includes('internal://tasks/'));
      expect(internalTaskConfig).toBeDefined();
      expect(internalTaskConfig.key).toBe('task_data');
      
      // Should include external API examples
      const externalApiConfig = parsed.find((c: any) => c.url.includes('api.example.com'));
      expect(externalApiConfig).toBeDefined();
    });
  });
});