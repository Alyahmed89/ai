# D1 Database Setup Instructions

## Current Status
The DeepSeek Agent has been successfully deployed with the following changes:
- ✅ Stop token changed from `<<DONE>>` to `[END_FLOW]`
- ✅ Max iterations changed from 20 to 500
- ✅ Health endpoint added (`GET /health`)
- ✅ D1 database schema designed and ready

However, the D1 database binding is currently commented out in `wrangler.toml` because:
1. The Cloudflare API token doesn't have D1 database permissions
2. No database ID is available to bind to the worker

## Steps to Enable D1 Database

### 1. Create a D1 Database
You need to create a D1 database in your Cloudflare account:

**Option A: Using Cloudflare Dashboard**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages → D1
3. Click "Create database"
4. Name it `flow-runs-db`
5. Copy the Database ID

**Option B: Using Wrangler CLI (requires D1 permissions)**
```bash
# Install wrangler v4
npm install --save-dev wrangler@4

# Create database
npx wrangler d1 create flow-runs-db

# Get database ID
npx wrangler d1 list
```

### 2. Update wrangler.toml
Uncomment and update the D1 database section in `wrangler.toml`:

```toml
# D1 database for flow runs tracking
[[d1_databases]]
binding = "FLOW_RUNS_DB"
database_name = "flow-runs-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID

# Migration for D1 database
[[migrations]]
tag = "v2"
migration = """
  CREATE TABLE IF NOT EXISTS flow_runs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    initial_prompt TEXT NOT NULL,
    deepseek_system TEXT,
    repository TEXT NOT NULL,
    branch TEXT DEFAULT 'main',
    max_iterations INTEGER DEFAULT 500,
    actual_iterations INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    stop_reason TEXT,
    prompts_and_responses TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ended_at INTEGER,
    next_flow_id TEXT,
    task_type TEXT,
    success_score REAL,
    quality_metrics TEXT,
    deployment_id TEXT,
    improvement_suggestions TEXT
  );
  
  CREATE TABLE IF NOT EXISTS iterations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_run_id TEXT NOT NULL,
    iteration_number INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    openhands_response TEXT,
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (flow_run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
  );
  
  CREATE INDEX IF NOT EXISTS idx_flow_runs_conversation_id ON flow_runs(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_flow_runs_status ON flow_runs(status);
  CREATE INDEX IF NOT EXISTS idx_flow_runs_created_at ON flow_runs(created_at);
  CREATE INDEX IF NOT EXISTS idx_iterations_flow_run_id ON iterations(flow_run_id);
"""
```

### 3. Update API Token Permissions
Your Cloudflare API token needs D1 database permissions. Update the token to include:
- `D1:Read`
- `D1:Write`
- `Account Settings:Read`

### 4. Deploy with D1 Database
```bash
# Deploy with updated configuration
CLOUDFLARE_API_TOKEN="your_token_here" npx wrangler deploy
```

### 5. Verify Database Connection
Test the health endpoint:
```bash
curl https://deepseek-agent.alghamdimo89.workers.dev/health
```

Expected response when database is connected:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "checks": {
    "database": "connected"
  }
}
```

## Database Schema Details

### flow_runs Table
Tracks each flow run with the following columns:
- **id**: Unique flow run ID (UUID)
- **conversation_id**: Conversation ID from Durable Object
- **initial_prompt**: The starting prompt for the flow
- **deepseek_system**: DeepSeek system prompt used
- **repository**: GitHub repository being worked on
- **branch**: Git branch (default: 'main')
- **max_iterations**: Maximum iterations allowed (default: 500)
- **actual_iterations**: Actual iterations completed
- **status**: Flow status ('active', 'completed', 'stopped', 'error')
- **stop_reason**: Reason for stopping
- **prompts_and_responses**: JSON string of all prompts and responses
- **created_at**, **updated_at**, **ended_at**: Timestamps
- **next_flow_id**: ID of next flow in chain (for multi-flow tasks)
- **task_type**: Type of task (to be determined)
- **success_score**: AI-determined success score (0-1)
- **quality_metrics**: JSON metrics for quality assessment
- **deployment_id**: Deployment identifier
- **improvement_suggestions**: AI suggestions for improving the flow

### iterations Table
Tracks individual iterations within a flow run:
- **id**: Auto-incrementing ID
- **flow_run_id**: Reference to flow_runs.id
- **iteration_number**: Iteration sequence number
- **prompt**: Prompt sent to DeepSeek
- **response**: Response from DeepSeek
- **openhands_response**: Response from OpenHands (if any)
- **timestamp**: When iteration occurred
- **metadata**: Additional iteration metadata

## AI-Determined Data Columns
The following columns are reserved for AI-determined data to track progress and improve flows:

1. **task_type**: Categorization of task type (e.g., 'bug_fix', 'feature_implementation', 'refactoring', 'documentation')
2. **success_score**: Numeric score (0-1) indicating how successful the flow was
3. **quality_metrics**: JSON object with metrics like:
   - `code_quality`: Score for code quality
   - `completeness`: How complete the solution is
   - `efficiency`: Efficiency of the solution
   - `correctness`: Whether the solution is correct
4. **improvement_suggestions**: AI-generated suggestions for improving similar future flows

These fields will be populated by analyzing the flow run data and can be used to:
- Identify patterns in successful vs unsuccessful flows
- Improve prompt engineering
- Optimize iteration strategies
- Build a feedback loop for continuous improvement

## Troubleshooting

### Common Issues

1. **"Authentication error [code: 10000]"**
   - Solution: Update API token permissions to include D1 access

2. **"binding FLOW_RUNS_DB of type d1 must have an 'id' specified [code: 10021]"**
   - Solution: Add the database ID to wrangler.toml

3. **"Unexpected fields found in migrations field"**
   - Solution: Use `migration` field (not `sql`) for D1 migrations in wrangler v3

4. **Database not connecting in health check**
   - Solution: Verify database exists and binding is correct
   - Check that migrations have been applied