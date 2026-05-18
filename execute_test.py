#!/usr/bin/env python3
"""Execute run-test.sh inside the deepseek-agent container via code.anyapp.cfd/run"""
import json, urllib.request, base64

with open('/workspace/project/deepseek-agent/run-test.sh', 'rb') as f:
    script_b64 = base64.b64encode(f.read()).decode()

# Step 1: write script file on server
cmd1 = f'echo "{script_b64}" | base64 -d > /tmp/run-test.sh && chmod +x /tmp/run-test.sh'
# Step 2: copy to container and execute
cmd2 = 'docker cp /tmp/run-test.sh qswbzexiqi71xi4yev96otnq-181745838992:/tmp/run-test.sh && docker exec qswbzexiqi71xi4yev96otnq-181745838992 sh /tmp/run-test.sh'

def run(cmd):
    data = json.dumps({"cmd": cmd}).encode()
    req = urllib.request.Request(
        "https://code.anyapp.cfd/run",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    resp = urllib.request.urlopen(req, timeout=180)
    result = json.loads(resp.read())
    print(f"stdout:\n{result.get('stdout','')}")
    if result.get('stderr'):
        print(f"stderr:\n{result['stderr']}")
    if result.get('error'):
        print(f"error:\n{result['error']}")
    return result

print("=== Step 1: Write script ===")
run(cmd1)
print()
print("=== Step 2: Run test ===")
run(cmd2)
