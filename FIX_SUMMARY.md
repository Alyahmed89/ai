# Fix Summary: Database Error "no such column: priority"

## Problem
When calling `GET /start` endpoint, the following error occurred:
```json
{
    "success": false,
    "data": null,
    "error": "Database error: D1_ERROR: no such column: priority at offset 29: SQLITE_ERROR",
    "statusCode": 500
}
```

## Root Cause
The `GET /start` endpoint was querying the `flows` table with a `priority` column that doesn't exist in that table:
```sql
SELECT * FROM flows WHERE priority = ? ORDER BY created_at DESC LIMIT 1
SELECT * FROM flows ORDER BY priority DESC, created_at DESC LIMIT 1
```

According to database analysis:
- `flows` table: Has 1 test record, does NOT have `priority` column
- `flow_definitions` table: Has 5 real flow definitions, HAS `priority` column

## Solution
Updated `src/index-crud.ts` to handle the database schema inconsistency:

### Changes Made:

1. **GET /start endpoint (lines 387-405)**:
   - For specific priority (`GET /start?priority=X`): Only queries `flow_definitions` table (has `priority` column)
   - For highest priority (`GET /start`): Tries `flow_definitions` first (with `ORDER BY priority DESC`), falls back to `flows` table (with `ORDER BY created_at DESC`)
   - Removed SQL queries that reference `flows.priority` (which doesn't exist)

2. **Updated field accessors (lines 407-414)**:
   - Added fallback for `repository` field: `(flowResult as any).repository || (flowResult as any).repo`
   - Added fallback for description: `(flowResult as any).description || (flowResult as any).name`
   - Kept fallback for `priority`: `(flowResult as any).priority || 0`

3. **POST /start endpoint (lines 247-257)**:
   - Changed to query `flow_definitions` table first
   - Added fallback to `flows` table for backward compatibility
   - Updated field accessors with same fallback logic

## Why This Fix Works
1. `flow_definitions` table has the `priority` column that the code expects
2. `flow_definitions` table has the real flow data (5 records vs 1 test record in `flows` table)
3. Other parts of the codebase (`crud-api.ts`, `ConversationDO.ts`) already use `flow_definitions` table
4. The fix maintains backward compatibility by falling back to `flows` table if needed

## Testing
The fix should resolve the database error when calling:
- `GET /start` - to start highest priority flow
- `GET /start?priority=1` - to start flow with specific priority
- `POST /start` with `flow_id` parameter - to start specific flow

## Notes
- Long-term solution: Consolidate `flows` and `flow_definitions` tables or update all code to consistently use one table
- Migration `0026_add_flow_priority.sql` adds `priority` column to `flows` table but may not have been applied
- Current fix uses the table that already has the required schema (`flow_definitions`)