-- Migration 0036: Add hash column to nodes table for content integrity
-- This adds deterministic content hashing for nodes

-- ============================================================================
-- 1. Add hash column to nodes table
-- ============================================================================
ALTER TABLE nodes ADD COLUMN hash TEXT;

-- Create index for hash lookups
CREATE INDEX IF NOT EXISTS idx_nodes_hash ON nodes(hash);

-- ============================================================================
-- 2. Update sample data with hashes (optional - will be backfilled by script)
-- ============================================================================
-- Note: We'll create a separate script to backfill existing nodes
-- This ensures consistent hash computation across all nodes

-- ============================================================================
-- 3. Documentation
-- ============================================================================
-- Hash computation:
-- 1. Canonical string format: JSON.stringify({title, content, metadata})
-- 2. Hash algorithm: SHA-256
-- 3. Hash is computed on node creation and updated when title/content/metadata changes
-- 4. Hash provides content integrity verification and duplicate detection