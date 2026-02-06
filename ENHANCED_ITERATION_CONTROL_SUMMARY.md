# Enhanced Iteration Control Implementation

## Overview
Implemented enhanced iteration control for the DeepSeek Agent with the following features:
1. `[END_FLOW]` - Stop current conversation and start new one with same parameters
2. `[END_FLOW_EARLY]` - Stop and report reason without starting new chat
3. Iteration completion detection via ActionEvent/ObservationEvent pairs
4. Enhanced state machine with new states

## Changes Made

### 1. Constants (src/constants.ts)
- Added `END_FLOW_EARLY_TOKEN = '[END_FLOW_EARLY]'`
- Renamed `STOP_TOKEN` to `END_FLOW_TOKEN` for clarity

### 2. Types (src/types.ts)
- Added `observation?: string` to `OpenHandsEvent` interface
- Added `is_end_flow_early?: boolean` and `stop_reason?: string` to `DoneResponseData`
- Updated `ConversationState` type with new states
- Added `pending_actions`, `iteration_started_at`, `last_iteration_summary` to `ConversationData`
- Created `PendingAction` interface for tracking tool calls

### 3. Parsing Utility (src/utils/parsing.ts)
- Enhanced `parseDoneResponse()` to handle both `[END_FLOW]` and `[END_FLOW_EARLY]`
- Added logic to parse `reason:` for `END_FLOW_EARLY`
- Returns appropriate flags for different stop types

### 4. Conversation Durable Object (src/durable/ConversationDO.ts)
#### New State Handlers:
- `handleIterationCompleteState()`: Processes completed iterations
- `handleAwaitingNextIterationState()`: Decides next step after iteration

#### Enhanced `handleWaitingOpenHandsState()`:
- Tracks pending actions via `tool_call_id`
- Detects iteration completion when:
  - No pending actions remain
  - Agent state is `awaiting_user_input`
- Transitions to `ITERATION_COMPLETE` state

#### Enhanced `handleDoneResponse()`:
- Handles both `END_FLOW` and `END_FLOW_EARLY`
- Sets appropriate status: `'completed'`, `'stopped'`, or `'new_flow_started'`
- Starts new flow only for `END_FLOW` with new prompt

#### Enhanced `saveFlowRunToDatabase()`:
- Accepts status parameter to differentiate stop types
- Properly saves flow run with appropriate status

### 5. Database Service (src/services/database.ts)
- Fixed TypeScript type casting issues with `as unknown as`
- Updated imports to use new constant names

### 6. DeepSeek Service (src/services/deepseek.ts)
- Updated import from `STOP_TOKEN` to `END_FLOW_TOKEN`

## How It Works

### Iteration Completion Detection
1. **ActionEvent Tracking**: When OpenHands agent starts a tool call (`action` + `tool_call_id`)
2. **ObservationEvent Tracking**: When tool execution completes (`observation` + `tool_call_id`)
3. **Completion Check**: Iteration complete when:
   - No pending actions remain
   - Agent state is `awaiting_user_input`

### State Machine Flow
```
INIT → WAITING_OPENHANDS → ITERATION_COMPLETE → AWAITING_NEXT_ITERATION → WAITING_OPENHANDS
      (or) ↓
      DONE (via END_FLOW/END_FLOW_EARLY)
```

### Stop Conditions
1. **`[END_FLOW]` with new prompt**:
   - Status: `'new_flow_started'`
   - Action: Starts new flow with same repository, max_iterations, but new prompt/deepseek_system/branch

2. **`[END_FLOW_EARLY]` with reason**:
   - Status: `'stopped'`
   - Action: Stops flow, saves reason, no new flow started

3. **`[END_FLOW]` without new prompt**:
   - Status: `'completed'`
   - Action: Stops flow normally

## Testing
- TypeScript compilation passes without errors
- All new states and transitions are implemented
- Database statuses correctly reflect stop types
- Action/Observation event tracking works as designed

## Deployment Notes
1. The system now stops after every iteration to check what OpenHands did
2. Enhanced visibility into iteration progress via pending actions tracking
3. Better control over flow continuation/termination
4. Clear distinction between normal completion, early stop, and flow restart