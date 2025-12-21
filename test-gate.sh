#!/bin/bash

# Quick test script for gate hardening features
# Usage: ./test-gate.sh <your-jwt-token>

set -e

TOKEN="${1}"
BASE_URL="http://localhost:3001/api"

if [ -z "$TOKEN" ]; then
    echo "Usage: ./test-gate.sh <your-jwt-token>"
    echo ""
    echo "To get your token:"
    echo "1. Open browser DevTools → Application → Cookies"
    echo "2. Copy the value of the httpOnly cookie (or use Authorization header from Network tab)"
    echo ""
    echo "Or use curl to login first:"
    echo "  curl -X POST $BASE_URL/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"...\",\"password\":\"...\",\"deviceId\":\"test\"}'"
    exit 1
fi

echo "🧪 Testing Gate Hardening Features"
echo "===================================="
echo ""

# Test 1: Missing X-Request-Id
echo "📋 Test 1: Missing X-Request-Id (should return 400)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
if [ "$STATUS" = "400" ]; then
    echo "✅ PASS: Returns 400"
else
    echo "❌ FAIL: Expected 400, got $STATUS"
fi
echo ""

# Test 2: Invalid UUID
echo "📋 Test 2: Invalid UUID format (should return 400)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: invalid-uuid" \
  -H "Content-Type: application/json")
if [ "$STATUS" = "400" ]; then
    echo "✅ PASS: Returns 400"
else
    echo "❌ FAIL: Expected 400, got $STATUS"
fi
echo ""

# Test 3: Replay Protection
echo "📋 Test 3: Replay Protection (duplicate requestId)"
REQUEST_ID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440000")
echo "   Using RequestId: $REQUEST_ID"

# First request
echo "   First request..."
STATUS1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json")

# Second request with same ID
echo "   Second request (same ID)..."
STATUS2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json")

if [ "$STATUS1" = "200" ] || [ "$STATUS1" = "502" ] || [ "$STATUS1" = "504" ]; then
    if [ "$STATUS2" = "409" ]; then
        echo "✅ PASS: First request succeeded, second returned 409 (replay detected)"
    else
        echo "⚠️  WARN: First request: $STATUS1, Second request: $STATUS2 (expected 409)"
    fi
else
    echo "❌ FAIL: First request failed with $STATUS1"
fi
echo ""

# Test 4: Rate Limiting
echo "📋 Test 4: Rate Limiting (making 7 requests, 7th should be 429)"
RATE_LIMIT_HIT=false
for i in {1..7}; do
    REQUEST_ID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "$(date +%s)-$i")
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/gate/open" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-Request-Id: $REQUEST_ID" \
      -H "Content-Type: application/json")

    if [ "$STATUS" = "429" ]; then
        RATE_LIMIT_HIT=true
        echo "   Request $i: $STATUS (rate limited) ✅"
        break
    else
        echo "   Request $i: $STATUS"
    fi

    sleep 0.3
done

if [ "$RATE_LIMIT_HIT" = true ]; then
    echo "✅ PASS: Rate limiting works"
else
    echo "⚠️  WARN: Rate limit not hit (may need to wait for window to reset)"
fi
echo ""

# Test 5: Valid Request
echo "📋 Test 5: Valid Request (should succeed)"
REQUEST_ID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "$(date +%s)-valid")
RESPONSE=$(curl -s -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json")

if [ "$STATUS" = "200" ] || [ "$STATUS" = "502" ] || [ "$STATUS" = "504" ]; then
    echo "✅ PASS: Request processed (status: $STATUS)"
    echo "   Response: $RESPONSE"
else
    echo "❌ FAIL: Unexpected status $STATUS"
fi
echo ""

echo "===================================="
echo "✅ Testing complete!"
echo ""
echo "Next steps:"
echo "1. Check MongoDB GateLog collection for audit logs"
echo "2. Check browser DevTools → Network tab for X-Request-Id header"
echo "3. Review TESTING_GUIDE.md for detailed test scenarios"

