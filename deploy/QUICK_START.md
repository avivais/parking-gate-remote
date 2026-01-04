# Quick Start Deployment Guide

This is a condensed guide for deploying to production. For detailed instructions, see [README.md](README.md).

## Prerequisites

- Local machine with Node.js 18+
- SSH access to EC2: `ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com`
- Domain DNS configured in CloudFlare

## Deployment Steps

### 1. Build Applications (Local)

```bash
# From project root
./deploy/build-and-deploy.sh
```

This builds both backend and frontend with production settings.

### 2. Copy Files to Server (Local)

```bash
export SSH_KEY=~/.ssh/VaisenKey.pem
./deploy/copy-to-server.sh
```

This copies all necessary files to the EC2 instance.

### 3. Server Setup (On EC2)

SSH into the server and run:

```bash
cd /opt/parking-gate-remote

# Make scripts executable
chmod +x deploy/*.sh mqtt/certs/generate-mqtt-certs.sh

# Run server setup (generates certs, creates .env, etc.)
./deploy/server-setup.sh

# Configure Apache
sudo ./deploy/setup-apache.sh

# Configure firewall
sudo ufw allow 80,443,8883/tcp
sudo ufw deny 1883/tcp
sudo ufw --force enable

# Start all services
./deploy/start-services.sh
```

### 4. Verify Deployment

```bash
# Check service status
docker ps

# Check logs
docker logs parking-backend
docker logs parking-frontend
docker logs parking-mosquitto
docker logs parking-mongo

# Test endpoints
curl https://api.mitzpe6-8.com/api
# Open https://app.mitzpe6-8.com in browser
```

## Important Notes

1. **MQTT Certificates**: The setup script will generate them automatically. Make sure to copy `ca.crt` to your devices.

2. **MQTT Passwords**: You'll be prompted to create passwords during setup. Use strong passwords.

3. **Backend .env**: Edit `/opt/parking-gate-remote/backend/.env` with production values:
   - `JWT_SECRET`: Generate a strong random string
   - `MQTT_PASSWORD`: Must match the password in `mqtt/passwordfile`

4. **SSL Certificates**: Apache setup will obtain Let's Encrypt certificates automatically.

## Troubleshooting

- **Services won't start**: Check logs with `docker logs <container-name>`
- **Apache errors**: Check `/var/log/apache2/*error.log`
- **MQTT connection fails**: Verify certificates and password file
- **Backend can't connect to MongoDB**: Check network with `docker network inspect parking_net`

## Next Steps

1. Create admin user (see README.md)
2. Test MQTT connection from device
3. Set up monitoring and backups
4. Review security settings

For detailed information, see [README.md](README.md) and [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md).

