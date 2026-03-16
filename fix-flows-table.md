# Fix for "no such table: flows" Error

## Problem
When starting a flow (e.g., `rules_are_rules`), the system fails with:
```
"Database error checking flow: D1_ERROR: no such table: flows: SQLITE_ERROR"
```

## Root Cause
The code has backward compatibility logic that tries to query both:
1. `flow_definitions` table (modern table with full schema)
2. `flows` table (legacy table for backward compatibility)

When the `flows` table doesn't exist, the SQL query throws an error instead of returning `null`.

## Solution Implemented

### 1. **Created Migration 0040** (`migrations/0040_create_flows_table.sql`)
- Creates `flows` table with minimal schema matching code expectations
- Copies existing flow definitions from `flow_definitions` table
- Adds indexes for performance

### 2. **Fixed Error Handling in `index-crud.ts`**
Added try-catch blocks around `flows` table queries in 3 locations:

**Location 1** (POST `/start` with `flow_id` parameter):
- Lines 256-262: Wrapped `SELECT * FROM flows WHERE id = ?` in try-catch

**Location 2** (POST `/start` without parameters - highest priority flow):
- Lines 337-343: Wrapped `SELECT * FROM flows ORDER BY created_at DESC LIMIT 1` in try-catch

**Location 3** (GET `/start` endpoint):
- Lines 495-501: Wrapped `SELECT * FROM flows ORDER BY created_at DESC LIMIT 1` in try-catch

### 3. **Migration Details**
The `flows` table has this schema:
```sql
CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  max_iterations INTEGER DEFAULT 20,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Why Both Fixes Are Needed

1. **Migration 0040**: Creates the table so future queries work
2. **Error handling fixes**: Prevents crashes if table doesn't exist (defensive programming)

## Testing
After applying the fixes:
1. Apply migration: `sqlite3 your.db < migrations/0040_create_flows_table.sql`
2. Start the backend
3. Try starting a flow: `POST /start` with `{"flow_id": "rules_are_rules"}`

The flow should start successfully without the "no such table: flows" error.

## Notes
- The `flows` table is a **read-only copy** of `flow_definitions` for backward compatibility
- New flow definitions should be created in `flow_definitions` table
- The system will automatically copy from `flow_definitions` to `flows` via the migration
- Future enhancements could remove the `flows` table dependency entirely