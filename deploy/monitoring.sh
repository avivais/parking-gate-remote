#!/bin/bash
# Basic Health Check Script
# Run this via cron to monitor services

PROJECT_DIR="/opt/parking-gate-remote"
LOG_FILE="$PROJECT_DIR/monitoring.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Health Check Started ==="

# Check Docker containers
log "Checking Docker containers..."
UNHEALTHY=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep -v "healthy\|Up" | wc -l)
if [ "$UNHEALTHY" -gt 0 ]; then
    log "WARNING: Some containers are not healthy!"
    docker ps --format "{{.Names}}\t{{.Status}}" | grep -v "healthy\|Up" | while read line; do
        log "  - $line"
    done
else
    log "✓ All containers are healthy"
fi

# Check disk space
log "Checking disk space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    log "WARNING: Disk usage is ${DISK_USAGE}%"
else
    log "✓ Disk usage: ${DISK_USAGE}%"
fi

# Check MongoDB
log "Checking MongoDB..."
if docker exec parking-mongo mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    log "✓ MongoDB is responding"
else
    log "ERROR: MongoDB is not responding!"
fi

# Check Backend API
log "Checking Backend API..."
if curl -s -f http://localhost:3001/api > /dev/null 2>&1; then
    log "✓ Backend API is responding"
else
    log "ERROR: Backend API is not responding!"
fi

# Check Frontend
log "Checking Frontend..."
if curl -s -f http://localhost:3003 > /dev/null 2>&1; then
    log "✓ Frontend is responding"
else
    log "ERROR: Frontend is not responding!"
fi

# Check MQTT Broker
log "Checking MQTT Broker..."
if docker exec parking-mosquitto sh /usr/local/bin/healthcheck.sh > /dev/null 2>&1; then
    log "✓ MQTT Broker is healthy"
else
    log "ERROR: MQTT Broker healthcheck failed!"
fi

log "=== Health Check Completed ==="
log ""

