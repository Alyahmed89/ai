# ENDPOINT TESTING ISSUES
## Testing Results and Identified Problems
**Date:** 2026-03-11  
**Test Environment:** Local development server (port 42392)

---

## ✅ WORKING ENDPOINTS

### 1. Projects Endpoint
**Request:**
```bash
GET http://localhost:42392/api/graph/projects
```

**Response:** ✅ Working correctly
```json
{
  "success": true,
  "data": [
    {
      "id": "project-hono",
      "name": "Hono Framework Project",
      "status": "active",
      "created_at": 1773326768,
      "updated_at": 1773326768,
      "metadata": "{\"framework\": \"hono\", \"description\": \"Project for Hono framework development\"}",
      "deleted_at": null
    },
    {
      "id": "project-1773001482796-aw8u81apk",
      "name": "Test Project from Python",
      "status": "active",
      "metadata": "{\"description\": \"A test project created from Python\"}",
      "created_at": 1773001482796,
      "updated_at": 1773001482796
    }
  ]
}
```

### 2. Nodes Endpoint (with project filtering)
**Request:**
```bash
GET http://localhost:42392/api/graph/nodes?project_id=project-hono
```

**Response:** ✅ API working, ❌ UI bug
```json
{
  "success": true,
  "data": [
    {
      "id": "node-hono-1",
      "project_id": "project-hono",
      "type": "task",
      "title": "Hono API Implementation",
      "content": "Implement Hono.js API endpoints",
      "status": "active",
      "created_at": 1773327784,
      "updated_at": 1773327784,
      "metadata": "{}",
      "deleted_at": null
    }
  ]
}
```
**Issue:** Frontend shows "undefined" instead of "Hono API Implementation" despite API returning correct data.

### 3. Flows Endpoint
**Request:**
```bash
GET http://localhost:42392/api/graph/flows
```

**Response:** ✅ Working correctly
```json
{
  "success": true,
  "data": [
    {
      "id": "flow-hono-1773328950037",
      "name": "HonoFlow",
      "first_prompt": "Create a Hono.js API with Cloudflare D1 integration for project management",
      "deepseek_system": "You are a Hono.js expert specializing in Cloudflare Workers and D1 database. Create efficient, production-ready APIs.",
      "repo": "https://github.com/honojs/hono",
      "branch": "main",
      "max_iterations": 10,
      "steps": "[{\"step\":1,\"action\":\"Setup Hono.js project structure\"},{\"step\":2,\"action\":\"Configure Cloudflare D1 database connection\"},{\"step\":3,\"action\":\"Create REST API endpoints for projects, flows, tasks\"},{\"step\":4,\"action\":\"Add authentication middleware\"},{\"step\":5,\"action\":\"Test API with curl and Postman\"}]",
      "created_at": "2026-03-12 15:22:30"
    },
    {
      "id": "flow-1772800217194-kd1f8xrsg",
      "name": "test-flow",
      "first_prompt": "Test flow",
      "deepseek_system": null,
      "repo": null,
      "branch": null,
      "max_iterations": 5,
      "steps": null,
      "created_at": "2026-03-06 12:30:17"
    }
  ]
}
```

### 4. Tasks Endpoint
**Request:**
```bash
GET http://localhost:42392/api/graph/tasks?limit=5
```

**Response:** ✅ API working, ⚠️ Schema limitation
```json
{
  "success": true,
  "data": [
    {
      "id": "task-1773245848929-fdyg95sxk",
      "name": "Test message",
      "description": "Test message",
      "status": "pending",
      "created_at": 1773245848929,
      "updated_at": 1773245848929,
      "metadata": "{}",
      "deleted_at": null
    },
    {
      "id": "task-1773242035933-z3qvlm1gn",
      "name": "Hello, this is a test message",
      "description": "Hello, this is a test message",
      "status": "pending",
      "created_at": 1773242035933,
      "updated_at": 1773242035933,
      "metadata": "{}",
      "deleted_at": null
    }
  ]
}
```
**Issue:** No `project_id` column in tasks table, preventing project-based filtering.

---

## 🔍 IDENTIFIED ISSUES

### 1. Frontend Rendering Bug
**Problem:** Nodes API returns correct data with `title: "Hono API Implementation"`, but UI shows "undefined"
**Location:** Likely in frontend component that renders node titles
**Impact:** Users cannot see node titles in the UI

### 2. Database Schema Inconsistency
**Problem:** Inconsistent relationship modeling between entities
- ✅ **Nodes** have `project_id` column → Can filter by project
- ❌ **Tasks** have `feature_id` column (not `project_id`) → Cannot filter by project
- ❌ **Flows** have no project relationship column → Cannot filter by project
- ❌ **Features** have no `project_id` column → Broken relationship chain

**Impact:** Cannot create a unified project view with all related entities

### 3. Missing Project Context
**Problem:** Tasks and flows exist in isolation without project context
**Example:** A task for "Hono API Implementation" should be linked to "project-hono"
**Impact:** Cannot answer "What tasks/flows belong to this project?"

### 4. Endpoint Routing Confusion
**Problem:** Testing shows `/api/graph/*` endpoints, but code shows:
- `/api/*` for CRUD API (flows, tasks in `crud-api.ts`)
- `/graph/*` for Graph API (projects, nodes in `graph-api.ts`)

**Question:** Is there routing that mounts Graph API at `/api/graph`?

---

## 📋 MISSING ENDPOINTS NEEDED

### Required for Complete Project Management:

#### 1. Node Creation
```bash
POST /api/graph/nodes
Content-Type: application/json

{
  "project_id": "project-hono",
  "type": "task",
  "title": "Related Task Node",
  "content": "This is a related node",
  "status": "active"
}
```

#### 2. Task Creation (with project context)
```bash
POST /api/graph/tasks
Content-Type: application/json

{
  "project_id": "project-hono",  # Currently missing in schema
  "name": "New Task",
  "description": "Task description",
  "status": "pending"
}
```

#### 3. Flow Creation (with project context)
```bash
POST /api/graph/flows
Content-Type: application/json

{
  "project_id": "project-hono",  # Currently missing in schema
  "name": "New Flow",
  "first_prompt": "Flow prompt",
  "max_iterations": 10
}
```

#### 4. Hierarchy Navigation
```bash
GET /api/graph/nodes/{id}/children
GET /api/graph/nodes/{id}/parent
GET /api/graph/projects/{id}/hierarchy
```

---

## 🗺️ DATABASE SCHEMA ANALYSIS

### Current Schema (Problematic):
```
projects
  ├── id (TEXT)
  └── name (TEXT)

nodes
  ├── id (TEXT)
  ├── project_id (TEXT)  ✅ Has project relationship
  └── title (TEXT)

tasks
  ├── id (TEXT)
  ├── feature_id (TEXT)  ❌ Should be project_id
  └── name (TEXT)

flows
  ├── id (TEXT)
  └── name (TEXT)        ❌ No project relationship

features
  ├── id (TEXT)
  └── name (TEXT)        ❌ No project relationship
```

### Required Schema Fix:
1. Add `project_id` to `tasks` table
2. Add `project_id` to `flows` table  
3. Add `project_id` to `features` table (or remove feature-task relationship)
4. Consider adding `project_id` to all entity tables for unified project context

---

## 🚨 PRIORITY FIXES

### High Priority:
1. **Fix frontend node title rendering** - UI shows "undefined"
2. **Add project_id to tasks table** - Enable project-based task filtering
3. **Add project_id to flows table** - Enable project-based flow management

### Medium Priority:
4. **Create missing POST endpoints** - For nodes, tasks, flows creation
5. **Fix schema consistency** - All entities should have project relationship
6. **Add hierarchy endpoints** - For navigating project relationships

### Low Priority:
7. **Document endpoint routing** - Clarify `/api/*` vs `/graph/*` vs `/api/graph/*`
8. **Add validation** - Ensure data integrity across related entities

---

## 🔧 RECOMMENDED ACTIONS

### Immediate (Next Sprint):
1. Fix frontend bug showing "undefined" for node titles
2. Add `project_id` column to `tasks` table (migration)
3. Add `project_id` column to `flows` table (migration)
4. Create POST endpoints for node/task/flow creation

### Short-term (1-2 Sprints):
5. Update all entity creation to include `project_id`
6. Add project filtering to all list endpoints
7. Create project hierarchy navigation endpoints
8. Add data validation for project relationships

### Long-term:
9. Consider project-based permissions/access control
10. Add project analytics and reporting
11. Implement project templates/cloning
12. Add project archiving/deletion workflows

---

## 📊 TEST COVERAGE GAPS

### Tested & Working:
- ✅ `GET /api/graph/projects`
- ✅ `GET /api/graph/nodes` (with project filtering)
- ✅ `GET /api/graph/flows` 
- ✅ `GET /api/graph/tasks`

### Missing Tests:
- ❌ `POST /api/graph/nodes`
- ❌ `POST /api/graph/tasks` 
- ❌ `POST /api/graph/flows`
- ❌ `GET /api/graph/nodes/{id}/children`
- ❌ `GET /api/graph/projects/{id}/tasks`
- ❌ `GET /api/graph/projects/{id}/flows`
- ❌ Project-based filtering on all endpoints

### Schema Validation Needed:
- ❌ Ensure `project_id` exists when creating entities
- ❌ Validate project exists when linking entities
- ❌ Cascade delete when project is deleted
- ❌ Data consistency across project relationships

---

**Note:** All testing was performed against a local development server. Production behavior may differ. Database schema issues require migration scripts.