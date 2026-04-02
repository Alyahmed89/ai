-- Migration 0011: Etaflow Tasks (Converting priorities to deterministic tasks)
-- Flow: etaflow
-- Based on user requirements: Convert priorities into tasks

-- Clear existing test tasks for etaflow (keep other flows)
DELETE FROM tasks WHERE flow_id = 'etaflow';
DELETE FROM task_followups WHERE parent_task_id IN (SELECT id FROM tasks WHERE flow_id = 'etaflow');

-- Insert etaflow tasks based on priorities
INSERT INTO tasks (id, flow_id, title, description, status, order_index, created_at) VALUES
  -- Task 1: Review Payload & Validate
  ('eta_task_1', 'etaflow', 'Review Payload & Validate', 
   'Open /workspace/eta/seph6.json and read entire payload. Understand structure: pages, components, layouts, functions, backend integration. Check each key: Are patterns consistent? Do they allow full customization? Check each value: Are they rendering correctly? Do they block anything? Identify requirements: What is this app supposed to do? Review ZOD validator: Does it enforce correct patterns? If payload has issues that would break generation: Fix now. If ZOD validator allows multiple ways to do same thing: Lock to ONE correct pattern. If patterns work perfectly and allow full custom: Document as validated pattern. Report: Payload understood, any fixes made, validation locked.',
   'pending', 1, CURRENT_TIMESTAMP),
  
  -- Task 2: Setup (includes cloning d1 repo)
  ('eta_task_2', 'etaflow', 'Setup Environment', 
   'apt-get update && sleep 2. apt-get install nodejs npm && sleep 2. cd /workspace/eta. npm install && sleep 2. git branch --show-current (expect: fix-eta-template-syntax). git clone https://${GITHUB_TOKEN}@github.com/Alyahmed89/d1 /workspace/d1. cd /workspace/d1 && git status (verify: in d1 repo).',
   'pending', 2, CURRENT_TIMESTAMP),
  
  -- Task 3: Pull Hono Repo (Setup)
  ('eta_task_3', 'etaflow', 'Pull Hono Repository', 
   'git clone https://${GITHUB_TOKEN}@github.com/Alyahmed89/hono /workspace/hono. cd /workspace/hono. git status (verify: in hono repo). ls -la (verify: hono code present).',
   'pending', 3, CURRENT_TIMESTAMP),
  
  -- Task 4: Generate App & Copy to D1 Repo
  ('eta_task_4', 'etaflow', 'Generate App & Copy to D1 Repo', 
   'cd /workspace/eta. node generate-to-d1.js && sleep 2 (outputs to /workspace/eta/d1). cp -r /workspace/eta/d1/* /workspace/d1/ (copy generated app to d1 repo). cd /workspace/d1. ls -la (verify: generated app files copied).',
   'pending', 4, CURRENT_TIMESTAMP),
  
  -- Task 5: Check Deployment Status
  ('eta_task_5', 'etaflow', 'Check Deployment Status', 
   'Execute curl command to check Cloudflare Pages deployment status. Extract: id value, url value, status value. Check status value: If status = "success" proceed to browser testing, if status = anything else get build logs.',
   'pending', 5, CURRENT_TIMESTAMP),
  
  -- Task 6: Browser Testing - Priority 1: Homepage
  ('eta_task_6', 'etaflow', 'Test Homepage (Priority 1)', 
   'Start interactive browser with deployment URL. Navigate to homepage. Homepage loads and displays. Check visual quality: colors, spacing, typography, animations. Check SEO: view page source, check meta tags, structured data. Check favicon in browser tab. Test all functionality (forms, buttons, links, data loading). Report UI improvements needed: Colors that need adjustment, spacing issues, typography improvements, animation suggestions, missing unique touches, generic elements that need premium feel, layout improvements, SEO issues.',
   'pending', 6, CURRENT_TIMESTAMP),
  
  -- Task 7: Browser Testing - Priority 2: Signup Page
  ('eta_task_7', 'etaflow', 'Test Signup Page (Priority 2)', 
   'Navigate to signup page. Verify frontend uses https://hono.alghamdimo89.workers.dev for API calls. TEST NEGATIVE: Try signup with existing email - curl https://hono.alghamdimo89.workers.dev/auth/register - verify error response. TEST NEGATIVE: Try signup with invalid data - verify validation messages custom and match backend. TEST POSITIVE: Fill form with valid new test data. Submit form. Observe response (validation messages must be custom, reflect real backend response). curl directly to Worker signup endpoint to verify it works in isolation. Query D1 via CF API to verify user created in database. Check Worker logs via CF API for any errors. Report: Works ✓ or First issue found ✗ (include: what broke, frontend or backend, error messages). Report UI improvements needed.',
   'pending', 7, CURRENT_TIMESTAMP),
  
  -- Task 8: Browser Testing - Priority 3: Login Page
  ('eta_task_8', 'etaflow', 'Test Login Page (Priority 3)', 
   'Navigate to login page. TEST NEGATIVE: Try login with wrong password - curl endpoint - verify error response. TEST NEGATIVE: Try login with non-existent email - verify error. TEST POSITIVE: Fill form with correct credentials, submit. Verify validation messages are custom and match backend responses. curl directly to Worker login endpoint in isolation. Check auth token via CF API. Check Worker logs via CF API. Report: Works ✓ or First issue found ✗ (include: what broke, frontend or backend, error messages). Report UI improvements needed.',
   'pending', 8, CURRENT_TIMESTAMP),
  
  -- Task 9: Browser Testing - Priority 4: Templates List Page
  ('eta_task_9', 'etaflow', 'Test Templates List Page (Priority 4)', 
   'Navigate to templates list page. Displays all templates from database. Each template card shows: thumbnail, title, description, price. Filtering/sorting works (if in payload). Click template card → goes to template detail page. UI: Grid layout perfect, cards attractive, premium feel. SEO: Meta tags, structured data for products. Report UI improvements needed.',
   'pending', 9, CURRENT_TIMESTAMP),
  
  -- Task 10: Browser Testing - Priority 5: Single Template Page (CRITICAL)
  ('eta_task_10', 'etaflow', 'Test Single Template Page (Priority 5 - CRITICAL)', 
   'Navigate to single template page. This page sells the template. Must be absolutely perfect. Structure (multiple sections/tabs within one page): a) OVERVIEW TAB: Hero: Large preview image/video of template, Demo button (opens external demo: use our own d1 site URL as demo), Price and "Customize" button (goes to chat page), Key features list (pulled from template data), Template description. b) FEATURES TAB: Detailed features list from template data, Feature icons/visuals, Benefits explained. c) PAGES TAB: Shows all pages included in template, Screenshots or list from template data. d) STYLE GUIDE TAB: Colors: Display color palette used in template, Typography: Font families, sizes, Logo: If template includes logo variations, UI elements: Buttons, forms, cards examples. e) DETAILS TAB: Tech stack, Requirements, Support information. UI Requirements: Tabbed interface or smooth scrolling sections, Demo button prominent - opens external link in new tab, Chat box widget visible (bottom right): "Customize this template" → links to chat page, Beautiful product photography feel, Convincing, professional, premium. SEO: Rich product structured data, meta tags. Report: UI improvements, missing sections, layout issues.',
   'pending', 10, CURRENT_TIMESTAMP),
  
  -- Task 11: Browser Testing - Priority 6: Workspace Page
  ('eta_task_11', 'etaflow', 'Test Workspace Page (Priority 6)', 
   'Navigate to workspace page. Shows user''s purchased templates. Project management interface. Links to customization chat per template. Shows customization status. Must be complete and functional. UI: Dashboard feel, organized, easy to navigate. Report UI improvements needed.',
   'pending', 11, CURRENT_TIMESTAMP),
  
  -- Task 12: Browser Testing - Priority 7: Chat Page
  ('eta_task_12', 'etaflow', 'Test Chat Page (Priority 7)', 
   'Navigate to chat page (Customization Interface). Realtime chat with AI to customize selected template. Shows current template being customized. Chat history persists (Durable Objects). Messages send/receive in realtime. Input validation. Test: Send message → verify in DO via CF API → receive response. UI: Clean chat interface, professional, easy to use. Report: UI improvements, functionality issues.',
   'pending', 12, CURRENT_TIMESTAMP);

-- Insert follow-up tasks for investigation when issues are found
INSERT INTO task_followups (id, parent_task_id, title, description, status, order_index, created_at) VALUES
  -- Follow-up for any task that fails (issue investigation)
  ('eta_followup_investigate', 'eta_task_5', 'Investigate Deployment Failure', 
   'If deployment failed: Use deployment ID from Task 5. Execute curl for build logs. Extract error lines only. Report error lines.',
   'pending', 1, CURRENT_TIMESTAMP),
  
  -- Follow-up for any browser testing task that fails
  ('eta_followup_browser_issue', 'eta_task_6', 'Investigate Browser Issue', 
   'If any browser testing task fails: cd /workspace/d1 (d1 repo location). git pull origin main (get latest d1 repo state). Identify which page/component has the issue. Report: Page name, component name, issue description.',
   'pending', 2, CURRENT_TIMESTAMP),
  
  -- Follow-up for payload investigation
  ('eta_followup_payload', 'eta_task_6', 'Investigate Payload & Fix', 
   'Open /workspace/eta/seph6.json. Find section related to broken feature (pages, components, functions). Read relevant payload section. Check: Is payload formatted correctly? Check: Does payload match ZOD schema expectations? If payload has errors: Fix payload, save file. If payload fixed: Update ZOD validator to prevent this issue in future. If payload fixed: Add comment in validator explaining how to add pages/components correctly for this case. Report: Payload section content, any issues found, fixes applied.',
   'pending', 3, CURRENT_TIMESTAMP),
  
  -- Follow-up for generated code investigation
  ('eta_followup_generated', 'eta_task_6', 'Investigate Generated Code', 
   'cd /workspace/d1. Identify generated file with broken code (based on issue). Open and read that file. Find comments pointing to source .eta template. Note which .eta template(s) generated this code. Report: Generated file path, .eta template source(s).',
   'pending', 4, CURRENT_TIMESTAMP),
  
  -- Follow-up for template investigation
  ('eta_followup_template', 'eta_task_6', 'Investigate ETA Templates & API.JS', 
   'cd /workspace/eta/templates. Open .eta template(s) identified. Read template code. cd /workspace/eta && open api.js. Search api.js for related terms involved in the issue. Understand how payload keys get processed through api.js to .eta files. Understand how .eta templates transform payload data. Identify issue: template logic error, api.js processing error, missing payload data, wrong data mapping. Determine: Frontend-only OR backend involved. Report: Template file(s), api.js findings, issue type, frontend/backend determination.',
   'pending', 5, CURRENT_TIMESTAMP),
  
  -- Follow-up for backend work (if backend involved)
  ('eta_followup_backend', 'eta_task_6', 'Hono Work (Backend Fix)', 
   'Check Worker deployment via CF API (get latest deployment ID and timestamp). Check if latest Worker deployment matches last hono commit (verify sync). Check Worker env vars via CF API (verify D1 binding, DO binding correct). Check Worker logs via CF API (look for runtime errors). Check D1 database via CF API (verify schema, data integrity). Check Durable Objects via CF API if realtime features involved. curl test Worker endpoints (identify which endpoints fail). git clone https://${GITHUB_TOKEN}@github.com/Alyahmed89/hono /workspace/hono (if not exists). cd /workspace/hono. Identify relevant code based on CF API findings (route handler, DB query, auth). Read hono code. Identify backend issue (wrong query, broken endpoint, auth error, binding issue). Fix hono code. git add . git commit -m "Fix [issue]". git push origin main. sleep 15 (wait for Worker deployment). Check Worker deployment via CF API (verify new deployment created). Check Worker deployment timestamp matches new commit. curl test Worker endpoint to verify fix. Check D1 database via CF API to verify fix worked. Check Worker logs via CF API (verify no new errors). Report: Fix applied ✓, Worker deployed ✓, verified via CF API ✓.',
   'pending', 6, CURRENT_TIMESTAMP),
  
  -- Follow-up for template fix
  ('eta_followup_fix_template', 'eta_task_6', 'Fix ETA Template', 
   'cd /workspace/eta/templates. Open .eta template to fix. Apply fix (correct logic, fix data mapping, etc.). Save file. Report: Template fixed, changes made.',
   'pending', 7, CURRENT_TIMESTAMP),
  
  -- Follow-up for recompile and regenerate
  ('eta_followup_recompile', 'eta_task_6', 'Recompile & Regenerate & Push', 
   'cd /workspace/eta. node build-templates.js && sleep 2 (needed after .eta OR api.js edits). Verify: build successful. node generate-to-d1.js && sleep 2 (outputs to /workspace/eta/d1). cp -r /workspace/eta/d1/* /workspace/d1/ (copy to d1 repo). cd /workspace/d1. git add . git commit -m "Fix [issue description]". git push origin main (triggers deployment automatically - saves time). Report: Recompile ✓, Regenerate ✓, Copied ✓, Pushed to d1 ✓.',
   'pending', 8, CURRENT_TIMESTAMP),
  
  -- Follow-up for verification
  ('eta_followup_verify', 'eta_task_6', 'Verify New Deployment', 
   'Execute curl command to check new deployment status. From output, extract: id value (verify different from previous deployment ID). From output, extract: status value. Check status value: If status = "success" extract url value, report "Status: SUCCESS, URL: [url]", proceed to retest. If status != "success": Get build logs. Report errors and return to investigation.',
   'pending', 9, CURRENT_TIMESTAMP),
  
  -- Follow-up for retest
  ('eta_followup_retest', 'eta_task_6', 'Retest After Fix', 
   'Start interactive browser with NEW deployment URL. Navigate to specific feature that was broken. Test exact functionality. If backend involved: Verify via CF API (D1 query or DO check). Determine: Issue resolved ✓ or Issue persists ✗. Report: Resolution status.',
   'pending', 10, CURRENT_TIMESTAMP),
  
  -- Final follow-up: Push to eta repo
  ('eta_followup_final', 'eta_task_6', 'Push to ETA Repo (Final)', 
   'cd /workspace/eta. git status (verify: in eta repo, branch fix-eta-template-syntax). git add templates/ (if templates edited) OR git add api.js (if api.js edited) OR both. git commit -m "Fix [issue description]". git push origin fix-eta-template-syntax. Verify: push successful, note commit hash. If hono was modified: cd /workspace/hono && git log -1 (verify hono push). Report: Pushed to eta: ✓, Commit hash: [hash], Hono pushed: [✓ if applicable, or N/A]. Output exactly: [END_FLOW]',
   'pending', 11, CURRENT_TIMESTAMP);

-- Note: Follow-ups are linked to parent tasks but will only execute when parent task is marked as DONE
-- and follow-up status is PENDING. This creates the deterministic flow:
-- 1. Execute task
-- 2. External system marks task as DONE via POST /tasks/:id/complete
-- 3. System automatically selects next task (follow-up if parent is DONE, else next task)
-- 4. Continue until all tasks and follow-ups are DONE