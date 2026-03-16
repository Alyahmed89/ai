#!/usr/bin/env node
/**
 * Script to populate AI commands in endpoint_registry
 * Scans existing routes and creates AI command entries
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Define command mappings for initial set
const INITIAL_COMMANDS = [
  // Task management
  {
    name: 'create_task',
    description: 'Create a new task with title, description, and status',
    endpoint: '/api/tasks',
    method: 'POST',
    zodSchema: 'taskCreateSchema',
    tags: ['task', 'crud', 'ai_command']
  },
  {
    name: 'get_tasks',
    description: 'Get all tasks, optionally filtered by flow_id',
    endpoint: '/api/tasks',
    method: 'GET',
    zodSchema: null, // No schema for GET
    tags: ['task', 'read', 'ai_command']
  },
  {
    name: 'get_task_by_id',
    description: 'Get a specific task by its ID',
    endpoint: '/api/tasks/:id',
    method: 'GET',
    zodSchema: null,
    tags: ['task', 'read', 'ai_command']
  },
  {
    name: 'update_task',
    description: 'Update an existing task',
    endpoint: '/api/tasks/:id',
    method: 'PUT',
    zodSchema: 'taskUpdateSchema',
    tags: ['task', 'crud', 'ai_command']
  },
  {
    name: 'delete_task',
    description: 'Delete a task by ID',
    endpoint: '/api/tasks/:id',
    method: 'DELETE',
    zodSchema: null,
    tags: ['task', 'crud', 'ai_command']
  },
  
  // Flow step management
  {
    name: 'create_flow_step',
    description: 'Create a new flow step',
    endpoint: '/api/flow-steps',
    method: 'POST',
    zodSchema: 'flowStepCreateSchema',
    tags: ['flow', 'step', 'ai_command']
  },
  {
    name: 'get_flow_steps',
    description: 'Get all flow steps, optionally filtered by flow_id',
    endpoint: '/api/flow-steps',
    method: 'GET',
    zodSchema: null,
    tags: ['flow', 'step', 'ai_command']
  },
  {
    name: 'get_flow_step_by_id',
    description: 'Get a specific flow step by ID',
    endpoint: '/api/flow-steps/:id',
    method: 'GET',
    zodSchema: null,
    tags: ['flow', 'step', 'ai_command']
  },
  {
    name: 'update_flow_step',
    description: 'Update an existing flow step',
    endpoint: '/api/flow-steps/:id',
    method: 'PUT',
    zodSchema: 'flowStepUpdateSchema',
    tags: ['flow', 'step', 'ai_command']
  },
  
  // Flow definitions
  {
    name: 'get_flow_definitions',
    description: 'Get all flow definitions',
    endpoint: '/api/flow-definitions',
    method: 'GET',
    zodSchema: null,
    tags: ['flow', 'definition', 'ai_command']
  },
  
  // Conversation endpoints
  {
    name: 'start_conversation',
    description: 'Start a new conversation with a repository and initial prompt',
    endpoint: '/start',
    method: 'POST',
    zodSchema: null, // Complex schema, handle manually
    tags: ['conversation', 'ai_command']
  },
  {
    name: 'get_conversation_status',
    description: 'Get the status of a conversation by ID',
    endpoint: '/status/:id',
    method: 'GET',
    zodSchema: null,
    tags: ['conversation', 'ai_command']
  },
  
  // Flow runs
  {
    name: 'get_flow_runs',
    description: 'Get all flow runs with optional filtering',
    endpoint: '/api/flow-runs',
    method: 'GET',
    zodSchema: null,
    tags: ['flow', 'run', 'ai_command']
  },
  
  // Graph API - simple endpoints
  {
    name: 'create_project',
    description: 'Create a new project in the graph',
    endpoint: '/graph/projects',
    method: 'POST',
    zodSchema: null,
    tags: ['graph', 'project', 'ai_command']
  },
  {
    name: 'get_projects',
    description: 'Get all projects',
    endpoint: '/graph/projects',
    method: 'GET',
    zodSchema: null,
    tags: ['graph', 'project', 'ai_command']
  }
];

// Manual parameter schemas for endpoints without Zod schemas
const MANUAL_SCHEMAS: Record<string, any> = {
  'create_task': {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', default: 'pending' },
      flow_id: { type: 'string' },
      order_index: { type: 'integer', default: 0 }
    },
    required: ['title', 'flow_id']
  },
  'update_task': {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string' },
      order_index: { type: 'integer' }
    },
    required: []
  },
  'create_flow_step': {
    type: 'object',
    properties: {
      flow_id: { type: 'string' },
      step_key: { type: 'string' },
      title: { type: 'string' },
      instructions: { type: 'string' },
      step_type: { type: 'string', default: 'manual' },
      order_index: { type: 'integer', default: 0 }
    },
    required: ['flow_id', 'step_key', 'title', 'instructions']
  },
  'update_flow_step': {
    type: 'object',
    properties: {
      flow_id: { type: 'string' },
      step_key: { type: 'string' },
      title: { type: 'string' },
      instructions: { type: 'string' },
      step_type: { type: 'string' },
      order_index: { type: 'integer' }
    },
    required: []
  },
  'start_conversation': {
    type: 'object',
    properties: {
      repository: { type: 'string' },
      branch: { type: 'string', default: 'main' },
      initial_user_prompt: { type: 'string' },
      max_iterations: { type: 'integer', default: 20 },
      flow_id: { type: 'string' }
    },
    required: []
  },
  'create_project': {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      metadata: { type: 'string' }
    },
    required: ['name']
  }
};

/**
 * Generate SQL statements to populate AI commands
 */
function generatePopulationSQL(): string {
  const now = Math.floor(Date.now() / 1000);
  const sqlStatements: string[] = [];
  
  sqlStatements.push('-- AI Command Population Script');
  sqlStatements.push('-- Generated on: ' + new Date().toISOString());
  sqlStatements.push('');
  
  // First, disable all existing AI commands to clean up
  sqlStatements.push('-- Disable all existing AI commands');
  sqlStatements.push("UPDATE endpoint_registry SET ai_enabled = FALSE WHERE endpoint_type = 'internal_command';");
  sqlStatements.push('');
  
  sqlStatements.push('-- Insert or update AI commands');
  
  for (const cmd of INITIAL_COMMANDS) {
    const id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const parameterSchema = MANUAL_SCHEMAS[cmd.name] || 
      (cmd.zodSchema ? `/* Auto-generated from ${cmd.zodSchema} */` : null);
    
    const sql = `
INSERT OR REPLACE INTO endpoint_registry (
  id, name, description, url, method, auth_type,
  ai_enabled, endpoint_type, parameter_schema,
  created_at, updated_at, created_by, tags
) VALUES (
  '${id}',
  '${cmd.name}',
  '${cmd.description.replace(/'/g, "''")}',
  '${cmd.endpoint}',
  '${cmd.method}',
  'none',
  TRUE,
  'internal_command',
  ${parameterSchema ? `'${JSON.stringify(parameterSchema).replace(/'/g, "''")}'` : 'NULL'},
  ${now},
  ${now},
  'ai_command_script',
  '${JSON.stringify(cmd.tags).replace(/'/g, "''")}'
);`;
    
    sqlStatements.push(sql);
  }
  
  sqlStatements.push('');
  sqlStatements.push('-- Count of AI-enabled commands');
  sqlStatements.push("SELECT COUNT(*) as ai_command_count FROM endpoint_registry WHERE ai_enabled = TRUE AND endpoint_type = 'internal_command';");
  
  return sqlStatements.join('\n');
}

/**
 * Main function
 */
function main() {
  console.log('Generating AI command population SQL...\n');
  
  const sql = generatePopulationSQL();
  
  // Write to file
  const outputPath = join(__dirname, '../migrations/0039_populate_ai_commands.sql');
  const fs = require('fs');
  fs.writeFileSync(outputPath, sql);
  
  console.log(`Generated SQL saved to: ${outputPath}`);
  console.log(`\nTotal commands: ${INITIAL_COMMANDS.length}`);
  console.log('\nCommands to be enabled:');
  INITIAL_COMMANDS.forEach((cmd, i) => {
    console.log(`  ${i + 1}. ${cmd.name} (${cmd.method} ${cmd.endpoint})`);
  });
  
  console.log('\nTo apply:');
  console.log('  1. Run the migration: sqlite3 your.db < migrations/0039_populate_ai_commands.sql');
  console.log('  2. Restart the backend');
  console.log('  3. Test: GET /api/commands');
}

// Run if called directly
if (require.main === module) {
  main();
}

export { generatePopulationSQL, INITIAL_COMMANDS };