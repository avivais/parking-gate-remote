# Production Deployment Guide

This directory contains all files needed to deploy the Parking Gate Remote application to production on EC2.

## Prerequisites

- EC2 instance running Ubuntu with Apache
- Domain DNS configured in CloudFlare
- SSH access to EC2 instance with key `VaisenKey.pem`
- Let's Encrypt SSL certificates (will be obtained during deployment)
- Node.js 18+ installed locally for building

## Directory Structure

The application is deployed to `/opt/parking-gate-remote` (not `/var/www`) because:
- `/opt` is the standard location for optional software packages and Docker-based applications
- Apache will proxy to Docker containers running on localhost, so files don't need to be in `/var/www`
- The existing `/var/www/mitzpe6-8/app` and `/var/www/mitzpe6-8/api` directories are not used with this Docker setup
- All directories are created with sudo and then chowned to the ubuntu user for proper permissions

## Quick Start (Automated)

### Option 1: Automated Deployment

From your local machine:

```bash
# 1. Build applications
./deploy/build-and-deploy.sh

# 2. Copy all files to server
export SSH_KEY=$HOME/.ssh/VaisenKey.pem
./deploy/copy-to-server.sh

# 3. SSH to server and run setup
ssh -i $HOME/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com
cd /opt/parking-gate-remote
./server-setup.sh
sudo ./setup-apache.sh
./start-services.sh
```

### Option 2: Manual Step-by-Step

### 1. Initial Server Setup

SSH into your EC2 instance and run:

```bash
# Copy deployment-script.sh to server and run it
chmod +x deployment-script.sh
./deployment-script.sh
```

This will:
- Install Docker and Docker Compose (if needed)
- Create project directory structure at `/opt/parking-gate-remote`
- Guide you through MQTT certificate generation
- Set up MQTT password file

### 2. Generate MQTT TLS Certificates

On the server, navigate to the mqtt/certs directory and run:

```bash
cd /opt/parking-gate-remote/mqtt/certs
# Copy generate-mqtt-certs.sh to this directory
chmod +x generate-mqtt-certs.sh
./generate-mqtt-certs.sh
```

### 3. Configure MQTT Password File

```bash
# Install mosquitto-clients if needed
sudo apt-get update && sudo apt-get install -y mosquitto-clients

# Create password file
cd /opt/parking-gate-remote/mqtt
mosquitto_passwd -c passwordfile pgr_server
# Enter a strong password when prompted

# Add device user
mosquitto_passwd passwordfile pgr_device_mitspe6
# Enter a strong password when prompted

# Set permissions
chmod 600 passwordfile
```

### 4. Copy Deployment Files to Server

From your local machine, copy files to the server:

```bash
# Set these variables
SERVER="ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com"
KEY="$HOME/.ssh/VaisenKey.pem"
PROJECT_DIR="/opt/parking-gate-remote"

# Copy docker-compose files
scp -i $KEY deploy/docker-compose.prod.yml $SERVER:$PROJECT_DIR/docker-compose.yml
scp -i $KEY deploy/docker-compose.mqtt.prod.yml $SERVER:$PROJECT_DIR/docker-compose.mqtt.yml

# Copy MQTT configuration
scp -i $KEY deploy/mosquitto.prod.conf $SERVER:$PROJECT_DIR/mqtt/mosquitto.conf
scp -i $KEY mqtt/aclfile $SERVER:$PROJECT_DIR/mqtt/aclfile

# Copy Apache configurations
scp -i $KEY deploy/apache-api.conf $SERVER:/tmp/
scp -i $KEY deploy/apache-api-ssl.conf $SERVER:/tmp/
scp -i $KEY deploy/apache-root.conf $SERVER:/tmp/
scp -i $KEY deploy/apache-app-ssl-updated.conf $SERVER:/tmp/
```

### 5. Build and Deploy Backend

On your local machine:

```bash
cd backend
npm install
npm run build
```

Then copy to server:

```bash
# Copy built files
scp -i $KEY -r backend/dist $SERVER:$PROJECT_DIR/backend/
scp -i $KEY backend/package*.json $SERVER:$PROJECT_DIR/backend/
scp -i $KEY backend/Dockerfile $SERVER:$PROJECT_DIR/backend/

# Create .env file from template
scp -i $KEY deploy/backend.env.template $SERVER:$PROJECT_DIR/backend/.env.template
```

On the server, edit the .env file:

```bash
cd /opt/parking-gate-remote/backend
cp .env.template .env
nano .env  # Edit and set strong passwords and secrets
```

### 6. Build and Deploy Frontend

On your local machine:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE=https://api.mitzpe6-8.com/api npm run build
```

Then copy to server:

```bash
# Copy built files
scp -i $KEY -r frontend/.next $SERVER:$PROJECT_DIR/frontend/
scp -i $KEY frontend/package*.json $SERVER:$PROJECT_DIR/frontend/
scp -i $KEY frontend/next.config.ts $SERVER:$PROJECT_DIR/frontend/
scp -i $KEY frontend/Dockerfile $SERVER:$PROJECT_DIR/frontend/
scp -i $KEY -r frontend/public $SERVER:$PROJECT_DIR/frontend/
```

### 7. Configure Apache

On the server:

```bash
# Get SSL certificate for api.mitzpe6-8.com
sudo certbot --apache -d api.mitzpe6-8.com

# Copy Apache configurations
sudo cp /tmp/apache-api.conf /etc/apache2/sites-available/api.mitzpe6-8.com.conf
sudo cp /tmp/apache-api-ssl.conf /etc/apache2/sites-available/api.mitzpe6-8.com-le-ssl.conf
sudo cp /tmp/apache-root.conf /etc/apache2/sites-available/mitzpe6-8.com.conf

# Update app.mitzpe6-8.com vhost
sudo cp /tmp/apache-app-ssl-updated.conf /etc/apache2/sites-available/app.mitzpe6-8.com-le-ssl.conf

# Enable required modules
sudo a2enmod proxy proxy_http ssl rewrite

# Enable sites
sudo a2ensite api.mitzpe6-8.com
sudo a2ensite mitzpe6-8.com

# Test configuration
sudo apache2ctl configtest

# Reload Apache
sudo systemctl reload apache2
```

### 8. Configure Firewall

On the server:

```bash
# Allow required ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8883/tcp  # MQTT TLS

# Deny non-TLS MQTT (if port 1883 was open)
sudo ufw deny 1883/tcp

# Enable firewall if not already enabled
sudo ufw --force enable
```

### 9. Start Docker Services

On the server:

```bash
cd /opt/parking-gate-remote

# Create Docker network
docker network create parking_net 2>/dev/null || true

# Start MongoDB
docker-compose up -d mongo

# Wait for MongoDB to be ready
sleep 5

# Start MQTT broker
docker-compose -f docker-compose.mqtt.yml up -d

# Start backend
docker-compose up -d backend

# Start frontend
docker-compose up -d frontend
```

### 10. Verify Deployment

Check service logs:

```bash
docker logs parking-mongo
docker logs parking-mosquitto
docker logs parking-backend
docker logs parking-frontend
```

Test endpoints:

```bash
# Test API
curl https://api.mitzpe6-8.com/api

# Test frontend (in browser)
# Open https://app.mitzpe6-8.com
```

### 11. Create Admin User

Access the backend container and create an admin user:

```bash
docker exec -it parking-backend sh
# Use MongoDB or admin API endpoint to create admin user
```

## File Structure on Server

```
/opt/parking-gate-remote/
├── backend/
│   ├── .env
│   ├── Dockerfile
│   ├── dist/
│   └── package*.json
├── frontend/
│   ├── Dockerfile
│   ├── .next/
│   ├── package*.json
│   ├── next.config.ts
│   └── public/
├── mqtt/
│   ├── mosquitto.conf
│   ├── passwordfile
│   ├── aclfile
│   └── certs/
│       ├── ca.crt
│       ├── ca.key
│       ├── server.crt
│       └── server.key
├── docker-compose.yml
└── docker-compose.mqtt.yml
```

## Troubleshooting

### MQTT Connection Issues

- Verify certificates are in place and have correct permissions
- Check MQTT broker logs: `docker logs parking-mosquitto`
- Test TLS connection: `mosquitto_sub -h mqtt.mitzpe6-8.com -p 8883 --cafile /path/to/ca.crt -t '#'`

### Backend Connection Issues

- Check backend logs: `docker logs parking-backend`
- Verify MongoDB connection: `docker exec -it parking-mongo mongosh`
- Check environment variables: `docker exec -it parking-backend env | grep MONGO`

### Apache Proxy Issues

- Check Apache error logs: `sudo tail -f /var/log/apache2/*error.log`
- Verify proxy modules are enabled: `sudo a2enmod proxy proxy_http`
- Test Apache configuration: `sudo apache2ctl configtest`

## Security Notes

1. **Change all default passwords** in the `.env` file
2. **Keep MQTT certificates secure** - do not commit to version control
3. **Restrict SSH access** to EC2 instance if possible
4. **Regularly update** Docker images and system packages
5. **Monitor logs** for suspicious activity

## Backup Strategy

### MongoDB Backup

```bash
# Create backup
docker exec parking-mongo mongodump --out /data/backup

# Restore backup
docker exec parking-mongo mongorestore /data/backup
```

### MQTT Data Backup

MQTT data is stored in Docker volume `parking_mosquitto_data`. Backup the volume:

```bash
docker run --rm -v parking_mosquitto_data:/data -v $(pwd):/backup alpine tar czf /backup/mosquitto-backup.tar.gz /data
```

