import json
import subprocess

# The exact command with proper escaping
command = '''curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/pages/projects/d1/deployments" \\
  -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" \\
  -H "Content-Type: application/json" | jq -r '.result[0] | {id, url: .url, status: .latest_stage.status, environment: .environment, created_on}''

expected_report = '''Expected Report:
- What I did: Checked D1 project deployment status via Cloudflare Pages API
- What I found: Deployment ID: [id], URL: [url], Status: [status], Environment: [environment], Created: [created_on]
- Status: [success/failure]'''

full_instructions = f"{command}\n\n{expected_report}"

# Escape for SQL
escaped = full_instructions.replace('"', '\\"').replace("'", "''")

sql = f'UPDATE flow_steps SET instructions = "{escaped}" WHERE flow_id = "etaflow" AND step_key = "check_deployment_d1"'

# Create the curl command
curl_cmd = f'''curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/e39371fc55a5c9ef7ed83e16660bd7bb/d1/database/35f4cc1c-5656-4c02-bda8-26b62b63e6ca/query" \\
  -H "Authorization: Bearer H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL" \\
  -H "Content-Type: application/json" \\
  -d \'{{"sql": "{sql}"}}\''''

print("Running command:")
print(curl_cmd)

# Execute
result = subprocess.run(curl_cmd, shell=True, capture_output=True, text=True)
print("Result:", result.stdout)