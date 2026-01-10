#!/bin/bash
# Copy deployment files to EC2 server using tar.gz archive
# Usage: ./copy-to-server.sh [server-ip-or-hostname]

set -e

# Configuration
SERVER="${1:-ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com}"
KEY="${SSH_KEY:-$HOME/.ssh/VaisenKey.pem}"
# Using /opt for Docker-based application (standard location for optional software)
# Apache will proxy to Docker containers, so files don't need to be in /var/www
PROJECT_DIR="/opt/parking-gate-remote"
LOCAL_PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMP_DIR=$(mktemp -d)
ARCHIVE_NAME="parking-gate-deployment-$(date +%Y%m%d-%H%M%S).tar.gz"

echo "=== Copying Files to Server (tar.gz) ==="
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

# Cleanup function
cleanup() {
    echo "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
    # Clean up archive on server if it exists
    ssh -i "$KEY" "$SERVER" "rm -f ~/$ARCHIVE_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# Create directory structure in temp directory
echo "Preparing files for archive..."
mkdir -p "$TEMP_DIR/backend"
mkdir -p "$TEMP_DIR/frontend"
mkdir -p "$TEMP_DIR/mqtt/certs"
mkdir -p "$TEMP_DIR/apache-configs"

# Copy backend files
echo "  - Backend files..."
cp -r "$LOCAL_PROJECT_ROOT/backend/dist" "$TEMP_DIR/backend/" 2>/dev/null || { echo "Warning: backend/dist not found. Make sure to build backend first."; }
cp "$LOCAL_PROJECT_ROOT/backend/package.json" "$TEMP_DIR/backend/" 2>/dev/null || true
cp "$LOCAL_PROJECT_ROOT/backend/package-lock.json" "$TEMP_DIR/backend/" 2>/dev/null || true
cp "$LOCAL_PROJECT_ROOT/backend/Dockerfile" "$TEMP_DIR/backend/" 2>/dev/null || true

# Copy frontend files
echo "  - Frontend files..."
cp -r "$LOCAL_PROJECT_ROOT/frontend/.next" "$TEMP_DIR/frontend/" 2>/dev/null || { echo "Warning: frontend/.next not found. Make sure to build frontend first."; }
cp "$LOCAL_PROJECT_ROOT/frontend/package.json" "$TEMP_DIR/frontend/" 2>/dev/null || true
cp "$LOCAL_PROJECT_ROOT/frontend/package-lock.json" "$TEMP_DIR/frontend/" 2>/dev/null || true
cp "$LOCAL_PROJECT_ROOT/frontend/next.config.js" "$TEMP_DIR/frontend/" 2>/dev/null || true
cp -r "$LOCAL_PROJECT_ROOT/frontend/public" "$TEMP_DIR/frontend/" 2>/dev/null || true
cp "$LOCAL_PROJECT_ROOT/frontend/Dockerfile.prod" "$TEMP_DIR/frontend/Dockerfile" 2>/dev/null || true
# Copy admin route files for App Router
mkdir -p "$TEMP_DIR/frontend/src/app/admin"
cp -r "$LOCAL_PROJECT_ROOT/frontend/src/app/admin"/* "$TEMP_DIR/frontend/src/app/admin/" 2>/dev/null || true

# Copy docker-compose files
echo "  - Docker Compose files..."
cp "$LOCAL_PROJECT_ROOT/deploy/docker-compose.prod.yml" "$TEMP_DIR/docker-compose.yml"
cp "$LOCAL_PROJECT_ROOT/deploy/docker-compose.mqtt.prod.yml" "$TEMP_DIR/docker-compose.mqtt.yml"

# Copy MQTT configuration
echo "  - MQTT configuration..."
cp "$LOCAL_PROJECT_ROOT/deploy/mosquitto.prod.conf" "$TEMP_DIR/mqtt/mosquitto.conf"
cp "$LOCAL_PROJECT_ROOT/mqtt/aclfile" "$TEMP_DIR/mqtt/aclfile" 2>/dev/null || true
cp "$LOCAL_PROJECT_ROOT/deploy/generate-mqtt-certs.sh" "$TEMP_DIR/mqtt/certs/"

# Copy Apache configurations (for separate handling)
echo "  - Apache configurations..."
cp "$LOCAL_PROJECT_ROOT/deploy/apache-api.conf" "$TEMP_DIR/apache-configs/"
cp "$LOCAL_PROJECT_ROOT/deploy/apache-api-ssl.conf" "$TEMP_DIR/apache-configs/"
cp "$LOCAL_PROJECT_ROOT/deploy/apache-root.conf" "$TEMP_DIR/apache-configs/"
cp "$LOCAL_PROJECT_ROOT/deploy/apache-app-ssl-updated.conf" "$TEMP_DIR/apache-configs/"

# Copy environment template
echo "  - Environment template..."
cp "$LOCAL_PROJECT_ROOT/deploy/backend.env.template" "$TEMP_DIR/backend/.env.template"

# Copy deployment scripts
echo "  - Deployment scripts..."
cp "$LOCAL_PROJECT_ROOT/deploy/server-setup.sh" "$TEMP_DIR/"
cp "$LOCAL_PROJECT_ROOT/deploy/setup-apache.sh" "$TEMP_DIR/"
cp "$LOCAL_PROJECT_ROOT/deploy/start-services.sh" "$TEMP_DIR/"
cp "$LOCAL_PROJECT_ROOT/deploy/deployment-script.sh" "$TEMP_DIR/" 2>/dev/null || true

# Make scripts executable in archive
chmod +x "$TEMP_DIR"/*.sh 2>/dev/null || true
chmod +x "$TEMP_DIR/mqtt/certs/generate-mqtt-certs.sh" 2>/dev/null || true

# Create tar.gz archive
echo ""
echo "Creating archive..."
cd "$TEMP_DIR"
# COPYFILE_DISABLE=1 prevents macOS from including extended attributes (._* files)
# This avoids warnings when extracting on Linux
COPYFILE_DISABLE=1 tar czf "$LOCAL_PROJECT_ROOT/$ARCHIVE_NAME" .
ARCHIVE_SIZE=$(du -h "$LOCAL_PROJECT_ROOT/$ARCHIVE_NAME" | cut -f1)
echo "Archive created: $ARCHIVE_NAME ($ARCHIVE_SIZE)"

# Create directories on server with proper permissions
echo ""
echo "Creating directories on server (requires sudo)..."
ssh -i "$KEY" "$SERVER" "sudo mkdir -p $PROJECT_DIR/{backend,frontend,mqtt/certs} && sudo chown -R ubuntu:ubuntu $PROJECT_DIR && echo 'Directories created and ownership set to ubuntu user'"

# Transfer archive to server
echo ""
echo "Transferring archive to server..."
scp -i "$KEY" "$LOCAL_PROJECT_ROOT/$ARCHIVE_NAME" "$SERVER:~/"

# Extract archive on server
echo ""
echo "Extracting archive on server..."
ssh -i "$KEY" "$SERVER" "
    cd $PROJECT_DIR && \
    tar xzf ~/$ARCHIVE_NAME 2>/dev/null && \
    chmod +x *.sh mqtt/certs/*.sh 2>/dev/null || true && \
    echo 'Archive extracted successfully'
"

# Move Apache configs to /tmp/apache-configs with sudo
echo ""
echo "Setting up Apache configurations..."
ssh -i "$KEY" "$SERVER" "
    sudo mkdir -p /tmp/apache-configs && \
    sudo cp $PROJECT_DIR/apache-configs/* /tmp/apache-configs/ && \
    sudo chown root:root /tmp/apache-configs/* && \
    rm -rf $PROJECT_DIR/apache-configs && \
    echo 'Apache configurations moved to /tmp/apache-configs'
"

# Clean up archive on server
echo ""
echo "Cleaning up archive on server..."
ssh -i "$KEY" "$SERVER" "rm -f ~/$ARCHIVE_NAME"

# Clean up local archive
rm -f "$LOCAL_PROJECT_ROOT/$ARCHIVE_NAME"

echo ""
echo "=== Files Copied Successfully ==="
echo ""
echo "Next steps on server:"
echo "1. Run server setup: cd $PROJECT_DIR && ./server-setup.sh"
echo "2. Configure Apache: cd $PROJECT_DIR && sudo ./setup-apache.sh"
echo "3. Start services: cd $PROJECT_DIR && ./start-services.sh"
echo ""
echo "Or follow the manual steps in deploy/README.md"
