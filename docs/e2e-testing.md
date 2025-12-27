# End-to-End Testing Guide - Backend with MQTT

This guide walks you through testing the backend with MQTT mode and the MCU simulator from scratch.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- MongoDB running (via Docker Compose or local)
- Mosquitto client tools (for password file generation)

## Step-by-Step Setup

### 1. Start MongoDB

```bash
docker-compose up -d mongo
```

Verify MongoDB is running:
```bash
docker ps | grep mongo
```

### 2. Set Up MQTT Password File

```bash
# Install mosquitto_passwd if not already installed
# macOS: brew install mosquitto
# Ubuntu/Debian: sudo apt-get install mosquitto-clients

# Create password file with server user
mosquitto_passwd -c mqtt/passwordfile pgr_server
# Enter password when prompted (default: pgr_dev_password_change_me)

# Add device user for simulator
mosquitto_passwd mqtt/passwordfile pgr_device_mitspe6
# Enter password when prompted (remember this for MQTT_DEVICE_PASSWORD)
```

### 3. Start MQTT Broker

```bash
# Create network if it doesn't exist
docker network create parking_net 2>/dev/null || true

# Start Mosquitto broker
docker compose -f docker-compose.mqtt.yml up -d
```

Verify mosquitto is running:
```bash
docker ps | grep mosquitto
# Should show: parking-mosquitto
```

### 4. Configure Backend

Create or update `backend/.env`:

```env
# Database
MONGO_URI=mongodb://localhost:27017/parking-gate

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=15m

# Gate Device Mode: MUST be 'mqtt' for MQTT testing
GATE_DEVICE_MODE=mqtt

# MCU Settings
MCU_TIMEOUT_MS=5000
MCU_RETRY_COUNT=1
MCU_RETRY_DELAY_MS=250

# MQTT Configuration (REQUIRED when GATE_DEVICE_MODE=mqtt)
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=pgr_server
MQTT_PASSWORD=pgr_dev_password_change_me
MQTT_CMD_TOPIC=pgr/mitspe6/gate/cmd
MQTT_ACK_TOPIC=pgr/mitspe6/gate/ack
MQTT_STATUS_TOPIC=pgr/mitspe6/gate/status
```

**Important:**
- `GATE_DEVICE_MODE` must be set to `mqtt` (not `stub`)
- `MQTT_PASSWORD` must match the password you set for `pgr_server` in step 2

### 5. Start Backend

```bash
cd backend
npm install  # Only needed first time
npm run start:dev
```

**Verify backend connected to MQTT:**
Look for these log messages:
```
[MqttGateDeviceService] MQTT client connected
[MqttGateDeviceService] Subscribed to topics: pgr/mitspe6/gate/ack, pgr/mitspe6/gate/status
```

If you don't see these, check:
- `GATE_DEVICE_MODE=mqtt` in `.env`
- `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` are correct
- Mosquitto container is running

### 6. Start MCU Simulator

```bash
# Set device password (use the password you set for pgr_device_mitspe6 in step 2)
export MQTT_DEVICE_PASSWORD=your_device_password_here

# Start simulator
docker compose -f docker-compose.sim.yml up --build
```

**Verify simulator connected:**
Look for these log messages:
```
MCU Simulator starting...
✓ MQTT broker is ready
✓ Connected to MQTT broker
✓ Subscribed to pgr/mitspe6/gate/cmd
[STATUS] Published status: {...}
```

### 7. Verify Device Status Tracking

The simulator publishes status every 5 seconds. Check if backend is receiving and storing it:

**Check backend logs for:**
```
[MqttGateDeviceService] Updated device status for mitspe6-gate-001: online=true
```

**Query device status API:**
```bash
# Get admin token first (login as admin user)
curl http://localhost:3001/api/admin/device-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Expected response:
```json
{
  "items": [
    {
      "deviceId": "mitspe6-gate-001",
      "online": true,
      "updatedAt": 1766860175549,
      "lastSeenAt": "2025-12-25T...",
      "rssi": -65,
      "fwVersion": "sim-0.1.0"
    }
  ],
  "total": 1
}
```

### 8. Test Gate Open Command

**Call the gate open endpoint:**
```bash
# Get user token first (login as regular user)
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $(uuidgen)"
```

**Expected behavior:**

1. **Backend logs should show:**
   ```
   [MqttGateDeviceService] Published command for requestId <id> to topic pgr/mitspe6/gate/cmd
   [MqttGateDeviceService] Received ACK for requestId <id> (duration: <ms>ms)
   ```

2. **Simulator logs should show:**
   ```
   [CMD] Received command: {...}
   [ACK] Mode: success - sending success ACK for requestId: <id>
   [ACK] Published ACK: {...}
   ```

3. **API should return:**
   ```json
   {
     "success": true,
     "requestId": "..."
   }
   ```

## Troubleshooting

### Backend not connecting to MQTT

**Symptoms:**
- No "MQTT client connected" in backend logs
- Gate open returns timeout immediately

**Check:**
1. `GATE_DEVICE_MODE=mqtt` in `backend/.env`
2. Mosquitto container is running: `docker ps | grep mosquitto`
3. `MQTT_URL=mqtt://localhost:1883` (correct for backend running on host)
4. `MQTT_PASSWORD` matches password set for `pgr_server` user
5. Backend can reach mosquitto: `telnet localhost 1883` (should connect)

### Backend not receiving status messages

**Symptoms:**
- Simulator shows `[STATUS] Published status` but backend doesn't log "Updated device status"
- Device status API returns empty array

**Check:**
1. Backend logs show "Subscribed to topics: ... pgr/mitspe6/gate/status"
2. Topics match exactly: `pgr/mitspe6/gate/status`
3. Check backend logs for errors: `Failed to persist device status`
4. MongoDB connection is working

### Gate open times out

**Symptoms:**
- API returns 504 timeout error
- No `[CMD] Received command` in simulator logs

**Check:**
1. Simulator is running: `docker ps | grep mcu-sim`
2. Simulator logs show "✓ Subscribed to pgr/mitspe6/gate/cmd"
3. Backend logs show "Published command for requestId ..."
4. Topics match exactly: `pgr/mitspe6/gate/cmd`
5. Check mosquitto logs: `docker logs parking-mosquitto`

### Simulator not receiving commands

**Symptoms:**
- Backend publishes command but simulator doesn't log `[CMD] Received command`

**Check:**
1. Both services on same network: `docker network inspect parking_net`
2. Simulator MQTT_URL uses container name: `mqtt://parking-mosquitto:1883`
3. Backend MQTT_URL uses localhost: `mqtt://localhost:1883` (correct for host)
4. Check mosquitto ACL: `mqtt/aclfile` allows device user to read cmd topic

## Testing Different ACK Modes

You can test different failure scenarios by setting `MCU_ACK_MODE`:

```bash
# Success mode (default)
export MCU_ACK_MODE=success
docker compose -f docker-compose.sim.yml up --build

# Fail mode - returns error ACK
export MCU_ACK_MODE=fail
docker compose -f docker-compose.sim.yml up --build

# Timeout mode - doesn't send ACK
export MCU_ACK_MODE=timeout
docker compose -f docker-compose.sim.yml up --build

# Jitter mode - random delay (may cause timeouts)
export MCU_ACK_MODE=jitter
docker compose -f docker-compose.sim.yml up --build
```

## Clean Up

```bash
# Stop simulator
docker compose -f docker-compose.sim.yml down

# Stop mosquitto
docker compose -f docker-compose.mqtt.yml down

# Stop MongoDB
docker-compose down mongo
```

## Next Steps

- See [docs/mqtt-protocol.md](mqtt-protocol.md) for detailed protocol documentation
- See [docs/mqtt-sim.md](mqtt-sim.md) for advanced simulator configuration
- Test frontend integration by starting the frontend and checking admin device status UI

