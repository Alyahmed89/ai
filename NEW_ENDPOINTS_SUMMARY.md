# New CRUD Endpoints Added

## 1. Flow Step Conditions - Complete CRUD

### Added:
- `PUT /api/flow-step-conditions/:id` - Update flow step condition
- `DELETE /api/flow-step-conditions/:id` - Delete flow step condition

### Already existed:
- `GET /api/flow-steps/:id/conditions` - Get conditions for a step
- `POST /api/flow-step-conditions` - Create new condition

## 2. Flow Conditions - Complete CRUD

### Added:
- `GET /api/flow-conditions/:id` - Get specific flow condition
- `POST /api/flow-conditions` - Create flow condition
- `PUT /api/flow-conditions/:id` - Update flow condition
- `DELETE /api/flow-conditions/:id` - Delete flow condition

### Already existed:
- `GET /api/flow-conditions` - List all flow conditions

## 3. Step Input/Output - Dedicated Endpoints

### Added:
- `PUT /api/flow-steps/:id/input` - Update step input schema
- `GET /api/flow-steps/:id/output` - Get step output schema
- `PUT /api/flow-steps/:id/output` - Update step output schema

### Already existed:
- `GET /api/flow-steps/:id/input` - Get step input schema

## Usage Examples

### Update Flow Step Condition
```bash
curl -X PUT "https://your-worker.workers.dev/api/flow-step-conditions/cond-123" \
  -H "Content-Type: application/json" \
  -d '{
    "condition_type": "output_equals",
    "condition_value": "success",
    "next_step_id": "step-456"
  }'
```

### Create Flow Condition
```bash
curl -X POST "https://your-worker.workers.dev/api/flow-conditions" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": "flow-123",
    "step_id": "step-456",
    "condition_type": "prerequisite",
    "condition_engine": "state",
    "condition_key": "user_role",
    "condition_value": "admin"
  }'
```

### Update Step Input Schema
```bash
curl -X PUT "https://your-worker.workers.dev/api/flow-steps/step-123/input" \
  -H "Content-Type: application/json" \
  -d '{
    "input_keys": [
      {"key": "username", "type": "string", "required": true},
      {"key": "password", "type": "string", "required": true}
    ]
  }'
```

### Update Step Output Schema
```bash
curl -X PUT "https://your-worker.workers.dev/api/flow-steps/step-123/output" \
  -H "Content-Type: application/json" \
  -d '{
    "output_keys": [
      {"key": "user_id", "type": "string"},
      {"key": "auth_token", "type": "string"}
    ],
    "output_url": "https://api.example.com/webhook"
  }'
```

## Schema Validation

All endpoints use Zod validation schemas:

1. **Flow Step Conditions**: `flowStepConditionUpdateSchema`
2. **Flow Conditions**: `flowConditionCreateSchema`, `flowConditionUpdateSchema`
3. **Step Input/Output**: Direct field validation

## Database Operations

All endpoints:
- Check database connection
- Validate input data
- Check if records exist before update/delete
- Use proper error handling
- Return consistent JSON responses

## Response Format

Successful operations return:
```json
{
  "success": true,
  "data": {
    "message": "Operation successful",
    "id": "resource-id"  // when applicable
  }
}
```

Error responses return:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Minimal Changes Made

1. **Added 7 new endpoints** to complete CRUD functionality
2. **Added 3 new Zod schemas** for validation
3. **Updated imports** to include new schemas
4. **Maintained backward compatibility** - all existing endpoints unchanged

## Testing Recommendations

Test the new endpoints with:
1. Create → Read → Update → Delete workflow
2. Input validation with invalid data
3. Non-existent resource IDs (should return 404)
4. Missing required fields (should return 400)