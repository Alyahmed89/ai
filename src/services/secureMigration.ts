// Secure Migration Utilities for Dynamic API Data Fetching
// ============================================================================

import { MigrationReport, SecurityError, SecureApiConfig } from '../types/secureTypes';

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  payload: string | null;
  flow_id: string;
  status: string;
}

interface StepData {
  id: string;
  flow_id: string;
  step_key: string;
  task_id?: string;
  requires_task?: boolean;
  instructions: string;
}

export class SecureMigration {
  /**
   * Migrate requires_task steps to input_keys format
   */
  async migrateRequiresTaskToInputKeys(db: D1Database): Promise<MigrationReport> {
    const report: MigrationReport = {
      migrated: 0,
      skipped: 0,
      errors: [],
      security_warnings: [],
      recommendations: [],
      timestamp: new Date().toISOString()
    };
    
    try {
      // Get all steps with requires_task
      const steps = await db.prepare(`
        SELECT id, flow_id, step_key, task_id, instructions
        FROM flow_steps 
        WHERE requires_task = TRUE AND task_id IS NOT NULL
      `).all();
      
      if (!steps.results || steps.results.length === 0) {
        report.recommendations.push('No requires_task steps found to migrate');
        return report;
      }
      
      this.log('info', `Found ${steps.results.length} steps with requires_task to migrate`);
      
      for (const step of steps.results) {
        const stepData = step as unknown as StepData;
        
        try {
          // Security: Verify task exists and is accessible
          const task = await db.prepare(`
            SELECT id, title, description, payload, flow_id, status
            FROM tasks 
            WHERE id = ?
          `).bind(stepData.task_id).first();
          
          if (!task) {
            report.security_warnings.push({
              step_id: stepData.id,
              warning: `Task ${stepData.task_id} not found`,
              task_id: stepData.task_id
            });
            report.skipped++;
            continue;
          }
          
          const taskData = task as unknown as TaskData;
          
          // Security: Validate task payload if it contains URLs
          const securityReport = this.validateTaskPayload(taskData);
          if (securityReport.warnings.length > 0) {
            report.security_warnings.push(...securityReport.warnings.map(w => ({
              step_id: stepData.id,
              warning: w,
              task_id: stepData.task_id
            })));
          }
          
          // Create secure API config for internal task lookup
          const inputKeys = this.createTaskApiConfig(stepData, taskData);
          
          // Update step with input_keys
          await db.prepare(`
            UPDATE flow_steps 
            SET input_keys = ?
            WHERE id = ?
          `).bind(JSON.stringify([inputKeys]), stepData.id).run();
          
          report.migrated++;
          
          this.log('info', `Migrated step ${stepData.id} (task: ${stepData.task_id})`);
          
        } catch (error) {
          report.errors.push({
            step_id: stepData.id,
            error: error.message,
            task_id: stepData.task_id
          });
          this.log('error', `Failed to migrate step ${stepData.id}: ${error.message}`);
        }
      }
      
      // Add recommendations based on migration results
      if (report.migrated > 0) {
        report.recommendations.push(
          `Successfully migrated ${report.migrated} steps from requires_task to input_keys`
        );
      }
      
      if (report.skipped > 0) {
        report.recommendations.push(
          `${report.skipped} steps were skipped due to missing tasks or security warnings`
        );
      }
      
      if (report.errors.length > 0) {
        report.recommendations.push(
          `${report.errors.length} steps failed to migrate. Check errors for details.`
        );
      }
      
      report.recommendations.push(
        'Consider updating step instructions to use variable substitution syntax: {* task_data.description *}'
      );
      
      this.log('info', `Migration completed: ${report.migrated} migrated, ${report.skipped} skipped, ${report.errors.length} errors`);
      
    } catch (error) {
      report.errors.push({
        step_id: 'global',
        error: `Migration failed: ${error.message}`
      });
      this.log('error', `Global migration error: ${error.message}`);
    }
    
    return report;
  }
  
  /**
   * Create API config for internal task lookup
   */
  private createTaskApiConfig(step: StepData, task: TaskData): SecureApiConfig {
    // Extract description from task
    let description = task.description;
    if (!description && task.payload) {
      try {
        const payload = JSON.parse(task.payload);
        if (payload.instructions) {
          description = payload.instructions;
        } else if (typeof payload === 'string') {
          description = payload;
        }
      } catch (e) {
        // If payload is not JSON, use it as description
        description = task.payload;
      }
    }
    
    // Create task data object
    const taskData = {
      id: task.id,
      title: task.title,
      description: description,
      flow_id: task.flow_id,
      status: task.status
    };
    
    return {
      key: 'task_data',
      url: 'internal://tasks/' + task.id,
      method: 'GET',
      auth_type: 'none',
      timeout_ms: 5000,
      response_path: 'description',
      allowed_domains: ['internal'],
      require_https: false,
      log_level: 'info',
      redact_fields: []
    };
  }
  
  /**
   * Validate task payload for security issues
   */
  private validateTaskPayload(task: TaskData): { warnings: string[]; errors: string[] } {
    const result = { warnings: [], errors: [] };
    
    if (!task.payload) {
      return result;
    }
    
    try {
      // Try to parse as JSON
      const payload = JSON.parse(task.payload);
      const jsonString = JSON.stringify(payload);
      
      // Check for URLs
      const urlRegex = /https?:\/\/[^\s"']+/g;
      const urls = jsonString.match(urlRegex) || [];
      
      for (const url of urls) {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'https:' && 
              !parsed.hostname.includes('localhost') &&
              !parsed.hostname.includes('127.0.0.1')) {
            result.warnings.push(`Task payload contains non-HTTPS URL: ${url}`);
          }
        } catch (e) {
          // Not a valid URL, ignore
        }
      }
      
      // Check for sensitive data patterns
      const sensitivePatterns = [
        /api[_-]?key/i,
        /secret[_-]?key/i,
        /access[_-]?token/i,
        /password/i,
        /bearer\s+[A-Za-z0-9._-]{20,}/i
      ];
      
      for (const pattern of sensitivePatterns) {
        if (pattern.test(jsonString)) {
          result.warnings.push('Task payload may contain sensitive data (API keys, tokens, etc.)');
          break;
        }
      }
      
    } catch (e) {
      // Payload is not JSON, check as string
      if (typeof task.payload === 'string') {
        // Check for URLs in string
        const urlRegex = /https?:\/\/[^\s"']+/g;
        const urls = task.payload.match(urlRegex) || [];
        
        for (const url of urls) {
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' && 
                !parsed.hostname.includes('localhost')) {
              result.warnings.push(`Task payload contains non-HTTPS URL: ${url}`);
            }
          } catch (e) {
            // Not a valid URL, ignore
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Generate migration SQL script
   */
  generateMigrationSql(): string {
    return `-- Migration: Add input_keys column to flow_steps table
-- Date: ${new Date().toISOString()}
-- Description: Add support for dynamic API data fetching

-- 1. Add input_keys column
ALTER TABLE flow_steps ADD COLUMN IF NOT EXISTS input_keys TEXT;

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_flow_steps_input_keys ON flow_steps(input_keys) WHERE input_keys IS NOT NULL;

-- 3. Optional: Add comment about deprecation
-- Note: requires_task and task_id columns are now deprecated but kept for backward compatibility
-- New steps should use input_keys for dynamic API data fetching

-- 4. Example migration of existing requires_task steps:
-- UPDATE flow_steps 
-- SET input_keys = json_array(
--   json_object(
--     'key', 'task_data',
--     'url', 'internal://tasks/' || task_id,
--     'method', 'GET',
--     'auth_type', 'none',
--     'timeout_ms', 5000,
--     'response_path', 'description',
--     'allowed_domains', json_array('internal'),
--     'require_https', false
--   )
-- )
-- WHERE requires_task = TRUE AND task_id IS NOT NULL;

-- 5. Update step instructions to use variable syntax:
-- Original: "Complete the task: Implement login functionality"
-- Updated: "Complete the task: {* task_data.description *}"
-- Note: The variable 'task_data' comes from the input_keys configuration above

-- 6. Security note: External API URLs in input_keys must use HTTPS
-- unless explicitly allowed via require_https: false and allowed_domains`;
  }
  
  /**
   * Create example input_keys configurations
   */
  createExampleConfigs(): Record<string, SecureApiConfig[]> {
    return {
      // Example 1: Simple GET request
      simple_get: [{
        key: 'user_data',
        url: 'https://api.example.com/users/current',
        method: 'GET',
        auth_type: 'bearer',
        auth_value: 'env:API_TOKEN',
        timeout_ms: 10000,
        response_path: 'data.user',
        allowed_domains: ['api.example.com'],
        log_level: 'info'
      }],
      
      // Example 2: POST request with body
      post_with_body: [{
        key: 'create_result',
        url: 'https://api.example.com/resources',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          name: 'New Resource',
          type: 'example'
        },
        auth_type: 'bearer',
        auth_value: 'env:API_TOKEN',
        timeout_ms: 15000,
        response_path: 'data.id',
        allowed_domains: ['api.example.com']
      }],
      
      // Example 3: Multiple dependent API calls
      dependent_calls: [
        {
          key: 'user',
          url: 'https://api.example.com/users/{user_id}',
          method: 'GET',
          auth_type: 'bearer',
          auth_value: 'env:API_TOKEN',
          timeout_ms: 10000,
          response_path: 'data',
          allowed_domains: ['api.example.com']
        },
        {
          key: 'projects',
          url: 'https://api.example.com/users/{user.id}/projects',
          method: 'GET',
          depends_on: ['user'],
          auth_type: 'bearer',
          auth_value: 'env:API_TOKEN',
          timeout_ms: 10000,
          response_path: 'data.projects',
          allowed_domains: ['api.example.com']
        }
      ],
      
      // Example 4: Internal task lookup (backward compatibility)
      internal_task: [{
        key: 'task_data',
        url: 'internal://tasks/task_123',
        method: 'GET',
        auth_type: 'none',
        timeout_ms: 5000,
        response_path: 'description',
        allowed_domains: ['internal'],
        require_https: false
      }]
    };
  }
  
  /**
   * Validate input_keys JSON before insertion
   */
  validateInputKeysJson(inputKeys: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const result = { valid: true, errors: [], warnings: [] };
    
    try {
      const configs = JSON.parse(inputKeys);
      
      if (!Array.isArray(configs)) {
        result.valid = false;
        result.errors.push('input_keys must be a JSON array');
        return result;
      }
      
      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        
        // Check required fields
        if (!config.key || typeof config.key !== 'string') {
          result.errors.push(`Config at index ${i} missing or invalid 'key' property`);
        }
        
        if (!config.url || typeof config.url !== 'string') {
          result.errors.push(`Config at index ${i} missing or invalid 'url' property`);
        }
        
        if (!config.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].includes(config.method)) {
          result.errors.push(`Config at index ${i} missing or invalid 'method' property`);
        }
        
        // Security checks
        if (config.url && typeof config.url === 'string') {
          try {
            const url = new URL(config.url);
            
            // Check HTTPS for external domains
            if (url.protocol !== 'https:' && 
                url.protocol !== 'internal:' &&
                config.require_https !== false) {
              result.warnings.push(`Config at index ${i}: External URL should use HTTPS: ${config.url}`);
            }
            
            // Check for localhost/127.0.0.1 in production (warning)
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
              result.warnings.push(`Config at index ${i}: Using localhost URL in production: ${config.url}`);
            }
            
          } catch (e) {
            result.errors.push(`Config at index ${i}: Invalid URL: ${config.url}`);
          }
        }
        
        // Check auth_value if env: prefix is used
        if (config.auth_value && typeof config.auth_value === 'string' && 
            config.auth_value.startsWith('env:') && config.auth_value.length <= 5) {
          result.warnings.push(`Config at index ${i}: Environment variable reference appears empty: ${config.auth_value}`);
        }
      }
      
      if (result.errors.length > 0) {
        result.valid = false;
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Invalid JSON: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Generate backward compatibility wrapper
   */
  generateCompatibilityWrapper(): string {
    return `// Backward compatibility wrapper for requires_task
// Use this function to maintain compatibility during migration

import { SecureVariableResolver } from './secureVariableResolver';
import { getTaskData } from './database';

export async function getStepInstructions(
  step: any,
  db: D1Database,
  env: Record<string, string>,
  context: any
): Promise<string> {
  
  // New system: input_keys
  if (step.input_keys) {
    const resolver = new SecureVariableResolver(env);
    const resolved = await resolver.resolveStepVariables(
      {
        step_id: step.step_id || step.id,
        instructions: step.instructions,
        input_keys: step.input_keys,
        auto_fail_on_error: step.auto_fail_on_error
      },
      context
    );
    return resolved.instructions;
  }
  
  // Old system: requires_task
  if (step.requires_task && step.task_id) {
    const taskData = await getTaskData(db, step.task_id);
    return taskData?.description || step.instructions;
  }
  
  // Default: static instructions
  return step.instructions;
}

// Example usage in ConversationDO:
// const instructions = await getStepInstructions(step, this.env.FLOW_RUNS_DB, this.env, {
//   env: this.env,
//   step,
//   flow_id: this.flowId,
//   execution_id: this.executionId
// });`;
  }
  
  /**
   * Logging utility
   */
  private log(level: 'info' | 'error', message: string, context?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, context };
    
    if (level === 'error') {
      console.error(`[SecureMigration] ${message}`, context);
    } else {
      console.log(`[SecureMigration] ${message}`, context);
    }
  }
}