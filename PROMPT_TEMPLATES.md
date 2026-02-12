# PROMPT TEMPLATES FOR EACH STEP

## STEP 1: Check Deployment
```
Check deployment status of the D1 Pages project via Cloudflare API.
Execute: [API_CALL_TO_CHECK_DEPLOYMENT]
Return: deployment stage name.
```

## STEP 2: Get Deployment Errors
```
Get deployment errors for the D1 Pages project.
Execute: [API_CALL_TO_GET_ERRORS]
Return: error details or "No errors found".
```

## STEP 3: Browse Current State
```
Browse to the current Pages deployment URL to see the state.
Execute: Start browser and go to [PAGES_URL]
Return: page load status and state description.
```

## STEP 4: Fetch Task
```
Fetch the next pending task from the database.
Execute: [DATABASE_QUERY_FOR_TASKS]
Return: task data or "No tasks found".
```

## STEP 5: Search Generated Code
```
Search for generated code in the D1 repository path.
Execute: find [D1_REPO_PATH] for code files
Return: list of generated files.
```

## STEP 6: View Template
```
View .eta template source files.
Execute: find and view template files
Return: template file list with content.
```

## STEP 7: Gap Analysis
```
Analyze the gap between current state and task requirements.
Based on task: [TASK_DESCRIPTION]
And current state: [CURRENT_STATE]
Return: root cause (frontend/backend/no change).
```

## STEP 8: Edit .eta Template
```
Edit .eta template files for frontend fixes.
Based on task: [TASK_DESCRIPTION]
File: [TEMPLATE_FILE]
Changes: [SPECIFIC_CHANGES]
Return: edit confirmation.
```

## STEP 9: Recompile Templates
```
Recompile .eta templates.
Execute: [COMPILATION_COMMAND]
Return: compilation status.
```

## STEP 10: Regenerate + Copy Code
```
Regenerate code from templates and copy to D1 repository path.
Execute: regenerate and copy
Return: operation status.
```

## STEP 11: Commit → D1 repo
```
Commit changes to D1 repository.
Execute: git commit with message [COMMIT_MESSAGE]
Return: commit status.
```

## STEP 12: Wait Deployment
```
Wait for Pages deployment to complete.
Execute: wait and check status
Return: deployment status.
```

## STEP 14: Pull hono Repo
```
Pull hono repository for backend fixes.
Execute: git pull
Return: pull status.
```

## STEP 15: Search Backend Code
```
Search for backend code in hono repository.
Execute: find backend files matching pattern
Return: file list.
```

## STEP 16: Fix Backend Code
```
Fix backend code in hono repository.
Based on task: [TASK_DESCRIPTION]
File: [BACKEND_FILE]
Changes: [CODE_CHANGES]
Return: fix confirmation.
```

## STEP 17: Commit → hono repo
```
Commit changes to hono repository.
Execute: git commit with message [COMMIT_MESSAGE]
Return: commit status.
```

## STEP 18: Retest via Pages Deployment
```
Retest via Pages deployment.
Execute: browse and test [SPECIFIC_TEST]
Return: test result (pass/backend issue/frontend issue).
```

## STEP 19: Mark Task Complete
```
Mark task as complete in database.
Execute: update task status to DONE
Return: update status.
```

## STEP 20: Commit → eta repo
```
Commit changes to eta repository if modified.
Execute: git commit with message [COMMIT_MESSAGE]
Return: commit status or "no changes".
```

## STEP 21: Commit → hono repo
```
Commit changes to hono repository if modified.
Execute: git commit with message [COMMIT_MESSAGE]
Return: commit status or "no changes".
```

## STEP 22: Check Deployment (ETA Worker)
```
Check ETA Worker deployment status.
Execute: check HTTP status of ETA worker
Return: HTTP status code.
```

## CONDITIONAL BRANCHING PROMPTS

### After Step 1:
- If failed: "Go to Step 2: Get Deployment Errors."
- If success: "Go to Step 3: Browse Current State."

### After Step 7:
- Frontend issue: "Go to Step 8: Edit .eta Template."
- Backend issue: "Go to Step 14: Pull hono Repo."
- No change: "Go to Step 18: Retest via Pages Deployment."

### After Step 12:
- Success: "Go to Step 18: Retest via Pages Deployment."
- Failed: "Go to Step 2: Get Deployment Errors."

### After Step 18:
- Backend issue: "Go to Step 14: Pull hono Repo."
- Frontend issue: "Go to Step 8: Edit .eta Template."
- All pass: "Go to Step 19: Mark Task Complete."

### After Step 22:
- Failed: "Go to Step 2: Get Deployment Errors."
- Success: "END flow."

## BLANK FIELDS TO BE FILLED

1. `[API_CALL_TO_CHECK_DEPLOYMENT]`
2. `[API_CALL_TO_GET_ERRORS]`
3. `[PAGES_URL]`
4. `[DATABASE_QUERY_FOR_TASKS]`
5. `[D1_REPO_PATH]`
6. `[TASK_DESCRIPTION]`
7. `[CURRENT_STATE]`
8. `[TEMPLATE_FILE]`
9. `[SPECIFIC_CHANGES]`
10. `[COMPILATION_COMMAND]`
11. `[COMMIT_MESSAGE]`
12. `[BACKEND_FILE]`
13. `[CODE_CHANGES]`
14. `[SPECIFIC_TEST]`
15. `[TASK_ID]`

## RESPONSE FORMATS

OpenHands returns:
- "Status: [value]"
- "Files: [count/list]"
- "Database: [result]"
- "Git: [result]"
- "Browser: [result]"
- "Analysis: [result]"
- "Error: [details]"