#!/bin/bash
# Docker Cleanup Script
# Removes unused Docker resources to free up disk space
# Run via cron: 0 3 * * 0 (weekly on Sunday at 3 AM)

set -e

PROJECT_DIR="/opt/parking-gate-remote"
LOG_FILE="$PROJECT_DIR/cleanup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Docker Cleanup Started ==="

# Get disk usage before cleanup
DISK_BEFORE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
log "Disk usage before cleanup: ${DISK_BEFORE}%"

# Remove stopped containers
log "Removing stopped containers..."
STOPPED=$(docker ps -a -q -f status=exited 2>/dev/null | wc -l)
if [ "$STOPPED" -gt 0 ]; then
    docker container prune -f 2>/dev/null || true
    log "Removed stopped containers"
else
    log "No stopped containers to remove"
fi

# Remove unused images (keep images used by running containers)
log "Removing unused images..."
docker image prune -a -f --filter "until=168h" 2>/dev/null || true
log "Removed unused images older than 7 days"

# Remove unused volumes (be careful - this removes volumes not used by any container)
log "Removing unused volumes..."
UNUSED_VOLUMES=$(docker volume ls -q -f dangling=true 2>/dev/null | wc -l)
if [ "$UNUSED_VOLUMES" -gt 0 ]; then
    # Only remove truly unused volumes (not our data volumes)
    docker volume ls -q -f dangling=true | while read vol; do
        # Skip our named volumes
        if [[ ! "$vol" =~ ^parking_ ]]; then
            docker volume rm "$vol" 2>/dev/null || true
        fi
    done
    log "Removed unused volumes (preserved parking_* volumes)"
else
    log "No unused volumes to remove"
fi

# Remove unused networks
log "Removing unused networks..."
docker network prune -f 2>/dev/null || true
log "Removed unused networks"

# Remove build cache (this can free up significant space)
log "Removing Docker build cache..."
docker builder prune -a -f --filter "until=168h" 2>/dev/null || true
log "Removed build cache older than 7 days"

# Get disk usage after cleanup
DISK_AFTER=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
FREED=$((DISK_BEFORE - DISK_AFTER))

log "Disk usage after cleanup: ${DISK_AFTER}%"
if [ "$FREED" -gt 0 ]; then
    log "Freed up ${FREED}% disk space"
else
    log "No significant disk space freed"
fi

# Show Docker disk usage
log "Docker disk usage:"
docker system df 2>/dev/null | tee -a "$LOG_FILE" || true

log "=== Docker Cleanup Completed ==="
log ""

