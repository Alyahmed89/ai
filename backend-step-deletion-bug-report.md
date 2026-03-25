# Backend Step Deletion Bug Report

## Summary
Critical bug identified in the flow step deletion functionality. The backend API accepts deletion requests and returns success responses, but does not actually delete steps from the database.

## Affected Endpoints

### 1. `PUT /api/flows/{flowId}/steps` (Bulk DAG Update)
- **Status**: **BUGGY** - Returns success but doesn't delete
- **Payload Structure**:
  ```json
  {
    "steps": [...],           // Array of step objects to update/create
    "edges": [...],           // Array of edge objects  
    "deleted_step_ids": [...], // Array of step IDs to delete
    "deleted_edge_ids": [...]  // Array of edge IDs to delete
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Flow steps and edges updated successfully",
      "steps_updated": 1,
      "edges_updated": 0,
      "steps_deleted": 1,    // Claims deletion succeeded
      "edges_deleted": 0
    }
  }
  ```
- **Issue**: Returns `"steps_deleted": 1` but step remains in database.

### 2. `DELETE /api/flow-steps/{stepId}` (Individual Step Deletion)
- **Status**: **NOT SUPPORTED** - Returns 405 Method Not Allowed
- **Expected**: Should delete individual step
- **Actual**: Returns 405 error

### 3. `GET /api/flows/{flowId}/steps` (Get DAG)
- **Status**: **INCONSISTENT** - Returns 404 Not Found
- **Issue**: PUT works but GET doesn't (inconsistent API design)

## Working Endpoint

### `PUT /api/flow-steps/{stepId}` (Individual Step Update)
- **Status**: **WORKING** - Correctly updates step data
- **Used by**: Chat interface (`EditStepModal.tsx`)
- **Payload**: Individual step object with all fields

## Evidence of Bug

### Test Case 1: Bulk Deletion via PUT /api/flows/{flowId}/steps
```bash
# Request
PUT /api/flows/flow-def-1774377036239-p1ha954u8/steps
{
  "steps": [...],
  "edges": [],
  "deleted_step_ids": ["step-1774458678440-1buo8w514"],
  "deleted_edge_ids": []
}

# Response
{
  "success": true,
  "data": {
    "message": "Flow steps and edges updated successfully",
    "steps_updated": 1,
    "edges_updated": 0,
    "steps_deleted": 1,    # Claims deletion succeeded
    "edges_deleted": 0
  }
}

# Verification (step still exists)
GET /api/flow-steps?flow_id=flow-def-1774377036239-p1ha954u8
# Returns step-1774458678440-1buo8w514 in results
```

### Test Case 2: Individual Deletion Attempt
```bash
# Request
DELETE /api/flow-steps/step-1774458678440-1buo8w514

# Response
405 Method Not Allowed
```

## Impact

### Frontend Interfaces Affected:
1. **Flow Design Interface** (`/flows/design/[flowId]`)
   - Uses `saveFlowDAG()` function
   - Calls `PUT /api/flows/{flowId}/steps` with `deleted_step_ids`
   - **Result**: Steps appear deleted in UI but reappear on refresh

2. **Chat Interface** (`/chat`)
   - Step editing works (uses `PUT /api/flow-steps/{id}`)
   - Step deletion doesn't work (DELETE not supported)
   - **Result**: Can edit steps but not delete them

### User Experience:
- Users delete steps in flow designer
- UI shows steps as deleted
- Page refresh brings deleted steps back
- Confusion and data inconsistency

## Root Cause Analysis

### Suspected Issues:
1. **Database Transaction Issue**: The deletion SQL query may not be executed or committed
2. **Conditional Logic Bug**: Deletion may be conditional on other factors that aren't met
3. **Missing Implementation**: `deleted_step_ids` processing may be partially implemented
4. **API Inconsistency**: Different endpoints have different capabilities

### Code Path Analysis:
1. Frontend sends `deleted_step_ids` in payload
2. Backend receives and validates payload
3. Backend returns success response
4. **BUT**: Database deletion not executed or rolled back

## Recommendations for Backend Fix

### Priority 1: Fix `PUT /api/flows/{flowId}/steps`
- Ensure `deleted_step_ids` actually deletes from database
- Add proper transaction handling
- Implement rollback on failure

### Priority 2: Implement `DELETE /api/flow-steps/{stepId}`
- Support individual step deletion
- Consistent with REST conventions
- Needed for chat interface

### Priority 3: Fix `GET /api/flows/{flowId}/steps`
- Make GET endpoint consistent with PUT
- Return complete DAG (steps + edges)

### Priority 4: Add Validation & Error Handling
- Validate step references in edges
- Check for orphaned edges after deletion
- Return meaningful error messages

## Testing Requirements

### Backend Tests Needed:
1. **Unit Test**: `deleted_step_ids` processing in bulk update
2. **Integration Test**: Full DAG update with deletions
3. **Database Test**: Verify steps actually removed from DB
4. **Edge Case Test**: Delete steps with incoming/outgoing edges

### Test Scenarios:
```javascript
// Scenario 1: Simple deletion
{
  steps: [step1, step2, step3],
  deleted_step_ids: [step2.id]
  // Expected: step2 removed from database
}

// Scenario 2: Delete with edges
{
  steps: [step1, step2, step3],
  edges: [{source: step1.id, target: step2.id}, {source: step2.id, target: step3.id}],
  deleted_step_ids: [step2.id],
  deleted_edge_ids: [edge1.id, edge2.id]
  // Expected: step2 and connected edges removed
}

// Scenario 3: Delete multiple steps
{
  steps: [step1],
  deleted_step_ids: [step2.id, step3.id, step4.id]
  // Expected: All specified steps removed
}
```

## Frontend Workarounds (Temporary)

Until backend is fixed, consider:

1. **Disable Step Deletion in UI**: Remove delete buttons
2. **Show Warning**: Alert users deletion may not persist
3. **Manual Cleanup**: Provide admin tool to clean orphaned steps

## Timeline & Priority

- **Critical**: Fix within 1-2 days
- **Impact**: High - breaks core flow editing functionality
- **Users Affected**: All users editing flows

## Contact & References

- **Frontend Code**: `/workspace/ai/app/flows/design/[flowId]/page.tsx` (saveFlowDAG function)
- **Test Script**: `/workspace/ai/test-step-deletion-offline.js`
- **Evidence**: See server logs for DELETE 405 and PUT success responses
- **Database**: Cloudflare D1, `flow_steps` table

## Additional Notes

1. **Boolean Field Handling**: Frontend now correctly converts 1/0 to true/false
2. **Payload Structure**: Both interfaces use correct boolean values
3. **API Consistency**: Need uniform approach across all step-related endpoints
4. **Error Reporting**: Backend should return specific error if deletion fails