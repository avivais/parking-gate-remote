#!/bin/bash
# Server-side setup script
# Run this on the EC2 instance after copying files

set -e

PROJECT_DIR="/opt/parking-gate-remote"

echo "=== Server Setup Script ==="

# 1. Generate MQTT certificates
echo ""
echo "Step 1: Generating MQTT TLS certificates..."
cd $PROJECT_DIR/mqtt/certs
if [ ! -f "server.crt" ]; then
    chmod +x generate-mqtt-certs.sh
    ./generate-mqtt-certs.sh
else
    echo "Certificates already exist, skipping..."
fi

# 2. Create MQTT password file if it doesn't exist
echo ""
echo "Step 2: MQTT password file setup..."
if [ ! -f "$PROJECT_DIR/mqtt/passwordfile" ]; then
    echo "Creating MQTT password file..."
    echo "You will need to run:"
    echo "  cd $PROJECT_DIR/mqtt"
    echo "  mosquitto_passwd -c passwordfile pgr_server"
    echo "  mosquitto_passwd passwordfile pgr_device_mitspe6"
    read -p "Have you created the password file? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please create the password file before continuing"
        exit 1
    fi
    chmod 600 $PROJECT_DIR/mqtt/passwordfile
else
    echo "Password file already exists"
fi

# 3. Create backend .env if it doesn't exist
echo ""
echo "Step 3: Backend environment file setup..."
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    if [ -f "$PROJECT_DIR/backend/.env.template" ]; then
        cp $PROJECT_DIR/backend/.env.template $PROJECT_DIR/backend/.env
        echo "Created .env from template. Please edit it with production values:"
        echo "  nano $PROJECT_DIR/backend/.env"
        read -p "Have you edited the .env file? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Please edit the .env file before continuing"
            exit 1
        fi
    else
        echo "Error: .env.template not found"
        exit 1
    fi
else
    echo ".env file already exists"
fi

# 4. Create Docker network
echo ""
echo "Step 4: Creating Docker network..."
docker network create parking_net 2>/dev/null || echo "Network already exists"

# 5. Configure Apache
echo ""
echo "Step 5: Apache configuration..."
echo "SSL certificates and Apache vhosts need to be configured manually"
echo "See deploy/README.md for Apache setup instructions"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Configure Apache (see deploy/README.md)"
echo "2. Configure firewall: sudo ufw allow 80,443,8883/tcp"
echo "3. Start services: cd $PROJECT_DIR && docker-compose up -d"

