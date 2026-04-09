-- Migration 10004: Add memory_prompt column to flow_definitions table
-- Makes memory prompt dynamic per flow (optional, no fallback)

ALTER TABLE flow_definitions ADD COLUMN memory_prompt TEXT;