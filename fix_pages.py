import os
import re

def fix_page(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Add import for parseApiResponse
    if 'parseApiResponse' not in content:
        content = content.replace(
            "import { useState, useEffect } from 'react';",
            "import { useState, useEffect } from 'react';\nimport { parseApiResponse } from '@/lib/api-utils';"
        )
    
    # Fix the data parsing
    # Find pattern: const data = await response.json();\n      setTasks(data);
    pattern = r'(const \w+ = await response\.json\(\);)\s*\n\s*(set\w+\(\1\);?)'
    match = re.search(pattern, content)
    
    if match:
        old_code = match.group(0)
        var_name = match.group(1).split()[1]  # Get variable name
        new_code = f'''{match.group(1)}
      const parsedData = parseApiResponse({var_name});
      {match.group(2).replace(var_name, 'parsedData')}'''
        content = content.replace(old_code, new_code)
        print(f"Fixed data parsing in {filepath}")
    
    # Also fix interface if needed (for tasks)
    if 'tasks/page.tsx' in filepath:
        # Update Task interface to match actual API
        task_interface = '''interface Task {
  id: string;
  title: string | null;
  description: string | null;
  task_type: string | null;
  priority: string | null;
  status: string;
  flow_id: string | null;
  created_at: string;
  updated_at: string;
}'''
        content = re.sub(r'interface Task \{[\s\S]*?\}', task_interface, content)
        print(f"Updated Task interface in {filepath}")
    
    with open(filepath, 'w') as f:
        f.write(content)

# Fix all pages
pages = [
    'app/tasks/page.tsx',
    'app/flows/page.tsx', 
    'app/nodes/page.tsx',
    'app/flow-runs/page.tsx'
]

for page in pages:
    if os.path.exists(page):
        fix_page(page)
    else:
        print(f"Warning: {page} not found")

print("Done fixing pages!")
