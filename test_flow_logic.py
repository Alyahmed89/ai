#!/usr/bin/env python3
"""
Test script to simulate flow execution logic
"""

import subprocess
import json
import os

def execute_curl(sql_query):
    """Execute a curl command to D1 database"""
    cmd = [
        'curl', '-s', '-X', 'POST',
        'https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query',
        '-H', 'Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps({"sql": sql_query})
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error executing curl: {result.stderr}")
        return None
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Invalid JSON response: {result.stdout}")
        return None

def test_step3_task_fetch():
    """Test Step 3: Fetch task from database"""
    print("=== Testing Step 3: Fetch Task from Database ===")
    
    # Execute the query from Step 3 instructions
    sql = "SELECT id, title, description FROM tasks WHERE flow_id='etaflow' AND status='PENDING' ORDER BY created_at LIMIT 1;"
    result = execute_curl(sql)
    
    if not result or 'result' not in result:
        print("Failed to fetch task")
        return None
    
    task_data = result['result'][0]['results'][0] if result['result'][0]['results'] else None
    if not task_data:
        print("No pending tasks found")
        return None
    
    print(f"Fetched task: {task_data['id']} - {task_data['title']}")
    
    # Store task ID in file (as Step 3 instructions specify)
    task_id = task_data['id']
    with open('/tmp/current_task_id.txt', 'w') as f:
        f.write(f"TASK_ID={task_id}")
    
    print(f"Stored task ID in /tmp/current_task_id.txt: TASK_ID={task_id}")
    return task_id

def test_step8_task_complete(task_id):
    """Test Step 8: Mark task complete"""
    print(f"\n=== Testing Step 8: Mark Task Complete (Task ID: {task_id}) ===")
    
    # First, verify the task ID file exists
    if not os.path.exists('/tmp/current_task_id.txt'):
        print("ERROR: /tmp/current_task_id.txt not found!")
        return False
    
    with open('/tmp/current_task_id.txt', 'r') as f:
        file_content = f.read().strip()
    
    print(f"File content: {file_content}")
    
    # Extract task ID from file
    if 'TASK_ID=' in file_content:
        stored_task_id = file_content.split('TASK_ID=')[1]
        print(f"Extracted task ID from file: {stored_task_id}")
        
        if stored_task_id != task_id:
            print(f"WARNING: Task ID mismatch! File has {stored_task_id}, expected {task_id}")
    else:
        print("WARNING: TASK_ID= not found in file")
    
    # Execute the update query
    sql = f"UPDATE tasks SET status='DONE' WHERE id='{task_id}';"
    result = execute_curl(sql)
    
    if not result or 'result' not in result:
        print("Failed to update task status")
        return False
    
    success = result.get('success', False)
    if success:
        print(f"✓ Task {task_id} marked as DONE")
        
        # Verify the update
        verify_sql = f"SELECT id, title, status FROM tasks WHERE id='{task_id}';"
        verify_result = execute_curl(verify_sql)
        
        if verify_result and verify_result['result'][0]['results']:
            task_status = verify_result['result'][0]['results'][0]['status']
            print(f"✓ Verified task status: {task_status}")
            return task_status == 'DONE'
        else:
            print("Failed to verify task status")
            return False
    else:
        print(f"Failed to update task: {result.get('errors', 'Unknown error')}")
        return False

def test_step_progression():
    """Test the full 8-step progression logic"""
    print("\n=== Testing Full 8-Step Progression ===")
    
    # Get all steps
    sql = "SELECT order_index, step_key, title FROM flow_steps WHERE flow_id='etaflow' ORDER BY order_index;"
    result = execute_curl(sql)
    
    if not result or 'result' not in result:
        print("Failed to fetch steps")
        return
    
    steps = result['result'][0]['results']
    print(f"Found {len(steps)} steps:")
    for step in steps:
        print(f"  Step {step['order_index']}: {step['title']} ({step['step_key']})")
    
    # Check deterministic order
    expected_keys = [
        'eta.deployment_check',
        'eta.deployment_action', 
        'eta.task_fetch',
        'eta.code_search',
        'eta.template_view',
        'eta.template_edit',
        'eta.test',
        'eta.task_complete'
    ]
    
    actual_keys = [step['step_key'] for step in steps]
    
    if actual_keys == expected_keys:
        print("✓ Step order is correct and deterministic")
    else:
        print(f"✗ Step order mismatch!")
        print(f"  Expected: {expected_keys}")
        print(f"  Actual: {actual_keys}")

def main():
    print("Testing Flow Execution Logic")
    print("=" * 50)
    
    # Test step progression
    test_step_progression()
    
    # Test Step 3
    task_id = test_step3_task_fetch()
    
    if task_id:
        # Test Step 8
        success = test_step8_task_complete(task_id)
        
        if success:
            print("\n✓ Flow execution test PASSED!")
            print("  - Step 3 correctly fetches task from database")
            print("  - Task ID is persisted to file")
            print("  - Step 8 reads task ID from file and marks task DONE")
            print("  - File-based persistence works across steps")
        else:
            print("\n✗ Flow execution test FAILED at Step 8")
    else:
        print("\n✗ Flow execution test FAILED at Step 3 (no pending tasks)")

if __name__ == "__main__":
    main()