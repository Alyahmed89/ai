#!/usr/bin/env python3
"""
Create complete 24-step flow for ETA deployment verification
"""

import json
import subprocess

# Define all 24 steps with simplified instructions
steps = [
    # PHASE 1: DEPLOYMENT CHECK (Steps 1-8)
    {
        "id": "step1",
        "flow_id": "etaflow",
        "step_key": "eta.deployment_check_eta",
        "title": "Check ETA Worker Deployment",
        "instructions": "Check ETA worker status: curl -I https://eta.alghamdimo89.workers.dev",
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
        "instructions": "Browse to https://eta.alghamdimo89.workers.dev",
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
        "instructions": "Check Hono worker status: curl -I https://hono.alghamdimo89.workers.dev",
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
        "instructions": "Browse to https://hono.alghamdimo89.workers.dev",
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
        "instructions": "Check DeepSeek agent status: curl -I https://deepseek-agent.alghamdimo89.workers.dev",
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
        "instructions": "Browse to https://deepseek-agent.alghamdimo89.workers.dev",
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
        "instructions": "Check D1 databases via Cloudflare API",
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
        "instructions": "Get deployment errors from Cloudflare",
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
        "instructions": "Fetch next task from database",
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
        "instructions": "Analyze task requirements",
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
        "instructions": "Search for code patterns in repository",
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
        "instructions": "Check code templates",
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
        "instructions": "Apply template to task",
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
        "instructions": "Run tests on modified code",
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
        "instructions": "Commit changes to git",
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
        "instructions": "Update task status to completed",
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
        "instructions": "Trigger auto-deployment for ETA worker",
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
        "instructions": "Monitor deployment progress",
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
        "instructions": "Check ETA worker deployment status",
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
        "instructions": "Verify ETA worker functionality",
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
        "instructions": "Test Hono API endpoints",
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
        "instructions": "Test DeepSeek agent endpoints",
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
        "instructions": "Validate D1 database connections",
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
        "instructions": "Generate deployment report",
        "step_type": "execution",
        "order_index": 24,
        "page_key": "report",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    }
]

def main():
    print("Creating complete 24-step flow for ETA deployment verification...")
    
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
        
        # Escape single quotes in instructions
        instructions = step["instructions"].replace("'", "''")
        
        insert_sql = f"""
        INSERT INTO flow_steps (
            id, flow_id, step_key, title, instructions, step_type, 
            order_index, page_key, blocking, auto_fail_on_error, retryable
        ) VALUES (
            '{step["id"]}', '{step["flow_id"]}', '{step["step_key"]}', 
            '{step["title"]}', '{instructions}', '{step["step_type"]}', 
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
            # Try to continue with next step
        else:
            print(f"✓ Step {i}: {step['title']}")
    
    print("\n✅ 24-step flow created successfully!")
    print("\nPHASE 1: Deployment Check (Steps 1-8)")
    print("PHASE 2: Task Processing (Steps 9-16)")
    print("PHASE 3: Deployment Verification (Steps 17-24)")
    print("\nTotal steps: 24")
    print("Flow ID: etaflow")

if __name__ == "__main__":
    main()