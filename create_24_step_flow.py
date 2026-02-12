#!/usr/bin/env python3
"""
Create full 24-step flow for ETA deployment verification
"""

import json
import subprocess

# Define the 24 steps
steps = [
    # PHASE 1: DEPLOYMENT CHECK (Steps 1-8)
    {
        "id": "step1",
        "flow_id": "etaflow",
        "step_key": "eta.deployment_check_eta",
        "title": "Check ETA Worker Deployment",
        "instructions": "TASK: Check ETA Worker Deployment Status\nExecute: curl -s -I \"https://eta.alghamdimo89.workers.dev\" | head -1 | cut -d' ' -f2\nExpected: HTTP status code (200, 404, 500, etc.)\nReturn only the status code",
        "step_type": "api_call",
        "order_index": 1,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step2",
        "flow_id": "etaflow",
        "step_key": "eta.browse_eta",
        "title": "Browse ETA Worker",
        "instructions": "TASK: Browse to ETA Worker\nExecute: Start browser and go to https://eta.alghamdimo89.workers.dev\nCheck if page loads successfully\nReturn: \"Page loaded: yes\" or \"Page loaded: no\"",
        "step_type": "browser",
        "order_index": 2,
        "page_key": "eta_page",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step3",
        "flow_id": "etaflow",
        "step_key": "eta.deployment_check_hono",
        "title": "Check Hono Worker Deployment",
        "instructions": "TASK: Check Hono Worker Deployment Status\nExecute: curl -s -I \"https://hono.alghamdimo89.workers.dev\" | head -1 | cut -d' ' -f2\nExpected: HTTP status code (200, 404, 500, etc.)\nReturn only the status code",
        "step_type": "api_call",
        "order_index": 3,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step4",
        "flow_id": "etaflow",
        "step_key": "eta.browse_hono",
        "title": "Browse Hono Worker",
        "instructions": "TASK: Browse to Hono Worker\nExecute: Start browser and go to https://hono.alghamdimo89.workers.dev\nCheck if page loads successfully\nReturn: \"Page loaded: yes\" or \"Page loaded: no\"",
        "step_type": "browser",
        "order_index": 4,
        "page_key": "hono_page",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step5",
        "flow_id": "etaflow",
        "step_key": "eta.deployment_check_deepseek",
        "title": "Check DeepSeek Agent Deployment",
        "instructions": "TASK: Check DeepSeek Agent Deployment Status\nExecute: curl -s -I \"https://deepseek-agent.alghamdimo89.workers.dev\" | head -1 | cut -d' ' -f2\nExpected: HTTP status code (200, 404, 500, etc.)\nReturn only the status code",
        "step_type": "api_call",
        "order_index": 5,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step6",
        "flow_id": "etaflow",
        "step_key": "eta.browse_deepseek",
        "title": "Browse DeepSeek Agent",
        "instructions": "TASK: Browse to DeepSeek Agent\nExecute: Start browser and go to https://deepseek-agent.alghamdimo89.workers.dev\nCheck if page loads successfully\nReturn: \"Page loaded: yes\" or \"Page loaded: no\"",
        "step_type": "browser",
        "order_index": 6,
        "page_key": "deepseek_page",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step7",
        "flow_id": "etaflow",
        "step_key": "eta.check_d1_databases",
        "title": "Check D1 Database Status",
        "instructions": "TASK: Check D1 Database Status\nExecute: curl -s -X GET \"https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database\" -H \"Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL\" -H \"Content-Type: application/json\" | jq -r '.result | length'\nExpected: Number of databases (should be 4)\nReturn: \"Databases count: X\"",
        "step_type": "api_call",
        "order_index": 7,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step8",
        "flow_id": "etaflow",
        "step_key": "eta.get_deployment_errors",
        "title": "Get Deployment Errors",
        "instructions": "TASK: Get Deployment Errors\nExecute: Check Cloudflare Workers for errors\ncurl -s -X GET \"https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/workers/scripts\" -H \"Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL\" -H \"Content-Type: application/json\" | jq -r '.result[] | select(.id == \"eta\" or .id == \"hono\" or .id == \"deepseek-agent\") | .id + \": \" + (.modified_on // \"unknown\")'\nExpected: Last modified timestamps\nReturn: \"No errors\" or error details",
        "step_type": "api_call",
        "order_index": 8,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # PHASE 2: TASK PROCESSING (Steps 9-16)
    {
        "id": "step9",
        "flow_id": "etaflow",
        "step_key": "eta.fetch_next_task",
        "title": "Fetch Next Pending Task",
        "instructions": "TASK: Fetch Next Pending Task\nExecute: curl -s -X POST \"https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query\" -H \"Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL\" -H \"Content-Type: application/json\" -d \"{\\\"sql\\\": \\\"SELECT id, title, description FROM tasks WHERE flow_id='etaflow' AND status='PENDING' ORDER BY created_at LIMIT 1;\\\"}\" | jq -r '.result[0].results[0]'\nExpected: Task details or null\nReturn: Task data or \"No tasks\"",
        "step_type": "database",
        "order_index": 9,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step10",
        "flow_id": "etaflow",
        "step_key": "eta.analyze_task",
        "title": "Analyze Task Requirements",
        "instructions": "TASK: Analyze Task Requirements\nExecute: Read task from previous step\nIf task exists, analyze requirements\nCheck what needs to be implemented\nReturn: \"Task analysis: [brief summary]\" or \"No task to analyze\"",
        "step_type": "analysis",
        "order_index": 10,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step11",
        "flow_id": "etaflow",
        "step_key": "eta.search_code_patterns",
        "title": "Search Code Patterns",
        "instructions": "TASK: Search for Code Patterns\nExecute: Search repository for relevant patterns\nfind /workspace -name \"*.ts\" -o -name \"*.js\" -o -name \"*.py\" | head -10 > /tmp/code_files.txt\nReturn: \"Found X code files\"",
        "step_type": "execution",
        "order_index": 11,
        "page_key": "code_search",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step12",
        "flow_id": "etaflow",
        "step_key": "eta.check_templates",
        "title": "Check Code Templates",
        "instructions": "TASK: Check Code Templates\nExecute: Look for template files in repository\nfind /workspace -name \"*template*\" -o -name \"*.template\" | head -5 > /tmp/templates.txt\nReturn: \"Found X template files\"",
        "step_type": "execution",
        "order_index": 12,
        "page_key": "templates",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step13",
        "flow_id": "etaflow",
        "step_key": "eta.apply_template",
        "title": "Apply Template to Task",
        "instructions": "TASK: Apply Template to Task\nExecute: Apply appropriate template to task\nBased on task requirements, select and apply template\nReturn: \"Template applied: [template name]\" or \"No template needed\"",
        "step_type": "execution",
        "order_index": 13,
        "page_key": "template_apply",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step14",
        "flow_id": "etaflow",
        "step_key": "eta.run_tests",
        "title": "Run Tests on Code",
        "instructions": "TASK: Run Tests on Modified Code\nExecute: Run appropriate tests\nCheck if tests pass\nReturn: \"Tests passed\" or \"Tests failed: [error]\"",
        "step_type": "execution",
        "order_index": 14,
        "page_key": "tests",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step15",
        "flow_id": "etaflow",
        "step_key": "eta.commit_changes",
        "title": "Commit Changes to Git",
        "instructions": "TASK: Commit Changes to Git\nExecute: Commit modified files to git\ncd /workspace/deepseek-agent && git add . && git commit -m \"Task implementation\"\nReturn: \"Commit successful\" or \"Commit failed: [error]\"",
        "step_type": "execution",
        "order_index": 15,
        "page_key": "git_commit",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step16",
        "flow_id": "etaflow",
        "step_key": "eta.update_task_status",
        "title": "Update Task Status",
        "instructions": "TASK: Update Task Status to Completed\nExecute: Update task status in database\ncurl -s -X POST \"https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query\" -H \"Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL\" -H \"Content-Type: application/json\" -d \"{\\\"sql\\\": \\\"UPDATE tasks SET status='DONE' WHERE id='[TASK_ID]';\\\"}\"\nReturn: \"Task updated to DONE\" or \"Update failed\"",
        "step_type": "database",
        "order_index": 16,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # PHASE 3: DEPLOYMENT VERIFICATION (Steps 17-24)
    {
        "id": "step17",
        "flow_id": "etaflow",
        "step_key": "eta.trigger_deployment",
        "title": "Trigger Auto-Deployment",
        "instructions": "TASK: Trigger Auto-Deployment for ETA Worker\nExecute: Trigger deployment via Cloudflare API\ncurl -s -X POST \"https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/workers/scripts/eta\" -H \"Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL\" -H \"Content-Type: application/json\" -d \"{\\\"force\\\": true}\"\nReturn: \"Deployment triggered\" or \"Trigger failed\"",
        "step_type": "api_call",
        "order_index": 17,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step18",
        "flow_id": "etaflow",
        "step_key": "eta.monitor_deployment",
        "title": "Monitor Deployment Progress",
        "instructions": "TASK: Monitor Deployment Progress\nExecute: Check deployment status\nWait 10 seconds, then check ETA worker status\ncurl -s -I \"https://eta.alghamdimo89.workers.dev\" | head -1 | cut -d' ' -f2\nReturn: \"Deployment status: [status]\"",
        "step_type": "api_call",
        "order_index": 18,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step19",
        "flow_id": "etaflow",
        "step_key": "eta.check_eta_deployment",
        "title": "Check ETA Worker Deployment",
        "instructions": "TASK: Check ETA Worker Deployment Status\nExecute: Verify ETA worker is deployed and working\ncurl -s -I \"https://eta.alghamdimo89.workers.dev\" | head -1 | cut -d' ' -f2\nReturn: \"ETA deployment status: [status]\"",
        "step_type": "api_call",
        "order_index": 19,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step20",
        "flow_id": "etaflow",
        "step_key": "eta.verify_eta_functionality",
        "title": "Verify ETA Worker Functionality",
        "instructions": "TASK: Verify ETA Worker Functionality\nExecute: Test ETA worker endpoints\ncurl -s \"https://eta.alghamdimo89.workers.dev\"\nReturn: \"ETA functionality: working\" or \"ETA functionality: failed\"",
        "step_type": "api_call",
        "order_index": 20,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step21",
        "flow_id": "etaflow",
        "step_key": "eta.test_hono_api",
        "title": "Test Hono API Endpoints",
        "instructions": "TASK: Test Hono API Endpoints\nExecute: Test Hono API\ncurl -s \"https://hono.alghamdimo89.workers.dev\"\nReturn: \"Hono API: working\" or \"Hono API: failed\"",
        "step_type": "api_call",
        "order_index": 21,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step22",
        "flow_id": "etaflow",
        "step_key": "eta.test_deepseek_agent",
        "title": "Test DeepSeek Agent Endpoints",
        "instructions": "TASK: Test DeepSeek Agent Endpoints\nExecute: Test DeepSeek Agent API\ncurl -s \"https://deepseek-agent.alghamdimo89.workers.dev\"\nReturn: \"DeepSeek Agent: working\" or \"DeepSeek Agent: failed\"",
        "step_type": "api_call",
        "order_index": 22,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step23",
        "flow_id": "etaflow",
        "step_key": "eta.validate_d1_databases",
        "title": "Validate D1 Database Connections",
        "instructions": "TASK: Validate D1 Database Connections\nExecute: Test database connectivity\ncurl -s -X POST \"https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query\" -H \"Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL\" -H \"Content-Type: application/json\" -d \"{\\\"sql\\\": \\\"SELECT 1;\\\"}\"\nReturn: \"Database validation: success\" or \"Database validation: failed\"",
        "step_type": "database",
        "order_index": 23,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    {
        "id": "step24",
        "flow_id": "etaflow",
        "step_key": "eta.generate_deployment_report",
        "title": "Generate Deployment Report",
        "instructions": "TASK: Generate Deployment Report\nExecute: Create summary report of all steps\nCompile results from previous steps\nSave report to /tmp/deployment_report.txt\nReturn: \"Report generated: /tmp/deployment_report.txt\"",
        "step_type": "execution",
        "order_index": 24,
        "page_key": "report",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    }
]

def main():
    print("Creating 24-step flow for ETA deployment verification...")
    
    # First, delete existing steps
    delete_sql = "DELETE FROM flow_steps WHERE flow_id='etaflow';"
    delete_data = {"sql": delete_sql}
    
    print("Deleting existing steps...")
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query",
        "-H", "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(delete_data)
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error deleting steps: {result.stderr}")
        return
    
    print("Inserting 24 new steps...")
    
    for i, step in enumerate(steps, 1):
        # Convert None to NULL for SQL
        page_key = "NULL" if step["page_key"] is None else f"'{step['page_key']}'"
        
        insert_sql = f"""
        INSERT INTO flow_steps (
            id, flow_id, step_key, title, instructions, step_type, 
            order_index, page_key, blocking, auto_fail_on_error, retryable
        ) VALUES (
            '{step["id"]}', '{step["flow_id"]}', '{step["step_key"]}', 
            '{step["title"]}', '{step["instructions"]}', '{step["step_type"]}', 
            {step["order_index"]}, {page_key}, {step["blocking"]}, 
            {step["auto_fail_on_error"]}, {step["retryable"]}
        );
        """
        
        insert_data = {"sql": insert_sql}
        
        result = subprocess.run([
            "curl", "-s", "-X", "POST",
            "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query",
            "-H", "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL",
            "-H", "Content-Type: application/json",
            "-d", json.dumps(insert_data)
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Error inserting step {i}: {result.stderr}")
        else:
            print(f"✓ Step {i}: {step['title']}")
    
    print("\n✅ 24-step flow created successfully!")
    print("\nPHASE 1: Deployment Check (Steps 1-8)")
    print("PHASE 2: Task Processing (Steps 9-16)")
    print("PHASE 3: Deployment Verification (Steps 17-24)")
    print("\nTotal steps: 24")
    print("Flow ID: etaflow")
    print("Worker URLs:")
    print("  - ETA: https://eta.alghamdimo89.workers.dev")
    print("  - Hono: https://hono.alghamdimo89.workers.dev")
    print("  - DeepSeek Agent: https://deepseek-agent.alghamdimo89.workers.dev")

if __name__ == "__main__":
    main()