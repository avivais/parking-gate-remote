#!/bin/bash
# System Cleanup Script
# Cleans up system package cache, temporary files, etc.
# Run via cron: 0 5 * * 0 (weekly on Sunday at 5 AM)

set -e

PROJECT_DIR="/opt/parking-gate-remote"
LOG_FILE="$PROJECT_DIR/cleanup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== System Cleanup Started ==="

# Get disk usage before cleanup
DISK_BEFORE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
log "Disk usage before cleanup: ${DISK_BEFORE}%"

# Clean up APT package cache
log "Cleaning up APT package cache..."
if command -v apt-get >/dev/null 2>&1; then
    apt-get clean -y 2>/dev/null || true
    apt-get autoclean -y 2>/dev/null || true
    log "Cleaned APT package cache"
fi

# Remove old APT lists (keep current)
log "Removing old APT package lists..."
if [ -d "/var/lib/apt/lists" ]; then
    find /var/lib/apt/lists -type f -mtime +7 -delete 2>/dev/null || true
    log "Cleaned old APT package lists"
fi

# Clean up temporary files
log "Cleaning up temporary files..."
# /tmp files older than 7 days
find /tmp -type f -mtime +7 -delete 2>/dev/null || true
find /var/tmp -type f -mtime +7 -delete 2>/dev/null || true
log "Cleaned up old temporary files"

# Clean up old core dumps (if any)
log "Cleaning up old core dumps..."
find /var/crash -type f -mtime +30 -delete 2>/dev/null || true
log "Cleaned up old core dumps"

# Clean up old journal logs (systemd)
log "Cleaning up old journal logs..."
if command -v journalctl >/dev/null 2>&1; then
    journalctl --vacuum-time=30d 2>/dev/null || true
    journalctl --vacuum-size=500M 2>/dev/null || true
    log "Cleaned up old journal logs (kept last 30 days, max 500MB)"
fi

# Get disk usage after cleanup
DISK_AFTER=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
FREED=$((DISK_BEFORE - DISK_AFTER))

log "Disk usage after cleanup: ${DISK_AFTER}%"
if [ "$FREED" -gt 0 ]; then
    log "Freed up ${FREED}% disk space"
else
    log "No significant disk space freed"
fi

log "=== System Cleanup Completed ==="
log ""

