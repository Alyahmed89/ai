// Backfill utility for node hashes
// Can be run as a one-time migration script

import { computeNodeHash, extractHashData } from './nodeHash';

/**
 * Options for backfill operation
 */
export interface BackfillOptions {
  dryRun?: boolean;
  batchSize?: number;
  verbose?: boolean;
}

/**
 * Result of backfill operation
 */
export interface BackfillResult {
  totalNodes: number;
  processed: number;
  updated: number;
  errors: number;
  dryRun: boolean;
}

/**
 * Backfills hashes for all existing nodes in the database
 * 
 * @param db D1Database instance
 * @param options Backfill options
 * @returns Backfill result
 */
export async function backfillNodeHashes(
  db: any,
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const {
    dryRun = false,
    batchSize = 100,
    verbose = false
  } = options;
  
  console.log('Starting node hash backfill...');
  console.log(`Options: dryRun=${dryRun}, batchSize=${batchSize}, verbose=${verbose}`);
  
  // Get total count of nodes
  const totalResult = await db.prepare(
    "SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL"
  ).first();
  
  const totalNodes = totalResult ? (totalResult as any).count : 0;
  
  console.log(`Found ${totalNodes} active nodes to process`);
  
  if (totalNodes === 0) {
    console.log('No nodes to process. Exiting.');
    return {
      totalNodes: 0,
      processed: 0,
      updated: 0,
      errors: 0,
      dryRun
    };
  }
  
  // Process nodes in batches
  let processed = 0;
  let updated = 0;
  let errors = 0;
  let offset = 0;
  
  while (offset < totalNodes) {
    // Fetch batch of nodes
    const nodesResult = await db.prepare(`
      SELECT id, title, content, metadata, hash 
      FROM nodes 
      WHERE deleted_at IS NULL 
      ORDER BY created_at 
      LIMIT ? OFFSET ?
    `).bind(batchSize, offset).all();
    
    const nodes = nodesResult.results || [];
    
    if (nodes.length === 0) {
      break;
    }
    
    if (verbose) {
      console.log(`Processing batch ${Math.floor(offset / batchSize) + 1}: ${nodes.length} nodes`);
    }
    
    // Process each node in the batch
    for (const node of nodes) {
      processed++;
      
      try {
        // Compute hash
        const hashData = extractHashData(node);
        const computedHash = await computeNodeHash(hashData);
        
        // Check if hash already exists and is correct
        if (node.hash === computedHash) {
          if (verbose) {
            console.log(`  ✓ Node ${node.id}: Hash already correct`);
          }
          continue;
        }
        
        // Update hash
        if (!dryRun) {
          const now = Math.floor(Date.now() / 1000);
          await db.prepare(
            "UPDATE nodes SET hash = ?, updated_at = ? WHERE id = ?"
          ).bind(computedHash, now, node.id).run();
        }
        
        updated++;
        
        if (verbose) {
          console.log(`  ✓ Node ${node.id}: Hash updated`);
          if (node.hash) {
            console.log(`    Old hash: ${node.hash.substring(0, 16)}...`);
          }
          console.log(`    New hash: ${computedHash.substring(0, 16)}...`);
        }
      } catch (error: any) {
        errors++;
        console.error(`  ✗ Node ${node.id}: Error: ${error.message}`);
      }
    }
    
    offset += batchSize;
    
    // Show progress
    const progress = Math.round((processed / totalNodes) * 100);
    console.log(`Progress: ${processed}/${totalNodes} (${progress}%) - Updated: ${updated}, Errors: ${errors}`);
  }
  
  // Summary
  const result: BackfillResult = {
    totalNodes,
    processed,
    updated,
    errors,
    dryRun
  };
  
  console.log('\nBackfill Complete');
  console.log('=================');
  console.log(`Total nodes: ${totalNodes}`);
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Dry run: ${dryRun}`);
  
  if (dryRun) {
    console.log('\nNote: This was a dry run. No changes were made to the database.');
  }
  
  return result;
}

/**
 * Creates an API endpoint for triggering backfill
 * This can be added to the graph-api.ts for administrative use
 */
export function createBackfillEndpoint() {
  return async (c: any) => {
    try {
      const db = c.env.FLOW_RUNS_DB;
      if (!db) {
        return c.json({
          success: false,
          error: 'Database not configured',
          statusCode: 500
        });
      }
      
      // Check for admin key (optional security)
      const adminKey = c.env.ADMIN_KEY;
      const requestKey = c.req.query('admin_key');
      
      if (adminKey && requestKey !== adminKey) {
        return c.json({
          success: false,
          error: 'Unauthorized',
          statusCode: 401
        });
      }
      
      // Parse options from query parameters
      const dryRun = c.req.query('dry_run') !== 'false';
      const batchSize = parseInt(c.req.query('batch_size') || '100');
      const verbose = c.req.query('verbose') === 'true';
      
      const options: BackfillOptions = {
        dryRun,
        batchSize,
        verbose
      };
      
      console.log('Starting backfill via API endpoint...');
      const result = await backfillNodeHashes(db, options);
      
      return c.json({
        success: true,
        data: result,
        message: dryRun ? 'Backfill dry run completed' : 'Backfill completed successfully'
      });
      
    } catch (error: any) {
      console.error('Backfill API error:', error);
      return c.json({
        success: false,
        error: error.message || 'Backfill failed',
        statusCode: 500
      });
    }
  };
}