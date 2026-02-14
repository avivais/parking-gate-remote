#!/usr/bin/env bash
# Verify local configuration and start all components: MongoDB, (optional) MQTT broker,
# backend, frontend, and (optional) MCU simulator. Run from repository root.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_ENV="$REPO_ROOT/backend/.env"
MQTT_PWFILE="$REPO_ROOT/mqtt/passwordfile"
COMPOSE_MAIN="$REPO_ROOT/docker-compose.yml"
COMPOSE_MQTT="$REPO_ROOT/docker-compose.mqtt.yml"

command -v docker &>/dev/null || { echo "Error: Docker is required but not installed or not in PATH."; exit 1; }
docker info &>/dev/null || { echo "Error: Docker daemon is not running. Start Docker Desktop (or the Docker service) and try again."; exit 1; }

COMPOSE="docker compose"
docker compose version &>/dev/null 2>&1 || COMPOSE="docker-compose"

# ----- Verification -----
echo "Verifying local configuration..."

if [[ ! -f "$BACKEND_ENV" ]]; then
    echo "Error: backend/.env not found. Copy backend/.env.example to backend/.env and set MONGO_URI, etc."
    exit 1
fi

if ! grep -q "MONGO_URI=" "$BACKEND_ENV"; then
    echo "Error: backend/.env must define MONGO_URI (e.g. mongodb://localhost:27017/parking-gate)"
    exit 1
fi

GATE_MODE=$(grep -E "^GATE_DEVICE_MODE=" "$BACKEND_ENV" | cut -d= -f2 | tr -d '"' | tr -d "'" || true)
if [[ -z "$GATE_MODE" ]]; then
    GATE_MODE="stub"
fi

USE_MQTT=false
if [[ "$GATE_MODE" == "mqtt" ]]; then
    USE_MQTT=true
    if [[ ! -f "$MQTT_PWFILE" ]]; then
        echo "Creating mqtt/passwordfile (required for MQTT mode)..."
        docker run --rm -v "$REPO_ROOT/mqtt:/mqtt" eclipse-mosquitto:2.0 sh -c \
            "mosquitto_passwd -c -b /mqtt/passwordfile pgr_server pgr_dev_local && mosquitto_passwd -b /mqtt/passwordfile pgr_device_mitspe6 pgr_device_local"
    fi
    if [[ ! -f "$MQTT_PWFILE" ]]; then
        echo "Error: could not create mqtt/passwordfile. Create it manually (see mqtt/README.md)."
        exit 1
    fi
fi

# Ensure Docker network exists (for compose)
echo "Ensuring Docker network parking_net exists..."
docker network create parking_net 2>/dev/null || true

# ----- Stop any existing local processes -----
echo "Stopping any existing processes on ports 3000 and 3001..."
pids=$(lsof -ti :3001 2>/dev/null); [[ -n "$pids" ]] && echo "$pids" | xargs kill -9 2>/dev/null || true
pids=$(lsof -ti :3000 2>/dev/null); [[ -n "$pids" ]] && echo "$pids" | xargs kill -9 2>/dev/null || true
pkill -f "nest start" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*mcu-sim/src/index" 2>/dev/null || true
sleep 2

# ----- Start Docker stacks -----
echo "Starting MongoDB..."
$COMPOSE -f "$COMPOSE_MAIN" up -d mongo || { echo "Error: Failed to start MongoDB. Check Docker and docker-compose."; exit 1; }

if [[ "$USE_MQTT" == "true" ]]; then
    echo "Starting MQTT broker (Mosquitto)..."
    $COMPOSE -f "$COMPOSE_MQTT" up -d || { echo "Error: Failed to start MQTT broker."; exit 1; }
fi

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to accept connections..."
for i in $(seq 1 30); do
    if docker exec parking-mongo mongosh --quiet --eval "db.adminCommand('ping')" 2>/dev/null; then
        echo "  MongoDB is ready."
        break
    fi
    sleep 1
    [[ $i -eq 30 ]] && echo "Warning: MongoDB may not be ready yet; backend might retry."
done

# ----- Start backend -----
echo "Starting backend (NestJS)..."
(cd "$REPO_ROOT/backend" && nohup npm run start:dev > "$REPO_ROOT/backend.log" 2>&1 &)
cd "$REPO_ROOT"

# ----- Start frontend -----
echo "Starting frontend (Next.js)..."
(cd "$REPO_ROOT/frontend" && nohup npm run dev > "$REPO_ROOT/frontend.log" 2>&1 &)
cd "$REPO_ROOT"

# ----- Start MCU simulator if MQTT mode -----
if [[ "$USE_MQTT" == "true" ]]; then
    echo "Starting MCU simulator..."
    # Plain-text log: NO_COLOR disables ANSI in Node; simple redirect, no pipe
    rm -f "$REPO_ROOT/mcu-sim.log"
    (cd "$REPO_ROOT/mcu-sim" && \
      NO_COLOR=1 MQTT_URL=mqtt://localhost:1883 MQTT_DEVICE_PASSWORD=pgr_device_local MCU_DIAGNOSTICS_ON_RECONNECT=true \
      node src/index.js >> "$REPO_ROOT/mcu-sim.log" 2>&1) &
    disown 2>/dev/null || true
fi
cd "$REPO_ROOT"

# ----- Summary -----
sleep 6
echo ""
echo "Local stack started. Backend may need a few more seconds to connect."
echo ""
echo "  Frontend:    http://localhost:3000"
echo "  Backend API: http://localhost:3001/api"
echo "  MongoDB:     localhost:27017 (container: parking-mongo)"
if [[ "$USE_MQTT" == "true" ]]; then
    echo "  MQTT broker: localhost:1883 (container: parking-mosquitto)"
    echo "  MCU sim:     running (device status in Admin → Devices)"
fi
echo ""
echo "Logs: backend.log, frontend.log" && [[ "$USE_MQTT" == "true" ]] && echo "       mcu-sim.log"
echo "To stop: ./scripts/stop-local.sh"
echo ""

# Quick sanity check
if lsof -ti :3000 &>/dev/null && lsof -ti :3001 &>/dev/null; then
    echo "Verification: Frontend (3000) and Backend (3001) are listening."
else
    echo "Note: If frontend or backend did not start, check backend.log and frontend.log for errors."
fi
