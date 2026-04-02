-- Migration 0100: Add request_keys column to endpoint_registry table
-- This column stores extracted keys from sample_request for introspection

-- Add request_keys column to endpoint_registry
ALTER TABLE endpoint_registry ADD COLUMN request_keys TEXT;

-- Note: The request_keys column will be populated by the application
-- when sample_request is provided in POST/PUT /endpoints operations