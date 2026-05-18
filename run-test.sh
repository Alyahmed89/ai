#!/bin/sh
set -e

api_post() {
  local path="$1" data="$2"
  wget -q -O- --post-data="$data" \
    --header="Content-Type: application/json" \
    --header="Prefer: return=representation" \
    "http://localhost:9090$path" 2>/dev/null
}

api_get() {
  wget -q -O- "http://localhost:9090$path" 2>/dev/null
}

# Create flow run via internal API
ID=$(api_post "/flow-runs" '{"flow_id":"flow-prompt-to-rule-1778898760","status":"running","input":{},"output":{}}' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "CREATED RUN=$ID"

# Resume 1: step 0, flow is running, should pause for input
wget -q -O- --post-data='{"user_input":{"input_user_prompt":"a person is happy if they have food and shelter"}}' \
  --header="Content-Type: application/json" \
  "http://localhost:9090/flow-runs/$ID/resume" 2>/dev/null

echo ""
echo "SLEEP 30 after resume 1..."
sleep 30

# Check trace
TRACE=$(wget -q -O- "http://localhost:9090/flow-runs/$ID/trace" 2>/dev/null)
STATUS=$(echo "$TRACE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "STATUS after resume 1: $STATUS"

echo "=== TRACE 1 ==="
echo "$TRACE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
fr=d['flowRun']; srs=d.get('stepRuns',[])
print(f'status={fr[\"status\"]} steps={len(srs)}')
for s in srs:
    nid=(s.get('result') or s.get('output') or {}).get('procheck_next_step_id','')
    print(f'  {s[\"step_id\"]}: {s[\"status\"]} next={nid}')
"

# If paused, resume 2 (paused branch - merges user input, routes via pro_check)
if [ "$STATUS" = "paused" ]; then
  echo "Resume 2..."
  wget -q -O- --post-data='{"user_input":{"input_user_prompt":"a person is happy if they have food and shelter"}}' \
    --header="Content-Type: application/json" \
    "http://localhost:9090/flow-runs/$ID/resume" 2>/dev/null
  echo ""
  echo "SLEEP 60 after resume 2..."
  sleep 60
  
  echo "=== TRACE 2 ==="
  wget -q -O- "http://localhost:9090/flow-runs/$ID/trace" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
fr=d['flowRun']; srs=d.get('stepRuns',[])
print(f'status={fr[\"status\"]} steps={len(srs)}')
for s in srs:
    ar=s.get('ai_response','')
    nid=(s.get('result') or s.get('output') or {}).get('procheck_next_step_id','')
    print(f'  {s[\"step_id\"]}: {s[\"status\"]} next={nid}')
    if ar:
        a=json.loads(ar)
        for k,v in a.items():
            if not isinstance(v,(list,dict)):
                print(f'    {k}={str(v)[:150]}')
            else:
                print(f'    {k}=[{type(v).__name__}] {json.dumps(v)[:200]}')
"
fi
