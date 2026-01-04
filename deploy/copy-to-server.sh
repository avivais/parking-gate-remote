#!/bin/bash
# Copy deployment files to EC2 server
# Usage: ./copy-to-server.sh [server-ip-or-hostname]

set -e

# Configuration
SERVER="${1:-ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com}"
KEY="${SSH_KEY:-$HOME/.ssh/VaisenKey.pem}"
# Using /opt for Docker-based application (standard location for optional software)
# Apache will proxy to Docker containers, so files don't need to be in /var/www
PROJECT_DIR="/opt/parking-gate-remote"
LOCAL_PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Copying Files to Server ==="
echo "Server: $SERVER"
echo "Key: $KEY"
echo "Project Root: $LOCAL_PROJECT_ROOT"
echo ""

# Check if key exists
if [ ! -f "$KEY" ]; then
    echo "Error: SSH key not found at $KEY"
    echo "Set SSH_KEY environment variable or edit this script"
    exit 1
fi

# Function to copy files
copy_files() {
    echo "Copying $1..."
    scp -i "$KEY" -r "$LOCAL_PROJECT_ROOT/$2" "$SERVER:$PROJECT_DIR/$3"
}

# Create directories on server with proper permissions
echo "Creating directories on server (requires sudo)..."
ssh -i "$KEY" "$SERVER" "sudo mkdir -p $PROJECT_DIR/{backend,frontend,mqtt/certs} && sudo chown -R ubuntu:ubuntu $PROJECT_DIR && echo 'Directories created and ownership set to ubuntu user'"

# Copy backend files
echo ""
echo "=== Copying Backend Files ==="
scp -i "$KEY" -r "$LOCAL_PROJECT_ROOT/backend/dist" "$SERVER:$PROJECT_DIR/backend/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/backend/package.json" "$SERVER:$PROJECT_DIR/backend/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/backend/package-lock.json" "$SERVER:$PROJECT_DIR/backend/" 2>/dev/null || true
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/backend/Dockerfile" "$SERVER:$PROJECT_DIR/backend/"

# Copy frontend files
echo ""
echo "=== Copying Frontend Files ==="
scp -i "$KEY" -r "$LOCAL_PROJECT_ROOT/frontend/.next" "$SERVER:$PROJECT_DIR/frontend/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/frontend/package.json" "$SERVER:$PROJECT_DIR/frontend/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/frontend/package-lock.json" "$SERVER:$PROJECT_DIR/frontend/" 2>/dev/null || true
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/frontend/next.config.ts" "$SERVER:$PROJECT_DIR/frontend/"
scp -i "$KEY" -r "$LOCAL_PROJECT_ROOT/frontend/public" "$SERVER:$PROJECT_DIR/frontend/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/frontend/Dockerfile.prod" "$SERVER:$PROJECT_DIR/frontend/Dockerfile"

# Copy docker-compose files
echo ""
echo "=== Copying Docker Compose Files ==="
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/docker-compose.prod.yml" "$SERVER:$PROJECT_DIR/docker-compose.yml"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/docker-compose.mqtt.prod.yml" "$SERVER:$PROJECT_DIR/docker-compose.mqtt.yml"

# Copy MQTT configuration
echo ""
echo "=== Copying MQTT Configuration ==="
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/mosquitto.prod.conf" "$SERVER:$PROJECT_DIR/mqtt/mosquitto.conf"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/mqtt/aclfile" "$SERVER:$PROJECT_DIR/mqtt/aclfile"

# Copy Apache configurations
echo ""
echo "=== Copying Apache Configurations ==="
# Create directory in user's home first, then move with sudo (more reliable than /tmp)
APACHE_CONFIG_DIR="~/apache-configs"
ssh -i "$KEY" "$SERVER" "mkdir -p $APACHE_CONFIG_DIR"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/apache-api.conf" "$SERVER:$APACHE_CONFIG_DIR/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/apache-api-ssl.conf" "$SERVER:$APACHE_CONFIG_DIR/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/apache-root.conf" "$SERVER:$APACHE_CONFIG_DIR/"
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/apache-app-ssl-updated.conf" "$SERVER:$APACHE_CONFIG_DIR/"
# Move to /tmp/apache-configs with sudo for the setup script
ssh -i "$KEY" "$SERVER" "sudo mkdir -p /tmp/apache-configs && sudo cp $APACHE_CONFIG_DIR/* /tmp/apache-configs/ && sudo chown root:root /tmp/apache-configs/* && rm -rf $APACHE_CONFIG_DIR"

# Copy environment template
echo ""
echo "=== Copying Environment Template ==="
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/backend.env.template" "$SERVER:$PROJECT_DIR/backend/.env.template"

# Copy certificate generation script
echo ""
echo "=== Copying Certificate Generation Script ==="
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/deploy/generate-mqtt-certs.sh" "$SERVER:$PROJECT_DIR/mqtt/certs/"

echo ""
echo "=== Files Copied Successfully ==="
echo ""
echo "Next steps on server:"
echo "1. Generate MQTT certificates: cd $PROJECT_DIR/mqtt/certs && chmod +x generate-mqtt-certs.sh && ./generate-mqtt-certs.sh"
echo "2. Create MQTT password file: cd $PROJECT_DIR/mqtt && mosquitto_passwd -c passwordfile pgr_server"
echo "3. Create backend .env: cd $PROJECT_DIR/backend && cp .env.template .env && nano .env"
echo "4. Configure Apache (see deploy/README.md)"
echo "5. Start services: cd $PROJECT_DIR && docker-compose up -d"

