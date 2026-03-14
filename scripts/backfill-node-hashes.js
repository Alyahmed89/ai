#!/usr/bin/env node

/**
 * Backfill script for node hashes
 * Computes and updates SHA-256 hashes for all existing nodes in the database
 * 
 * Usage: node backfill-node-hashes.js [--dry-run] [--batch-size N] [--verbose]
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

// Database configuration (adjust as needed)
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'db.sqlite');

console.log('Node Hash Backfill Script');
console.log('=========================');
console.log(`Database: ${DB_PATH}`);
console.log(`Dry run: ${dryRun}`);
console.log(`Batch size: ${batchSize}`);
console.log(`Verbose: ${verbose}`);
console.log('');

// Check if database exists
try {
  readFileSync(DB_PATH);
} catch (error) {
  console.error(`Error: Database not found at ${DB_PATH}`);
  console.error('Make sure the database exists or set DB_PATH environment variable');
  process.exit(1);
}

// Import SQLite
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

/**
 * Creates a canonical string from node data for hashing
 */
function createCanonicalString(title, content, metadata) {
  const canonicalData = {
    title: title || '',
    content: content || null,
    metadata: metadata || null
  };
  
  return JSON.stringify(canonicalData);
}

/**
 * Computes SHA-256 hash of node data
 */
function computeNodeHash(title, content, metadata) {
  const canonicalString = createCanonicalString(title, content, metadata);
  return createHash('sha256')
    .update(canonicalString)
    .digest('hex');
}

/**
 * Main backfill function
 */
async function backfillNodeHashes() {
  let db;
  
  try {
    // Open database connection
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    // Check if hash column exists
    const tableInfo = await db.all("PRAGMA table_info(nodes)");
    const hashColumnExists = tableInfo.some(col => col.name === 'hash');
    
    if (!hashColumnExists) {
      console.error('Error: hash column does not exist in nodes table');
      console.error('Please run migration 0036_add_node_hash_column.sql first');
      process.exit(1);
    }
    
    // Get total count of nodes
    const totalResult = await db.get("SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL");
    const totalNodes = totalResult.count;
    
    console.log(`Found ${totalNodes} active nodes to process`);
    console.log('');
    
    if (totalNodes === 0) {
      console.log('No nodes to process. Exiting.');
      return;
    }
    
    // Process nodes in batches
    let processed = 0;
    let updated = 0;
    let errors = 0;
    let offset = 0;
    
    while (offset < totalNodes) {
      // Fetch batch of nodes
      const nodes = await db.all(`
        SELECT id, title, content, metadata, hash 
        FROM nodes 
        WHERE deleted_at IS NULL 
        ORDER BY created_at 
        LIMIT ? OFFSET ?
      `, [batchSize, offset]);
      
      if (nodes.length === 0) {
        break;
      }
      
      console.log(`Processing batch ${Math.floor(offset / batchSize) + 1}: ${nodes.length} nodes`);
      
      // Process each node in the batch
      for (const node of nodes) {
        processed++;
        
        try {
          // Compute hash
          const computedHash = computeNodeHash(node.title, node.content, node.metadata);
          
          // Check if hash already exists and is correct
          if (node.hash === computedHash) {
            if (verbose) {
              console.log(`  ✓ Node ${node.id}: Hash already correct`);
            }
            continue;
          }
          
          // Update hash
          if (!dryRun) {
            await db.run(
              "UPDATE nodes SET hash = ?, updated_at = ? WHERE id = ?",
              [computedHash, Math.floor(Date.now() / 1000), node.id]
            );
          }
          
          updated++;
          
          if (verbose) {
            console.log(`  ✓ Node ${node.id}: Hash updated`);
            if (node.hash) {
              console.log(`    Old hash: ${node.hash.substring(0, 16)}...`);
            }
            console.log(`    New hash: ${computedHash.substring(0, 16)}...`);
          }
        } catch (error) {
          errors++;
          console.error(`  ✗ Node ${node.id}: Error: ${error.message}`);
        }
      }
      
      offset += batchSize;
      
      // Show progress
      const progress = Math.round((processed / totalNodes) * 100);
      console.log(`Progress: ${processed}/${totalNodes} (${progress}%) - Updated: ${updated}, Errors: ${errors}`);
      console.log('');
    }
    
    // Summary
    console.log('Backfill Complete');
    console.log('=================');
    console.log(`Total nodes: ${totalNodes}`);
    console.log(`Processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`Dry run: ${dryRun}`);
    
    if (dryRun) {
      console.log('\nNote: This was a dry run. No changes were made to the database.');
      console.log('Run without --dry-run flag to apply changes.');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run the backfill
backfillNodeHashes();