# Database Changes for Strict Control Flow

**Date**: 2026-02-12  
**Branch**: flow  
**Commit**: 27091ca (Maximum speed DO optimization with strict OpenHands control)

## Summary
Updated Cloudflare D1 database with strict control flow and deterministic ZOD validation system.

## Changes Made via Cloudflare API

### 1. Updated `deepseek_system` Prompt in `flows` table
- **Flow ID**: `etaflow`
- **Changes**: Added absolute control rules:
  - "OpenHands does ONLY what's specified - no more, no less"
  - "If OpenHands deviates, get STRICTER next prompt"
  - "One exact command per instruction"
  - "Zero guessing - use Cloudflare API for verification"

### 2. Created 6-Step Flow in `flow_steps` table
All steps for `flow_id = "etaflow"`:

#### Step 1: `eta.strict_control` (order_index: 1)
- **Title**: STRICT CONTROL: Deployment Check
- **Purpose**: Check deployment status via Cloudflare API
- **Instructions**: curl command to get deployment status

#### Step 2: `eta.deployment_action` (order_index: 2)
- **Title**: Deployment Action with Browser
- **Purpose**: Start browser or analyze errors based on status
- **Instructions**: Conditional actions for success/failure/active status

#### Step 3: `eta.code_analysis` (order_index: 3)
- **Title**: Get Actual Code for Analysis
- **Purpose**: Get actual code content (not just metadata)
- **Instructions**: Read eta/seph6.json for analysis

#### Step 4: `eta.zod_deterministic` (order_index: 4)
- **Title**: Deterministic ZOD Validation Check
- **Purpose**: Check if ZOD validation is involved
- **Instructions**: grep for "zod" in codebase
- **Decision Tree**:
  1. ZOD preventing fixes → Adjust schema
  2. ZOD allowing loose configs → Tighten schema
  3. No ZOD → Continue with standard fix

#### Step 5: `eta.targeted_fix` (order_index: 5)
- **Title**: Targeted Fix/Implementation
- **Purpose**: Fix ONLY what's broken
- **Rules**: No unrelated refactoring, update ZOD if involved

#### Step 6: `eta.verification` (order_index: 6)
- **Title**: Verify Fix with Cloudflare API
- **Purpose**: Verify fix via API, browser test if successful

## DO Optimization Settings
Updated in `/workspace/deepseek-agent/src/constants.ts`:

```typescript
export const ALARM_DELAY_INIT = 2 * 1000; // 2 seconds (2x from 1s)
export const ALARM_DELAY_WAITING = 5 * 1000; // 5 seconds (0.5x from 10s - FASTER!)
export const ALARM_DELAY_ACTIVE = 3 * 1000; // 3 seconds (same as original)
```

**Estimated DO operations/day**: 4,104 (well under 100k limit)

## Verification Queries
To verify database changes:

```sql
-- Check flow_steps
SELECT step_key, title, order_index 
FROM flow_steps 
WHERE flow_id="etaflow" 
ORDER BY order_index;

-- Check deepseek_system prompt
SELECT deepseek_system 
FROM flows 
WHERE id="etaflow";
```

## Notes
- Database changes made via direct Cloudflare API calls
- Git repository contains code changes only
- This document serves as reference for database state

## **ABSOLUTE CONTROL SYSTEM ADDED (2026-02-12)**

### **Problem Fixed:**
- DeepSeek was not controlling OpenHands properly
- OpenHands was asking "Should I...?" and reporting "Then: ..."
- 20 iterations limit was arbitrary

### **Solution Implemented:**
1. **Updated `first_prompt`**: Changed from 20 iterations to 6 iterations (one per step)
2. **Updated `deepseek_system`**: Added ABSOLUTE CONTROL RULES
3. **Updated all `flow_steps`**: Each step now includes absolute control mechanism

### **ABSOLUTE CONTROL RULES (NON-NEGOTIABLE):**
1. OpenHands does NOTHING unless explicitly told
2. OpenHands waits SILENTLY for commands
3. OpenHands NEVER asks "Should I...?"
4. OpenHands NEVER reports "Then: ..."
5. One exact command per prompt
6. If OpenHands deviates, next prompt gets STRICTER

### **CONTROL MECHANISM:**
- Every prompt MUST include: "WAIT FOR COMMAND"
- Zero autonomy, zero initiative
- OpenHands is a tool, not a partner
- Every flow_step now has absolute control rules embedded

### **Iteration Limit:**
- Changed from arbitrary "20 iterations" to "6 iterations" (one per systematic step)
- Each iteration corresponds to one step in the 6-step workflow