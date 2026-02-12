#!/usr/bin/env python3
"""
Create full 24-step flow for ETA deployment verification - Simple version
"""

import json
import subprocess

# Define the 24 steps with proper escaping
steps = [
    # PHASE 1: DEPLOYMENT CHECK (Steps 1-8)
    {
        "id": "step1",
        "flow_id": "etaflow",
        "step_key": "eta.deployment_check_eta",
        "title": "Check ETA Worker Deployment",
        "instructions": "TASK: Check ETA Worker Deployment Status\\nExecute: curl -s -I https://eta.alghamdimo89.workers.dev | head -1 | cut -d' ' -f2\\nExpected: HTTP status code (200, 404, 500, etc.)\\nReturn only the status code",
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
        "instructions": "TASK: Browse to ETA Worker\\nExecute: Start browser and go to https://eta.alghamdimo89.workers.dev\\nCheck if page loads successfully\\nReturn: Page loaded: yes or Page loaded: no",
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
        "instructions": "TASK: Check Hono Worker Deployment Status\\nExecute: curl -s -I https://hono.alghamdimo89.workers.dev | head -1 | cut -d' ' -f2\\nExpected: HTTP status code (200, 404, 500, etc.)\\nReturn only the status code",
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
        "instructions": "TASK: Browse to Hono Worker\\nExecute: Start browser and go to https://hono.alghamdimo89.workers.dev\\nCheck if page loads successfully\\nReturn: Page loaded: yes or Page loaded: no",
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
        "instructions": "TASK: Check DeepSeek Agent Deployment Status\\nExecute: curl -s -I https://deepseek-agent.alghamdimo89.workers.dev | head -1 | cut -d' ' -f2\\nExpected: HTTP status code (200, 404, 500, etc.)\\nReturn only the status code",
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
        "instructions": "TASK: Browse to DeepSeek Agent\\nExecute: Start browser and go to https://deepseek-agent.alghamdimo89.workers.dev\\nCheck if page loads successfully\\nReturn: Page loaded: yes or Page loaded: no",
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
        "instructions": "TASK: Check D1 Database Status\\nExecute: curl -s -X GET https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database -H Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL -H Content-Type: application/json | jq -r '.result | length'\\nExpected: Number of databases (should be 4)\\nReturn: Databases count: X",
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
        "instructions": "TASK: Get Deployment Errors\\nExecute: Check Cloudflare Workers for errors\\ncurl -s -X GET https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/workers/scripts -H Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL -H Content-Type: application/json | jq -r '.result[] | select(.id == eta or .id == hono or .id == deepseek-agent) | .id + :  + (.modified_on // unknown)'\\nExpected: Last modified timestamps\\nReturn: No errors or error details",
        "step_type": "api_call",
        "order_index": 8,
        "page_key": None,
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
    
    print("Inserting 8 new steps...")
    
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
            print(f"SQL: {insert_sql}")
        else:
            print(f"✓ Step {i}: {step['title']}")
    
    print("\n✅ Steps created successfully!")

if __name__ == "__main__":
    main()