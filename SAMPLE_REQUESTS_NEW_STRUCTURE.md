# Sample Requests for New Two-Graph Structure

## Overview
We now have two separate graphs:
1. **Knowledge Graph**: Projects, Nodes, Relationships, Dependencies, Tags, Levels
2. **Process Graph**: Flows, Steps, Step Edges, Flow Runs, Step Runs

## Base URL
- Graph API: `/graph`
- Existing CRUD API: `/api`

## 1. Knowledge Graph (Existing with fixes)

### Create a Project
```bash
curl -X POST http://localhost:44787/graph/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-Commerce Platform",
    "status": "active",
    "metadata": "{\"description\": \"Online shopping platform\"}"
  }'
```

### Create Knowledge Nodes (NOT flows!)
```bash
# Create a task node
curl -X POST http://localhost:44787/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "type": "task",
    "title": "Implement User Authentication",
    "content": "{\"description\": \"Create login system\"}",
    "status": "active"
  }'

# Create an API node
curl -X POST http://localhost:44787/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "type": "api",
    "title": "Payment API",
    "content": "{\"endpoint\": \"/api/payments\", \"methods\": [\"POST\"]}",
    "status": "active"
  }'

# Create a concept node
curl -X POST http://localhost:44787/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "type": "concept",
    "title": "Microservices Architecture",
    "content": "{\"description\": \"Design for scalability\"}",
    "status": "active"
  }'

# Create a document node
curl -X POST http://localhost:44787/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "type": "doc",
    "title": "API Documentation",
    "content": "{\"format\": \"markdown\", \"sections\": [\"overview\", \"endpoints\"]}",
    "status": "active"
  }'
```

### Create Relationships Between Knowledge Nodes
```bash
curl -X POST http://localhost:44787/graph/relationships \
  -H "Content-Type: application/json" \
  -d '{
    "source_node_id": "node-1",
    "target_node_id": "node-2",
    "relation_type": "implements",
    "weight": 0.9
  }'
```

### Create Dependencies
```bash
curl -X POST http://localhost:44787/graph/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "node-1",
    "depends_on_node_id": "node-3",
    "dependency_type": "hard"
  }'
```

## 2. Process Graph (NEW)

### Create a Flow (Workflow Definition)
```bash
curl -X POST http://localhost:44787/graph/flows \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "title": "Order Processing Workflow",
    "status": "active",
    "metadata": "{\"description\": \"Process customer orders from cart to delivery\"}"
  }'
```

### List Flows for a Project
```bash
curl -X GET http://localhost:44787/graph/projects/project-1/flows
```

### Create Steps in a Flow
```bash
# Step 1: Validate Order
curl -X POST http://localhost:44787/graph/steps \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-1",
    "title": "Validate Order",
    "type": "validation",
    "content": "{\"rules\": [\"check_inventory\", \"validate_payment\"]}",
    "order_index": 1
  }'

# Step 2: Process Payment
curl -X POST http://localhost:44787/graph/steps \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-1",
    "title": "Process Payment",
    "type": "action",
    "content": "{\"processor\": \"stripe\", \"currency\": \"USD\"}",
    "order_index": 2
  }'

# Step 3: Decision: Payment Success?
curl -X POST http://localhost:44787/graph/steps \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-1",
    "title": "Check Payment Status",
    "type": "decision",
    "content": "{\"conditions\": [\"payment_success\", \"payment_failed\"]}",
    "order_index": 3
  }'

# Step 4: Fulfill Order (if payment success)
curl -X POST http://localhost:44787/graph/steps \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-1",
    "title": "Fulfill Order",
    "type": "action",
    "content": "{\"actions\": [\"update_inventory\", \"notify_warehouse\"]}",
    "order_index": 4
  }'

# Step 5: Notify Customer (if payment failed)
curl -X POST http://localhost:44787/graph/steps \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-1",
    "title": "Notify Customer",
    "type": "action",
    "content": "{\"channel\": \"email\", \"template\": \"payment_failed\"}",
    "order_index": 5
  }'
```

### Create Step Edges (Connections with Conditions)
```bash
# Sequential edge: Validate Order -> Process Payment
curl -X POST http://localhost:44787/graph/step-edges \
  -H "Content-Type: application/json" \
  -d '{
    "source_step_id": "step-1",
    "target_step_id": "step-2",
    "condition": null,
    "weight": 1.0
  }'

# Sequential edge: Process Payment -> Check Payment Status
curl -X POST http://localhost:44787/graph/step-edges \
  -H "Content-Type: application/json" \
  -d '{
    "source_step_id": "step-2",
    "target_step_id": "step-3",
    "condition": null,
    "weight": 1.0
  }'

# Conditional edge: If payment success -> Fulfill Order
curl -X POST http://localhost:44787/graph/step-edges \
  -H "Content-Type: application/json" \
  -d '{
    "source_step_id": "step-3",
    "target_step_id": "step-4",
    "condition": "payment_status == \"success\"",
    "weight": 1.0
  }'

# Conditional edge: If payment failed -> Notify Customer
curl -X POST http://localhost:44787/graph/step-edges \
  -H "Content-Type: application/json" \
  -d '{
    "source_step_id": "step-3",
    "target_step_id": "step-5",
    "condition": "payment_status == \"failed\"",
    "weight": 1.0
  }'
```

### List Steps for a Flow
```bash
curl -X GET http://localhost:44787/graph/flows/flow-1/steps
```

### Get Step Details with Edges
```bash
curl -X GET http://localhost:44787/graph/steps/step-3
```

### Get Edges for a Step
```bash
curl -X GET http://localhost:44787/graph/steps/step-3/edges
```

## 3. Execution (Flow Runs)

### Start a Flow Run
```bash
curl -X POST http://localhost:44787/graph/flow-runs \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-1",
    "status": "running",
    "metadata": "{\"order_id\": \"ORD-12345\", \"customer_id\": \"CUST-67890\"}"
  }'
```

### Update Step Run Status
```bash
# Step run started
curl -X PATCH http://localhost:44787/graph/step-runs/step-run-1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "metadata": "{\"started_at\": \"2024-03-08T10:00:00Z\"}"
  }'

# Step run completed
curl -X PATCH http://localhost:44787/graph/step-runs/step-run-1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "output": "{\"valid\": true, \"inventory_available\": true}",
    "metadata": "{\"finished_at\": \"2024-03-08T10:05:00Z\"}"
  }'
```

### Get Flow Run Details
```bash
curl -X GET http://localhost:44787/graph/flow-runs/flow-run-1
```

## 4. Complete Example: E-Commerce Platform

### Step 1: Create Project
```bash
curl -X POST http://localhost:44787/graph/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-Commerce Platform v2",
    "status": "active",
    "metadata": "{\"domain\": \"ecommerce\", \"team\": \"backend\"}"
  }'
```

### Step 2: Create Knowledge Nodes
```bash
# Product Catalog API
curl -X POST http://localhost:44787/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "type": "api",
    "title": "Product Catalog API",
    "content": "{\"endpoints\": [\"/api/products\", \"/api/categories\"]}",
    "status": "active"
  }'

# Shopping Cart Service
curl -X POST http://localhost:44787/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "type": "api",
    "title": "Shopping Cart API",
    "content": "{\"endpoints\": [\"/api/cart\", \"/api/cart/items\"]}",
    "status": "active"
  }'

# Payment Processing Task
curl -X POST http://localhost:44787/graph/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "type": "task",
    "title": "Integrate Payment Gateway",
    "content": "{\"description\": \"Connect to Stripe API\"}",
    "status": "in_progress"
  }'
```

### Step 3: Create Process Flow
```bash
# Create checkout flow
curl -X POST http://localhost:44787/graph/flows \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-1",
    "title": "Checkout Flow",
    "status": "active",
    "metadata": "{\"version\": \"1.0\", \"trigger\": \"cart_submit\"}"
  }'
```

### Step 4: Link Knowledge to Process (via metadata)
```json
{
  "flow_id": "flow-1",
  "title": "Validate Cart",
  "type": "validation",
  "content": "{\"rules\": [\"check_inventory\", \"validate_prices\"]}",
  "order_index": 1,
  "metadata": "{\"knowledge_nodes\": [\"node-1\", \"node-2\"]}"
}
```

## 5. Query Examples

### Get All Knowledge Nodes for Project
```bash
curl -X GET "http://localhost:44787/graph/projects/project-1/nodes"
```

### Get Knowledge Nodes by Type
```bash
curl -X GET "http://localhost:44787/graph/projects/project-1/nodes?type=api"
curl -X GET "http://localhost:44787/graph/projects/project-1/nodes?type=task"
```

### Get Complete Knowledge Graph for Project
```bash
# This would return nodes and relationships for visualization
curl -X GET "http://localhost:44787/graph/projects/project-1/graph"
```

### Get Complete Process Graph for Project
```bash
# Get all flows with their steps and edges
curl -X GET "http://localhost:44787/graph/projects/project-1/flows"
```

### Get Flow Execution History
```bash
curl -X GET "http://localhost:44787/graph/flows/flow-1/runs"
```

## 6. Response Examples

### Knowledge Node Response
```json
{
  "success": true,
  "data": {
    "node": {
      "id": "node-1",
      "project_id": "project-1",
      "type": "api",
      "title": "Product Catalog API",
      "content": "{\"endpoints\": [\"/api/products\", \"/api/categories\"]}",
      "status": "active",
      "created_at": 1741468800,
      "updated_at": 1741468800,
      "metadata": null
    },
    "tags": [],
    "relationships": [],
    "dependencies": [],
    "children": [],
    "parent": null
  }
}
```

### Flow Response with Steps
```json
{
  "success": true,
  "data": {
    "id": "flow-1",
    "project_id": "project-1",
    "title": "Checkout Flow",
    "status": "active",
    "metadata": "{\"version\": \"1.0\"}",
    "created_at": 1741468800,
    "updated_at": 1741468800,
    "steps": [
      {
        "id": "step-1",
        "flow_id": "flow-1",
        "title": "Validate Cart",
        "type": "validation",
        "content": "{\"rules\": [\"check_inventory\"]}",
        "order_index": 1,
        "metadata": null,
        "created_at": 1741468800,
        "updated_at": 1741468800
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source_step_id": "step-1",
        "target_step_id": "step-2",
        "condition": null,
        "weight": 1.0,
        "metadata": null,
        "created_at": 1741468800,
        "source_title": "Validate Cart",
        "target_title": "Process Payment"
      }
    ]
  }
}
```

### Flow Run Response
```json
{
  "success": true,
  "data": {
    "id": "flow-run-1",
    "flow_id": "flow-1",
    "status": "running",
    "started_at": 1741468800,
    "finished_at": null,
    "metadata": "{\"order_id\": \"ORD-12345\"}",
    "created_at": 1741468800,
    "updated_at": 1741468800,
    "step_runs": [
      {
        "id": "step-run-1",
        "flow_run_id": "flow-run-1",
        "step_id": "step-1",
        "status": "completed",
        "output": "{\"valid\": true}",
        "started_at": 1741468800,
        "finished_at": 1741468900,
        "metadata": "{\"duration\": \"100s\"}",
        "created_at": 1741468800,
        "updated_at": 1741468900
      }
    ]
  }
}
```

## Summary of Changes

### What Changed:
1. **Node types**: Removed `flow` from node types. Nodes are now: `task`, `doc`, `api`, `concept`, `rule`, `context`, `data`, `ui`, `system`
2. **New tables**: `flows`, `steps`, `step_edges`, `flow_runs`, `step_runs`
3. **Two graphs**: Knowledge Graph (nodes, relationships) and Process Graph (flows, steps)
4. **Clear separation**: Flows are not nodes, they're separate workflow definitions

### Benefits:
1. **Clean separation**: Knowledge vs Process
2. **Better modeling**: Steps belong to flows, not nodes
3. **Execution tracking**: Flow runs and step runs for monitoring
4. **Conditional logic**: Step edges with conditions for branching

### Migration Path:
1. Existing `flow` type nodes should be migrated to `concept` or `doc` types
2. Flow definitions moved to new `flows` table
3. Step definitions moved to new `steps` table
4. Execution tracking uses new `flow_runs` and `step_runs` tables