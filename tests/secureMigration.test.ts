// Unit tests for SecureMigration
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { SecureMigration } from '../src/services/secureMigration';

describe('SecureMigration', () => {
  let migration: SecureMigration;
  
  beforeEach(() => {
    migration = new SecureMigration();
  });
  
  describe('Task payload validation', () => {
    it('should detect non-HTTPS URLs in payload', () => {
      const task = {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test',
        payload: JSON.stringify({
          instructions: 'Do something',
          url: 'http://insecure.com/api'
        }),
        flow_id: 'flow-123',
        status: 'pending'
      };
      
      const result = migration['validateTaskPayload'](task as any);
      expect(result.warnings[0]).toContain('non-HTTPS URL');
    });
    
    it('should allow HTTPS URLs', () => {
      const task = {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test',
        payload: JSON.stringify({
          instructions: 'Do something',
          url: 'https://secure.com/api'
        }),
        flow_id: 'flow-123',
        status: 'pending'
      };
      
      const result = migration['validateTaskPayload'](task as any);
      expect(result.warnings).toHaveLength(0);
    });
    
    it('should detect sensitive data patterns', () => {
      const task = {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test',
        payload: JSON.stringify({
          instructions: 'Do something',
          api_key: 'sk_test_1234567890'
        }),
        flow_id: 'flow-123',
        status: 'pending'
      };
      
      const result = migration['validateTaskPayload'](task as any);
      expect(result.warnings[0]).toContain('sensitive data');
    });
    
    it('should handle non-JSON payload', () => {
      const task = {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test',
        payload: 'Just a plain string with https://example.com',
        flow_id: 'flow-123',
        status: 'pending'
      };
      
      const result = migration['validateTaskPayload'](task as any);
      // Should not throw error
      expect(result).toBeDefined();
    });
  });
  
  describe('Input keys validation', () => {
    it('should validate correct input_keys JSON', () => {
      const inputKeys = JSON.stringify([{
        key: 'user_data',
        url: 'https://api.example.com/users',
        method: 'GET'
      }]);
      
      const result = migration.validateInputKeysJson(inputKeys);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should invalidate missing required fields', () => {
      const inputKeys = JSON.stringify([{
        url: 'https://api.example.com/users',
        method: 'GET'
        // missing key
      }]);
      
      const result = migration.validateInputKeysJson(inputKeys);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("missing or invalid 'key' property");
    });
    
    it('should warn about non-HTTPS URLs', () => {
      const inputKeys = JSON.stringify([{
        key: 'test',
        url: 'http://example.com/api',
        method: 'GET'
      }]);
      
      const result = migration.validateInputKeysJson(inputKeys);
      expect(result.warnings[0]).toContain('should use HTTPS');
    });
    
    it('should warn about localhost in production', () => {
      const inputKeys = JSON.stringify([{
        key: 'test',
        url: 'http://localhost:3000/api',
        method: 'GET'
      }]);
      
      const result = migration.validateInputKeysJson(inputKeys);
      expect(result.warnings[0]).toContain('Using localhost URL in production');
    });
  });
  
  describe('Example config generation', () => {
    it('should generate example configurations', () => {
      const examples = migration.createExampleConfigs();
      
      expect(examples.simple_get).toBeDefined();
      expect(Array.isArray(examples.simple_get)).toBe(true);
      expect(examples.simple_get[0].key).toBe('user_data');
      
      expect(examples.dependent_calls).toBeDefined();
      expect(examples.dependent_calls.length).toBe(2);
      expect(examples.dependent_calls[1].depends_on).toEqual(['user']);
      
      expect(examples.internal_task).toBeDefined();
      expect(examples.internal_task[0].url).toContain('internal://tasks/');
    });
  });
  
  describe('Migration SQL generation', () => {
    it('should generate migration SQL', () => {
      const sql = migration.generateMigrationSql();
      
      expect(sql).toContain('ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS input_keys TEXT');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_flow_steps_input_keys');
      expect(sql).toContain('requires_task and task_id columns are now deprecated');
      expect(sql).toContain('Security note: External API URLs in input_keys must use HTTPS');
    });
  });
  
  describe('Compatibility wrapper generation', () => {
    it('should generate backward compatibility wrapper', () => {
      const wrapper = migration.generateCompatibilityWrapper();
      
      expect(wrapper).toContain('Backward compatibility wrapper for requires_task');
      expect(wrapper).toContain('resolveStepInstructions');
      expect(wrapper).toContain('SecureVariableResolver');
      expect(wrapper).toContain('getTaskData');
    });
  });
});