# Ultra Minimal Next.js App with Service Architecture

A clean, minimal Next.js application with optimized service-based architecture for better bundle size and maintainability.

## Features

- **Service-based architecture**: Business logic separated from API routes
- **Minimal bundle size**: Optimized for Cloudflare Workers deployment
- **TypeScript ready**: Full TypeScript support out of the box
- **Clean structure**: Modular service layers and minimal API routes
- **Production ready**: Can be built and deployed with edge runtime
- **Environment variable support**: Secure configuration management

## Architecture Overview

The application follows a service-based architecture:

```
/
├── app/
│   ├── api/              # Minimal API routes (request/response only)
│   ├── flows/            # Flow list and detail pages
│   ├── steps/            # Step list and detail pages
│   ├── tasks/            # Task list and detail pages
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── lib/
│   ├── cloudflare-d1.ts  # Shared D1 database service
│   ├── task-service.ts   # Task business logic
│   ├── flow-service.ts   # Flow business logic
│   └── step-service.ts   # Step business logic
├── package.json          # Minimal dependencies
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variable template
└── README.md             # This file
```

## Key Architectural Improvements

### 1. Service Layer Architecture
- **API Routes**: Minimal request/response handling only
- **Service Modules**: All business logic moved to `/lib/` services
- **Shared D1 Service**: Centralized database operations

### 2. Bundle Size Optimization
- **No code duplication**: Shared services reduce bundle size
- **Edge runtime**: All API routes use `export const runtime = 'edge'`
- **Minimal dependencies**: Only essential packages included

### 3. Environment Configuration
- **Secure credentials**: Cloudflare D1 credentials in environment variables
- **Development/production**: Separate configurations
- **Template file**: `.env.example` for documentation

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env.local
```

2. Update `.env.local` with your Cloudflare D1 credentials:
```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_D1_DATABASE_ID=your_database_id
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at [http://localhost:42452](http://localhost:42452).

### Production Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Service Modules

### Task Service (`/lib/task-service.ts`)
- `getTasks()`: Get tasks with filtering and pagination
- `getTaskById()`: Get single task by ID
- `createTask()`: Create new task
- `updateTask()`: Update existing task
- `getTaskStats()`: Get task statistics

### Flow Service (`/lib/flow-service.ts`)
- `getFlowDefinitions()`: Get flow definitions
- `getFlowDefinitionById()`: Get single flow by ID
- `getFlowSteps()`: Get steps for a flow
- `createFlowDefinition()`: Create new flow
- `getFlowStats()`: Get flow statistics

### Step Service (`/lib/step-service.ts`)
- `getFlowSteps()`: Get all flow steps
- `getFlowStepById()`: Get single step by ID
- `getStepConditions()`: Get step conditions
- `getStepInput()`: Get step input data
- `getStepStats()`: Get step statistics

## API Routes

All API routes are minimal and delegate to service modules:

- `/api/tasks` - Task list with filtering
- `/api/tasks/[id]` - Single task details
- `/api/flow-definitions` - Flow definitions list
- `/api/flow-definitions/[id]` - Single flow details
- `/api/flow-steps` - Flow steps list
- `/api/flow-steps/[id]` - Single step details

## Pages

- `/` - Home page with navigation
- `/tasks` - Task list page
- `/tasks/[id]` - Task detail page
- `/flows` - Flow list page
- `/flows/[id]` - Flow detail page
- `/steps` - Step list page
- `/steps/[id]` - Step detail page

## Why This Architecture?

This architecture is designed for:
- **Better bundle size**: Services reduce code duplication in API routes
- **Maintainability**: Business logic separated from API layer
- **Scalability**: Easy to add new services and endpoints
- **Edge deployment**: Optimized for Cloudflare Workers
- **Security**: Credentials in environment variables, not in code

## Deployment Considerations

### For Cloudflare Workers:
1. Use `next-on-pages` for deployment
2. Ensure environment variables are set in Cloudflare dashboard
3. Consider splitting into multiple workers if bundle exceeds 3MB

### For Vercel:
1. Set environment variables in Vercel dashboard
2. Edge runtime is supported for API routes
3. Static pages can be pre-rendered

## License

MIT
