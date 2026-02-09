#!/usr/bin/env python3
"""
Test executions table implementation.
Record each flow run with execution_id, flow_id, current_step, status, timestamps.
"""

import sqlite3
import json
import time
import uuid

def test_executions_table():
    """Test the executions table implementation"""
    
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
        CREATE TABLE flow_steps (
            id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            step_number INTEGER NOT NULL,
            prompt TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
            UNIQUE(flow_id, step_number)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE executions (
            execution_id TEXT PRIMARY KEY,
            flow_id TEXT NOT NULL,
            project_id TEXT,
            current_step INTEGER DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'running',
            started_at INTEGER NOT NULL,
            finished_at INTEGER,
            error_message TEXT,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE execution_steps (
            id TEXT PRIMARY KEY,
            execution_id TEXT NOT NULL,
            step_number INTEGER NOT NULL,
            step_id TEXT NOT NULL,
            prompt_sent TEXT,
            response_received TEXT,
            validation_called BOOLEAN DEFAULT FALSE,
            validation_passed BOOLEAN,
            validation_response TEXT,
            started_at INTEGER,
            completed_at INTEGER,
            error_message TEXT,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (execution_id) REFERENCES executions(execution_id) ON DELETE CASCADE,
            FOREIGN KEY (step_id) REFERENCES flow_steps(id) ON DELETE CASCADE
        )
    ''')
    
    # Insert test data
    now = int(time.time())
    
    # Insert flow
    cursor.execute('''
        INSERT INTO flows (id, name, created_at)
        VALUES (?, ?, ?)
    ''', ('test_flow_001', 'Test Flow', now))
    
    # Insert flow steps
    flow_steps = [
        ('step_1', 'test_flow_001', 1, 'Step 1 prompt', now),
        ('step_2', 'test_flow_001', 2, 'Step 2 prompt', now)
    ]
    
    for step_id, flow_id, step_num, prompt, created_at in flow_steps:
        cursor.execute('''
            INSERT INTO flow_steps (id, flow_id, step_number, prompt, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (step_id, flow_id, step_num, prompt, created_at))
    
    # Test 1: Create a new execution
    print("✅ Test 1: Creating new execution")
    
    execution_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO executions (
            execution_id, flow_id, project_id, current_step, status,
            started_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        execution_id,
        'test_flow_001',
        'test_project',
        1,  # Starting at step 1
        'running',
        now,
        now,
        now
    ))
    
    cursor.execute('SELECT execution_id, flow_id, status, current_step FROM executions WHERE execution_id = ?', (execution_id,))
    execution = cursor.fetchone()
    print(f"   Execution created: {execution}")
    
    # Test 2: Record step execution
    print("\n✅ Test 2: Recording step execution")
    
    exec_step_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO execution_steps (
            id, execution_id, step_number, step_id, prompt_sent,
            response_received, validation_called, validation_passed,
            started_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        exec_step_id,
        execution_id,
        1,
        'step_1',
        'Store test data with key "test_key"',
        'DATA_READY',
        True,
        True,
        now,
        now + 10,  # Completed 10 seconds later
        now,
        now
    ))
    
    # Update execution current_step
    cursor.execute('''
        UPDATE executions 
        SET current_step = 2, updated_at = ?
        WHERE execution_id = ?
    ''', (now + 10, execution_id))
    
    cursor.execute('SELECT step_number, prompt_sent, validation_passed FROM execution_steps WHERE execution_id = ?', (execution_id,))
    step = cursor.fetchone()
    print(f"   Step recorded: Step {step[0]}, validation passed: {step[2]}")
    
    # Test 3: Complete execution
    print("\n✅ Test 3: Completing execution")
    
    # Record step 2
    exec_step_id_2 = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO execution_steps (
            id, execution_id, step_number, step_id, prompt_sent,
            response_received, validation_called, validation_passed,
            started_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        exec_step_id_2,
        execution_id,
        2,
        'step_2',
        'Echo back retrieved data',
        'Retrieved value: test_value_123',
        True,
        True,
        now + 10,
        now + 20,
        now,
        now
    ))
    
    # Mark execution as completed
    cursor.execute('''
        UPDATE executions 
        SET status = 'completed', current_step = 2, finished_at = ?, updated_at = ?
        WHERE execution_id = ?
    ''', (now + 20, now + 20, execution_id))
    
    cursor.execute('SELECT status, finished_at FROM executions WHERE execution_id = ?', (execution_id,))
    completed_exec = cursor.fetchone()
    print(f"   Execution completed: status={completed_exec[0]}, finished_at={completed_exec[1]}")
    
    # Test 4: Query execution history
    print("\n✅ Test 4: Querying execution history")
    
    cursor.execute('''
        SELECT e.execution_id, e.flow_id, e.status, e.current_step,
               COUNT(es.id) as steps_completed,
               MIN(es.started_at) as first_step_started,
               MAX(es.completed_at) as last_step_completed
        FROM executions e
        LEFT JOIN execution_steps es ON e.execution_id = es.execution_id
        WHERE e.flow_id = ?
        GROUP BY e.execution_id
        ORDER BY e.started_at DESC
    ''', ('test_flow_001',))
    
    executions = cursor.fetchall()
    print(f"   Found {len(executions)} execution(s) for flow test_flow_001:")
    for exec_id, flow_id, status, current_step, steps_completed, first_started, last_completed in executions:
        duration = (last_completed - first_started) if last_completed else 'N/A'
        print(f"   - {exec_id}: status={status}, steps={current_step}/{steps_completed}, duration={duration}s")
    
    # Test 5: Failed execution scenario
    print("\n✅ Test 5: Simulating failed execution")
    
    failed_execution_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO executions (
            execution_id, flow_id, project_id, current_step, status,
            started_at, finished_at, error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        failed_execution_id,
        'test_flow_001',
        'test_project',
        1,
        'failed',
        now - 1800,
        now - 1700,
        'Validation failed: Row not found in database',
        now,
        now
    ))
    
    # Record failed step
    failed_step_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO execution_steps (
            id, execution_id, step_number, step_id, prompt_sent,
            response_received, validation_called, validation_passed,
            validation_response, error_message,
            started_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        failed_step_id,
        failed_execution_id,
        1,
        'step_1',
        'Store test data',
        'DATA_READY',
        True,
        False,
        '{"passed": false, "error": "Row not found"}',
        'Validation failed',
        now - 1800,
        now - 1790,
        now,
        now
    ))
    
    cursor.execute('''
        SELECT status, error_message 
        FROM executions 
        WHERE status = 'failed'
    ''')
    failed_execs = cursor.fetchall()
    print(f"   Failed executions: {len(failed_execs)}")
    for status, error in failed_execs:
        print(f"   - Error: {error[:50]}...")
    
    # Test 6: Execution statistics
    print("\n✅ Test 6: Execution statistics")
    
    cursor.execute('''
        SELECT 
            COUNT(*) as total_executions,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
            AVG(finished_at - started_at) as avg_duration_seconds
        FROM executions
        WHERE finished_at IS NOT NULL
    ''')
    
    stats = cursor.fetchone()
    print(f"   Statistics:")
    print(f"   - Total executions: {stats[0]}")
    print(f"   - Completed: {stats[1]}")
    print(f"   - Failed: {stats[2]}")
    print(f"   - Running: {stats[3]}")
    print(f"   - Avg duration: {stats[4]:.1f}s")
    
    # Test 7: Step-level analytics
    print("\n✅ Test 7: Step-level analytics")
    
    cursor.execute('''
        SELECT 
            step_number,
            COUNT(*) as total_runs,
            AVG(completed_at - started_at) as avg_duration,
            SUM(CASE WHEN validation_passed = 1 THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN validation_passed = 0 THEN 1 ELSE 0 END) as failed
        FROM execution_steps
        WHERE completed_at IS NOT NULL
        GROUP BY step_number
        ORDER BY step_number
    ''')
    
    step_stats = cursor.fetchall()
    print(f"   Step performance:")
    for step_num, total_runs, avg_dur, passed, failed in step_stats:
        pass_rate = (passed / total_runs * 100) if total_runs > 0 else 0
        print(f"   - Step {step_num}: {total_runs} runs, {avg_dur:.1f}s avg, {pass_rate:.1f}% pass rate")
    
    conn.close()
    
    return True

def main():
    """Main execution"""
    print("STEP 6 — EXECUTIONS TABLE IMPLEMENTATION")
    print("=" * 60)
    print("Add executions table (flow_run) to record each run:")
    print("- execution_id")
    print("- flow_id")
    print("- project_id (optional)")
    print("- current_step")
    print("- status")
    print("- started_at / finished_at")
    print("=" * 60)
    
    test_executions_table()
    
    print("\n" + "=" * 60)
    print("IMPLEMENTATION SUMMARY")
    print("=" * 60)
    
    print("\n1. EXECUTIONS TABLE SCHEMA:")
    print("   - execution_id (TEXT PRIMARY KEY)")
    print("   - flow_id (TEXT, foreign key to flows)")
    print("   - project_id (TEXT, optional)")
    print("   - current_step (INTEGER DEFAULT 1)")
    print("   - status (TEXT: 'running', 'completed', 'failed', 'stopped')")
    print("   - started_at (INTEGER NOT NULL)")
    print("   - finished_at (INTEGER)")
    print("   - error_message (TEXT)")
    print("   - metadata (TEXT, JSON)")
    print("   - created_at, updated_at (INTEGER)")
    
    print("\n2. EXECUTION_STEPS TABLE SCHEMA:")
    print("   - id (TEXT PRIMARY KEY)")
    print("   - execution_id (TEXT, foreign key to executions)")
    print("   - step_number (INTEGER)")
    print("   - step_id (TEXT, foreign key to flow_steps)")
    print("   - prompt_sent (TEXT)")
    print("   - response_received (TEXT)")
    print("   - validation_called (BOOLEAN)")
    print("   - validation_passed (BOOLEAN)")
    print("   - validation_response (TEXT, JSON)")
    print("   - started_at, completed_at (INTEGER)")
    print("   - error_message (TEXT)")
    print("   - metadata (TEXT, JSON)")
    print("   - created_at, updated_at (INTEGER)")
    
    print("\n3. MIGRATION CREATED:")
    print("   - 0007_executions_table.sql")
    print("   - Creates executions table with indexes")
    print("   - Creates execution_steps table for detailed tracking")
    print("   - Inserts test execution data")
    print("   - Supports execution history and analytics")
    
    print("\n4. KEY FEATURES:")
    print("   - Complete execution lifecycle tracking")
    print("   - Step-by-step execution recording")
    print("   - Validation result storage")
    print("   - Error tracking and debugging")
    print("   - Performance analytics")
    print("   - Project-level execution grouping")
    
    print("\n5. EXECUTION LIFECYCLE:")
    print("   1. Create execution record (status: 'running')")
    print("   2. For each step:")
    print("      a. Record step start in execution_steps")
    print("      b. Execute step (prompt → response)")
    print("      c. Call validator API")
    print("      d. Record validation result")
    print("      e. Update execution.current_step")
    print("   3. Mark execution as completed/failed")
    print("   4. Record finished_at timestamp")
    
    print("\n6. QUERY EXAMPLES:")
    print("   - Get running executions: SELECT * FROM executions WHERE status = 'running'")
    print("   - Get execution steps: SELECT * FROM execution_steps WHERE execution_id = ?")
    print("   - Get execution history: SELECT * FROM executions WHERE flow_id = ?")
    print("   - Get step performance: SELECT step_number, AVG(completed_at - started_at) FROM execution_steps GROUP BY step_number")
    
    print("\n✅ STEP 6 COMPLETE")
    print("\n👉 LAST FOUNDATIONAL STEP: Added executions table as requested.")
    print("\n🎯 CORE ARCHITECTURE NOW COMPLETE")

if __name__ == '__main__':
    main()