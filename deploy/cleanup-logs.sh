#!/bin/bash
# Log Rotation and Cleanup Script
# Rotates Docker logs and cleans up old log files
# Run via cron: 0 4 * * * (daily at 4 AM)

set -e

PROJECT_DIR="/opt/parking-gate-remote"
LOG_FILE="$PROJECT_DIR/cleanup.log"
MAX_LOG_SIZE="10m"
MAX_LOG_FILES=3
MAX_LOG_AGE_DAYS=30

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Log Cleanup Started ==="

# Docker log rotation is configured in docker-compose.yml
# This script handles additional cleanup

# Clean up old monitoring logs (keep last 30 days)
log "Cleaning up old monitoring logs..."
if [ -f "$PROJECT_DIR/monitoring.log" ]; then
    # Rotate if larger than 50MB
    if [ -f "$PROJECT_DIR/monitoring.log" ] && [ $(stat -f%z "$PROJECT_DIR/monitoring.log" 2>/dev/null || stat -c%s "$PROJECT_DIR/monitoring.log" 2>/dev/null) -gt 52428800 ]; then
        mv "$PROJECT_DIR/monitoring.log" "$PROJECT_DIR/monitoring.log.old"
        touch "$PROJECT_DIR/monitoring.log"
        log "Rotated monitoring.log"
    fi
    # Remove old rotated logs
    find "$PROJECT_DIR" -name "monitoring.log.*" -mtime +$MAX_LOG_AGE_DAYS -delete 2>/dev/null || true
fi

# Clean up old cleanup logs
log "Cleaning up old cleanup logs..."
if [ -f "$LOG_FILE" ]; then
    # Rotate if larger than 10MB
    if [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt 10485760 ]; then
        mv "$LOG_FILE" "$LOG_FILE.old"
        touch "$LOG_FILE"
        log "Rotated cleanup.log"
    fi
    # Remove old rotated logs
    find "$PROJECT_DIR" -name "cleanup.log.*" -mtime +$MAX_LOG_AGE_DAYS -delete 2>/dev/null || true
fi

# Clean up Apache logs older than 30 days (logrotate handles rotation, we just clean old ones)
log "Cleaning up old Apache logs..."
if [ -d "/var/log/apache2" ]; then
    find /var/log/apache2 -name "*.log.*" -type f -mtime +$MAX_LOG_AGE_DAYS -delete 2>/dev/null || true
    log "Cleaned up old Apache rotated logs"
fi

# Show log disk usage
log "Log disk usage:"
du -sh "$PROJECT_DIR"/*.log* 2>/dev/null | tee -a "$LOG_FILE" || true
du -sh /var/log/apache2/*.log* 2>/dev/null | head -5 | tee -a "$LOG_FILE" || true

log "=== Log Cleanup Completed ==="
log ""

