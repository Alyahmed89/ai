#!/bin/bash
ID=$(curl -s -X POST "https://kong.anyapp.cfd/rest/v1/flow_runs" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"flow_id":"flow-prompt-to-rule-1778898760","status":"running","input":{},"output":{}}' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "Flow run: $ID"

# Watch logs in background
docker logs f82a2832b451 --since 30s --follow 2>&1 | grep '\[engine\]' &
LOGPID=$!

sleep 2
echo "=== RESUME 1 ==="
curl -s -X POST "https://ai.anyapp.cfd/flow-runs/$ID/resume" \
  -H "Content-Type: application/json" \
  -d '{"user_input":{"input_user_prompt":"a person is happy if they have food and shelter"}}'
sleep 30

echo "=== RESUME 2 ==="
curl -s -X POST "https://ai.anyapp.cfd/flow-runs/$ID/resume" \
  -H "Content-Type: application/json" \
  -d '{}'
sleep 60

echo "=== TRACE ==="
curl -s "https://ai.anyapp.cfd/flow-runs/$ID/trace" | python3 -c "
import sys,json
d=json.load(sys.stdin)
fr=d['flowRun']; srs=d.get('stepRuns',[])
print(f'status={fr[\"status\"]} steps={len(srs)}')
for s in srs:
    ar=s.get('ai_response','')
    nid=(s.get('result') or s.get('output') or {}).get('procheck_next_step_id','')
    print(f'  {s[\"step_id\"]}: {s[\"status\"]} next={nid}')
"

kill $LOGPID 2>/dev/null
