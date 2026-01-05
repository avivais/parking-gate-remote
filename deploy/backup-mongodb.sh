#!/bin/bash
# MongoDB Backup Script
# Run this via cron for automated backups

set -e

PROJECT_DIR="/opt/parking-gate-remote"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mongodb_backup_$DATE"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting MongoDB backup at $(date)"

# Create backup using mongodump from the container
docker exec parking-mongo mongodump --archive > "$BACKUP_FILE.archive" 2>/dev/null || {
    echo "Error: Failed to create backup"
    exit 1
}

# Compress the backup
gzip "$BACKUP_FILE.archive"
mv "$BACKUP_FILE.archive.gz" "$BACKUP_FILE.tar.gz"

echo "Backup created: $BACKUP_FILE.tar.gz"
echo "Size: $(du -h "$BACKUP_FILE.tar.gz" | cut -f1)"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "mongodb_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed at $(date)"
echo "Old backups (older than 7 days) have been removed"

