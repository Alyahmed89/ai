#!/usr/bin/env node

/**
 * Migration script to convert requires_task steps to input_keys format
 * 
 * Usage:
 *   node scripts/migrate-requires-task.js [--dry-run] [--limit N] [--flow-id FLOW_ID]
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --limit N    Limit to N steps (for testing)
 *   --flow-id    Only migrate steps from specific flow
 *   --help       Show this help
 */

import { createClient } from '@libsql/client';
import { SecureMigration } from '../src/services/secureMigration.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');
const flowId = args.find(arg => arg.startsWith('--flow-id='))?.split('=')[1];
const showHelp = args.includes('--help');

if (showHelp) {
  console.log(`
Migration script to convert requires_task steps to input_keys format

Usage:
  node scripts/migrate-requires-task.js [--dry-run] [--limit N] [--flow-id FLOW_ID]

Options:
  --dry-run    Show what would be migrated without making changes
  --limit N    Limit to N steps (for testing)
  --flow-id    Only migrate steps from specific flow
  --help       Show this help

Examples:
  # Dry run to see what would be migrated
  node scripts/migrate-requires-task.js --dry-run

  # Migrate first 10 steps for testing
  node scripts/migrate-requires-task.js --limit=10

  # Migrate steps from specific flow
  node scripts/migrate-requires-task.js --flow-id=flow_123

  # Full migration
  node scripts/migrate-requires-task.js
`);
  process.exit(0);
}

async function main() {
  console.log('🚀 Starting migration of requires_task steps to input_keys format');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  if (limit > 0) console.log(`Limit: ${limit} steps`);
  if (flowId) console.log(`Flow filter: ${flowId}`);
  console.log('─'.repeat(80));
  
  try {
    // Load database configuration
    const configPath = join(__dirname, '..', 'wrangler.toml');
    let dbUrl = process.env.DATABASE_URL;
    let dbAuthToken = process.env.DATABASE_AUTH_TOKEN;
    
    if (!dbUrl) {
      console.error('❌ DATABASE_URL environment variable is required');
      console.error('Set it with: export DATABASE_URL="libsql://your-database.turso.io"');
      process.exit(1);
    }
    
    // Create database client
    const dbConfig = {
      url: dbUrl,
      authToken: dbAuthToken
    };
    
    console.log(`🔗 Connecting to database: ${dbUrl.replace(/\/\/[^@]+@/, '//***@')}`);
    const client = createClient(dbConfig);
    
    // Create migration instance
    const migration = new SecureMigration();
    
    // First, check if input_keys column exists
    console.log('📋 Checking database schema...');
    try {
      const schemaCheck = await client.execute(`
        SELECT name FROM pragma_table_info('flow_steps') 
        WHERE name = 'input_keys'
      `);
      
      if (schemaCheck.rows.length === 0) {
        console.log('❌ input_keys column not found in flow_steps table');
        console.log('💡 Run the migration SQL first:');
        console.log(migration.generateMigrationSql());
        process.exit(1);
      }
      
      console.log('✅ input_keys column exists');
    } catch (error) {
      console.error('❌ Error checking database schema:', error.message);
      process.exit(1);
    }
    
    // Get steps to migrate
    console.log('🔍 Finding steps to migrate...');
    let query = `
      SELECT 
        fs.id, fs.flow_id, fs.step_key, fs.task_id, fs.requires_task, fs.instructions,
        t.id as task_db_id, t.title as task_title, t.description as task_description, t.payload as task_payload
      FROM flow_steps fs
      LEFT JOIN tasks t ON fs.task_id = t.id
      WHERE fs.requires_task = TRUE AND fs.task_id IS NOT NULL
    `;
    
    const params = [];
    
    if (flowId) {
      query += ' AND fs.flow_id = ?';
      params.push(flowId);
    }
    
    query += ' ORDER BY fs.flow_id, fs.order_index';
    
    if (limit > 0) {
      query += ' LIMIT ?';
      params.push(limit);
    }
    
    const stepsResult = await client.execute(query, params);
    
    if (stepsResult.rows.length === 0) {
      console.log('✅ No steps found that require migration');
      console.log('Steps that already have input_keys or don\'t have requires_task will be skipped');
      process.exit(0);
    }
    
    console.log(`📊 Found ${stepsResult.rows.length} steps to migrate`);
    
    // Show preview
    console.log('\n📋 Steps to migrate:');
    console.log('─'.repeat(80));
    stepsResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Step: ${row.step_key} (Flow: ${row.flow_id})`);
      console.log(`   Task: ${row.task_id} - ${row.task_title || 'No title'}`);
      console.log(`   Instructions: ${row.instructions?.substring(0, 50)}${row.instructions?.length > 50 ? '...' : ''}`);
      console.log('');
    });
    
    if (dryRun) {
      console.log('✅ Dry run complete. No changes were made.');
      console.log('To apply migration, run without --dry-run flag');
      process.exit(0);
    }
    
    // Ask for confirmation
    console.log('⚠️  WARNING: This will modify the database.');
    console.log('Steps with requires_task will get input_keys configuration.');
    console.log('The requires_task column will remain for backward compatibility.');
    
    const readline = (await import('readline')).createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('Continue with migration? (yes/no): ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('Migration cancelled');
      process.exit(0);
    }
    
    console.log('\n🔄 Starting migration...');
    
    let migrated = 0;
    let skipped = 0;
    let errors = [];
    
    // Migrate each step
    for (const row of stepsResult.rows) {
      try {
        console.log(`\n🔧 Migrating step ${row.step_key} (${row.id})...`);
        
        // Create input_keys configuration
        const taskData = row.task_db_id ? {
          id: row.task_db_id,
          title: row.task_title,
          description: row.task_description,
          payload: row.task_payload
        } : null;
        
        const inputKeys = migration['createTaskApiConfig'](
          {
            id: row.id,
            flow_id: row.flow_id,
            step_key: row.step_key,
            task_id: row.task_id,
            requires_task: row.requires_task,
            instructions: row.instructions
          },
          taskData || { id: row.task_id, title: '', description: '', payload: null }
        );
        
        const inputKeysJson = JSON.stringify([inputKeys]);
        
        // Validate the configuration
        const validation = migration.validateInputKeysJson(inputKeysJson);
        if (!validation.valid) {
          console.log(`❌ Validation failed: ${validation.errors.join(', ')}`);
          errors.push({ step_id: row.id, error: validation.errors.join(', ') });
          skipped++;
          continue;
        }
        
        // Update the step
        const updateQuery = `
          UPDATE flow_steps 
          SET input_keys = ?
          WHERE id = ?
        `;
        
        await client.execute(updateQuery, [inputKeysJson, row.id]);
        
        console.log(`✅ Migrated step ${row.step_key}`);
        console.log(`   Input keys: ${inputKeysJson.substring(0, 100)}...`);
        
        migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating step ${row.id}:`, error.message);
        errors.push({ step_id: row.id, error: error.message });
        skipped++;
      }
    }
    
    // Generate report
    console.log('\n' + '═'.repeat(80));
    console.log('📊 MIGRATION REPORT');
    console.log('═'.repeat(80));
    console.log(`✅ Migrated: ${migrated} steps`);
    console.log(`⏭️  Skipped: ${skipped} steps`);
    console.log(`❌ Errors: ${errors.length} steps`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => {
        console.log(`  - Step ${err.step_id}: ${err.error}`);
      });
    }
    
    // Show recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Update step instructions to use variable syntax: {* task_data.description *}');
    console.log('2. Test migrated steps in a staging environment');
    console.log('3. Monitor logs for API call errors');
    console.log('4. Consider updating other steps to use input_keys for dynamic API data');
    
    // Generate SQL for manual review
    console.log('\n📝 Generated migration SQL for reference:');
    console.log(migration.generateMigrationSql().substring(0, 500) + '...');
    
    console.log('\n🎉 Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});