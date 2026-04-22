#!/bin/bash

# Cloudflare Worker deployment script for SigNoz integration
# This script uploads and deploys the worker to Cloudflare

set -e

# Cloudflare API configuration
ACCOUNT_ID="e39371fc55a5c9ef7ed83e16660bd7bb"
API_TOKEN="H9uhqAdjj9dgk20BvV48mwRZ6tKflo4kiqaEQYNL"
SCRIPT_NAME="deepseek-agent"
BASE_URL="https://api.cloudflare.com/client/v4"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Cloudflare Worker Deployment Script ===${NC}"
echo -e "${YELLOW}Script: ${SCRIPT_NAME}${NC}"
echo -e "${YELLOW}Account ID: ${ACCOUNT_ID}${NC}"

# Check if worker.js exists
if [ ! -f "worker.js" ]; then
    echo -e "${RED}Error: worker.js not found in current directory${NC}"
    echo -e "${YELLOW}Please build the worker first or ensure worker.js exists${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found worker.js${NC}"

# 1. Upload worker script
echo -e "\n${YELLOW}1. Uploading worker script...${NC}"
UPLOAD_RESPONSE=$(curl -s -X PUT "${BASE_URL}/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -F 'metadata={"main_module":"worker.js"};type=application/json' \
  -F 'worker.js=@worker.js;type=application/javascript')

if echo "$UPLOAD_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Worker uploaded successfully${NC}"
else
    echo -e "${RED}✗ Failed to upload worker${NC}"
    echo "Response: $UPLOAD_RESPONSE"
    exit 1
fi

# 2. Deploy worker
echo -e "\n${YELLOW}2. Deploying worker...${NC}"
DEPLOY_RESPONSE=$(curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/deployments" \
  -H "Authorization: Bearer ${API_TOKEN}")

if echo "$DEPLOY_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Worker deployed successfully${NC}"
else
    echo -e "${RED}✗ Failed to deploy worker${NC}"
    echo "Response: $DEPLOY_RESPONSE"
    exit 1
fi

# 3. Enable subdomain (workers.dev)
echo -e "\n${YELLOW}3. Enabling workers.dev subdomain...${NC}"
SUBDOMAIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/subdomain" \
  -H "Authorization: Bearer ${API_TOKEN}")

if echo "$SUBDOMAIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Subdomain enabled successfully${NC}"
    # Extract subdomain URL
    SUBDOMAIN_URL=$(echo "$SUBDOMAIN_RESPONSE" | grep -o '"subdomain":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}Worker available at: https://${SUBDOMAIN_URL}.workers.dev${NC}"
else
    echo -e "${YELLOW}⚠ Subdomain may already be enabled or failed${NC}"
    echo "Response: $SUBDOMAIN_RESPONSE"
fi

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "${GREEN}Worker should now be running with SigNoz telemetry${NC}"
echo -e "${YELLOW}Note: To attach a custom domain route, you need zone_id and domain pattern${NC}"
echo -e "${YELLOW}Missing: zone_id and domain pattern for custom domain attachment${NC}"

# 4. Start log stream (optional)
echo -e "\n${YELLOW}4. Starting log stream (optional - will run in background)...${NC}"
echo -e "${YELLOW}To start log stream manually:${NC}"
echo "curl -X POST \"${BASE_URL}/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/tails\" \\"
echo "  -H \"Authorization: Bearer ${API_TOKEN}\""

echo -e "\n${GREEN}=== Next Steps ===${NC}"
echo "1. Test worker at: https://${SCRIPT_NAME}.${ACCOUNT_ID}.workers.dev"
echo "2. Check SigNoz logs at: https://otel.anyapp.cfd"
echo "3. Verify condition evaluation logs are being sent"

exit 0