#!/usr/bin/env python3
"""
Create exact flow from the user's table with conditional branching
"""

import json
import subprocess

# Define steps exactly as in the table
steps = [
    # Step 1: Check Deployment (Pages – D1 project)
    {
        "id": "step1",
        "flow_id": "etaflow",
        "step_key": "check_deployment_d1",
        "title": "Check Deployment (Pages – D1 project)",
        "instructions": "Check D1 project deployment status via Cloudflare Pages API",
        "step_type": "api_call",
        "order_index": 1,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 2: Get Deployment Errors (Pages – D1)
    {
        "id": "step2",
        "flow_id": "etaflow",
        "step_key": "get_deployment_errors",
        "title": "Get Deployment Errors (Pages – D1)",
        "instructions": "Get deployment errors if Step 1 failed",
        "step_type": "api_call",
        "order_index": 2,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 3: Browse Current State (Pages URL)
    {
        "id": "step3",
        "flow_id": "etaflow",
        "step_key": "browse_current_state",
        "title": "Browse Current State (Pages URL)",
        "instructions": "Browse to Pages deployment URL to see current state",
        "step_type": "browser",
        "order_index": 3,
        "page_key": "pages_state",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 4: Fetch Task
    {
        "id": "step4",
        "flow_id": "etaflow",
        "step_key": "fetch_task",
        "title": "Fetch Task",
        "instructions": "Fetch next task from database",
        "step_type": "database",
        "order_index": 4,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 5: Search Generated Code (D1 repo path)
    {
        "id": "step5",
        "flow_id": "etaflow",
        "step_key": "search_generated_code",
        "title": "Search Generated Code (D1 repo path)",
        "instructions": "Search for generated code in D1 repository path",
        "step_type": "execution",
        "order_index": 5,
        "page_key": "code_search",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 6: View Template (.eta source)
    {
        "id": "step6",
        "flow_id": "etaflow",
        "step_key": "view_template",
        "title": "View Template (.eta source)",
        "instructions": "View .eta template source files",
        "step_type": "execution",
        "order_index": 6,
        "page_key": "template_view",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 7: Gap Analysis (Root Cause Decision)
    {
        "id": "step7",
        "flow_id": "etaflow",
        "step_key": "gap_analysis",
        "title": "Gap Analysis (Root Cause Decision)",
        "instructions": "Analyze gap and decide root cause: frontend (.eta/D1) issue, backend (hono) issue, or no change needed",
        "step_type": "analysis",
        "order_index": 7,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 8: Edit .eta Template
    {
        "id": "step8",
        "flow_id": "etaflow",
        "step_key": "edit_eta_template",
        "title": "Edit .eta Template",
        "instructions": "Edit .eta template files for frontend fixes",
        "step_type": "execution",
        "order_index": 8,
        "page_key": "template_edit",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 9: Recompile Templates
    {
        "id": "step9",
        "flow_id": "etaflow",
        "step_key": "recompile_templates",
        "title": "Recompile Templates",
        "instructions": "Recompile .eta templates",
        "step_type": "execution",
        "order_index": 9,
        "page_key": "template_compile",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 10: Regenerate + Copy Code → D1 repo path
    {
        "id": "step10",
        "flow_id": "etaflow",
        "step_key": "regenerate_copy_code",
        "title": "Regenerate + Copy Code → D1 repo path",
        "instructions": "Regenerate code from templates and copy to D1 repository path",
        "step_type": "execution",
        "order_index": 10,
        "page_key": "code_regenerate",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 11: Commit → D1 repo
    {
        "id": "step11",
        "flow_id": "etaflow",
        "step_key": "commit_d1_repo",
        "title": "Commit → D1 repo",
        "instructions": "Commit changes to D1 repository",
        "step_type": "execution",
        "order_index": 11,
        "page_key": "d1_commit",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 12: Wait Deployment (Pages – D1)
    {
        "id": "step12",
        "flow_id": "etaflow",
        "step_key": "wait_deployment_pages",
        "title": "Wait Deployment (Pages – D1)",
        "instructions": "Wait for Pages deployment to complete",
        "step_type": "api_call",
        "order_index": 12,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 14: Pull hono Repo
    {
        "id": "step14",
        "flow_id": "etaflow",
        "step_key": "pull_hono_repo",
        "title": "Pull hono Repo",
        "instructions": "Pull hono repository for backend fixes",
        "step_type": "execution",
        "order_index": 14,
        "page_key": "hono_pull",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 15: Search Backend Code
    {
        "id": "step15",
        "flow_id": "etaflow",
        "step_key": "search_backend_code",
        "title": "Search Backend Code",
        "instructions": "Search for backend code in hono repository",
        "step_type": "execution",
        "order_index": 15,
        "page_key": "backend_search",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 16: Fix Backend Code
    {
        "id": "step16",
        "flow_id": "etaflow",
        "step_key": "fix_backend_code",
        "title": "Fix Backend Code",
        "instructions": "Fix backend code in hono repository",
        "step_type": "execution",
        "order_index": 16,
        "page_key": "backend_fix",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 17: Commit → hono repo
    {
        "id": "step17",
        "flow_id": "etaflow",
        "step_key": "commit_hono_repo",
        "title": "Commit → hono repo",
        "instructions": "Commit changes to hono repository",
        "step_type": "execution",
        "order_index": 17,
        "page_key": "hono_commit",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 18: Retest via Pages Deployment
    {
        "id": "step18",
        "flow_id": "etaflow",
        "step_key": "retest_pages_deployment",
        "title": "Retest via Pages Deployment",
        "instructions": "Retest via Pages deployment (NOT local eta)",
        "step_type": "api_call",
        "order_index": 18,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 19: Mark Task Complete
    {
        "id": "step19",
        "flow_id": "etaflow",
        "step_key": "mark_task_complete",
        "title": "Mark Task Complete",
        "instructions": "Mark task as complete in database",
        "step_type": "database",
        "order_index": 19,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 20: Commit → eta repo (if modified)
    {
        "id": "step20",
        "flow_id": "etaflow",
        "step_key": "commit_eta_repo",
        "title": "Commit → eta repo (if modified)",
        "instructions": "Commit changes to eta repository if modified",
        "step_type": "execution",
        "order_index": 20,
        "page_key": "eta_commit",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 21: Commit → hono repo (if modified)
    {
        "id": "step21",
        "flow_id": "etaflow",
        "step_key": "commit_hono_repo_again",
        "title": "Commit → hono repo (if modified)",
        "instructions": "Commit changes to hono repository if modified",
        "step_type": "execution",
        "order_index": 21,
        "page_key": "hono_commit_again",
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    },
    # Step 22: Check Deployment (ETA Worker)
    {
        "id": "step22",
        "flow_id": "etaflow",
        "step_key": "check_deployment_eta_worker",
        "title": "Check Deployment (ETA Worker)",
        "instructions": "Check ETA Worker deployment status",
        "step_type": "api_call",
        "order_index": 22,
        "page_key": None,
        "blocking": 1,
        "auto_fail_on_error": 1,
        "retryable": 1
    }
]

def main():
    print("Creating exact flow from table with conditional branching...")
    
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
    
    print("Inserting new steps...")
    
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
            print(f"Error inserting step {step['order_index']}: {result.stderr}")
        else:
            print(f"✓ Step {step['order_index']}: {step['title']}")
    
    print("\n✅ Exact flow created successfully!")
    print("\nFLOW STRUCTURE FROM TABLE:")
    print("1. Check Deployment (Pages – D1 project)")
    print("   - Failed → 2: Get Deployment Errors")
    print("   - Success → 3: Browse Current State")
    print("2. Get Deployment Errors → 3")
    print("3. Browse Current State → 4")
    print("4. Fetch Task → 5 (if found)")
    print("5. Search Generated Code → 6")
    print("6. View Template → 7")
    print("7. Gap Analysis:")
    print("   - Frontend issue → 8")
    print("   - Backend issue → 14")
    print("   - No change needed → 18")
    print("8. Edit .eta Template → 9")
    print("9. Recompile Templates → 10")
    print("10. Regenerate + Copy Code → 11")
    print("11. Commit → D1 repo → 12")
    print("12. Wait Deployment:")
    print("   - Success → 18")
    print("   - Failed → 2")
    print("14. Pull hono Repo → 15")
    print("15. Search Backend Code → 16")
    print("16. Fix Backend Code → 17")
    print("17. Commit → hono repo → 18")
    print("18. Retest via Pages Deployment:")
    print("   - Backend issue → 14")
    print("   - Frontend issue → 8")
    print("   - All pass → 19")
    print("19. Mark Task Complete → 20")
    print("20. Commit → eta repo → 21")
    print("21. Commit → hono repo → 22")
    print("22. Check Deployment (ETA Worker):")
    print("   - Failed → 2")
    print("   - Success → END")

if __name__ == "__main__":
    main()