# End-to-End Testing Guide - Production-Like Setup

This guide provides comprehensive steps for testing the complete Parking Gate Remote system in a production-like environment, running locally with production MQTT broker configuration.

## Overview

This guide covers:
1. **MCU Firmware**: Flashing production firmware with production MQTT topics
2. **Backend**: Setting up and running with production MQTT configuration
3. **Frontend**: Setting up and running the web application
4. **Log Verification**: What to expect in logs from all components
5. **Functionality Testing**: Complete checklist of production features

## Prerequisites

- **Hardware**: ESP32 TTGO with A7670G cellular modem
- **Software**:
  - PlatformIO CLI or VS Code with PlatformIO extension
  - Node.js 18+ installed
  - Docker and Docker Compose installed
  - MongoDB (via Docker Compose or local)
- **MQTT Broker**: Production HiveMQ Cloud account (or local Mosquitto for testing)
- **Serial Connection**: USB cable to connect ESP32 for flashing and monitoring

## Part 1: MCU Firmware Setup

### 1.1 Configure Production MQTT Settings

Edit `firmware/src/config/config.h` with production values:

```cpp
// Device Identification
#define DEVICE_ID "mitspe6-gate-001"  // Change per device

// MQTT Broker Configuration (Production HiveMQ Cloud)
#define MQTT_HOST "3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883  // TLS port
#define MQTT_USERNAME "avivais"
#define MQTT_PASSWORD "Avivr_121"

// MQTT Topics (Production)
#define MQTT_CMD_TOPIC "pgr/mitspe6/gate/cmd"
#define MQTT_ACK_TOPIC "pgr/mitspe6/gate/ack"
#define MQTT_STATUS_TOPIC "pgr/mitspe6/gate/status"
```

**Important**:
- Use production MQTT broker credentials
- Ensure topics match backend configuration exactly
- Device ID must be unique per physical device

### 1.2 Build and Flash Firmware

```bash
cd firmware

# Build firmware
pio run

# Flash to ESP32 (connect device via USB first)
pio run -t upload

# Open serial monitor to view logs
pio device monitor
```

**Alternative (VS Code PlatformIO Extension)**:
1. Open `firmware/` folder in VS Code
2. Click PlatformIO icon in sidebar
3. Click "Build" (checkmark icon)
4. Click "Upload" (arrow icon)
5. Click "Monitor" (plug icon) to view serial output

### 1.3 Verify Firmware Boot Sequence

**Expected Serial Monitor Output** (115200 baud):

```
========================================
Parking Gate Remote - MCU Firmware
Device ID: mitspe6-gate-001
FW Version: fw-dev-0.1
========================================
[Main] Starting in MODEM_INIT state
[Modem] Powering on modem...
[Modem] Starting AT handshake...
[Modem] AT handshake OK
[Modem] Echo disabled
[Modem] SIM query OK
[Modem] Network registration query OK
[Modem] Signal strength query OK
[Modem] Initialization complete
[Main] State transition: MODEM_INIT -> PPP_CONNECTING (time in state: 5234ms)
[PPP] Starting PPP session...
[PPP] Sending PPP configuration AT commands...
[PPP] PPP connection initiated
[PPP] PPP is UP, IP: 10.xxx.xxx.xxx
[Main] State transition: PPP_CONNECTING -> PPP_UP (time in state: 15234ms)
[Main] State transition: PPP_UP -> MQTT_CONNECTING (time in state: 10ms)
[MQTT] Connecting to broker 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud:8883...
[MQTT] Connected to broker
[MQTT] Subscribed to pgr/mitspe6/gate/cmd
[Main] State transition: MQTT_CONNECTING -> MQTT_CONNECTED (time in state: 2341ms)
[Main] Status published: {"deviceId":"mitspe6-gate-001","online":true,"updatedAt":1234567890,"fwVersion":"fw-dev-0.1"}
```

**Key Indicators**:
- ✅ Modem initializes successfully
- ✅ PPP connection establishes (IP assigned)
- ✅ MQTT connects to production broker
- ✅ Subscribes to command topic
- ✅ Status messages publish every 5 seconds

**If errors occur**:
- Check cellular signal: Look for RSSI values in modem logs
- Verify SIM card is active and has data plan
- Check MQTT credentials are correct
- Verify network registration: `AT+CREG?` should return `0,1` or `0,5`

## Part 2: Backend Setup

### 2.1 Start MongoDB

```bash
# Start MongoDB container
docker-compose up -d mongo

# Verify it's running
docker ps | grep mongo
```

### 2.2 Configure Backend for Production MQTT

Create or update `backend/.env`:

```env
# Database
MONGO_URI=mongodb://localhost:27017/parking-gate

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=15m

# Gate Device Mode: MUST be 'mqtt' for production testing
GATE_DEVICE_MODE=mqtt

# MCU Settings
MCU_TIMEOUT_MS=5000
MCU_RETRY_COUNT=1
MCU_RETRY_DELAY_MS=500  # Recommended: 500ms for cellular networks

# MQTT Configuration (Production HiveMQ Cloud)
MQTT_URL=mqtts://3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud:8883
MQTT_USERNAME=avivais
MQTT_PASSWORD=Avivr_121
MQTT_CMD_TOPIC=pgr/mitspe6/gate/cmd
MQTT_ACK_TOPIC=pgr/mitspe6/gate/ack
MQTT_STATUS_TOPIC=pgr/mitspe6/gate/status
```

**Important**:
- Use `mqtts://` protocol for TLS (port 8883)
- Topics must match firmware configuration exactly
- `GATE_DEVICE_MODE` must be `mqtt` (not `stub`)

### 2.3 Install Dependencies and Start Backend

```bash
cd backend

# Install dependencies (first time only)
npm install

# Start backend in development mode
npm run start:dev
```

### 2.4 Verify Backend Startup

**Expected Backend Logs**:

```
[Nest] Starting Nest application...
[MqttGateDeviceService] Connecting to MQTT broker at mqtts://3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud:8883
[MqttGateDeviceService] MQTT client connected
[MqttGateDeviceService] Subscribed to topics: pgr/mitspe6/gate/ack, pgr/mitspe6/gate/status
[Nest] Application successfully started on port 3001
```

**Key Indicators**:
- ✅ MQTT client connects successfully
- ✅ Subscribes to ACK and STATUS topics
- ✅ Application starts on port 3001
- ✅ No connection errors

**If errors occur**:
- Check `MQTT_URL` uses `mqtts://` for TLS
- Verify MQTT credentials match production broker
- Check network connectivity to HiveMQ Cloud
- Review error messages in logs

### 2.5 Create Admin User and Get JWT Token

To access admin endpoints (like device status), you need an admin user with a JWT token.

#### Option A: Create Admin User via MongoDB (Recommended for Testing)

1. **Register a regular user first**:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123456",
    "firstName": "Admin",
    "lastName": "User",
    "phone": "0501234567",
    "apartmentNumber": 1,
    "floor": 1
  }'
```

**Expected Response**:
```json
{
  "_id": "...",
  "email": "admin@example.com",
  "role": "user",
  "status": "pending",
  ...
}
```

2. **Update user to admin role and approve via MongoDB**:

```bash
# Connect to MongoDB
docker exec -it parking-mongo mongosh parking-gate

# Find the user by email
db.users.findOne({ email: "admin@example.com" })

# Update user to admin role and approve status
db.users.updateOne(
  { email: "admin@example.com" },
  {
    $set: {
      role: "admin",
      status: "approved"
    }
  }
)

# Verify the update
db.users.findOne({ email: "admin@example.com" })
```

**Expected MongoDB Output**:
```javascript
{
  _id: ObjectId("..."),
  email: 'admin@example.com',
  role: 'admin',  // ✅ Changed to admin
  status: 'approved',  // ✅ Changed to approved
  ...
}
```

3. **Login to get JWT token**:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123456",
    "deviceId": "test-device-001"
  }'
```

**Expected Response**:
```json
{
  "user": {
    "_id": "...",
    "email": "admin@example.com",
    "role": "admin",
    "status": "approved",
    ...
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the `accessToken` value** - this is your admin JWT token.

#### Option B: Create Admin User via Frontend

1. Open frontend: `http://localhost:3000`
2. Register a new user via the registration page
3. Update the user in MongoDB (as shown in Option A, step 2)
4. Login via frontend - the JWT token will be stored in browser cookies automatically

### 2.6 Verify Device Status Reception

Once MCU is connected and publishing status, backend should log:

```
[MqttGateDeviceService] Received status message: {"deviceId":"mitspe6-gate-001","online":true,"updatedAt":1234567890,"fwVersion":"fw-dev-0.1"}
[MqttGateDeviceService] Updated device status for mitspe6-gate-001: online=true
```

**Check device status via API**:

```bash
# Use the admin JWT token from step 2.5
curl http://localhost:3001/api/admin/device-status \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Example with actual token**:
```bash
curl http://localhost:3001/api/admin/device-status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Response**:
```json
{
  "items": [
    {
      "deviceId": "mitspe6-gate-001",
      "online": true,
      "updatedAt": 1234567890,
      "lastSeenAt": "2025-01-XX...",
      "rssi": -75,
      "fwVersion": "fw-dev-0.1"
    }
  ],
  "total": 1
}
```

**If you get 401 Unauthorized**:
- Verify the JWT token is correct (copy the full token from login response)
- Check token hasn't expired (default: 15 minutes)
- Ensure user has `role: "admin"` in database
- Ensure user has `status: "approved"` in database

## Part 3: Frontend Setup

### 3.1 Install Dependencies and Start Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start frontend development server
npm run dev
```

### 3.2 Verify Frontend Startup

**Expected Output**:

```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Ready in XXXms
```

**Access Frontend**:
- Open browser: `http://localhost:3000`
- Should see login page

### 3.3 Frontend Logs

Frontend runs in browser, check browser console (F12) for logs:

**Expected Console Logs** (after login):
```
[AuthContext] User authenticated: { id: "...", email: "..." }
[API] Fetching device status...
[API] Device status received: { items: [...], total: 1 }
```

## Part 4: Complete System Log Flow

### 4.1 System Startup Sequence

**Timeline of Expected Logs**:

1. **MCU Boots** (Serial Monitor):
   ```
   [Modem] Powering on modem...
   [Modem] Initialization complete
   [PPP] PPP is UP, IP: 10.xxx.xxx.xxx
   [MQTT] Connected to broker
   [MQTT] Subscribed to pgr/mitspe6/gate/cmd
   [Main] Status published: {...}
   ```

2. **Backend Receives Status** (Backend Logs):
   ```
   [MqttGateDeviceService] Received status message: {...}
   [MqttGateDeviceService] Updated device status for mitspe6-gate-001: online=true
   ```

3. **Frontend Displays Device** (Browser Console):
   ```
   [API] Device status received: { items: [{ deviceId: "mitspe6-gate-001", online: true }] }
   ```

### 4.2 Gate Open Command Flow

**When user clicks "Open Gate" in frontend**:

1. **Frontend** (Browser Console):
   ```
   [API] Sending gate open request...
   [API] Gate open response: { success: true, requestId: "..." }
   ```

2. **Backend** (Backend Logs):
   ```
   [GateController] Gate open requested by user: user-123
   [MqttGateDeviceService] Published command for requestId abc-123 to topic pgr/mitspe6/gate/cmd
   [MqttGateDeviceService] Received ACK for requestId abc-123 (duration: 234ms)
   [GateController] Gate open successful
   ```

3. **MCU** (Serial Monitor):
   ```
   [MQTT] Message received on topic: pgr/mitspe6/gate/cmd, payload: {"requestId":"abc-123","command":"open","userId":"user-123","issuedAt":1234567890}
   [Main] Command received on topic: pgr/mitspe6/gate/cmd
   [Main] Parsed command - requestId: abc-123, command: open, userId: user-123
   [Main] Command 'open' acknowledged (GPIO not implemented yet)
   [Main] ACK published: {"requestId":"abc-123","ok":true}
   ```

4. **Backend Receives ACK** (Backend Logs):
   ```
   [MqttGateDeviceService] Received ACK for requestId abc-123: ok=true
   ```

## Part 5: Production Functionality Testing Checklist

### 5.1 Connectivity Tests

- [ ] **MCU Modem Initialization**
  - [ ] Modem powers on successfully
  - [ ] AT handshake completes
  - [ ] SIM card detected
  - [ ] Network registration successful
  - [ ] Signal strength reported (RSSI)

- [ ] **PPP Connection**
  - [ ] PPP session starts
  - [ ] IP address assigned
  - [ ] DNS resolution works
  - [ ] Connection stable (no frequent disconnects)

- [ ] **MQTT Connection**
  - [ ] Connects to production broker
  - [ ] TLS handshake successful
  - [ ] Subscribes to command topic
  - [ ] Connection remains stable

### 5.2 Status Reporting Tests

- [ ] **Status Heartbeat**
  - [ ] MCU publishes status every 5 seconds
  - [ ] Backend receives and stores status
  - [ ] Status includes: deviceId, online, updatedAt, fwVersion
  - [ ] Frontend displays device as "online"

- [ ] **Device Status API**
  - [ ] Admin can query device status
  - [ ] Status shows correct deviceId
  - [ ] `online` field reflects actual connection state
  - [ ] `lastSeenAt` updates when status received

### 5.3 Command Execution Tests

- [ ] **Gate Open Command**
  - [ ] User can trigger gate open from frontend
  - [ ] Backend publishes command to MQTT
  - [ ] MCU receives command
  - [ ] MCU publishes ACK with `ok: true`
  - [ ] Backend receives ACK within timeout
  - [ ] Frontend shows success message

- [ ] **Command Error Handling**
  - [ ] Unknown command returns `ok: false, errorCode: "UNKNOWN_COMMAND"`
  - [ ] Backend handles error ACK correctly
  - [ ] Frontend displays error message

- [ ] **Timeout Handling**
  - [ ] If MCU doesn't respond, backend times out after 5 seconds
  - [ ] Frontend shows timeout error
  - [ ] Backend retries (if configured)

### 5.4 Recovery and Resilience Tests

- [ ] **MQTT Reconnection**
  - [ ] If MQTT disconnects, MCU reconnects automatically
  - [ ] Backend reconnects if connection lost
  - [ ] Status continues after reconnection

- [ ] **PPP Recovery**
  - [ ] If PPP fails, MCU attempts to rebuild connection
  - [ ] After X failures, modem hard reset triggered
  - [ ] System recovers after reset

- [ ] **Network Resilience**
  - [ ] System handles temporary network outages
  - [ ] Commands queue and execute when connection restored
  - [ ] Status updates resume automatically

### 5.5 Frontend Integration Tests

- [ ] **Authentication**
  - [ ] User can register new account
  - [ ] User can login
  - [ ] Admin can approve pending users
  - [ ] JWT tokens work correctly

- [ ] **Device Status Display**
  - [ ] Admin sees device status in dashboard
  - [ ] Online/offline status updates in real-time
  - [ ] Device details (RSSI, firmware version) displayed

- [ ] **Gate Control**
  - [ ] Approved users can open gate
  - [ ] Gate open button works
  - [ ] Success/error messages display correctly
  - [ ] Request ID shown for tracking

### 5.6 Security Tests

- [ ] **MQTT Authentication**
  - [ ] Backend authenticates with correct credentials
  - [ ] MCU authenticates with correct credentials
  - [ ] Invalid credentials rejected

- [ ] **Topic Access Control**
  - [ ] Backend can only publish to CMD topic
  - [ ] MCU can only subscribe to CMD topic
  - [ ] MCU can only publish to ACK and STATUS topics
  - [ ] Backend can only subscribe to ACK and STATUS topics

- [ ] **API Security**
  - [ ] Unauthenticated requests rejected
  - [ ] Non-admin users cannot access admin endpoints
  - [ ] Pending users cannot open gate

## Part 6: Troubleshooting

### 6.1 MCU Not Connecting to MQTT

**Symptoms**:
- Serial monitor shows MQTT connection failures
- No status messages published

**Checks**:
1. Verify MQTT credentials in `config.h`
2. Check cellular signal strength (RSSI)
3. Verify SIM card has active data plan
4. Check PPP connection is up (IP assigned)
5. Test MQTT broker connectivity from another device

**Debug Commands** (Serial Monitor):
- Check modem: Send `AT` command manually
- Check network: `AT+CREG?` should return `0,1` or `0,5`
- Check signal: `AT+CSQ` should show signal strength

### 6.2 Backend Not Receiving Status

**Symptoms**:
- MCU publishes status but backend doesn't log it
- Device status API returns empty

**Checks**:
1. Backend `MQTT_URL` matches MCU broker
2. Topics match exactly: `pgr/mitspe6/gate/status`
3. Backend logs show "Subscribed to topics: ... pgr/mitspe6/gate/status"
4. MQTT broker ACL allows device to publish to status topic
5. Check backend logs for MQTT errors

### 6.3 Gate Open Command Not Working

**Symptoms**:
- Frontend shows error
- Backend logs show timeout
- MCU doesn't receive command

**Checks**:
1. MCU is online (status messages received)
2. Topics match: `pgr/mitspe6/gate/cmd`
3. Backend publishes command (check logs)
4. MCU subscribed to command topic (check serial monitor)
5. MQTT broker ACL allows communication
6. Check MQTT broker logs for message routing

### 6.4 Frontend Not Displaying Device

**Symptoms**:
- Device status page empty
- No devices shown

**Checks**:
1. Backend is receiving status messages
2. Device status API returns data (test with curl)
3. Frontend API calls succeed (check browser console)
4. User has admin role (for device status page)
5. Check browser network tab for API errors

## Part 7: Local Testing with Mosquitto (Alternative)

If you want to test locally without production MQTT broker:

### 7.1 Setup Local Mosquitto

```bash
# Create password file
mosquitto_passwd -c mqtt/passwordfile pgr_server
# Enter password: pgr_dev_password_change_me

mosquitto_passwd mqtt/passwordfile pgr_device_mitspe6
# Enter device password

# Start Mosquitto
docker network create parking_net 2>/dev/null || true
docker compose -f docker-compose.mqtt.yml up -d
```

### 7.2 Update Configurations

**MCU Firmware** (`firmware/src/config/config.h`):
```cpp
#define MQTT_HOST "localhost"  // Or your computer's IP
#define MQTT_PORT 1883  // Non-TLS for local
```

**Backend** (`backend/.env`):
```env
MQTT_URL=mqtt://localhost:1883
```

**Note**: For local testing, you may need to use WiFi instead of cellular, or configure port forwarding.

## Part 8: Clean Up

```bash
# Stop frontend (Ctrl+C in terminal)

# Stop backend (Ctrl+C in terminal)

# Stop MongoDB
docker-compose down mongo

# Stop Mosquitto (if used)
docker compose -f docker-compose.mqtt.yml down
```

## Next Steps

- See [docs/mqtt-protocol.md](mqtt-protocol.md) for detailed protocol documentation
- See [docs/mqtt-sim.md](mqtt-sim.md) for MCU simulator usage
- Review production deployment checklist before going live
- Set up monitoring and alerting for production
