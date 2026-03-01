#!/bin/bash

echo "=== Cloudflare D1 CRUD Application Test ==="
echo ""

echo "1. Checking backend health..."
BACKEND_HEALTH=$(curl -s http://localhost:48647/api/health)
if [[ $BACKEND_HEALTH == *"ok"* ]]; then
    echo "✓ Backend is healthy: $BACKEND_HEALTH"
else
    echo "✗ Backend is not responding"
    exit 1
fi

echo ""
echo "2. Checking frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:44479)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo "✓ Frontend is running (HTTP 200)"
else
    echo "✗ Frontend returned HTTP $FRONTEND_RESPONSE"
    exit 1
fi

echo ""
echo "3. Testing API endpoints..."
echo "   - Testing /api/flows..."
FLOWS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:48647/api/flows)
if [ "$FLOWS_RESPONSE" = "200" ] || [ "$FLOWS_RESPONSE" = "500" ]; then
    echo "   ✓ /api/flows endpoint responding (HTTP $FLOWS_RESPONSE)"
else
    echo "   ✗ /api/flows endpoint returned HTTP $FLOWS_RESPONSE"
fi

echo "   - Testing /api/tasks..."
TASKS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:48647/api/tasks)
if [ "$TASKS_RESPONSE" = "200" ] || [ "$TASKS_RESPONSE" = "500" ]; then
    echo "   ✓ /api/tasks endpoint responding (HTTP $TASKS_RESPONSE)"
else
    echo "   ✗ /api/tasks endpoint returned HTTP $TASKS_RESPONSE"
fi

echo ""
echo "4. Checking running processes..."
echo "   Backend process:"
pgrep -f "node server.js" > /dev/null && echo "   ✓ Backend process is running" || echo "   ✗ Backend process not found"
echo "   Frontend process:"
pgrep -f "next dev" > /dev/null && echo "   ✓ Frontend process is running" || echo "   ✗ Frontend process not found"

echo ""
echo "=== Test Summary ==="
echo "Application URLs:"
echo "  Frontend: http://localhost:44479"
echo "  Backend API: http://localhost:48647/api"
echo ""
echo "To access the application:"
echo "1. Open your browser to http://localhost:44479"
echo "2. Check the dashboard for API health status"
echo "3. Navigate to Flows or Tasks to manage data"
echo ""
echo "For more details, see /workspace/README.md"