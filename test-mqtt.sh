#!/bin/bash

# MQTT Integration Testing Script
# Tests both stub and MQTT modes

set -e

BASE_URL="http://localhost:3001/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 MQTT Integration Testing"
echo "============================"
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./test-mqtt.sh <jwt-token>${NC}"
    echo ""
    echo "To get a token:"
    echo "1. Login via frontend and copy token from browser DevTools"
    echo "2. Or use curl:"
    echo "   curl -X POST $BASE_URL/auth/login \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"email\":\"your@email.com\",\"password\":\"your-password\",\"deviceId\":\"test\"}'"
    echo ""
    echo "3. Extract accessToken from the response JSON"
    exit 1
fi

TOKEN="$1"

# Verify token format (JWT tokens have 3 parts separated by dots)
TOKEN_PARTS=$(echo "$TOKEN" | tr '.' '\n' | wc -l | tr -d ' ')
if [ "$TOKEN_PARTS" != "3" ]; then
    echo -e "${RED}❌ Invalid token format. JWT tokens should have 3 parts separated by dots.${NC}"
    echo "Token appears to be truncated or invalid."
    echo ""
    echo "To get a fresh token, run:"
    echo "  curl -X POST $BASE_URL/auth/login \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"email\":\"your@email.com\",\"password\":\"your-password\",\"deviceId\":\"test\"}' | jq -r '.tokens.accessToken'"
    exit 1
fi

# Generate UUID function
generate_uuid() {
    if command -v uuidgen &> /dev/null; then
        uuidgen
    elif command -v python3 &> /dev/null; then
        python3 -c "import uuid; print(uuid.uuid4())"
    else
        echo "$(date +%s)-$(shuf -i 1000-9999 -n 1)"
    fi
}

echo "📋 Test 1: Verify Backend is Running"
echo "-----------------------------------"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" || echo "000")
if [ "$STATUS" != "000" ]; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is not running. Start it with: cd backend && npm run start:dev${NC}"
    exit 1
fi
echo ""

echo "📋 Test 2: Check Current Mode"
echo "----------------------------"
echo "Skipping mode check to avoid rate limiting (will test in Test 3)"
echo ""

echo "📋 Test 3: Test Gate Open (Stub or MQTT Mode)"
echo "---------------------------------------------"
REQUEST_ID=$(generate_uuid)
echo "Using RequestId: $REQUEST_ID"
# Make a single request and capture both status code and response body
HTTP_CODE=$(curl -s -o /tmp/gate_response_$$.json -w "%{http_code}" -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json")
RESPONSE=$(cat /tmp/gate_response_$$.json 2>/dev/null || echo "")
rm -f /tmp/gate_response_$$.json 2>/dev/null
STATUS="$HTTP_CODE"

# Check for 401 and provide helpful message
if [ "$STATUS" = "401" ]; then
    echo -e "${RED}❌ Got 401 Unauthorized${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo -e "${YELLOW}Possible causes:${NC}"
    echo "1. Token expired (tokens expire after 15 minutes by default)"
    echo "2. Token is truncated or invalid"
    echo "3. Session/device mismatch"
    echo ""
    echo "To get a fresh token:"
    echo "  curl -X POST $BASE_URL/auth/login \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"email\":\"your@email.com\",\"password\":\"your-password\",\"deviceId\":\"dev1\"}' | jq -r '.tokens.accessToken'"
    exit 1
fi

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    echo -e "${GREEN}✅ Request succeeded (status: $STATUS)${NC}"
    echo "Response: $RESPONSE"
elif [ "$STATUS" = "409" ]; then
    echo -e "${YELLOW}⚠️  Got 409 Conflict - Replay protection detected${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo "This means the requestId was already used. This is expected if you ran the test multiple times."
    echo "Try again with a fresh requestId (the script generates a new one each time)."
elif [ "$STATUS" = "429" ]; then
    echo -e "${YELLOW}⚠️  Got 429 Too Many Requests - Rate limit exceeded${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo "Rate limit: 6 requests per minute per user (default)"
    echo "Wait a minute and try again, or check GATE_RATE_LIMIT_PER_MINUTE in backend .env"
elif [ "$STATUS" = "401" ]; then
    echo -e "${RED}❌ Got 401 Unauthorized${NC}"
    echo "Response: $RESPONSE"
    echo ""
    echo -e "${YELLOW}Possible causes:${NC}"
    echo "1. Token expired (tokens expire after 15 minutes by default)"
    echo "2. Token is truncated or invalid"
    echo "3. Session/device mismatch"
    echo ""
    echo "To get a fresh token:"
    echo "  curl -X POST $BASE_URL/auth/login \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"email\":\"your@email.com\",\"password\":\"your-password\",\"deviceId\":\"dev1\"}' | jq -r '.tokens.accessToken'"
elif [ "$STATUS" = "502" ]; then
    echo -e "${YELLOW}⚠️  Got 502 - MQTT mode may be enabled but broker not responding${NC}"
    echo "Response: $RESPONSE"
elif [ "$STATUS" = "504" ]; then
    echo -e "${YELLOW}⚠️  Got 504 - Timeout (MQTT mode waiting for ACK?)${NC}"
    echo "Response: $RESPONSE"
else
    echo -e "${RED}❌ Unexpected status: $STATUS${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

echo "📋 Test 4: Check MQTT Broker Status (if using MQTT mode)"
echo "--------------------------------------------------------"
if docker ps | grep -q parking-mosquitto; then
    echo -e "${GREEN}✅ Mosquitto container is running${NC}"
    echo "Broker logs (last 5 lines):"
    docker logs --tail 5 parking-mosquitto 2>&1 | sed 's/^/   /'
else
    echo -e "${YELLOW}⚠️  Mosquitto container not running${NC}"
    echo "If using MQTT mode, start it with:"
    echo "  docker-compose -f docker-compose.mqtt.yml up -d"
fi
echo ""

echo "============================"
echo "✅ Basic tests complete!"
echo ""
echo "Next steps:"
echo "1. Check backend logs for MQTT connection messages"
echo "2. If using MQTT mode, simulate device with mosquitto_sub/pub"
echo "3. Check MongoDB GateLog collection for audit logs"
echo ""
echo "For MQTT mode testing, see README.md section 'Testing MQTT Mode'"

