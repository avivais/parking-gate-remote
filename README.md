# Parking Gate Remote

A NestJS backend and Next.js frontend application for remote gate control with MQTT support for cellular-only microcontrollers.

## Architecture

- **Backend**: NestJS application with MongoDB
- **Frontend**: Next.js application
- **MQTT Broker**: Mosquitto (optional, for MQTT mode)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- MongoDB (via Docker Compose)
- Mosquitto client tools (for testing MQTT)

### 1. Start MongoDB

```bash
docker-compose up -d mongo
```

### 2. Start MQTT Broker (Optional - only needed for MQTT mode)

Before starting the broker, you need to set up the password file:

```bash
# Install mosquitto_passwd if not already installed
# macOS: brew install mosquitto
# Ubuntu/Debian: sudo apt-get install mosquitto-clients

# Generate password file
mosquitto_passwd -c mqtt/passwordfile pgr_server
# Enter password when prompted (default: pgr_dev_password_change_me)

# Add device user (optional, for testing)
mosquitto_passwd mqtt/passwordfile pgr_device_mitspe6
```

Then start the broker:

```bash
# Ensure the main network exists
docker network create parking_net 2>/dev/null || true

# Start Mosquitto
docker-compose -f docker-compose.mqtt.yml up -d
```

### 3. Configure Backend

Create `backend/.env` file with required environment variables:

```env
# Database
MONGO_URI=mongodb://localhost:27017/parking-gate

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=15m

# Gate Device Mode: 'stub' or 'mqtt'
GATE_DEVICE_MODE=stub

# MCU Settings (used by both stub and MQTT modes)
MCU_TIMEOUT_MS=2500
MCU_RETRY_COUNT=1
MCU_RETRY_DELAY_MS=250

# MQTT Configuration (only needed when GATE_DEVICE_MODE=mqtt)
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=pgr_server
MQTT_PASSWORD=pgr_dev_password_change_me
MQTT_CMD_TOPIC=pgr/mitspe6/gate/cmd
MQTT_ACK_TOPIC=pgr/mitspe6/gate/ack
MQTT_STATUS_TOPIC=pgr/mitspe6/gate/status
```

### 4. Start Backend

```bash
cd backend
npm install
npm run start:dev
```

Backend will run on `http://localhost:3001/api`

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3000`

## MQTT Mode

### Overview

When `GATE_DEVICE_MODE=mqtt`, the backend communicates with the gate device via MQTT instead of using the stub implementation.

### Message Format

**Command Message** (published to `pgr/mitspe6/gate/cmd`):
```json
{
  "requestId": "uuid-here",
  "command": "open",
  "userId": "user-id-here"
}
```

**ACK Message** (published to `pgr/mitspe6/gate/ack`):
```json
{
  "requestId": "uuid-here",
  "ok": true
}
```

Or on error:
```json
{
  "requestId": "uuid-here",
  "ok": false,
  "errorCode": "optional-error-code"
}
```

### Testing MQTT Mode

#### 1. Start the broker and backend

```bash
# Start broker
docker-compose -f docker-compose.mqtt.yml up -d

# Start backend with MQTT mode
cd backend
GATE_DEVICE_MODE=mqtt npm run start:dev
```

#### 2. Simulate device ACK (in a separate terminal)

Subscribe to commands and publish ACKs:

```bash
# Subscribe to command topic (as device)
mosquitto_sub -h localhost -p 1883 \
  -u pgr_device_mitspe6 -P <device-password> \
  -t "pgr/mitspe6/gate/cmd" -q 1

# In another terminal, publish ACK when you receive a command
mosquitto_pub -h localhost -p 1883 \
  -u pgr_device_mitspe6 -P <device-password> \
  -t "pgr/mitspe6/gate/ack" -q 1 \
  -m '{"requestId":"<request-id-from-cmd>","ok":true}'
```

#### 3. Test via API

```bash
# Get auth token first (via login endpoint)
TOKEN="your-jwt-token"

# Open gate
curl -X POST http://localhost:3001/api/gate/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $(uuidgen)"
```

#### 4. Automated Test Script

Create a simple script to simulate the device:

```bash
#!/bin/bash
# test-mqtt-device.sh

mosquitto_sub -h localhost -p 1883 \
  -u pgr_device_mitspe6 -P <device-password> \
  -t "pgr/mitspe6/gate/cmd" -q 1 | while read -r line; do
  CMD=$(echo "$line" | jq -r '.')
  REQ_ID=$(echo "$CMD" | jq -r '.requestId')

  echo "Received command: $CMD"
  echo "Sending ACK for requestId: $REQ_ID"

  mosquitto_pub -h localhost -p 1883 \
    -u pgr_device_mitspe6 -P <device-password> \
    -t "pgr/mitspe6/gate/ack" -q 1 \
    -m "{\"requestId\":\"$REQ_ID\",\"ok\":true}"
done
```

## Developer Checklist

### Local Development Setup

1. ✅ Start MongoDB: `docker-compose up -d mongo`
2. ✅ Generate MQTT password file: `mosquitto_passwd -c mqtt/passwordfile pgr_server`
3. ✅ Start MQTT broker: `docker-compose -f docker-compose.mqtt.yml up -d`
4. ✅ Configure backend `.env` with `GATE_DEVICE_MODE=stub` or `mqtt`
5. ✅ Install backend dependencies: `cd backend && npm install`
6. ✅ Start backend: `npm run start:dev`
7. ✅ Install frontend dependencies: `cd frontend && npm install`
8. ✅ Start frontend: `npm run dev`

### Testing MQTT Integration

1. ✅ Set `GATE_DEVICE_MODE=mqtt` in backend `.env`
2. ✅ Verify broker is running: `docker logs parking-mosquitto`
3. ✅ Test broker connection: `mosquitto_sub -h localhost -p 1883 -u pgr_server -P <password> -t '#'`
4. ✅ Simulate device: Use `mosquitto_sub` to listen on `cmd` topic and `mosquitto_pub` to send ACKs
5. ✅ Test API endpoint: `POST /api/gate/open` with valid JWT token
6. ✅ Verify logs: Check backend logs for MQTT connection and message flow

### Production Considerations

- [ ] Change default MQTT passwords
- [ ] Use proper TLS certificates (not self-signed)
- [ ] Configure firewall rules for MQTT ports
- [ ] Set up monitoring for MQTT broker
- [ ] Configure MQTT broker persistence and backup
- [ ] Review ACL rules for production devices
- [ ] Set appropriate `MCU_TIMEOUT_MS` and retry settings

## Environment Variables Reference

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `GATE_DEVICE_MODE` | `stub` | Device communication mode: `stub` or `mqtt` |
| `MCU_TIMEOUT_MS` | `2500` | Timeout for MCU operations (ms) |
| `MCU_RETRY_COUNT` | `1` | Number of retry attempts |
| `MCU_RETRY_DELAY_MS` | `250` | Delay between retries (ms) |
| `MQTT_URL` | `mqtt://localhost:1883` | MQTT broker URL |
| `MQTT_USERNAME` | `pgr_server` | MQTT username |
| `MQTT_PASSWORD` | `pgr_dev_password_change_me` | MQTT password |
| `MQTT_CMD_TOPIC` | `pgr/mitspe6/gate/cmd` | Command topic |
| `MQTT_ACK_TOPIC` | `pgr/mitspe6/gate/ack` | ACK topic |
| `MQTT_STATUS_TOPIC` | `pgr/mitspe6/gate/status` | Status topic |

## Troubleshooting

### MQTT Connection Issues

- Verify broker is running: `docker ps | grep mosquitto`
- Check broker logs: `docker logs parking-mosquitto`
- Verify password file exists: `ls -la mqtt/passwordfile`
- Test connection manually: `mosquitto_sub -h localhost -p 1883 -u pgr_server -P <password> -t '#'`

### Backend Errors

- Check `GATE_DEVICE_MODE` is set correctly
- Verify MQTT environment variables are set when using MQTT mode
- Check backend logs for connection errors
- Ensure MongoDB is running and accessible

## License

[Add your license here]

