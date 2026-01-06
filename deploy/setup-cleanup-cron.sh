#!/bin/bash
# Setup Cleanup Cron Jobs
# Run this script to install all cleanup cron jobs

set -e

PROJECT_DIR="/opt/parking-gate-remote"

# This script should be run as the ubuntu user (not sudo)
# It will add cron jobs to the ubuntu user's crontab

echo "=== Setting up Cleanup Cron Jobs ==="
echo ""

# Make scripts executable
chmod +x "$PROJECT_DIR/cleanup-docker.sh"
chmod +x "$PROJECT_DIR/cleanup-logs.sh"
chmod +x "$PROJECT_DIR/cleanup-system.sh"
chmod +x "$PROJECT_DIR/backup-mongodb.sh"
chmod +x "$PROJECT_DIR/monitoring.sh"

echo "✓ Made cleanup scripts executable"
echo ""

# Backup existing crontab
CRON_BACKUP="$PROJECT_DIR/crontab.backup.$(date +%Y%m%d_%H%M%S)"
crontab -l > "$CRON_BACKUP" 2>/dev/null || true
echo "✓ Backed up existing crontab to $CRON_BACKUP"
echo ""

# Check if cron jobs already exist
CRON_EXISTS=false
if crontab -l 2>/dev/null | grep -q "cleanup-docker.sh"; then
    CRON_EXISTS=true
fi

if [ "$CRON_EXISTS" = true ]; then
    echo "⚠ Warning: Cleanup cron jobs already exist!"
    echo "Current crontab:"
    crontab -l
    echo ""
    read -p "Do you want to replace them? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted. No changes made."
        exit 0
    fi
    # Remove existing cleanup cron jobs
    crontab -l 2>/dev/null | grep -v "cleanup-docker.sh" | grep -v "cleanup-logs.sh" | grep -v "cleanup-system.sh" | grep -v "backup-mongodb.sh" | grep -v "monitoring.sh" | crontab - 2>/dev/null || true
fi

# Add cleanup cron jobs
(crontab -l 2>/dev/null; echo "") | crontab - 2>/dev/null || true
(crontab -l 2>/dev/null; echo "# Parking Gate Remote - Cleanup Jobs") | crontab -
(crontab -l 2>/dev/null; echo "# Docker cleanup - Weekly on Sunday at 3 AM") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * 0 $PROJECT_DIR/cleanup-docker.sh >> $PROJECT_DIR/cleanup.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "# Log cleanup - Daily at 4 AM") | crontab -
(crontab -l 2>/dev/null; echo "0 4 * * * $PROJECT_DIR/cleanup-logs.sh >> $PROJECT_DIR/cleanup.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "# System cleanup - Weekly on Sunday at 5 AM") | crontab -
(crontab -l 2>/dev/null; echo "0 5 * * 0 $PROJECT_DIR/cleanup-system.sh >> $PROJECT_DIR/cleanup.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "# MongoDB backup - Daily at 2 AM") | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_DIR/backup-mongodb.sh >> $PROJECT_DIR/backup.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "# Health monitoring - Every 15 minutes") | crontab -
(crontab -l 2>/dev/null; echo "*/15 * * * * $PROJECT_DIR/monitoring.sh >> $PROJECT_DIR/monitoring.log 2>&1") | crontab -

echo "✓ Installed cleanup cron jobs"
echo ""
echo "Cron schedule:"
echo "  - Docker cleanup:     Weekly (Sunday 3 AM)"
echo "  - Log cleanup:        Daily (4 AM)"
echo "  - System cleanup:     Weekly (Sunday 5 AM)"
echo "  - MongoDB backup:     Daily (2 AM)"
echo "  - Health monitoring:   Every 15 minutes"
echo ""
echo "View cron jobs:"
echo "  crontab -l"
echo ""
echo "View cleanup logs:"
echo "  tail -f $PROJECT_DIR/cleanup.log"
echo ""
echo "=== Cleanup Cron Jobs Setup Complete ==="

