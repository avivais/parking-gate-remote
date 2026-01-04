#!/bin/bash
# Start all Docker services
# Run this on the EC2 instance

set -e

PROJECT_DIR="/opt/parking-gate-remote"

echo "=== Starting Docker Services ==="

cd $PROJECT_DIR

# Create network if it doesn't exist
docker network create parking_net 2>/dev/null || echo "Network already exists"

# Start MongoDB
echo ""
echo "Starting MongoDB..."
docker-compose up -d mongo

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to be ready..."
sleep 5

# Start MQTT broker
echo ""
echo "Starting MQTT broker..."
docker-compose -f docker-compose.mqtt.yml up -d

# Wait a moment for MQTT
sleep 2

# Start backend
echo ""
echo "Starting backend..."
docker-compose up -d backend

# Wait a moment for backend
sleep 2

# Start frontend
echo ""
echo "Starting frontend..."
docker-compose up -d frontend

# Show status
echo ""
echo "=== Service Status ==="
docker-compose ps
docker-compose -f docker-compose.mqtt.yml ps

echo ""
echo "=== Services Started ==="
echo ""
echo "Check logs with:"
echo "  docker logs parking-mongo"
echo "  docker logs parking-mosquitto"
echo "  docker logs parking-backend"
echo "  docker logs parking-frontend"

