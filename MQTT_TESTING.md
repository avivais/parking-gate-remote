# MQTT Integration Testing Guide

This guide helps you test the MQTT integration for the gate device service.

## Quick Start Testing

### 1. Test Stub Mode (Default)

Stub mode should work immediately without any setup:

```bash
# 1. Start backend (if not already running)
cd backend
npm run start:dev

# 2. Get a JWT token (login via frontend or curl)
# 3. Run the test script
./test-mqtt.sh <your-jwt-token>
```

**Expected:** Requests should succeed with 200 status (or occasional 502 from simulated failures).

### 2. Test MQTT Mode

#### Step 1: Set Up MQTT Broker

```bash
# 1. Generate password file
mosquitto_passwd -c mqtt/passwordfile pgr_server
# Enter password: pgr_dev_password_change_me (or your own)

# 2. Create network (if doesn't exist)
docker network create parking_net 2>/dev/null || true

# 3. Start Mosquitto broker
docker-compose -f docker-compose.mqtt.yml up -d

# 4. Verify broker is running
docker logs parking-mosquitto
```

#### Step 2: Configure Backend for MQTT Mode

Edit `backend/.env`:

```env
GATE_DEVICE_MODE=mqtt
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=pgr_server
MQTT_PASSWORD=pgr_dev_password_change_me
MQTT_CMD_TOPIC=pgr/mitspe6/gate/cmd
MQTT_ACK_TOPIC=pgr/mitspe6/gate/ack
MQTT_STATUS_TOPIC=pgr/mitspe6/gate/status
```

Restart backend:

```bash
cd backend
npm run start:dev
```

#### Step 3: Simulate Device (Terminal 1)

In one terminal, subscribe to commands and respond with ACKs:

```bash
# Install jq if needed: brew install jq (macOS) or apt-get install jq (Linux)

mosquitto_sub -h localhost -p 1883 \
  -u pgr_device_mitspe6 -P <device-password> \
  -t "pgr/mitspe6/gate/cmd" -q 1 | while read -r line; do
  echo "📨 Received command: $line"

  # Extract requestId from JSON
  REQ_ID=$(echo "$line" | jq -r '.requestId')

  if [ "$REQ_ID" != "null" ] && [ -n "$REQ_ID" ]; then
    echo "✅ Sending ACK for requestId: $REQ_ID"

    # Send ACK
    mosquitto_pub -h localhost -p 1883 \
      -u pgr_device_mitspe6 -P <device-password> \
      -t "pgr/mitspe6/gate/ack" -q 1 \
      -m "{\"requestId\":\"$REQ_ID\",\"ok\":true}"
  fi
done
```

**Note:** Replace `<device-password>` with the password you set for `pgr_device_mitspe6` user, or add the user:

```bash
mosquitto_passwd mqtt/passwordfile pgr_device_mitspe6
```

#### Step 4: Test API (Terminal 2)

In another terminal:

```bash
# Get your JWT token first (login via frontend)
TOKEN="your-jwt-token-here"

# Test gate open
REQUEST_ID=$(uuidgen || python3 -c "import uuid; print(uuid.uuid4())")
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "Content-Type: application/json" \
  -v
```

**Expected Flow:**
1. Backend publishes command to `pgr/mitspe6/gate/cmd`
2. Device simulator receives command
3. Device simulator publishes ACK to `pgr/mitspe6/gate/ack`
4. Backend receives ACK and returns 200 OK

## Detailed Test Scenarios

### Test 1: MQTT Connection

**Goal:** Verify backend connects to MQTT broker on startup.

**Steps:**
1. Set `GATE_DEVICE_MODE=mqtt` in backend `.env`
2. Start backend: `cd backend && npm run start:dev`
3. Check backend logs for: `MQTT client connected`

**Expected:**
```
[MqttGateDeviceService] Connecting to MQTT broker at mqtt://localhost:1883
[MqttGateDeviceService] MQTT client connected
[MqttGateDeviceService] Subscribed to topics: pgr/mitspe6/gate/ack, pgr/mitspe6/gate/status
```

### Test 2: Command Publishing

**Goal:** Verify backend publishes commands correctly.

**Steps:**
1. Subscribe to command topic as device:
```bash
mosquitto_sub -h localhost -p 1883 \
  -u pgr_device_mitspe6 -P <password> \
  -t "pgr/mitspe6/gate/cmd" -q 1 -v
```

2. Make API request to open gate
3. Verify command message format

**Expected Message:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "command": "open",
  "userId": "user-id-here"
}
```

### Test 3: ACK Handling

**Goal:** Verify backend receives and processes ACKs.

**Steps:**
1. Start device simulator (see Step 3 above)
2. Make API request
3. Check backend logs for ACK receipt

**Expected Logs:**
```
[MqttGateDeviceService] Published command for requestId ... to topic pgr/mitspe6/gate/cmd
[MqttGateDeviceService] Received ACK for requestId ... (duration: 245ms)
```

### Test 4: Timeout Handling

**Goal:** Verify timeout works when device doesn't respond.

**Steps:**
1. Don't start device simulator
2. Make API request
3. Wait for timeout

**Expected:**
- Status: 504 Gateway Timeout
- Error message: "תקשורת עם מכשיר השער ארכה יותר מדי זמן"
- GateLog shows `mcu.timeout: true`

### Test 5: Retry Logic

**Goal:** Verify retries work on failure.

**Steps:**
1. Configure retries in `.env`:
```env
MCU_RETRY_COUNT=2
MCU_RETRY_DELAY_MS=500
```

2. Simulate device that fails first attempt, succeeds on retry
3. Make API request

**Expected:**
- Backend retries up to 2 times
- GateLog shows `mcu.retries: 1` or `2`

### Test 6: Broker Disconnection

**Goal:** Verify graceful handling when broker is down.

**Steps:**
1. Start backend with MQTT mode
2. Stop broker: `docker-compose -f docker-compose.mqtt.yml stop`
3. Make API request

**Expected:**
- Status: 502 Bad Gateway
- Error message indicates MQTT connection issue
- Backend logs show connection errors

### Test 7: Mode Switching

**Goal:** Verify stub mode still works.

**Steps:**
1. Set `GATE_DEVICE_MODE=stub` in `.env`
2. Restart backend
3. Make API request (no broker needed)

**Expected:**
- Requests succeed immediately
- No MQTT connection logs
- Simulated MCU behavior (100-500ms delay, occasional failures)

## Monitoring and Debugging

### Check Backend Logs

```bash
# Watch backend logs
cd backend
npm run start:dev

# Look for MQTT-related messages:
# - Connection status
# - Published commands
# - Received ACKs
# - Errors
```

### Check MQTT Broker Logs

```bash
docker logs -f parking-mosquitto
```

### Monitor MQTT Traffic

Subscribe to all topics (as server user):

```bash
mosquitto_sub -h localhost -p 1883 \
  -u pgr_server -P <password> \
  -t "#" -v
```

### Check MongoDB Logs

```bash
# Connect to MongoDB
docker exec -it parking-mongo mongosh

# View recent gate logs
use parking-gate
db.gatelogs.find().sort({ createdAt: -1 }).limit(5).pretty()

# Check for MQTT metadata
db.gatelogs.find({ "mcu.attempted": true }).sort({ createdAt: -1 }).limit(5).pretty()
```

## Troubleshooting

### Backend won't connect to MQTT

**Symptoms:** Logs show connection errors, 502 responses

**Solutions:**
1. Verify broker is running: `docker ps | grep mosquitto`
2. Check broker logs: `docker logs parking-mosquitto`
3. Verify password file exists: `ls -la mqtt/passwordfile`
4. Test connection manually:
```bash
mosquitto_sub -h localhost -p 1883 -u pgr_server -P <password> -t "#"
```

### ACK not received

**Symptoms:** Requests timeout, no ACK in logs

**Solutions:**
1. Verify device simulator is running
2. Check device user has correct password
3. Verify ACL allows device to publish to ack topic
4. Check broker logs for publish errors
5. Monitor all topics: `mosquitto_sub -h localhost -p 1883 -u pgr_server -P <password> -t "#" -v`

### Wrong mode active

**Symptoms:** Unexpected behavior (MQTT when expecting stub, or vice versa)

**Solutions:**
1. Check `.env` file: `grep GATE_DEVICE_MODE backend/.env`
2. Restart backend after changing `.env`
3. Check backend logs for mode confirmation

### Password authentication fails

**Symptoms:** Connection refused, authentication errors

**Solutions:**
1. Regenerate password file:
```bash
mosquitto_passwd -c mqtt/passwordfile pgr_server
```
2. Restart broker: `docker-compose -f docker-compose.mqtt.yml restart`
3. Verify password matches `.env` file

## Automated Testing Script

Use the provided `test-mqtt.sh` script:

```bash
# Get token first (login via frontend)
TOKEN="your-jwt-token"

# Run tests
./test-mqtt.sh "$TOKEN"
```

## Next Steps

After verifying MQTT integration works:

1. ✅ Test with real microcontroller device
2. ✅ Configure production MQTT broker
3. ✅ Set up TLS certificates for production
4. ✅ Update passwords for production
5. ✅ Configure monitoring and alerts
6. ✅ Test failover scenarios

