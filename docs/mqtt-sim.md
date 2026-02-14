# MCU Simulator Setup and Testing Guide

This document describes how to set up and use the MCU simulator for testing the parking gate remote system.

## Overview

The MCU simulator is a Dockerized Node.js service that simulates an MCU (Microcontroller Unit) device. It connects to the MQTT broker and:

- Subscribes to command topics (`pgr/mitspe6/gate/cmd`)
- Publishes acknowledgments (`pgr/mitspe6/gate/ack`)
- Publishes periodic status updates (`pgr/mitspe6/gate/status`)

## Prerequisites

1. Docker and Docker Compose installed
2. MQTT broker running (via `docker-compose.mqtt.yml`)
3. MQTT device password configured in `mqtt/passwordfile`

## Setup Instructions

### 1. Start MQTT Broker

First, ensure the MQTT broker is running:

```bash
# Create network if it doesn't exist
docker network create parking_net 2>/dev/null || true

# Start Mosquitto broker
docker compose -f docker-compose.mqtt.yml up -d
```

### 2. Configure Device Password

The simulator requires the device password to be set. Ensure `mqtt/passwordfile` contains the `pgr_device_mitspe6` user:

```bash
# Add device user if not already present
mosquitto_passwd mqtt/passwordfile pgr_device_mitspe6
# Enter password when prompted
```

### 3. Start MCU Simulator

You have two options:

**Option A: Start mosquitto separately first (recommended for development)**

```bash
# Set device password (required)
export MQTT_DEVICE_PASSWORD=your_device_password_here

# Optional: Override defaults
export MCU_ACK_MODE=success  # success | fail | timeout | jitter
export MCU_DEVICE_ID=mitspe6-gate-001
export MCU_STATUS_INTERVAL_MS=5000

# Start simulator (mosquitto must already be running)
docker compose -f docker-compose.sim.yml up --build
```

**Option B: Start both services together (with dependency orchestration)**

```bash
# Set device password (required)
export MQTT_DEVICE_PASSWORD=your_device_password_here

# Start both mosquitto and simulator together
# The dependency ensures mosquitto starts before the simulator
docker compose -f docker-compose.mqtt.yml -f docker-compose.sim.yml up --build
```

**Important Notes:**

1. **Why `depends_on` doesn't work when running separately:**
   - Docker Compose validates `depends_on` at **compose file parse time**, not at runtime
   - When you run `docker compose -f docker-compose.sim.yml up`, Compose only reads that file
   - It looks for a service named `mosquitto` in the current project and fails if not found
   - This happens **before** checking if mosquitto is already running as a container
   - The simulator now includes a wait script that checks for mosquitto readiness before connecting

2. **MQTT URL configuration:**
   - Default: `mqtt://parking-mosquitto:1883` (uses container name for separate runs)
   - When using both files together, you can override: `MQTT_URL=mqtt://mosquitto:1883` (uses service name)
   - The simulator will automatically wait for the broker to be ready

3. **Port exposure:**
   - The simulator doesn't need to expose any ports - it only communicates with mosquitto over the internal Docker network
   - Mosquitto exposes ports 1883/8883 to the host for external clients (backend, testing tools)

You can also set environment variables in a `.env` file or directly in `docker-compose.sim.yml`.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_URL` | `mqtt://mosquitto:1883` | MQTT broker URL |
| `MQTT_CMD_TOPIC` | `pgr/mitspe6/gate/cmd` | Command topic to subscribe to |
| `MQTT_ACK_TOPIC` | `pgr/mitspe6/gate/ack` | ACK topic to publish to |
| `MQTT_STATUS_TOPIC` | `pgr/mitspe6/gate/status` | Status topic to publish to |
| `MQTT_DEVICE_USERNAME` | `pgr_device_mitspe6` | MQTT username for device |
| `MQTT_DEVICE_PASSWORD` | *(required)* | MQTT password for device |
| `MCU_DEVICE_ID` | `mitspe6-gate-001` | Device identifier |
| `MCU_ACK_DELAY_MS` | `100` | Delay before sending ACK (ms) |
| `MCU_ACK_MODE` | `success` | ACK behavior mode (see below) |
| `MCU_STATUS_INTERVAL_MS` | `5000` | Status heartbeat interval (ms) |
| `MCU_FW_VERSION` | `sim-1.0.0` | Simulated firmware version |
| `MCU_RSSI` | `-65` | Simulated signal strength (dBm) |
| `MQTT_DIAGNOSTICS_TOPIC` | `pgr/mitspe6/gate/diagnostics` | Topic for diagnostic log batches (MCU → backend) |
| `MCU_DIAGNOSTICS_ON_RECONNECT` | `false` | When `true`, publish a diagnostics batch on every connect/reconnect (for e2e recovery testing) |
| `MCU_DISCONNECT_AFTER_MS` | *(unset)* | If set (e.g. `5000`), voluntarily disconnect after N ms from first connection, then rely on auto-reconnect; use with `MCU_DIAGNOSTICS_ON_RECONNECT=true` for e2e "lose connection → recover → send log" |
| `MCU_SESSION_ID` | `sim-<timestamp>` | Optional session id included in diagnostics payload for correlating batches |

### ACK Modes

The simulator supports different ACK modes for testing various scenarios:

#### `success` (default)
- Publishes successful ACK: `{requestId, ok: true}`
- Use for normal operation testing

#### `fail`
- Publishes error ACK: `{requestId, ok: false, errorCode: "SIM_FAIL"}`
- Use to test error handling

#### `timeout`
- Does NOT publish any ACK
- Use to test backend timeout handling

#### `jitter`
- Random delay between 100-6000ms before publishing ACK
- May cause late ACKs (after backend timeout)
- Use to test timeout edge cases and late ACK handling

### Diagnostics and E2E recovery

When `MCU_DIAGNOSTICS_ON_RECONNECT=true`, the simulator publishes a diagnostics message to `pgr/mitspe6/gate/diagnostics` on every connect (including reconnects after broker down or voluntary disconnect). The payload matches the protocol: `deviceId`, optional `fwVersion`/`sessionId`, and `entries` with `connection_lost` (if a disconnect was observed) and `connection_restored`. Use this with the e2e script `scripts/e2e-recovery-diagnostics.sh` to verify the full "lose connection → recover → send log" flow.

When `MCU_DISCONNECT_AFTER_MS` is set (e.g. `5000`), the simulator disconnects itself after that many milliseconds, then reconnects automatically; combined with `MCU_DIAGNOSTICS_ON_RECONNECT=true`, the next connect sends a diagnostics batch so the backend and admin diagnostics API can be asserted without stopping the broker.

## Testing Scenarios

### 1. Basic Operation Test

```bash
# Start simulator in success mode
export MQTT_DEVICE_PASSWORD=your_password
export MCU_ACK_MODE=success
docker compose -f docker-compose.sim.yml up --build

# In another terminal, call the gate API
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: API returns success, simulator logs show command received and ACK sent
```

### 2. Timeout Test

```bash
# Start simulator in timeout mode
export MQTT_DEVICE_PASSWORD=your_password
export MCU_ACK_MODE=timeout
docker compose -f docker-compose.sim.yml up --build

# Call gate API
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: API returns timeout error after MCU_TIMEOUT_MS (default 5000ms)
```

### 3. Error ACK Test

```bash
# Start simulator in fail mode
export MQTT_DEVICE_PASSWORD=your_password
export MCU_ACK_MODE=fail
docker compose -f docker-compose.sim.yml up --build

# Call gate API
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected: API returns error response with SIM_FAIL error code
```

### 4. Jitter/Late ACK Test

```bash
# Start simulator in jitter mode
export MQTT_DEVICE_PASSWORD=your_password
export MCU_ACK_MODE=jitter
docker compose -f docker-compose.sim.yml up --build

# Call gate API multiple times
# Some requests may timeout, some may succeed
# Backend logs may show "late ack unknown requestId" for ACKs received after timeout
```

### 5. Device Status Monitoring

```bash
# Start simulator
export MQTT_DEVICE_PASSWORD=your_password
docker compose -f docker-compose.sim.yml up --build

# Check admin UI at http://localhost:3000/admin (devices tab)
# Device should appear as "online" with lastSeen updating every MCU_STATUS_INTERVAL_MS

# Stop simulator
docker compose -f docker-compose.sim.yml stop

# Wait for status interval to pass
# Device should show as "offline" in admin UI
```

## Acceptance Test Checklist

- [ ] **Test 1**: Start mosquitto + simulator containers
  ```bash
  docker compose -f docker-compose.mqtt.yml up -d
  docker compose -f docker-compose.sim.yml up --build
  ```

- [ ] **Test 2**: Call `/api/gate/open` → simulator receives cmd and sends ACK → API returns success
  - Verify simulator logs show command received
  - Verify simulator logs show ACK published
  - Verify API returns 200 OK

- [ ] **Test 3**: Switch `MCU_ACK_MODE=timeout` → `/gate/open` should timeout
  - Stop simulator
  - Set `MCU_ACK_MODE=timeout` in environment
  - Restart simulator
  - Call `/api/gate/open`
  - Verify API returns timeout error after `MCU_TIMEOUT_MS`

- [ ] **Test 4**: Switch `MCU_ACK_MODE=jitter` → ensure sometimes timeouts happen, backend logs "late ack unknown requestId"
  - Stop simulator
  - Set `MCU_ACK_MODE=jitter` in environment
  - Restart simulator
  - Call `/api/gate/open` multiple times
  - Verify some requests timeout
  - Verify backend logs show "late ack unknown requestId" for late ACKs

- [ ] **Test 5**: Admin UI shows device online + lastSeen changes every status interval
  - Open admin UI at `/admin` and navigate to "מכשירים" (devices) tab
  - Verify device appears with "מקוון" (online) badge
  - Verify lastSeen updates every `MCU_STATUS_INTERVAL_MS` seconds
  - Verify device shows correct `deviceId`, `rssi`, and `fwVersion` if configured

- [ ] **Test 6**: Stop simulator → device shows offline after status interval timeout
  - Stop simulator: `docker compose -f docker-compose.sim.yml stop`
  - Wait for `MCU_STATUS_INTERVAL_MS` to pass
  - Verify device shows "לא מקוון" (offline) badge in admin UI
  - Verify lastSeen timestamp stops updating

## Troubleshooting

### Simulator won't connect to MQTT broker

- Verify broker is running: `docker ps | grep mosquitto`
- Check broker logs: `docker logs parking-mosquitto`
- Verify password file exists and contains device user: `cat mqtt/passwordfile`
- Verify `MQTT_DEVICE_PASSWORD` environment variable is set correctly
- Check network: `docker network inspect parking_net`

### Simulator connects but doesn't receive commands

- Verify simulator is subscribed to correct topic: Check logs for "Subscribed to pgr/mitspe6/gate/cmd"
- Verify backend is publishing to correct topic: Check backend logs
- Verify ACL allows device user to read command topic: Check `mqtt/aclfile`

### Device status not appearing in admin UI

- Verify backend is receiving status messages: Check backend logs for "Updated device status"
- Verify MongoDB connection: Check backend logs for MongoDB errors
- Verify admin endpoint is accessible: `curl http://localhost:3001/api/admin/device-status -H "Authorization: Bearer TOKEN"`
- Check browser console for API errors

### Late ACKs not being logged

- Verify backend timeout is shorter than jitter delay range (100-6000ms)
- Check backend logs at DEBUG level: `MCU_TIMEOUT_MS` should be less than 6000ms
- Verify simulator is actually delaying ACKs: Check simulator logs for jitter delay messages

## Logs

### Simulator Logs

View simulator logs:
```bash
docker logs -f parking-mcu-sim
```

Expected log messages:
- `[CMD] Received command: {...}` - Command received
- `[ACK] Published ACK: {...}` - ACK sent
- `[STATUS] Published status: {...}` - Status heartbeat sent

### Backend Logs

Check backend logs for:
- `Updated device status for <deviceId>: online=true/false` - Status persisted
- `Received ACK for unknown requestId: <requestId>` - Late ACK detected

## Stopping the Simulator

```bash
# Stop simulator
docker compose -f docker-compose.sim.yml stop

# Stop and remove containers
docker compose -f docker-compose.sim.yml down
```

