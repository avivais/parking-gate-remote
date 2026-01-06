# Cleanup and Maintenance Guide

This document describes the automated cleanup and maintenance tasks configured for the production deployment.

## Overview

The following cleanup tasks are automated via cron jobs:

1. **Docker Cleanup** - Removes unused Docker resources (weekly)
2. **Log Rotation** - Rotates and cleans up log files (daily)
3. **System Cleanup** - Cleans system package cache and temporary files (weekly)
4. **MongoDB Backup** - Creates backups and removes old ones (daily)
5. **Health Monitoring** - Monitors service health (every 15 minutes)

## Setup

To install all cleanup cron jobs, run:

```bash
cd /opt/parking-gate-remote
./setup-cleanup-cron.sh
```

This will:
- Make all cleanup scripts executable
- Backup your existing crontab
- Install all cleanup cron jobs
- Show you the schedule

## Cleanup Tasks

### 1. Docker Cleanup (`cleanup-docker.sh`)

**Schedule**: Weekly on Sunday at 3 AM

**What it does**:
- Removes stopped containers
- Removes unused Docker images (older than 7 days)
- Removes unused volumes (preserves `parking_*` volumes)
- Removes unused networks
- Removes Docker build cache (older than 7 days)

**Logs**: `/opt/parking-gate-remote/cleanup.log`

**Manual run**:
```bash
cd /opt/parking-gate-remote
./cleanup-docker.sh
```

### 2. Log Cleanup (`cleanup-logs.sh`)

**Schedule**: Daily at 4 AM

**What it does**:
- Rotates monitoring logs if larger than 50MB
- Rotates cleanup logs if larger than 10MB
- Removes old rotated logs (older than 30 days)
- Cleans up old Apache rotated logs (older than 30 days)

**Logs**: `/opt/parking-gate-remote/cleanup.log`

**Manual run**:
```bash
cd /opt/parking-gate-remote
./cleanup-logs.sh
```

**Note**: Docker container logs are automatically rotated via docker-compose logging configuration (max 10MB per file, 3 files).

### 3. System Cleanup (`cleanup-system.sh`)

**Schedule**: Weekly on Sunday at 5 AM

**What it does**:
- Cleans APT package cache
- Removes old APT package lists (older than 7 days)
- Removes temporary files (older than 7 days)
- Removes old core dumps (older than 30 days)
- Cleans up systemd journal logs (keeps last 30 days, max 500MB)

**Logs**: `/opt/parking-gate-remote/cleanup.log`

**Manual run**:
```bash
cd /opt/parking-gate-remote
./cleanup-system.sh
```

### 4. MongoDB Backup (`backup-mongodb.sh`)

**Schedule**: Daily at 2 AM

**What it does**:
- Creates compressed MongoDB backup
- Removes backups older than 7 days
- Stores backups in `/opt/parking-gate-remote/backups/`

**Logs**: `/opt/parking-gate-remote/backup.log`

**Manual run**:
```bash
cd /opt/parking-gate-remote
./backup-mongodb.sh
```

**Backup retention**: 7 days (automatically cleaned up)

### 5. Health Monitoring (`monitoring.sh`)

**Schedule**: Every 15 minutes

**What it does**:
- Checks Docker container health
- Checks disk space usage
- Checks MongoDB connectivity
- Checks Backend API availability
- Checks Frontend availability
- Checks MQTT Broker health

**Logs**: `/opt/parking-gate-remote/monitoring.log`

**Manual run**:
```bash
cd /opt/parking-gate-remote
./monitoring.sh
```

## Docker Log Rotation

Docker container logs are automatically rotated via docker-compose configuration:

- **Max size per log file**: 10MB
- **Max number of log files**: 3
- **Total log size per container**: ~30MB

This is configured in `docker-compose.prod.yml` and `docker-compose.mqtt.prod.yml`.

## Viewing Logs

### Cleanup Logs
```bash
tail -f /opt/parking-gate-remote/cleanup.log
```

### Backup Logs
```bash
tail -f /opt/parking-gate-remote/backup.log
```

### Monitoring Logs
```bash
tail -f /opt/parking-gate-remote/monitoring.log
```

### Docker Container Logs
```bash
# View recent logs
docker logs parking-backend --tail 50
docker logs parking-frontend --tail 50
docker logs parking-mosquitto --tail 50
docker logs parking-mongo --tail 50

# Follow logs
docker logs -f parking-backend
```

## Cron Job Management

### View Current Cron Jobs
```bash
crontab -l
```

### Edit Cron Jobs
```bash
crontab -e
```

### Remove All Cleanup Cron Jobs
```bash
crontab -l | grep -v "cleanup\|backup\|monitoring" | crontab -
```

## Disk Space Monitoring

Check disk usage:
```bash
# Overall disk usage
df -h

# Docker disk usage
docker system df

# Project directory usage
du -sh /opt/parking-gate-remote/*

# Log directory usage
du -sh /opt/parking-gate-remote/*.log*
```

## Maintenance Schedule Summary

| Task | Frequency | Time | Script |
|------|-----------|------|--------|
| MongoDB Backup | Daily | 2 AM | `backup-mongodb.sh` |
| Log Cleanup | Daily | 4 AM | `cleanup-logs.sh` |
| Docker Cleanup | Weekly (Sun) | 3 AM | `cleanup-docker.sh` |
| System Cleanup | Weekly (Sun) | 5 AM | `cleanup-system.sh` |
| Health Monitoring | Every 15 min | - | `monitoring.sh` |

## Troubleshooting

### Cleanup Scripts Not Running

1. Check if cron service is running:
   ```bash
   sudo systemctl status cron
   ```

2. Check cron logs:
   ```bash
   sudo grep CRON /var/log/syslog | tail -20
   ```

3. Verify scripts are executable:
   ```bash
   ls -l /opt/parking-gate-remote/*.sh
   ```

4. Test script manually:
   ```bash
   cd /opt/parking-gate-remote
   ./cleanup-docker.sh
   ```

### Disk Space Still High

1. Check what's using space:
   ```bash
   docker system df
   du -sh /opt/parking-gate-remote/*
   ```

2. Manually run cleanup:
   ```bash
   ./cleanup-docker.sh
   ./cleanup-system.sh
   ```

3. Check for large log files:
   ```bash
   find /opt/parking-gate-remote -type f -size +100M
   ```

### Backups Not Being Created

1. Check backup script logs:
   ```bash
   tail -f /opt/parking-gate-remote/backup.log
   ```

2. Verify MongoDB container is running:
   ```bash
   docker ps | grep parking-mongo
   ```

3. Test backup manually:
   ```bash
   ./backup-mongodb.sh
   ```

## Best Practices

1. **Monitor disk space regularly**: Check `df -h` weekly
2. **Review cleanup logs**: Check `/opt/parking-gate-remote/cleanup.log` weekly
3. **Download backups off-server**: Periodically download MongoDB backups to a safe location
4. **Adjust retention periods**: If disk space is tight, reduce retention periods in scripts
5. **Test scripts manually**: After deployment, test each cleanup script manually to ensure they work

## Customization

To adjust cleanup schedules or retention periods, edit the scripts:

- **Retention periods**: Edit the `find` commands with `-mtime +N` (N = days)
- **Cron schedules**: Edit `setup-cleanup-cron.sh` or use `crontab -e`
- **Log rotation sizes**: Edit the size checks in `cleanup-logs.sh`

