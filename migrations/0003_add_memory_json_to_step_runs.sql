-- Migration 0003: Add memory_json column to step_runs table
ALTER TABLE step_runs ADD COLUMN memory_json TEXT;