#!/usr/bin/env python3
"""
Minimal test setup for deterministic loop validation.
Creates SQLite database with required tables and inserts test flow.
"""

import sqlite3
import json
import time

def create_test_database():
    """Create SQLite database with required tables and test data."""
    
    # Create in-memory database for demonstration
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    # Create flows table
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
            created_at INTEGER NOT NULL
        )
    ''')
    
    # Create flow_test_data table
    cursor.execute('''
        CREATE TABLE flow_test_data (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
        )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX idx_flow_test_data_flow_id ON flow_test_data(flow_id)')
    cursor.execute('CREATE INDEX idx_flow_test_data_key ON flow_test_data(key)')
    
    # Insert test flow
    test_flow = {
        'id': 'test_flow_001',
        'name': 'Deterministic Loop Test',
        'first_prompt': 'Store test data with key "test_key" and value: {{test_value}}',
        'deepseek_system': 'You are a test assistant. Follow instructions exactly. Return structured JSON when asked.',
        'repo': 'test/repo',
        'branch': 'main',
        'max_iterations': 2,
        'steps': json.dumps([
            {
                'step': 1,
                'prompt': 'Store test data with key "test_key" and value: {{test_value}}',
                'expected_response': 'DATA_READY',
                'success_criteria': 'row_exists_in_flow_test_data'
            },
            {
                'step': 2,
                'prompt': 'Echo back retrieved data',
                'success_criteria': 'deepseek_response_contains_exact_stored_value'
            }
        ]),
        'created_at': int(time.time())
    }
    
    cursor.execute('''
        INSERT INTO flows (id, name, first_prompt, deepseek_system, repo, branch, max_iterations, steps, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        test_flow['id'],
        test_flow['name'],
        test_flow['first_prompt'],
        test_flow['deepseek_system'],
        test_flow['repo'],
        test_flow['branch'],
        test_flow['max_iterations'],
        test_flow['steps'],
        test_flow['created_at']
    ))
    
    # Verify insertion
    cursor.execute('SELECT COUNT(*) FROM flows')
    flow_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT name, first_prompt FROM flows WHERE id = ?', ('test_flow_001',))
    flow_data = cursor.fetchone()
    
    print("✅ STEP 1 COMPLETE")
    print(f"Tables created: flows, flow_test_data")
    print(f"Flow inserted: {flow_count} flow(s) in database")
    print(f"Flow details: name='{flow_data[0]}', first_prompt='{flow_data[1][:50]}...'")
    
    # Show steps structure
    cursor.execute('SELECT steps FROM flows WHERE id = ?', ('test_flow_001',))
    steps_json = cursor.fetchone()[0]
    steps = json.loads(steps_json)
    print(f"\nFlow steps configured:")
    for step in steps:
        print(f"  Step {step['step']}: {step['prompt'][:40]}...")
        print(f"    Expected response: {step.get('expected_response', 'N/A')}")
        print(f"    Success criteria: {step.get('success_criteria', 'N/A')}")
    
    conn.commit()
    conn.close()
    
    return True

if __name__ == '__main__':
    create_test_database()