# DeepSeek Agent API

A Cloudflare Worker-based API for managing conversations, flows, tasks, and steps with D1 database integration.

## Project Structure

```
/workspace/deepseek-agent/
├── src/               # Cloudflare Worker source code
│   ├── index-crud.ts  # Main application entry point
│   ├── crud-api.ts    # CRUD API endpoints
│   ├── types.ts       # TypeScript type definitions
│   └── durable/       # Durable Objects implementation
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Features

- **Conversation Management**: Start, attach to, and check status of conversations
- **Flows Management**: CRUD operations for flow definitions
- **Tasks Management**: CRUD operations for tasks with status tracking
- **Steps Management**: Manage flow execution steps
- **D1 Database Integration**: Cloudflare D1 database for persistent storage
- **Durable Objects**: Stateful conversation execution with alarms

## Setup Instructions

1. Navigate to the project directory:
   ```bash
   cd /workspace/deepseek-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The API will run on the configured Cloudflare Workers dev server port

## API Endpoints

### Backend API (Port 48647)

#### Flow Execution Endpoints
- `POST /start` - Start a new conversation/flow execution (requires JSON body with `flow_id` or `repository` and `initial_user_prompt`)
- `GET /start` - Start the highest priority flow automatically (optional query parameter: `?priority=N` to start flow with specific priority)
- `GET /status/:id` - Get status of a conversation/flow execution

#### CRUD API Endpoints (under `/api/`)
- `GET /api/health` - Health check
- `GET /api/flows` - Get all flows
- `POST /api/flows` - Create new flow
- `GET /api/flows/:id` - Get flow by ID
- `PUT /api/flows/:id` - Update flow
- `DELETE /api/flows/:id` - Delete flow
- `GET /api/flows/:flowId/steps` - Get all steps for a specific flow
- `GET /api/flows/:flowId/tasks` - Get all tasks for a specific flow
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/flow-conditions` - Get all flow conditions
- `GET /api/flow-runs` - Get all flow runs
- `GET /api/flow-runs/:id` - Get flow run by ID
- `POST /api/flow-runs` - Create new flow run
- `PUT /api/flow-runs/:id` - Update flow run
- `DELETE /api/flow-runs/:id` - Delete flow run
- `GET /api/flow-runs/:flowRunId/iterations` - Get iterations for a flow run

### API Examples

#### Start flow execution
```bash
# POST /start - Start a specific flow by ID
curl -X POST "http://localhost:8787/start" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "etaflow"
  }'

# GET /start - Start the highest priority flow automatically
curl -X GET "http://localhost:8787/start"

# GET /start?priority=1 - Start a flow with priority 1
curl -X GET "http://localhost:8787/start?priority=1"

# GET /status/:id - Check status of a running flow
curl -X GET "http://localhost:8787/status/{conversation_id}"
```

#### Get tasks for a specific flow
```bash
# Get all tasks for the etaflow
curl -X GET "http://localhost:8787/api/flows/etaflow/tasks"

# Get all tasks for the honoflow  
curl -X GET "http://localhost:8787/api/flows/honoflow/tasks"

# Get all steps for the etaflow
curl -X GET "http://localhost:8787/api/flows/etaflow/steps"
```

#### Create a new task for a flow
```bash
curl -X POST "http://localhost:8787/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "new_task_001",
    "flow_id": "etaflow",
    "title": "New Task",
    "description": "Task description",
    "status": "pending",
    "order_index": 13
  }'
```

## Database Schema

The application works with the following Cloudflare D1 tables:

1. **flows** - Flow definitions
   - `id`, `name`, `first_prompt`, `deepseek_system`, `repo`, `branch`, `max_iterations`, `steps`, `priority`, `created_at`
   - Note: `priority` field (integer, default 0) determines execution priority. Higher number = higher priority.

2. **flow_steps** - Steps within flows
   - `id`, `flow_id`, `step_number`, `prompt`, `created_at`

3. **flow_conditions** - Conditions for flow steps
   - `id`, `flow_id`, `step_id`, `condition_type`, `condition_value`, `created_at`

4. **tasks** - Task management
   - `id`, `flow_id`, `title`, `description`, `status`, `order_index`, `created_at`

5. **flow_runs** - Flow execution history with prompts and responses
   - `id`, `flow_id`, `conversation_id`, `step_id`, `input_prompt`, `output_response`, `status`, `duration_ms`, `created_at`, `next_flow_id`

6. **iterations** - Iteration tracking (table exists in schema but may not be populated)
   - `id`, `flow_run_id`, `iteration_number`, `prompt`, `response`, `openhands_response`, `status`, `created_at`
   
7. **flow_execution_data** - Flow execution metadata
   - `id`, `flow_id`, `conversation_id`, `key`, `value`, `created_at`, `updated_at`

## Cloudflare D1 Configuration

The backend is configured to connect to Cloudflare D1 using:
- **Account ID**: `e39371fc55a5c9ef7ed83e16660bd7bb`
- **API Token**: `H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL`
- **Database ID**: `ce8f2a2c-6e4b-4398-b73e-ba8f204f609a`

## UI Components

### Dashboard
- Displays statistics for flows, tasks, and flow runs
- Shows API health status
- Quick access to main features

### Flows Management
- List view of all flows with repository information
- Create, edit, and delete flows
- JSON editor for flow steps

### Tasks Management
- Kanban-like task list with status indicators
- Toggle task status between pending/done
- Create, edit, and delete tasks
- Filter tasks by flow

## Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS 3** - Utility-first CSS framework
- **Axios** - HTTP client for API calls

### Backend
- **Express.js** - Node.js web framework
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## Development Notes

1. The frontend and backend run on separate ports (44479 and 48647)
2. CORS is enabled on the backend to allow frontend requests
3. All API calls are proxied through the backend to avoid CORS issues
4. The UI follows a minimalist, Clickup-inspired design
5. Error handling is implemented for both frontend and backend

## Testing the Application

1. Open your browser to `http://localhost:44479`
2. Verify the dashboard shows API status as "Healthy"
3. Navigate to "Flows" to manage flow definitions
4. Navigate to "Tasks" to manage tasks
5. Test CRUD operations for both entities

## Troubleshooting

### Backend not starting
- Check if port 48647 is already in use
- Verify Node.js version (requires Node.js 18+ for built-in fetch)
- Check backend logs: `tail -f /workspace/backend/backend.log`

### Frontend not starting
- Check if port 44479 is already in use
- Verify all dependencies are installed
- Check frontend logs: `tail -f /workspace/frontend/frontend.log`

### API connection issues
- Verify backend is running on port 48647
- Check CORS configuration in backend
- Verify Cloudflare API credentials in `.env` file