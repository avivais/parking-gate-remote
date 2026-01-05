# Monitoring and Backup Strategy

## Monitoring

### Basic Health Check Script

A monitoring script (`monitoring.sh`) checks:
- Docker container health status
- Disk space usage
- MongoDB connectivity
- Backend API availability
- Frontend availability
- MQTT Broker health

### Setup Automated Monitoring

Add to crontab (runs every 15 minutes):

```bash
# Edit crontab
crontab -e

# Add this line:
*/15 * * * * /opt/parking-gate-remote/monitoring.sh
```

View monitoring logs:
```bash
tail -f /opt/parking-gate-remote/monitoring.log
```

### Manual Health Check

Run manually:
```bash
cd /opt/parking-gate-remote
./monitoring.sh
```

### What to Monitor

1. **Container Status**: All containers should show "healthy" or "Up"
2. **Disk Space**: Should stay below 85%
3. **Service Availability**: All services should respond to health checks
4. **Logs**: Regularly check Docker logs for errors:
   ```bash
   docker logs parking-backend --tail 50
   docker logs parking-frontend --tail 50
   docker logs parking-mosquitto --tail 50
   docker logs parking-mongo --tail 50
   ```

## Backup Strategy

### MongoDB Backup Script

A backup script (`backup-mongodb.sh`) creates compressed MongoDB backups.

### Setup Automated Backups

Add to crontab (runs daily at 2 AM):

```bash
# Edit crontab
crontab -e

# Add this line:
0 2 * * * /opt/parking-gate-remote/backup-mongodb.sh
```

### Manual Backup

Run manually:
```bash
cd /opt/parking-gate-remote
sudo ./backup-mongodb.sh
```

### Backup Retention

- Backups are stored in `/opt/parking-gate-remote/backups/`
- Format: `mongodb_backup_YYYYMMDD_HHMMSS.tar.gz`
- Automatically removes backups older than 7 days
- Keep at least one backup off-server (download periodically)

### Restore from Backup

```bash
# Stop services
cd /opt/parking-gate-remote
docker compose stop backend

# Restore backup
gunzip -c backups/mongodb_backup_YYYYMMDD_HHMMSS.tar.gz | docker exec -i parking-mongo mongorestore --archive

# Start services
docker compose start backend
```

### Off-Server Backup

Download backups regularly to a safe location:

```bash
# From your local machine
scp -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com:/opt/parking-gate-remote/backups/*.tar.gz ./local-backups/
```

## Additional Monitoring Options

### Docker Stats

Monitor resource usage:
```bash
docker stats
```

### Apache Logs

Check web server logs:
```bash
sudo tail -f /var/log/apache2/app.mitzpe6-8.com-access.log
sudo tail -f /var/log/apache2/api.mitzpe6-8.com-access.log
sudo tail -f /var/log/apache2/*error.log
```

### System Resources

```bash
# CPU and memory
htop

# Disk usage
df -h
du -sh /opt/parking-gate-remote/*

# Docker disk usage
docker system df
```

## Alerting (Future Enhancement)

Consider setting up:
1. **Email alerts** for critical failures
2. **CloudWatch** integration for AWS monitoring
3. **Sentry** or similar for application error tracking
4. **Uptime monitoring** service (e.g., UptimeRobot)

## Maintenance Schedule

- **Daily**: Automated backups run at 2 AM
- **Every 15 minutes**: Health checks run automatically
- **Weekly**: Review logs and clean up old backups
- **Monthly**: Review and update dependencies
- **As needed**: Update system packages: `sudo apt update && sudo apt upgrade`

