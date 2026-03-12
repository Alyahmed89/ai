# RULE EVALUATION REQUEST
## System Analysis for Rules Engine Validation
**Date:** 2026-03-11  
**Analysis Type:** Database Schema and API Endpoint Validation  
**Scope:** `schema` (primary), with implications for `api` and `naming` scopes

---

## 📋 EXECUTIVE SUMMARY

Based on endpoint testing analysis, the system has several critical issues requiring rule validation:

1. **Database Schema Inconsistency** - Missing project relationships across entities
2. **Frontend Rendering Bug** - UI shows "undefined" despite correct API data  
3. **Missing API Endpoints** - No POST endpoints for entity creation
4. **Routing Confusion** - Unclear API path configuration

**Primary Scope:** `schema` - Core issues relate to database structure and relationships

---

## 🔍 ANALYSIS DETAILS

### Context Type: `database_schema_and_api_endpoints`
- **System Component:** Database schema and REST API endpoints
- **Validation Scope:** `schema` (primary), `api` (secondary), `naming` (tertiary)
- **Risk Areas Identified:**
  - Schema inconsistency between related tables
  - Missing required fields for entity relationships
  - Naming convention violations (`feature_id` vs `project_id`)
  - API endpoint completeness issues
  - Frontend-backend data consistency problems

---

## 📊 DATA FOR RULE EVALUATION

### Current Database Schema Issues:

#### 1. **Inconsistent Project Relationships**
```sql
-- ✅ Nodes table has proper project relationship
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),  -- ✅ Has project_id
  title TEXT,
  ...
);

-- ❌ Tasks table uses feature_id instead of project_id  
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  feature_id TEXT REFERENCES features(id),  -- ❌ Should be project_id
  title TEXT,
  ...
);

-- ❌ Flows table has no project relationship
CREATE TABLE flows (
  id TEXT PRIMARY KEY,
  name TEXT,
  ...  -- ❌ Missing project_id
);

-- ❌ Features table has no project relationship  
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  name TEXT,
  ...  -- ❌ Missing project_id
);
```

#### 2. **Relationship Chain Issues**
```
Current (Broken):
projects → nodes (✅ has project_id)
projects → tasks (❌ no direct link, uses feature_id → features)
projects → flows (❌ no link)
projects → features (❌ no link)

Required:
projects → nodes (✅)
projects → tasks (❌ needs project_id)
projects → flows (❌ needs project_id)  
projects → features (❌ needs project_id OR remove feature-task relationship)
```

#### 3. **Naming Convention Violations**
- **Inconsistent:** `feature_id` in tasks table (should be `project_id` for consistency)
- **Missing:** `project_id` in flows and features tables
- **Impact:** Cannot implement unified project-based filtering and permissions

---

## 🚨 RISK AREAS

### High Risk:
1. **Schema Inconsistency** - Different relationship patterns across similar entities
2. **Missing Required Fields** - `project_id` absent from critical tables
3. **Broken Data Relationships** - Cannot query "all tasks for project X"

### Medium Risk:
4. **API Endpoint Completeness** - Missing POST endpoints for entity creation
5. **Routing Confusion** - Unclear API path structure (`/api/*` vs `/graph/*` vs `/api/graph/*`)

### Low Risk:
6. **Frontend Rendering Bug** - UI shows "undefined" for node titles (likely frontend-specific)

---

## 📝 EVALUATION REQUEST PAYLOAD

```json
{
  "scope": "schema",
  "data": {
    "current_schema": {
      "tables": {
        "projects": {
          "columns": ["id", "name", "status", "created_at", "updated_at", "metadata", "deleted_at"],
          "primary_key": "id"
        },
        "nodes": {
          "columns": ["id", "project_id", "type", "title", "content", "status", "created_at", "updated_at", "metadata", "deleted_at"],
          "foreign_keys": ["project_id -> projects.id"],
          "primary_key": "id"
        },
        "tasks": {
          "columns": ["id", "feature_id", "title", "description", "task_type", "priority", "status", "action", "dependencies", "file", "line", "estimated_complexity", "validation_checklist", "created_at", "numeric_priority", "endpoint_path", "http_method", "sample_payload", "expected_response", "auth_required", "ai_context", "last_runtime_validation_at", "last_runtime_validation_status", "runtime_validation_count", "expectation_override", "expectation_source", "flow", "obligation_evidence", "obligation_reason", "flow_id", "order_index"],
          "foreign_keys": ["feature_id -> features.id", "flow_id -> flows.id"],
          "primary_key": "id",
          "issue": "Has feature_id instead of project_id, missing direct project relationship"
        },
        "flows": {
          "columns": ["id", "name", "first_prompt", "deepseek_system", "repo", "branch", "max_iterations", "steps", "created_at"],
          "primary_key": "id",
          "issue": "Missing project_id column, no project relationship"
        },
        "features": {
          "columns": ["id", "name", "file", "line", "zod_validated", "runtime_handler", "import_dependency", "test_exists", "repo", "generated_app_version", "category", "created_at"],
          "primary_key": "id",
          "issue": "Missing project_id column, no project relationship"
        }
      },
      "relationship_issues": [
        {
          "issue": "inconsistent_project_relationships",
          "description": "Only nodes table has project_id. Tasks, flows, and features lack project relationships.",
          "impact": "Cannot filter tasks/flows by project, broken project context"
        },
        {
          "issue": "feature_id_instead_of_project_id",
          "description": "Tasks table uses feature_id instead of project_id, creating indirect relationship",
          "impact": "Tasks cannot be directly linked to projects"
        }
      ]
    },
    "api_endpoint_issues": {
      "tested_endpoints": [
        "GET /api/graph/projects",
        "GET /api/graph/nodes?project_id={id}",
        "GET /api/graph/flows",
        "GET /api/graph/tasks?limit=5"
      ],
      "missing_endpoints": [
        "POST /api/graph/nodes",
        "POST /api/graph/tasks",
        "POST /api/graph/flows",
        "GET /api/graph/nodes/{id}/children",
        "GET /api/graph/projects/{id}/tasks",
        "GET /api/graph/projects/{id}/flows"
      ],
      "routing_confusion": {
        "code_shows": ["/api/* (CRUD API)", "/graph/* (Graph API)"],
        "testing_shows": "/api/graph/*",
        "issue": "Unclear routing configuration"
      }
    },
    "frontend_issue": {
      "description": "Nodes API returns correct title data but frontend shows 'undefined'",
      "api_response_example": {
        "success": true,
        "data": [{
          "id": "node-hono-1",
          "project_id": "project-hono",
          "type": "task",
          "title": "Hono API Implementation",
          "content": "Implement Hono.js API endpoints",
          "status": "active"
        }]
      },
      "frontend_display": "undefined",
      "issue_type": "frontend_rendering_bug"
    }
  }
}
```

---

## 🎯 EXPECTED RULES ENGINE EVALUATION

### What Rules Engine Should Validate:

#### 1. **Schema Consistency Rules:**
- All entity tables that belong to a project should have `project_id` column
- Foreign key naming should be consistent (`project_id` not `feature_id`)
- Required fields for entity relationships should be present

#### 2. **Relationship Integrity Rules:**
- Direct relationships should exist where logical (projects → tasks, projects → flows)
- Indirect relationships should be justified or eliminated
- Cascade delete rules should be defined

#### 3. **Naming Convention Rules:**
- Foreign key columns should follow pattern `{parent_table}_id`
- Column names should be consistent across similar entities
- Table names should reflect entity relationships

#### 4. **API Completeness Rules:**
- CRUD operations should be available for all main entities
- Filtering capabilities should match relationship structure
- Endpoint paths should follow consistent patterns

---

## 🔄 NEXT STEPS AFTER RULES EVALUATION

### Based on Expected Violations:

#### **Critical Violations (Require Immediate Fix):**
1. **Missing `project_id` in tasks table** → Add column with migration
2. **Missing `project_id` in flows table** → Add column with migration  
3. **Inconsistent foreign key naming** → Rename `feature_id` to `project_id` or justify relationship

#### **Warning Violations (Should Be Fixed):**
4. **Missing POST endpoints** → Implement creation endpoints
5. **Routing confusion** → Clarify and document API path structure
6. **Missing hierarchy endpoints** → Add navigation endpoints

#### **Informational Violations (Log Only):**
7. **Frontend rendering bug** → Log for frontend team to fix
8. **Missing features.project_id** → Consider if features need project relationship

---

## 📞 API CALL TO MAKE

```bash
POST /evaluate
Content-Type: application/json

{
  "scope": "schema",
  "data": { ... }  # Full payload as shown above
}
```

---

## 🏗️ ARCHITECTURE CONTEXT

This evaluation request follows the separation of concerns:

1. **AI Analysis** → Identified issues from endpoint testing
2. **Rules Engine** → Validates against defined rules (source of truth)
3. **System Execution** → Applies fixes based on rule violations

**Why This Design:**
- Prevents AI from hallucinating rules
- Ensures consistent validation across system
- Separates reasoning from enforcement
- Allows rule updates without code changes

---

## 📋 DELIVERABLES EXPECTED FROM RULES ENGINE

1. **Violations List** - Specific rule violations with severity
2. **Suggested Fixes** - Concrete changes needed
3. **Edits Required** - SQL migrations, code changes, etc.
4. **Priority Guidance** - What to fix first based on impact

---

**Note:** This analysis is based on endpoint testing results and database schema inspection. The Rules Engine is the source of truth for validation decisions.