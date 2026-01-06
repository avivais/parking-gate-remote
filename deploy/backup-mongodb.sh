#!/bin/bash
# MongoDB Backup Script
# Run this via cron for automated backups

set -e

PROJECT_DIR="/opt/parking-gate-remote"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_FILE="$PROJECT_DIR/backup.log"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mongodb_backup_$DATE"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== MongoDB Backup Started ==="

# Create backup using mongodump from the container
log "Creating MongoDB backup..."
docker exec parking-mongo mongodump --archive > "$BACKUP_FILE.archive" 2>/dev/null || {
    log "ERROR: Failed to create backup"
    exit 1
}

# Compress the backup
log "Compressing backup..."
gzip "$BACKUP_FILE.archive"
mv "$BACKUP_FILE.archive.gz" "$BACKUP_FILE.tar.gz"

BACKUP_SIZE=$(du -h "$BACKUP_FILE.tar.gz" | cut -f1)
log "Backup created: $BACKUP_FILE.tar.gz (Size: $BACKUP_SIZE)"

# Keep only last 7 days of backups
log "Cleaning up old backups (keeping last 7 days)..."
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "mongodb_backup_*.tar.gz" -mtime +7 | wc -l)
if [ "$OLD_BACKUPS" -gt 0 ]; then
    find "$BACKUP_DIR" -name "mongodb_backup_*.tar.gz" -mtime +7 -delete
    log "Removed $OLD_BACKUPS old backup(s)"
else
    log "No old backups to remove"
fi

log "=== MongoDB Backup Completed ==="
log ""

