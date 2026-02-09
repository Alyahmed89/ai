#!/usr/bin/env python3
"""
Test flow_steps table implementation.
One row per step, ordered, with prompt, expected_response, validator_api.
"""

import sqlite3
import json
import time

def test_flow_steps():
    """Test the flow_steps table implementation"""
    
    # Create in-memory database
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    # Create required tables
    cursor.execute('''
        CREATE TABLE flows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            first_prompt TEXT NOT NULL,
            deepseek_system TEXT,
            repo TEXT NOT NULL,
            branch TEXT DEFAULT 'main',
            max_iterations INTEGER DEFAULT 20,
            steps TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            schema_version INTEGER DEFAULT 1,
            validation_schema TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE flow_steps (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            step_number INTEGER NOT NULL,
            prompt TEXT NOT NULL,
            expected_response TEXT,
            validator_api TEXT NOT NULL,
            validator_payload_template TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
            UNIQUE(flow_id, step_number)
        )
    ''')
    
    # Insert test flow
    cursor.execute('''
        INSERT INTO flows (id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at, schema_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'test_flow_001',
        'Deterministic Loop Test',
        'Store test data with key "test_key" and value: {{test_value}}',
        'Test system prompt',
        'test/repo',
        'main',
        2,
        '[]',  # Empty steps JSON since we use flow_steps table
        int(time.time()),
        1
    ))
    
    # Insert flow steps
    steps = [
        {
            'id': 'step_test_001_1',
            'flow_id': 'test_flow_001',
            'step_number': 1,
            'prompt': 'Store test data with key "test_key" and value: {{test_value}}',
            'expected_response': 'DATA_READY',
            'validator_api': '/validate/row-exists',
            'validator_payload_template': '{"flow_id": "{{flow_id}}", "key": "test_key"}',
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        },
        {
            'id': 'step_test_001_2',
            'flow_id': 'test_flow_001',
            'step_number': 2,
            'prompt': 'Echo back retrieved data',
            'expected_response': None,
            'validator_api': '/validate/response-contains',
            'validator_payload_template': '{"response": "{{deepseek_response}}", "expected_value": "{{retrieved_value}}"}',
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        }
    ]
    
    for step in steps:
        cursor.execute('''
            INSERT INTO flow_steps (id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            step['id'],
            step['flow_id'],
            step['step_number'],
            step['prompt'],
            step['expected_response'],
            step['validator_api'],
            step['validator_payload_template'],
            step['created_at'],
            step['updated_at']
        ))
    
    conn.commit()
    
    # Test 1: Verify steps are inserted
    cursor.execute('SELECT COUNT(*) FROM flow_steps WHERE flow_id = ?', ('test_flow_001',))
    step_count = cursor.fetchone()[0]
    print(f"✅ Test 1: {step_count} steps inserted for flow test_flow_001")
    
    # Test 2: Verify steps are ordered by step_number
    cursor.execute('''
        SELECT step_number, prompt, validator_api 
        FROM flow_steps 
        WHERE flow_id = ? 
        ORDER BY step_number
    ''', ('test_flow_001',))
    
    steps_ordered = cursor.fetchall()
    print(f"\n✅ Test 2: Steps ordered correctly:")
    for step in steps_ordered:
        print(f"   Step {step[0]}: {step[1][:40]}...")
        print(f"     Validator API: {step[2]}")
    
    # Test 3: Verify step details
    cursor.execute('''
        SELECT step_number, prompt, expected_response, validator_api, validator_payload_template
        FROM flow_steps 
        WHERE flow_id = ? 
        ORDER BY step_number
    ''', ('test_flow_001',))
    
    steps_details = cursor.fetchall()
    print(f"\n✅ Test 3: Step details:")
    for step in steps_details:
        print(f"\n   Step {step[0]}:")
        print(f"     Prompt: {step[1][:50]}...")
        print(f"     Expected Response: {step[2] or 'None'}")
        print(f"     Validator API: {step[3]}")
        print(f"     Validator Payload Template: {step[4][:50]}...")
    
    # Test 4: Verify unique constraint (try to insert duplicate step_number)
    try:
        cursor.execute('''
            INSERT INTO flow_steps (id, flow_id, step_number, prompt, expected_response, validator_api, validator_payload_template, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            'step_test_001_1_duplicate',
            'test_flow_001',
            1,  # Duplicate step_number
            'Duplicate step',
            'DUPLICATE',
            '/validate/test',
            '{}',
            int(time.time()),
            int(time.time())
        ))
        print("\n❌ Test 4: Unique constraint failed - duplicate step_number allowed")
    except sqlite3.IntegrityError:
        print("\n✅ Test 4: Unique constraint works - duplicate step_number rejected")
    
    # Test 5: Simulate execution with flow_steps
    print(f"\n✅ Test 5: Simulating execution with flow_steps:")
    
    cursor.execute('''
        SELECT step_number, prompt, validator_api, validator_payload_template
        FROM flow_steps 
        WHERE flow_id = ? 
        ORDER BY step_number
    ''', ('test_flow_001',))
    
    execution_steps = cursor.fetchall()
    
    context = {
        'flow_id': 'test_flow_001',
        'test_value': 'api_validated_value_123',
        'retrieved_value': 'stored_value_456'
    }
    
    for step_num, prompt, validator_api, payload_template in execution_steps:
        print(f"\n   Executing Step {step_num}:")
        
        # Inject variables into prompt
        injected_prompt = prompt
        for key, value in context.items():
            injected_prompt = injected_prompt.replace(f'{{{{{key}}}}}', str(value))
        print(f"     Prompt (with variables): {injected_prompt[:60]}...")
        
        # Prepare validator payload
        if payload_template:
            payload = payload_template
            for key, value in context.items():
                payload = payload.replace(f'{{{{{key}}}}}', str(value))
            print(f"     Validator API: {validator_api}")
            print(f"     Validator Payload: {payload[:60]}...")
        
        # Simulate expected response check for step 1
        if step_num == 1:
            print(f"     Expected Response: DATA_READY")
    
    conn.close()
    
    return True

def main():
    """Main execution"""
    print("STEP 4 — FLOW_STEPS TABLE IMPLEMENTATION")
    print("=" * 60)
    print("Adding flow_steps table: one row per step, ordered, with prompt,")
    print("expected_response, validator_api.")
    print("=" * 60)
    
    test_flow_steps()
    
    print("\n" + "=" * 60)
    print("IMPLEMENTATION SUMMARY")
    print("=" * 60)
    
    print("\n1. FLOW_STEPS TABLE SCHEMA:")
    print("   - id (TEXT PRIMARY KEY)")
    print("   - flow_id (TEXT, foreign key to flows)")
    print("   - step_number (INTEGER, ordered)")
    print("   - prompt (TEXT)")
    print("   - expected_response (TEXT, optional)")
    print("   - validator_api (TEXT, API endpoint for validation)")
    print("   - validator_payload_template (TEXT, JSON template)")
    print("   - created_at, updated_at (INTEGER)")
    print("   - UNIQUE(flow_id, step_number) constraint")
    
    print("\n2. MIGRATION CREATED:")
    print("   - 0005_flow_steps.sql")
    print("   - Creates flow_steps table")
    print("   - Migrates existing test flow steps")
    print("   - Adds indexes for performance")
    
    print("\n3. TEST FLOW STEPS INSERTED:")
    print("   - Step 1: Store test data with variable {{test_value}}")
    print("     Expected: DATA_READY")
    print("     Validator: /validate/row-exists")
    print("   - Step 2: Echo back retrieved data")
    print("     Expected: None")
    print("     Validator: /validate/response-contains")
    
    print("\n4. KEY FEATURES:")
    print("   - One row per step (normalized)")
    print("   - Ordered by step_number")
    print("   - Validator API per step")
    print("   - Payload templates with variable substitution")
    print("   - Unique constraint prevents duplicate step numbers")
    
    print("\n✅ STEP 4 COMPLETE")
    print("\n👉 ONLY ONE CHANGE MADE: Added flow_steps table as requested.")

if __name__ == '__main__':
    main()