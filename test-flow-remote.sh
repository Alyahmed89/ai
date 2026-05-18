#!/bin/sh
ID="$1"
docker logs qswbzexiqi71xi4yev96otnq-181745838992 --tail 0 --follow 2>&1 | grep '\[engine\]' &
LOGPID=$!
sleep 2
curl -s -X POST "http://localhost:9090/flow-runs/$ID/resume" -H 'Content-Type: application/json' -d '{}'
sleep 30
echo '---DONE---'
kill $LOGPID 2>/dev/null
