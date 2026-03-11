# ID Generation Rules

## Overview
This document describes the ID generation rules used in the DeepSeek Agent system for tracking flow runs and step runs.

## ID Formats

### 1. Flow Run ID
**Format**: `flow_{timestamp_ms}_{random7}`

**Example**: `flow_1773261196990_rp3d6ai`

**Components**:
- Prefix: `flow_`
- Timestamp: Current time in milliseconds (e.g., `1773261196990`)
- Separator: `_`
- Random suffix: 7-character alphanumeric string (e.g., `rp3d6ai`)

**Generation Code**:
```typescript
export function generateFlowRunId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
```

**Purpose**: Unique identifier for each flow execution instance.

### 2. Step Run ID
**Format**: `step_{timestamp_ms}_{random7}`

**Example**: `step_1773261196991_abc1234`

**Components**:
- Prefix: `step_`
- Timestamp: Current time in milliseconds (e.g., `1773261196991`)
- Separator: `_`
- Random suffix: 7-character alphanumeric string (e.g., `abc1234`)

**Generation Code**:
```typescript
export function generateStepRunId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
```

**Purpose**: Unique identifier for each step execution within a flow run.

## Technical Details

### Random String Generation
- Uses `Math.random().toString(36)` to generate a base-36 string
- `substring(2, 9)` extracts 7 characters starting from position 2
- Base-36 includes digits 0-9 and letters a-z
- Example: `0.rp3d6aixyz` → substring(2,9) → `rp3d6ai`

### Collision Probability
- With 7-character base-36 strings: 36^7 ≈ 78 billion possibilities
- With millisecond timestamp: effectively eliminates collisions
- Probability of collision in practice: negligible

### Timestamp Precision
- Milliseconds since Unix epoch (January 1, 1970)
- Provides natural ordering by creation time
- Helps with debugging and chronological analysis

## Usage Guidelines

### 1. Flow Run IDs
- Generated when a new flow execution starts
- Used in `flow_runs` table as primary key
- Referenced by step runs via `flow_run_id` foreign key
- Used in API endpoints: `/api/flow-runs/:id`

### 2. Step Run IDs
- Generated for each step execution within a flow
- Used in `step_runs` table as primary key
- Contains prompt, response, and execution metadata
- Used for step-level observability and debugging

### 3. Database Relationships
```
flow_runs
├── id (flow_{timestamp}_{random7})
├── flow_id (e.g., "doc-comment")
└── ... other columns

step_runs
├── id (step_{timestamp}_{random7})
├── flow_run_id (references flow_runs.id)
├── step_id (e.g., "doc_step1")
└── ... other columns
```

## Best Practices

### 1. ID Parsing
```typescript
function parseFlowRunId(id: string): { type: 'flow', timestamp: number, random: string } {
  const match = id.match(/^flow_(\d+)_([a-z0-9]{7})$/);
  if (!match) throw new Error('Invalid flow run ID format');
  return {
    type: 'flow',
    timestamp: parseInt(match[1]),
    random: match[2]
  };
}
```

### 2. Chronological Sorting
- IDs can be sorted chronologically by timestamp
- Useful for dashboard views and analytics
- Example: `ORDER BY created_at DESC` (already indexed)

### 3. Debugging
- Timestamp in ID helps identify when flow/step was created
- Random suffix ensures uniqueness across concurrent executions
- Prefix indicates entity type for log analysis

## Migration Considerations

### 1. Backward Compatibility
- Existing IDs follow this format
- No changes needed for existing data
- New IDs will continue using same format

### 2. Index Performance
- Indexes created for optimal query performance:
  - `idx_flow_runs_flow_id` - Filter by flow type
  - `idx_step_runs_flow_run_id` - Join with flow runs
  - `idx_step_runs_order` - Order steps within flow

### 3. Scalability
- Format supports high-volume concurrent execution
- No central ID generation bottleneck
- Distributed generation across workers

## Examples

### Real IDs from Production
```json
{
  "flow_run_id": "flow_1773261196990_rp3d6ai",
  "step_run_ids": [
    "step_1773261196991_abc1234",
    "step_1773261196992_def5678",
    "step_1773261196993_ghi9012"
  ]
}
```

### API Usage
```bash
# Get flow run by ID
GET /api/flow-runs/flow_1773261196990_rp3d6ai

# Get step runs for a flow
GET /api/step-runs?flow_run_id=flow_1773261196990_rp3d6ai
```

## References
- Source: `src/services/database.ts` - `generateFlowRunId()` and `generateStepRunId()`
- Database: `flow_runs` and `step_runs` tables
- API: CRUD endpoints in `src/crud-api.ts`