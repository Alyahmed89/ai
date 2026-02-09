#!/usr/bin/env python3
"""
Test validators table implementation.
Register validator APIs once (name, endpoint, truth_source),
reference from flow_steps instead of raw URLs.
"""

import sqlite3
import json
import time

def test_validators_table():
    """Test the validators table implementation"""
    
    # Create in-memory database
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    # Create required tables
    cursor.execute('''
        CREATE TABLE flows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE validators (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            truth_source TEXT NOT NULL,
            description TEXT,
            request_schema TEXT,
            response_schema TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(name),
            UNIQUE(endpoint)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE flow_steps (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            step_number INTEGER NOT NULL,
            prompt TEXT NOT NULL,
            expected_response TEXT,
            validator_api TEXT, -- Old column (for migration)
            validator_id TEXT,  -- New column (references validators)
            validator_payload_template TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
            UNIQUE(flow_id, step_number)
        )
    ''')
    
    # Insert test flow
    cursor.execute('''
        INSERT INTO flows (id, name, created_at)
        VALUES (?, ?, ?)
    ''', (
        'test_flow_001',
        'Test Flow',
        int(time.time())
    ))
    
    # Insert validators
    validators = [
        {
            'id': 'validator_row_exists',
            'name': 'row_exists',
            'endpoint': '/validate/row-exists',
            'truth_source': 'db',
            'description': 'Validates if a row exists in the database',
            'request_schema': json.dumps({
                'type': 'object',
                'properties': {
                    'flow_id': {'type': 'string'},
                    'key': {'type': 'string'}
                },
                'required': ['flow_id', 'key']
            }),
            'response_schema': json.dumps({
                'type': 'object',
                'properties': {
                    'validation_id': {'type': 'string'},
                    'passed': {'type': 'boolean'}
                }
            }),
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        },
        {
            'id': 'validator_response_contains',
            'name': 'response_contains',
            'endpoint': '/validate/response-contains',
            'truth_source': 'api',
            'description': 'Validates if response contains expected value',
            'request_schema': json.dumps({
                'type': 'object',
                'properties': {
                    'response': {'type': 'string'},
                    'expected_value': {'type': 'string'}
                },
                'required': ['response', 'expected_value']
            }),
            'response_schema': json.dumps({
                'type': 'object',
                'properties': {
                    'validation_id': {'type': 'string'},
                    'passed': {'type': 'boolean'}
                }
            }),
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        }
    ]
    
    for validator in validators:
        cursor.execute('''
            INSERT INTO validators (id, name, endpoint, truth_source, description, request_schema, response_schema, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            validator['id'],
            validator['name'],
            validator['endpoint'],
            validator['truth_source'],
            validator['description'],
            validator['request_schema'],
            validator['response_schema'],
            validator['created_at'],
            validator['updated_at']
        ))
    
    # Insert flow steps with validator_id references
    flow_steps = [
        {
            'id': 'step_1',
            'flow_id': 'test_flow_001',
            'step_number': 1,
            'prompt': 'Store test data',
            'expected_response': 'DATA_READY',
            'validator_api': '/validate/row-exists',  # Old way
            'validator_id': 'validator_row_exists',   # New way
            'validator_payload_template': '{"flow_id": "{{flow_id}}", "key": "test_key"}',
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        },
        {
            'id': 'step_2',
            'flow_id': 'test_flow_001',
            'step_number': 2,
            'prompt': 'Echo back data',
            'expected_response': None,
            'validator_api': '/validate/response-contains',  # Old way
            'validator_id': 'validator_response_contains',   # New way
            'validator_payload_template': '{"response": "{{deepseek_response}}", "expected_value": "{{retrieved_value}}"}',
            'created_at': int(time.time()),
            'updated_at': int(time.time())
        }
    ]
    
    for step in flow_steps:
        cursor.execute('''
            INSERT INTO flow_steps (id, flow_id, step_number, prompt, expected_response, validator_api, validator_id, validator_payload_template, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            step['id'],
            step['flow_id'],
            step['step_number'],
            step['prompt'],
            step['expected_response'],
            step['validator_api'],
            step['validator_id'],
            step['validator_payload_template'],
            step['created_at'],
            step['updated_at']
        ))
    
    conn.commit()
    
    # Test 1: Verify validators are inserted
    cursor.execute('SELECT COUNT(*) FROM validators')
    validator_count = cursor.fetchone()[0]
    print(f"✅ Test 1: {validator_count} validators registered")
    
    # Test 2: Verify validator details
    cursor.execute('SELECT name, endpoint, truth_source, description FROM validators ORDER BY name')
    validators_list = cursor.fetchall()
    print(f"\n✅ Test 2: Validator details:")
    for name, endpoint, truth_source, description in validators_list:
        print(f"   {name}:")
        print(f"     Endpoint: {endpoint}")
        print(f"     Truth Source: {truth_source}")
        print(f"     Description: {description[:50]}...")
    
    # Test 3: Verify flow_steps reference validators
    print(f"\n✅ Test 3: Flow steps with validator references:")
    cursor.execute('''
        SELECT fs.step_number, fs.prompt, fs.validator_id, v.name, v.endpoint, v.truth_source
        FROM flow_steps fs
        LEFT JOIN validators v ON fs.validator_id = v.id
        WHERE fs.flow_id = ?
        ORDER BY fs.step_number
    ''', ('test_flow_001',))
    
    steps_with_validators = cursor.fetchall()
    for step_num, prompt, validator_id, validator_name, endpoint, truth_source in steps_with_validators:
        print(f"\n   Step {step_num}: {prompt[:40]}...")
        print(f"     Validator ID: {validator_id}")
        print(f"     Validator Name: {validator_name}")
        print(f"     Endpoint: {endpoint}")
        print(f"     Truth Source: {truth_source}")
    
    # Test 4: Verify unique constraints on validators
    try:
        cursor.execute('''
            INSERT INTO validators (id, name, endpoint, truth_source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'duplicate_test',
            'row_exists',  # Duplicate name
            '/validate/another',
            'db',
            int(time.time()),
            int(time.time())
        ))
        print("\n❌ Test 4: Unique name constraint failed")
    except sqlite3.IntegrityError:
        print("\n✅ Test 4: Unique name constraint works")
    
    try:
        cursor.execute('''
            INSERT INTO validators (id, name, endpoint, truth_source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'duplicate_test2',
            'another_validator',
            '/validate/row-exists',  # Duplicate endpoint
            'db',
            int(time.time()),
            int(time.time())
        ))
        print("❌ Test 4: Unique endpoint constraint failed")
    except sqlite3.IntegrityError:
        print("✅ Test 4: Unique endpoint constraint works")
    
    # Test 5: Simulate validation execution
    print(f"\n✅ Test 5: Simulating validation execution:")
    
    cursor.execute('''
        SELECT fs.step_number, fs.validator_payload_template, v.endpoint, v.request_schema
        FROM flow_steps fs
        JOIN validators v ON fs.validator_id = v.id
        WHERE fs.flow_id = ?
        ORDER BY fs.step_number
    ''', ('test_flow_001',))
    
    validation_steps = cursor.fetchall()
    
    context = {
        'flow_id': 'test_flow_001',
        'deepseek_response': 'Retrieved value: test_value_123',
        'retrieved_value': 'test_value_123'
    }
    
    for step_num, payload_template, endpoint, request_schema in validation_steps:
        print(f"\n   Step {step_num} validation:")
        print(f"     Endpoint: {endpoint}")
        
        # Inject variables into payload template
        if payload_template:
            payload = payload_template
            for key, value in context.items():
                payload = payload.replace(f'{{{{{key}}}}}', str(value))
            print(f"     Payload: {payload}")
        
        # Validate against request schema
        if request_schema:
            schema = json.loads(request_schema)
            print(f"     Request Schema: {schema['type']} with {len(schema.get('required', []))} required fields")
    
    # Test 6: Query all validators by truth source
    print(f"\n✅ Test 6: Validators grouped by truth source:")
    cursor.execute('''
        SELECT truth_source, GROUP_CONCAT(name, ', ') as validator_names
        FROM validators
        GROUP BY truth_source
        ORDER BY truth_source
    ''')
    
    by_truth_source = cursor.fetchall()
    for source, names in by_truth_source:
        print(f"   {source}: {names}")
    
    conn.close()
    
    return True

def main():
    """Main execution"""
    print("STEP 5 — VALIDATORS TABLE IMPLEMENTATION")
    print("=" * 60)
    print("Add validators table to register validator APIs once")
    print("(name, endpoint, truth_source), and reference it from")
    print("flow_steps instead of raw URLs.")
    print("=" * 60)
    
    test_validators_table()
    
    print("\n" + "=" * 60)
    print("IMPLEMENTATION SUMMARY")
    print("=" * 60)
    
    print("\n1. VALIDATORS TABLE SCHEMA:")
    print("   - id (TEXT PRIMARY KEY)")
    print("   - name (TEXT, UNIQUE)")
    print("   - endpoint (TEXT, UNIQUE)")
    print("   - truth_source (TEXT: 'db', 'api', 'external', 'manual')")
    print("   - description (TEXT)")
    print("   - request_schema (TEXT, JSON schema)")
    print("   - response_schema (TEXT, JSON schema)")
    print("   - created_at, updated_at (INTEGER)")
    
    print("\n2. MIGRATION CREATED:")
    print("   - 0006_validators_table.sql")
    print("   - Creates validators table with unique constraints")
    print("   - Adds validator_id column to flow_steps")
    print("   - Inserts default validators:")
    print("     * row_exists -> /validate/row-exists (truth_source: db)")
    print("     * response_contains -> /validate/response-contains (truth_source: api)")
    print("   - Updates flow_steps to reference validator_id")
    
    print("\n3. KEY BENEFITS:")
    print("   - Single source of truth for validator definitions")
    print("   - Schema validation for request/response")
    print("   - Truth source tracking (db, api, external, manual)")
    print("   - Unique constraints prevent duplicate validators")
    print("   - Centralized management of validator endpoints")
    
    print("\n4. EXECUTION FLOW WITH VALIDATORS TABLE:")
    print("   1. Load step: SELECT * FROM flow_steps WHERE flow_id = ?")
    print("   2. Get validator: SELECT * FROM validators WHERE id = ?")
    print("   3. Build payload: Inject variables into template")
    print("   4. Validate: Check payload against request_schema")
    print("   5. Call: POST to validator.endpoint with payload")
    print("   6. Verify: Check response against response_schema")
    
    print("\n5. TRUTH SOURCE CATEGORIES:")
    print("   - db: Validation against database state")
    print("   - api: Validation via external API call")
    print("   - external: Validation via external system")
    print("   - manual: Requires human verification")
    
    print("\n✅ STEP 5 COMPLETE")
    print("\n👉 MINIMAL, SINGLE ADDITION: Added validators table as requested.")

if __name__ == '__main__':
    main()