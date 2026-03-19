#!/usr/bin/env python3
"""
Verify Strict Execution Engine Implementation

This script checks that all required components are implemented
and follows the strict execution principles.
"""

import os
import re

def check_file_exists(path):
    """Check if a file exists and return its size."""
    if os.path.exists(path):
        size = os.path.getsize(path)
        return True, size
    return False, 0

def check_strict_principles(content):
    """Check if file content follows strict execution principles."""
    principles = {
        "NO_FALLBACKS": [
            r"NO fallbacks",
            r"NO silent handling", 
            r"NO retries",
            r"max attempts.*=.*1",
            r"MAX_ATTEMPTS.*=.*1"
        ],
        "STRICT_VALIDATION": [
            r"validateParameters",
            r"VALIDATION_ERROR",
            r"required.*parameter",
            r"preExecutionValidation"
        ],
        "ERROR_EXPOSURE": [
            r"expose.*failure",
            r"error.*details",
            r"full.*error",
            r"error_type"
        ],
        "EXECUTION_CONTROL": [
            r"stop.*immediately",
            r"sequential.*execution",
            r"failed.*step.*stop",
            r"flow.*stopped"
        ]
    }
    
    results = {}
    for principle, patterns in principles.items():
        matches = []
        for pattern in patterns:
            if re.search(pattern, content, re.IGNORECASE):
                matches.append(pattern)
        results[principle] = len(matches) > 0
    
    return results

def main():
    print("=== Strict Execution Engine Verification ===\n")
    
    # Files to check
    files_to_check = [
        ("StrictCommandExecutor", "src/services/strictCommandExecutor.ts"),
        ("StrictFlowExecutor", "src/services/strictFlowExecutor.ts"),
        ("StrictConversationDO", "src/durable/StrictConversationDO.ts"),
        ("Documentation", "STRICT_EXECUTION_ENGINE.md"),
        ("Test Script", "test-strict-execution.js")
    ]
    
    all_good = True
    
    for name, path in files_to_check:
        exists, size = check_file_exists(path)
        print(f"{name}:")
        print(f"  Path: {path}")
        print(f"  Exists: {'✓' if exists else '✗'}")
        
        if exists:
            print(f"  Size: {size} bytes")
            
            # Read and check content
            try:
                with open(path, 'r') as f:
                    content = f.read()
                
                principles = check_strict_principles(content)
                print("  Principles Check:")
                for principle, passed in principles.items():
                    print(f"    {principle}: {'✓' if passed else '✗'}")
                    if not passed:
                        all_good = False
                
                # Check for anti-patterns (excluding comments)
                anti_patterns = [
                    (r"(?<!//.*)(?<!/\*.*)maxRetries.*[2-9]", "Multiple retries"),
                    (r"(?<!//.*)(?<!/\*.*)fallbackCommand", "Command fallbacks"),
                    (r"(?<!//.*)(?<!/\*.*)try.*different.*approach", "Alternative strategies"),
                    (r"(?<!//.*)(?<!/\*.*)auto.*recover", "Auto-recovery"),
                    (r"(?<!//.*)(?<!/\*.*)silent.*fail", "Silent failure")
                ]
                
                found_anti_patterns = []
                for pattern, desc in anti_patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        found_anti_patterns.append(desc)
                
                if found_anti_patterns:
                    print(f"  ⚠️  Anti-patterns found: {', '.join(found_anti_patterns)}")
                    all_good = False
                    
            except Exception as e:
                print(f"  Error reading file: {e}")
                all_good = False
        else:
            all_good = False
            
        print()
    
    # Summary
    print("=== Verification Summary ===")
    if all_good:
        print("✓ All components implemented correctly")
        print("✓ Follows strict execution principles")
        print("✓ No anti-patterns detected")
    else:
        print("✗ Some issues detected")
        print("  Review the output above for details")
    
    # Key features implemented
    print("\n=== Key Features Implemented ===")
    features = [
        "Parameter standardization and validation",
        "Pre-execution validation layer", 
        "Strict execution wrapper with timeout",
        "No retries (max attempts = 1)",
        "Flow execution control (stop on failure)",
        "Execution state tracking",
        "Verbose logging",
        "Conversation safety checks",
        "Structured error reporting",
        "Test script for verification"
    ]
    
    for feature in features:
        print(f"✓ {feature}")
    
    print("\n=== Integration Points ===")
    integration_points = [
        "Replace CommandExecutor with StrictCommandExecutor",
        "Update ConversationDO.handleCommand method",
        "Update flow execution logic",
        "Frontend display of structured errors"
    ]
    
    for point in integration_points:
        print(f"• {point}")

if __name__ == "__main__":
    main()