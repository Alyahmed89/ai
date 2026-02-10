# 🎯 OPTIMIZED PROMPTS FOR DETERMINISTIC TASK FLOW

Based on testing, here are the optimized prompts for the deterministic task flow system.

## 📋 **PROMPT TEMPLATE STRUCTURE**

### **For Main Tasks:**
```
Execute: {TASK_TITLE}

{TASK_DESCRIPTION}

**FLOW EXECUTION RULES:**
1. Execute ONLY this task - do not skip ahead or combine tasks
2. Report completion when done
3. Wait for external system to mark task as DONE via API
4. Do NOT proceed to next task until current task is marked DONE
5. External completion URL: POST /tasks/{TASK_ID}/complete

**OUTPUT FORMAT:**
- Execute task steps
- Report results
- Output: [TASK_COMPLETE] when finished
```

### **For Follow-up Tasks:**
```
Execute follow-up: {FOLLOWUP_TITLE}

{FOLLOWUP_DESCRIPTION}

**CONTEXT:** This is a follow-up task because parent task "{PARENT_TASK_TITLE}" is DONE.

**FLOW EXECUTION RULES:**
1. Execute ONLY this follow-up task
2. Report completion when done  
3. Wait for external system to mark task as DONE via API
4. Do NOT proceed to next task until current task is marked DONE
5. External completion URL: POST /tasks/{FOLLOWUP_ID}/complete

**OUTPUT FORMAT:**
- Execute follow-up steps
- Report investigation findings
- Output: [TASK_COMPLETE] when finished
```

## 🎪 **EXAMPLE: LOGIN TASK PROMPT**

### **Actual Prompt Injected:**
```
Execute: Login Form Submission Test

Test the login form submission functionality. Navigate to login page. Fill email: test@example.com, password: test123. Click submit button. Verify form submits correctly. Check for validation messages. Verify backend receives request. Check response status. Report success or failure.

**FLOW EXECUTION RULES:**
1. Execute ONLY this task - do not skip ahead or combine tasks
2. Report completion when done
3. Wait for external system to mark task as DONE via API
4. Do NOT proceed to next task until current task is marked DONE
5. External completion URL: POST /tasks/test_login_task/complete

**OUTPUT FORMAT:**
- Execute task steps
- Report results
- Output: [TASK_COMPLETE] when finished
```

### **Expected AI Response:**
```
I'll execute the login form submission test:

1. **Navigate to login page**: Opening browser to deployment URL/login
2. **Fill form**: Email: test@example.com, Password: test123
3. **Click submit**: Form submission initiated
4. **Verify submission**: Checking for success/error messages
5. **Check backend**: Verifying request reached backend endpoint
6. **Check response**: Response status code received

**Results:**
- Form submitted successfully: ✓
- Validation messages displayed: ✓  
- Backend received request: ✓ (HTTP 200 response)
- Response status: Success

[TASK_COMPLETE]
```

## 🔍 **EXAMPLE: FOLLOW-UP INVESTIGATION PROMPT**

### **Actual Prompt Injected:**
```
Execute follow-up: Investigate Login Failure

If login test fails: Check browser console for errors. Check network requests. Verify backend endpoint is reachable. Check D1 database for test user. Test with curl directly to backend. Report findings.

**CONTEXT:** This is a follow-up task because parent task "Login Form Submission Test" is DONE.

**FLOW EXECUTION RULES:**
1. Execute ONLY this follow-up task
2. Report completion when done  
3. Wait for external system to mark task as DONE via API
4. Do NOT proceed to next task until current task is marked DONE
5. External completion URL: POST /tasks/test_login_followup/complete

**OUTPUT FORMAT:**
- Execute follow-up steps
- Report investigation findings
- Output: [TASK_COMPLETE] when finished
```

### **Expected AI Response:**
```
Investigating login failure:

1. **Browser console**: Checking for JavaScript errors
2. **Network requests**: Examining HTTP requests/responses
3. **Backend endpoint**: Testing https://hono.alghamdimo89.workers.dev/auth/login
4. **Database check**: Querying D1 for test user
5. **Direct curl test**: Testing endpoint directly

**Findings:**
- Browser console: No errors found
- Network: 500 Internal Server Error on POST /auth/login
- Backend endpoint: Reachable but returning error
- Database: Test user exists
- Curl test: Same 500 error

**Root cause**: Backend Worker throwing unhandled exception

[TASK_COMPLETE]
```

## 🚀 **ETAFLOW TASK PROMPT EXAMPLES**

### **Task 1: Review Payload & Validate**
```
Execute: Review Payload & Validate

Open /workspace/eta/seph6.json and read entire payload. Understand structure: pages, components, layouts, functions, backend integration. Check each key: Are patterns consistent? Do they allow full customization? Check each value: Are they rendering correctly? Do they block anything? Identify requirements: What is this app supposed to do? Review ZOD validator: Does it enforce correct patterns? If payload has issues that would break generation: Fix now. If ZOD validator allows multiple ways to do same thing: Lock to ONE correct pattern. If patterns work perfectly and allow full custom: Document as validated pattern. Report: Payload understood, any fixes made, validation locked.

**FLOW EXECUTION RULES:**
1. Execute ONLY this task - do not skip ahead or combine tasks
2. Report completion when done
3. Wait for external system to mark task as DONE via API
4. Do NOT proceed to next task until current task is marked DONE
5. External completion URL: POST /tasks/eta_task_1/complete

**OUTPUT FORMAT:**
- Execute task steps
- Report results
- Output: [TASK_COMPLETE] when finished
```

### **Task 6: Test Homepage (Priority 1)**
```
Execute: Test Homepage (Priority 1)

Start interactive browser with deployment URL. Navigate to homepage. Homepage loads and displays. Check visual quality: colors, spacing, typography, animations. Check SEO: view page source, check meta tags, structured data. Check favicon in browser tab. Test all functionality (forms, buttons, links, data loading). Report UI improvements needed: Colors that need adjustment, spacing issues, typography improvements, animation suggestions, missing unique touches, generic elements that need premium feel, layout improvements, SEO issues.

**FLOW EXECUTION RULES:**
1. Execute ONLY this task - do not skip ahead or combine tasks
2. Report completion when done
3. Wait for external system to mark task as DONE via API
4. Do NOT proceed to next task until current task is marked DONE
5. External completion URL: POST /tasks/eta_task_6/complete

**OUTPUT FORMAT:**
- Execute task steps
- Report results
- Output: [TASK_COMPLETE] when finished
```

## 📊 **PROMPT OPTIMIZATION FINDINGS**

### **What Works Best:**
1. **Clear task boundaries** - "Execute ONLY this task"
2. **Explicit completion signal** - "[TASK_COMPLETE]" marker
3. **API reference** - Include exact completion URL
4. **Context for follow-ups** - Explain why this task executes
5. **Structured output format** - Guide AI on expected response

### **What to Avoid:**
1. ❌ Ambiguous instructions
2. ❌ Multiple tasks in one prompt
3. ❌ Assuming AI knows about flow state
4. ❌ Missing completion markers
5. ❌ Vague success criteria

### **Optimal Prompt Length:**
- **Main tasks**: 5-10 lines of description + 5 lines of rules
- **Follow-ups**: 3-5 lines of description + 5 lines of rules
- **Total**: 10-15 lines maximum

## 🔧 **IMPLEMENTATION IN HONO WORKER**

The prompt injection happens in the ConversationDO when it gets the next task:

```typescript
// In ConversationDO.ts
async getNextTaskPrompt(flowId: string): Promise<string> {
  const nextTask = await this.getNextTaskForFlow(flowId);
  if (!nextTask) return "[END_FLOW]";
  
  const { id, title, description, type, parentTaskId } = nextTask;
  
  let prompt = "";
  
  if (type === 'followup') {
    const parentTask = await this.getTaskDetails(parentTaskId);
    prompt = `Execute follow-up: ${title}\n\n${description}\n\n`;
    prompt += `**CONTEXT:** This is a follow-up task because parent task "${parentTask.title}" is DONE.\n\n`;
  } else {
    prompt = `Execute: ${title}\n\n${description}\n\n`;
  }
  
  prompt += `**FLOW EXECUTION RULES:**\n`;
  prompt += `1. Execute ONLY this task - do not skip ahead or combine tasks\n`;
  prompt += `2. Report completion when done\n`;
  prompt += `3. Wait for external system to mark task as DONE via API\n`;
  prompt += `4. Do NOT proceed to next task until current task is marked DONE\n`;
  prompt += `5. External completion URL: POST /tasks/${id}/complete\n\n`;
  prompt += `**OUTPUT FORMAT:**\n`;
  prompt += `- Execute task steps\n`;
  prompt += `- Report results\n`;
  prompt += `- Output: [TASK_COMPLETE] when finished`;
  
  return prompt;
}
```

## ✅ **READY FOR PRODUCTION**

These optimized prompts ensure:
1. **Deterministic execution** - One task at a time
2. **Clear completion signals** - [TASK_COMPLETE] markers
3. **External control** - API-based task completion
4. **Proper context** - Follow-ups explain parent relationship
5. **Structured responses** - Consistent output format

**Usage:** Add `"flow": "etaflow"` to the `/start` payload and the system will automatically use these optimized prompts.