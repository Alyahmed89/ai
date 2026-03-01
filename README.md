# Cloudflare D1 CRUD Application

A minimalist Next.js frontend with Express.js backend for managing Cloudflare D1 database operations.

## Project Structure

```
/workspace/
├── frontend/          # Next.js frontend application
├── backend/           # Express.js backend API
└── README.md          # This file
```

## Features

- **Dashboard**: Overview of database statistics and API health
- **Flows Management**: CRUD operations for flow definitions
- **Tasks Management**: CRUD operations for tasks with status tracking
- **Minimalist UI**: Clean, Clickup-like interface with Tailwind CSS
- **Full CRUD Operations**: Create, Read, Update, Delete for all entities

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd /workspace/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   npm start
   ```
   The backend will run on `http://localhost:48647`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd /workspace/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:44479`

## API Endpoints

### Backend API (Port 48647)

- `GET /api/health` - Health check
- `GET /api/flows` - Get all flows
- `POST /api/flows` - Create new flow
- `GET /api/flows/:id` - Get flow by ID
- `PUT /api/flows/:id` - Update flow
- `DELETE /api/flows/:id` - Delete flow
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/flow-conditions` - Get all flow conditions
- `GET /api/flow-runs` - Get all flow runs

## Database Schema

The application works with the following Cloudflare D1 tables:

1. **flows** - Flow definitions
   - `id`, `name`, `first_prompt`, `deepseek_system`, `repo`, `branch`, `max_iterations`, `steps`, `created_at`

2. **flow_steps** - Steps within flows
   - `id`, `flow_id`, `step_number`, `prompt`, `created_at`

3. **flow_conditions** - Conditions for flow steps
   - `id`, `flow_id`, `step_id`, `condition_type`, `condition_value`, `created_at`

4. **tasks** - Task management
   - `id`, `flow_id`, `title`, `description`, `status`, `order_index`, `created_at`

5. **flow_runs** - Flow execution history
   - `id`, `flow_id`, `status`, `started_at`, `completed_at`, `created_at`

6. **iterations** - Iteration tracking
   - `id`, `flow_run_id`, `iteration_number`, `status`, `created_at`

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