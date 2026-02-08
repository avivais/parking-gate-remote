#!/usr/bin/env bash
# Gracefully stop all local components: backend, frontend, MCU simulator, and Docker stacks.
# Run from repository root.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "Stopping local Parking Gate Remote stack..."

# 1. Kill Node processes on app ports (backend 3001, frontend 3000)
for port in 3001 3000; do
    if pid=$(lsof -ti ":$port" 2>/dev/null); then
        echo "  Stopping process on port $port (PID $pid)"
        kill -TERM $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
    fi
done

# 2. Give processes a moment to exit gracefully
sleep 2

# 3. Force-kill any remaining on ports
for port in 3001 3000; do
    pids=$(lsof -ti ":$port" 2>/dev/null)
    [[ -n "$pids" ]] && echo "$pids" | xargs kill -9 2>/dev/null || true
done

# 4. Stop Nest and Next dev servers by name (in case they moved ports)
pkill -f "nest start" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
# MCU simulator (node mcu-sim)
pkill -f "node.*mcu-sim/src/index" 2>/dev/null || true

sleep 1

# 5. Stop Docker Compose stacks (MQTT broker, then main stack for mongo)
if docker compose version &>/dev/null; then
    docker compose -f docker-compose.mqtt.yml down 2>/dev/null || true
    docker compose down 2>/dev/null || true
else
    docker-compose -f docker-compose.mqtt.yml down 2>/dev/null || true
    docker-compose down 2>/dev/null || true
fi

echo "All local components stopped."
echo "  Frontend: http://localhost:3000 (stopped)"
echo "  Backend:  http://localhost:3001/api (stopped)"
echo "  MongoDB and Mosquitto containers are down."
