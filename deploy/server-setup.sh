#!/bin/bash
# Server-side setup script
# Run this on the EC2 instance after copying files

set -e

PROJECT_DIR="/opt/parking-gate-remote"

echo "=== Server Setup Script ==="

# Check and install Docker if needed
if ! command -v docker &> /dev/null; then
    echo ""
    echo "Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    sudo usermod -aG docker $USER
    rm /tmp/get-docker.sh
    echo "Docker installed. Activating docker group..."
    # Try to activate docker group without logout
    newgrp docker <<EOF || true
echo "Docker group activated"
EOF
    # Start Docker service
    sudo systemctl start docker
    sudo systemctl enable docker
    echo "Docker service started and enabled"
else
    echo "Docker is already installed: $(docker --version)"
    # Ensure Docker service is running
    if ! sudo docker ps &> /dev/null; then
        echo "Starting Docker service..."
        sudo systemctl start docker
        sudo systemctl enable docker
    fi
fi

# Check and install Docker Compose if needed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo ""
    echo "Docker Compose not found. Installing..."
    # Try docker compose plugin first (modern approach)
    if docker compose version &> /dev/null; then
        echo "Docker Compose plugin is available"
    else
        # Install standalone docker-compose
        DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
        sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        echo "Docker Compose installed: $DOCKER_COMPOSE_VERSION"
    fi
else
    if docker compose version &> /dev/null; then
        echo "Docker Compose is already installed: $(docker compose version)"
    else
        echo "Docker Compose is already installed: $(docker-compose --version)"
    fi
fi

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
MQTT_SERVER_PASSWORD=""  # Initialize variable for use in step 3
if [ ! -f "$PROJECT_DIR/mqtt/passwordfile" ]; then
    echo "Creating MQTT password file..."

    # Check if mosquitto_passwd is available
    if ! command -v mosquitto_passwd &> /dev/null; then
        echo "Installing mosquitto-clients..."
        sudo apt-get update && sudo apt-get install -y mosquitto-clients
    fi

    # Prompt for passwords
    echo ""
    echo "Enter password for MQTT user 'pgr_server' (backend):"
    read -s MQTT_SERVER_PASSWORD
    echo ""
    echo "Enter password for MQTT user 'pgr_device_mitspe6' (device):"
    read -s MQTT_DEVICE_PASSWORD
    echo ""

    # Create password file
    cd $PROJECT_DIR/mqtt
    echo "$MQTT_SERVER_PASSWORD" | mosquitto_passwd -c passwordfile pgr_server
    echo "$MQTT_DEVICE_PASSWORD" | mosquitto_passwd passwordfile pgr_device_mitspe6
    chmod 600 passwordfile
    echo "MQTT password file created successfully"
else
    echo "Password file already exists"
    # If password file exists, we still need to get the password for .env
    if [ -z "$MQTT_SERVER_PASSWORD" ]; then
        echo "Enter MQTT_PASSWORD for pgr_server user (for .env file):"
        read -s MQTT_SERVER_PASSWORD
        echo ""
    fi
fi

# 3. Create backend .env if it doesn't exist
echo ""
echo "Step 3: Backend environment file setup..."
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    if [ -f "$PROJECT_DIR/backend/.env.template" ]; then
        echo "Creating .env file from template..."

        # Prompt for required values
        echo ""
        echo "Enter JWT_SECRET (strong random string, at least 32 characters):"
        read -s JWT_SECRET
        echo ""

        # Use the MQTT password from step 2 if we just created it
        if [ -z "$MQTT_SERVER_PASSWORD" ]; then
            echo "Enter MQTT_PASSWORD for pgr_server user:"
            read -s MQTT_SERVER_PASSWORD
            echo ""
        else
            echo "Using MQTT_PASSWORD from step 2..."
        fi

        # Generate a random JWT_SECRET if user didn't provide one
        if [ -z "$JWT_SECRET" ]; then
            echo "No JWT_SECRET provided, generating random one..."
            JWT_SECRET=$(openssl rand -hex 32)
            echo "Generated JWT_SECRET: $JWT_SECRET"
        fi

        # Create .env file from template with substitutions
        sed -e "s|CHANGE_ME_TO_STRONG_RANDOM_SECRET|$JWT_SECRET|g" \
            -e "s|CHANGE_ME_TO_STRONG_PASSWORD|$MQTT_SERVER_PASSWORD|g" \
            "$PROJECT_DIR/backend/.env.template" > "$PROJECT_DIR/backend/.env"

        echo ".env file created successfully"
        echo ""
        echo "Note: You can edit $PROJECT_DIR/backend/.env later if needed"
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
echo "SSL certificates and Apache vhosts will be configured by setup-apache.sh"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Configure Apache: sudo ./setup-apache.sh"
echo "2. Configure firewall: sudo ufw allow 80,443,8883/tcp"
echo "3. Start services: ./start-services.sh"

