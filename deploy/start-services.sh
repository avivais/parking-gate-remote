#!/bin/bash
# Start all Docker services
# Run this on the EC2 instance

set -e

PROJECT_DIR="/opt/parking-gate-remote"

# Detect docker-compose command (try docker compose v2 first, then docker-compose v1)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "Error: docker compose or docker-compose not found"
    echo "Please install Docker Compose"
    exit 1
fi

echo "=== Starting Docker Services ==="
echo "Using: $DOCKER_COMPOSE"
echo ""

cd $PROJECT_DIR

# Remove manually created network if it exists (docker-compose will create it with proper labels)
# This fixes the warning about network not being created by compose
if docker network inspect parking_net &> /dev/null; then
    # Check if network was created by compose (has the proper label)
    NETWORK_LABEL=$(docker network inspect parking_net --format '{{index .Labels "com.docker.compose.network"}}' 2>/dev/null || echo "")
    if [ -z "$NETWORK_LABEL" ] || [ "$NETWORK_LABEL" != "parking_net" ]; then
        echo "Removing manually created network (docker-compose will recreate it with proper labels)..."
        docker network rm parking_net 2>/dev/null || true
        sleep 1
    else
        echo "Network already exists and was created by docker-compose"
    fi
fi

# Start MongoDB
echo ""
echo "Starting MongoDB..."
$DOCKER_COMPOSE up -d mongo

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to be ready..."
sleep 5

# Start MQTT broker
echo ""
echo "Starting MQTT broker..."
$DOCKER_COMPOSE -f docker-compose.mqtt.yml up -d

# Wait a moment for MQTT
sleep 2

# Start backend
echo ""
echo "Starting backend..."
$DOCKER_COMPOSE up -d backend

# Wait a moment for backend
sleep 2

# Start frontend
echo ""
echo "Starting frontend..."
$DOCKER_COMPOSE up -d frontend

# Show status
echo ""
echo "=== Service Status ==="
$DOCKER_COMPOSE ps
$DOCKER_COMPOSE -f docker-compose.mqtt.yml ps

echo ""
echo "=== Services Started ==="
echo ""
echo "Check logs with:"
echo "  docker logs parking-mongo"
echo "  docker logs parking-mosquitto"
echo "  docker logs parking-backend"
echo "  docker logs parking-frontend"

