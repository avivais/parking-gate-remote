# Gate Hardening Testing Guide

This guide helps you test all the new security features before committing.

## Prerequisites

1. Start the backend: `cd backend && npm run start:dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Have a valid user account and be logged in

## Test 1: X-Request-Id Header (Frontend)

### Expected Behavior
- Frontend automatically generates UUID for POST /gate/open
- Header is sent with every request

### Steps
1. Open browser DevTools → Network tab
2. Click "פתח שער" button
3. Find the `/api/gate/open` request
4. Check Request Headers → should see `X-Request-Id: <uuid>`
5. Verify UUID format (e.g., `550e8400-e29b-41d4-a716-446655440000`)

### Success Criteria
✅ X-Request-Id header is present
✅ UUID format is valid
✅ Same requestId is reused on 401 retry (check Network tab for retry)

---

## Test 2: Missing X-Request-Id (Backend Validation)

### Expected Behavior
- Backend returns 400 if X-Request-Id is missing
- Error message in Hebrew

### Steps (using curl or Postman)
```bash
# Get your access token first (from browser DevTools → Application → Cookies)
TOKEN="your-access-token-here"

# Test without X-Request-Id
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Response
```json
{
  "statusCode": 400,
  "message": "נדרש X-Request-Id header"
}
```

### Success Criteria
✅ Returns 400 Bad Request
✅ Hebrew error message
✅ Check GateLog in MongoDB - should have entry with status

---

## Test 3: Invalid UUID Format

### Expected Behavior
- Backend validates UUID format
- Returns 400 for invalid format

### Steps
```bash
TOKEN="your-access-token-here"

# Test with invalid UUID
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: invalid-uuid" \
  -H "Content-Type: application/json"
```

### Expected Response
```json
{
  "statusCode": 400,
  "message": "X-Request-Id חייב להיות UUID תקין"
}
```

### Success Criteria
✅ Returns 400 Bad Request
✅ Hebrew error message

---

## Test 4: Replay Protection (Duplicate RequestId)

### Expected Behavior
- First request with a requestId succeeds
- Second request with same requestId returns 409 Conflict
- Error message: "בקשה כפולה זוהתה"

### Steps
```bash
TOKEN="your-access-token-here"
REQUEST_ID="550e8400-e29b-41d4-a716-446655440000"

# First request - should succeed
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json"

# Second request with same ID - should fail
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json"
```

### Expected Response (Second Request)
```json
{
  "statusCode": 409,
  "message": "בקשה כפולה זוהתה"
}
```

### Success Criteria
✅ First request: 200 OK
✅ Second request: 409 Conflict
✅ Check GateLog - first has status "success", second has "blocked_replay"
✅ Wait 30+ seconds, try again with same ID - should work (TTL expired)

---

## Test 5: Rate Limiting

### Expected Behavior
- Default: 6 requests per minute per user
- 7th request returns 429 Too Many Requests
- Error message: "יותר מדי בקשות, נסה שוב בעוד רגע"

### Steps
```bash
TOKEN="your-access-token-here"

# Make 7 rapid requests
for i in {1..7}; do
  REQUEST_ID=$(uuidgen)
  echo "Request $i with ID: $REQUEST_ID"
  curl -X POST http://localhost:3001/api/gate/open \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Request-Id: $REQUEST_ID" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n\n"
  sleep 0.5
done
```

### Expected Response (7th Request)
```json
{
  "statusCode": 429,
  "message": "יותר מדי בקשות, נסה שוב בעוד רגע"
}
```

### Success Criteria
✅ First 6 requests: 200 OK (or 409 if duplicate, or 502/504 if MCU fails)
✅ 7th request: 429 Too Many Requests
✅ Check GateLog - 7th entry has status "blocked_rate_limit"
✅ Wait 1 minute, try again - should work

### Alternative: Test via Frontend
1. Click "פתח שער" button 7 times rapidly
2. 7th click should show error toast
3. Check Network tab - 7th request has 429 status

---

## Test 6: MCU Stub Behavior

### Expected Behavior
- MCU stub simulates call with 100-500ms delay
- 5% chance of failure (BadGatewayException)
- Timeout after 2500ms (configurable)
- Retries on failure (1 retry by default)

### Steps
```bash
TOKEN="your-access-token-here"

# Make several requests to see different outcomes
for i in {1..10}; do
  REQUEST_ID=$(uuidgen)
  echo "Request $i:"
  curl -X POST http://localhost:3001/api/gate/open \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Request-Id: $REQUEST_ID" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n\n"
  sleep 1
done
```

### Expected Outcomes
- Most requests: 200 OK (success)
- Some requests: 502 Bad Gateway (MCU failure, ~5% chance)
- Check GateLog for `mcu` metadata:
  ```json
  {
    "mcu": {
      "attempted": true,
      "timeout": false,
      "retries": 0  // or 1 if retried
    }
  }
  ```

### Success Criteria
✅ Most requests succeed
✅ Some may fail with 502 (simulated MCU failure)
✅ GateLog shows `mcu.attempted: true`
✅ GateLog shows `durationMs` > 0

---

## Test 7: Audit Logging

### Expected Behavior
- All gate open attempts are logged to GateLog collection
- Logs include: requestId, status, durationMs, mcu metadata, sessionId

### Steps
1. Make a few requests (some successful, some rate-limited, some replayed)
2. Check MongoDB GateLog collection:

```bash
# Using MongoDB shell or Compass
db.gatelogs.find().sort({ createdAt: -1 }).limit(10).pretty()
```

### Expected Log Structure
```json
{
  "_id": ObjectId("..."),
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123",
  "email": "user@example.com",
  "deviceId": "device123",
  "sessionId": "session123",
  "ip": "127.0.0.1",
  "userAgent": "Mozilla/5.0...",
  "openedBy": "user",
  "status": "success",  // or "failed", "blocked_rate_limit", "blocked_replay"
  "failureReason": null,  // or error message
  "durationMs": 245,
  "mcu": {
    "attempted": true,
    "timeout": false,
    "retries": 0
  },
  "createdAt": ISODate("2024-01-01T12:00:00Z"),
  "updatedAt": ISODate("2024-01-01T12:00:00Z")
}
```

### Success Criteria
✅ All requests are logged
✅ requestId is present in all logs
✅ status field reflects outcome
✅ durationMs is recorded
✅ mcu metadata is present
✅ sessionId is included (from JWT)

---

## Test 8: Normal User Flow (End-to-End)

### Expected Behavior
- User clicks button → gate opens → success message
- All security checks pass
- Request is logged

### Steps
1. Log in to frontend
2. Click "פתח שער" button
3. Should see success toast: "השער נפתח ✅"
4. Check Network tab:
   - Request has X-Request-Id header
   - Response is 200 OK
   - Request completed in < 1 second

### Success Criteria
✅ Button works normally
✅ Success message appears
✅ No errors in console
✅ Request logged in GateLog

---

## Test 9: Configuration

### Test Environment Variables

Create/update `.env` file in backend:
```env
GATE_RATE_LIMIT_PER_MINUTE=3
GATE_REQUEST_TTL_SECONDS=60
MCU_TIMEOUT_MS=1000
MCU_RETRY_COUNT=2
MCU_RETRY_DELAY_MS=100
```

Restart backend and verify:
1. Rate limit is now 3 per minute
2. Replay protection TTL is 60 seconds
3. MCU timeout is 1 second
4. MCU retries 2 times

---

## Quick Test Script

Save this as `test-gate.sh`:

```bash
#!/bin/bash

TOKEN="${1:-your-token-here}"
BASE_URL="http://localhost:3001/api"

echo "=== Test 1: Missing X-Request-Id ==="
curl -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n\n"

echo "=== Test 2: Invalid UUID ==="
curl -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: invalid" \
  -w "\nStatus: %{http_code}\n\n"

echo "=== Test 3: Replay Protection ==="
REQUEST_ID=$(uuidgen)
echo "Using RequestId: $REQUEST_ID"
curl -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -w "\nStatus: %{http_code}\n\n"

echo "Same RequestId again (should fail):"
curl -X POST "$BASE_URL/gate/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -w "\nStatus: %{http_code}\n\n"

echo "=== Test 4: Rate Limiting ==="
for i in {1..7}; do
  REQUEST_ID=$(uuidgen)
  echo "Request $i:"
  curl -X POST "$BASE_URL/gate/open" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Request-Id: $REQUEST_ID" \
    -w "\nStatus: %{http_code}\n\n" \
    -o /dev/null -s
  sleep 0.5
done

echo "=== Tests Complete ==="
```

Usage:
```bash
chmod +x test-gate.sh
./test-gate.sh "your-jwt-token-here"
```

---

## MongoDB Queries for Verification

```javascript
// View recent logs
db.gatelogs.find().sort({ createdAt: -1 }).limit(10).pretty()

// Count by status
db.gatelogs.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// Check replay protection (should have unique requestIds)
db.gaterequests.find().sort({ createdAt: -1 }).limit(10).pretty()

// Verify TTL index exists
db.gaterequests.getIndexes()
```

---

## Troubleshooting

### Rate limit not working?
- Check ThrottlerModule is configured in app.module.ts
- Verify GateThrottlerGuard is applied to the route
- Check if in-memory storage is being used (restart clears it)

### Replay protection not working?
- Verify GateRequest schema is registered in GateModule
- Check MongoDB for duplicate key errors
- Verify TTL index is created: `db.gaterequests.getIndexes()`

### MCU stub always succeeds?
- It has 5% failure rate - make more requests to see failures
- Check GateLog for `mcu.attempted: true`

### Frontend not sending X-Request-Id?
- Check browser DevTools → Network tab
- Verify path is exactly `/gate/open` and method is `POST`
- Check api.ts implementation

