# Endpoint Selection Analysis

## How Step Nodes Save Input Endpoint Selection

### Investigation Summary
Date: 2026-04-03
Branch: fix-flow-run-id-capture

### Overview
This document summarizes how step nodes in the AI workflow system save input endpoints selected from dropdown lists.

### Two UI Approaches for Endpoint Selection

#### 1. EditStepModal Approach
- **Location**: `/workspace/ai/components/EditStepModal.tsx`
- **UI Component**: Regular HTML `<select>` dropdown
- **Process**:
  1. User selects endpoint from dropdown list
  2. Endpoint ID stored in `newEndpoint.endpoint_id`
  3. On "Add Endpoint" click, configuration added to `endpointConfigs` array
  4. On save, `endpointConfigs` converted to JSON string
  5. Sent as `use_endpoints` field to backend API

#### 2. FlowSection/NodePopup Approach  
- **Location**: `/workspace/ai/app/flows/design/[flowId]/page.tsx`
- **UI Component**: `SearchableDropdown` from `/workspace/ai/components/ui/SearchableDropdown.tsx`
- **Process**:
  1. User searches/selects endpoint in SearchableDropdown
  2. Selected endpoint stored in `selectedInputCommand` or `selectedOutputCommand`
  3. On node save, endpoints built into array
  4. Converted to JSON string for `use_endpoints` field

### Data Structure
```json
[
  {
    "endpoint_id": "endpoint_1773851144837",
    "phase": "input",  // or "command" or "output"
    "map": {
      "response.title": "post_title",
      "response.body": "post_body"
    }
  }
]
```

### API Integration
- **Endpoint**: `PUT /api/flow-steps/{stepId}`
- **Field**: `use_endpoints` (JSON string)
- **Example CURL**:
  ```bash
  curl -X PUT "https://ai.anyapp.cfd/api/flow-steps/step-1775175873355-s1isncz0k" \
    -H "Content-Type: application/json" \
    -d '{
      "use_endpoints": "[{\"endpoint_id\": \"endpoint_1773851144837\", \"phase\": \"input\", \"map\": {\"response.title\": \"post_title\", \"response.body\": \"post_body\"}}]"
    }'
  ```

### Key Components
1. **SearchableDropdown.tsx**: Reusable dropdown with search functionality
2. **FlowSection.tsx**: Component for input/output sections in flow design
3. **EditStepModal.tsx**: Modal for editing step details including endpoints
4. **Flow Design Page**: Main interface at `/app/flows/design/[flowId]/page.tsx`

### Usage in Instructions
Endpoints can be referenced in step instructions using template syntax:
- `{api.endpoint_name.response.field_name}`
- Example: `{api.test_jsonplaceholder.response.title}`

### Backend Integration
- Proxy API routes through `/app/api/proxy/[...path]/route.ts`
- Backend URL: `https://ai.anyapp.cfd`
- Database field: `use_endpoints` column in flow_steps table

### Current Branch Status
- **Branch**: `fix-flow-run-id-capture`
- **Remote**: Already synchronized with `origin/fix-flow-run-id-capture`
- **Last Commit**: "feat: Display all status information in flow runs" (6a6dd12)