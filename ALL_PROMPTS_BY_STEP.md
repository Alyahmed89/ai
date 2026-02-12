# ALL PROMPTS OPENHANDS CAN EXPECT FROM DEEPSEEK

## FLOW: Exact 21-Step Flow with Conditional Branching

### **STEP 1: Check Deployment (Pages – D1 project)**
**Prompt from DeepSeek:**
```
Check deployment status of the D1 Pages project via Cloudflare API.
Execute: curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/pages/projects/[D1_PROJECT_NAME]/deployments" -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" -H "Content-Type: application/json" | jq -r '.result[0].latest_stage.name'
Return: "deploy", "success", "failed", or specific error stage.
```

### **STEP 2: Get Deployment Errors (Pages – D1)**
**Prompt from DeepSeek:**
```
Get deployment errors for the D1 Pages project.
Execute: curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/pages/projects/[D1_PROJECT_NAME]/deployments" -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" -H "Content-Type: application/json" | jq -r '.result[0].latest_stage | select(.name == "failed") | .details'
Return: Error details or "No errors found".
```

### **STEP 3: Browse Current State (Pages URL)**
**Prompt from DeepSeek:**
```
Browse to the current Pages deployment URL to see the state.
Execute: Start browser and go to https://[D1_PAGES_URL]
Check if page loads successfully and document current state.
Return: "Page loaded: yes, state: [description]" or "Page loaded: no, error: [error]".
```

### **STEP 4: Fetch Task**
**Prompt from DeepSeek:**
```
Fetch the next pending task from the database.
Execute: curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query" -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" -H "Content-Type: application/json" -d "{\"sql\": \"SELECT id, title, description FROM tasks WHERE flow_id='etaflow' AND status='PENDING' ORDER BY created_at LIMIT 1;\"}" | jq -r '.result[0].results[0]'
Return: Task data in JSON format or "No tasks found".
```

### **STEP 5: Search Generated Code (D1 repo path)**
**Prompt from DeepSeek:**
```
Search for generated code in the D1 repository path.
Execute: find /workspace/[D1_REPO_PATH] -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.json" | head -20 > /tmp/generated_files.txt && cat /tmp/generated_files.txt
Return: List of generated files or "No generated files found".
```

### **STEP 6: View Template (.eta source)**
**Prompt from DeepSeek:**
```
View .eta template source files.
Execute: find /workspace -name "*.eta" -o -name "*.ejs" -o -name "*.template" | head -10 > /tmp/template_files.txt && for file in $(cat /tmp/template_files.txt); do echo "=== $file ==="; head -20 "$file"; done
Return: Template file list with first 20 lines of each.
```

### **STEP 7: Gap Analysis (Root Cause Decision)**
**Prompt from DeepSeek:**
```
Analyze the gap between current state and task requirements.
Based on task: [TASK_DESCRIPTION]
And current state: [CURRENT_STATE_FROM_STEP_3]
Determine root cause: frontend (.eta/D1) issue, backend (hono) issue, or no change needed.
Return: "Root cause: frontend issue", "Root cause: backend issue", or "Root cause: no change needed".
```

### **STEP 8: Edit .eta Template**
**Prompt from DeepSeek:**
```
Edit .eta template files for frontend fixes.
Based on task: [TASK_DESCRIPTION]
And gap analysis: [GAP_ANALYSIS]
Execute: Identify which .eta template needs editing and make minimal changes.
File: [SPECIFIC_TEMPLATE_FILE]
Changes: [SPECIFIC_CHANGES]
Return: "Template edited: [file]" or "No edits needed".
```

### **STEP 9: Recompile Templates**
**Prompt from DeepSeek:**
```
Recompile .eta templates.
Execute: Run template compilation command for the .eta framework.
Command: [ETA_COMPILATION_COMMAND]
Return: "Templates recompiled successfully" or "Compilation failed: [error]".
```

### **STEP 10: Regenerate + Copy Code → D1 repo path**
**Prompt from DeepSeek:**
```
Regenerate code from templates and copy to D1 repository path.
Execute: Regenerate code using template engine, then copy to /workspace/[D1_REPO_PATH]
Source: [TEMPLATE_OUTPUT_PATH]
Destination: /workspace/[D1_REPO_PATH]/[DESTINATION_PATH]
Return: "Code regenerated and copied to D1 repo" or "Failed: [error]".
```

### **STEP 11: Commit → D1 repo**
**Prompt from DeepSeek:**
```
Commit changes to D1 repository.
Execute: cd /workspace/[D1_REPO_PATH] && git add . && git commit -m "[COMMIT_MESSAGE_BASED_ON_TASK]"
Return: "Commit successful: [commit hash]" or "Commit failed: [error]".
```

### **STEP 12: Wait Deployment (Pages – D1)**
**Prompt from DeepSeek:**
```
Wait for Pages deployment to complete.
Execute: Wait 30 seconds, then check deployment status: curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/pages/projects/[D1_PROJECT_NAME]/deployments" -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" -H "Content-Type: application/json" | jq -r '.result[0].latest_stage.name'
Return: "Deployment status: [status]" (success, failed, or deploying).
```

### **STEP 14: Pull hono Repo**
**Prompt from DeepSeek:**
```
Pull hono repository for backend fixes.
Execute: cd /workspace/[HONO_REPO_PATH] && git pull origin main
Return: "Hono repo pulled successfully" or "Pull failed: [error]".
```

### **STEP 15: Search Backend Code**
**Prompt from DeepSeek:**
```
Search for backend code in hono repository.
Execute: cd /workspace/[HONO_REPO_PATH] && find . -name "*.ts" -o -name "*.js" | grep -i "[SEARCH_PATTERN_BASED_ON_TASK]" | head -10
Return: List of backend files matching the pattern.
```

### **STEP 16: Fix Backend Code**
**Prompt from DeepSeek:**
```
Fix backend code in hono repository.
Based on task: [TASK_DESCRIPTION]
And gap analysis: [GAP_ANALYSIS]
File: [SPECIFIC_BACKEND_FILE]
Changes: [SPECIFIC_CODE_CHANGES]
Execute: Edit the file with the specified changes.
Return: "Backend code fixed: [file]" or "No fixes needed".
```

### **STEP 17: Commit → hono repo**
**Prompt from DeepSeek:**
```
Commit changes to hono repository.
Execute: cd /workspace/[HONO_REPO_PATH] && git add . && git commit -m "[COMMIT_MESSAGE_BASED_ON_TASK]"
Return: "Commit successful: [commit hash]" or "Commit failed: [error]".
```

### **STEP 18: Retest via Pages Deployment**
**Prompt from DeepSeek:**
```
Retest via Pages deployment (NOT local eta).
Execute: Browse to https://[D1_PAGES_URL] and test functionality.
Test: [SPECIFIC_TEST_BASED_ON_TASK]
Return: "Test passed: [result]", "Test failed - backend issue: [error]", or "Test failed - frontend issue: [error]".
```

### **STEP 19: Mark Task Complete**
**Prompt from DeepSeek:**
```
Mark task as complete in database.
Execute: curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query" -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" -H "Content-Type: application/json" -d "{\"sql\": \"UPDATE tasks SET status='DONE' WHERE id='[TASK_ID_FROM_STEP_4]';\"}"
Return: "Task marked as DONE" or "Update failed: [error]".
```

### **STEP 20: Commit → eta repo (if modified)**
**Prompt from DeepSeek:**
```
Commit changes to eta repository if modified.
Execute: cd /workspace/[ETA_REPO_PATH] && git add . && git commit -m "[COMMIT_MESSAGE_BASED_ON_TASK]"
Return: "ETA repo commit successful: [commit hash]" or "No changes to commit".
```

### **STEP 21: Commit → hono repo (if modified)**
**Prompt from DeepSeek:**
```
Commit changes to hono repository if modified.
Execute: cd /workspace/[HONO_REPO_PATH] && git add . && git commit -m "[COMMIT_MESSAGE_BASED_ON_TASK]"
Return: "Hono repo commit successful: [commit hash]" or "No changes to commit".
```

### **STEP 22: Check Deployment (ETA Worker)**
**Prompt from DeepSeek:**
```
Check ETA Worker deployment status.
Execute: curl -s -I "https://eta.alghamdimo89.workers.dev" | head -1 | cut -d' ' -f2
Return: "ETA Worker status: [HTTP_STATUS]" (200, 404, 500, etc.).
```

## CONDITIONAL BRANCHING PROMPTS

### **After Step 1 Result:**
**If Failed:**
```
Deployment check failed. Go to Step 2: Get Deployment Errors.
```

**If Success:**
```
Deployment check successful. Go to Step 3: Browse Current State.
```

### **After Step 7 Decision:**
**If Frontend Issue:**
```
Root cause: frontend (.eta/D1) issue. Go to Step 8: Edit .eta Template.
```

**If Backend Issue:**
```
Root cause: backend (hono) issue. Go to Step 14: Pull hono Repo.
```

**If No Change Needed:**
```
Root cause: no change needed. Go to Step 18: Retest via Pages Deployment.
```

### **After Step 12 Result:**
**If Success:**
```
Deployment successful. Go to Step 18: Retest via Pages Deployment.
```

**If Failed:**
```
Deployment failed. Go to Step 2: Get Deployment Errors.
```

### **After Step 18 Result:**
**If Backend Issue:**
```
Retest failed - backend issue. Go to Step 14: Pull hono Repo.
```

**If Frontend Issue:**
```
Retest failed - frontend issue. Go to Step 8: Edit .eta Template.
```

**If All Pass:**
```
All tests passed. Go to Step 19: Mark Task Complete.
```

### **After Step 22 Result:**
**If Failed:**
```
ETA Worker deployment failed. Go to Step 2: Get Deployment Errors.
```

**If Success:**
```
ETA Worker deployment successful. END flow.
```

## BLANK FIELDS FOR TASK-SPECIFIC CONTEXT

The following fields will be filled based on the specific task:

1. `[D1_PROJECT_NAME]` - Name of the D1 Pages project
2. `[D1_PAGES_URL]` - URL of the deployed Pages project
3. `[D1_REPO_PATH]` - Local path to D1 repository
4. `[TASK_DESCRIPTION]` - Description from the fetched task
5. `[CURRENT_STATE_FROM_STEP_3]` - State observed in Step 3
6. `[GAP_ANALYSIS]` - Analysis from Step 7
7. `[SPECIFIC_TEMPLATE_FILE]` - Which .eta template to edit
8. `[SPECIFIC_CHANGES]` - Specific code changes needed
9. `[ETA_COMPILATION_COMMAND]` - Command to compile .eta templates
10. `[TEMPLATE_OUTPUT_PATH]` - Where compiled templates output
11. `[DESTINATION_PATH]` - Where to copy generated code in D1 repo
12. `[COMMIT_MESSAGE_BASED_ON_TASK]` - Commit message from task
13. `[HONO_REPO_PATH]` - Local path to hono repository
14. `[SEARCH_PATTERN_BASED_ON_TASK]` - Pattern to search in backend code
15. `[SPECIFIC_BACKEND_FILE]` - Which backend file to fix
16. `[SPECIFIC_TEST_BASED_ON_TASK]` - What to test in Step 18
17. `[TASK_ID_FROM_STEP_4]` - Task ID fetched in Step 4
18. `[ETA_REPO_PATH]` - Local path to eta repository

## EXPECTED RESPONSE FORMATS

OpenHands should return results in these formats:

1. **Status checks**: "Status: [value]" (e.g., "Status: 200", "Status: success")
2. **File operations**: "Operation: [result]" (e.g., "Files found: 15", "Template edited: user.eta")
3. **Database operations**: "Database: [result]" (e.g., "Task fetched: {id: 123}", "Task updated: DONE")
4. **Git operations**: "Git: [result]" (e.g., "Commit successful: abc123", "Pull successful")
5. **Browser operations**: "Browser: [result]" (e.g., "Page loaded: yes", "Test passed: login works")
6. **Analysis results**: "Analysis: [result]" (e.g., "Root cause: frontend issue", "Gap: missing validation")

## IMPORTANT NOTES

1. **OpenHands ONLY executes** - Never analyzes or decides next steps
2. **DeepSeek controls flow** - Based on raw results from OpenHands
3. **Conditional logic** - Handled by DeepSeek's decision-making
4. **Task-specific context** - Filled when task is fetched in Step 4
5. **Error handling** - Failed operations return error details for DeepSeek to analyze
6. **Loop detection** - DeepSeek must track loops to prevent infinite cycles