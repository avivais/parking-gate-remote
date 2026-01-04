#!/bin/bash
# Production Deployment Script for Parking Gate Remote
# Run this script on the EC2 instance as the ubuntu user

set -e  # Exit on error

echo "=== Parking Gate Remote Production Deployment ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/parking-gate-remote"
DEPLOY_USER="ubuntu"

# Check if running as correct user
if [ "$USER" != "$DEPLOY_USER" ]; then
    echo -e "${RED}Error: This script must be run as $DEPLOY_USER${NC}"
    exit 1
fi

# Function to print step
print_step() {
    echo -e "\n${GREEN}>>> $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Install Docker and Docker Compose
print_step "Step 1: Checking Docker installation"
if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_warning "Please log out and log back in for Docker group changes to take effect"
else
    echo "Docker is already installed"
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_warning "Docker Compose not found. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose is already installed"
fi

# Step 2: Create project directory structure
print_step "Step 2: Creating project directory structure"
sudo mkdir -p $PROJECT_DIR/{backend,frontend,mqtt/certs}
sudo chown -R $USER:$USER $PROJECT_DIR
mkdir -p $PROJECT_DIR/backend/dist
mkdir -p $PROJECT_DIR/frontend/.next
mkdir -p $PROJECT_DIR/mqtt/certs

echo "Directory structure created at $PROJECT_DIR"

# Step 3: Generate MQTT TLS certificates
print_step "Step 3: MQTT TLS Certificate Setup"
print_warning "You need to generate MQTT TLS certificates manually"
echo "To generate certificates, run the following commands:"
echo "  cd $PROJECT_DIR/mqtt/certs"
echo "  # Generate CA key and certificate"
echo "  openssl genrsa -out ca.key 2048"
echo "  openssl req -new -x509 -days 365 -key ca.key -out ca.crt -subj '/CN=MQTT CA'"
echo "  # Generate server key and certificate"
echo "  openssl genrsa -out server.key 2048"
echo "  openssl req -new -key server.key -out server.csr -subj '/CN=mqtt.mitzpe6-8.com'"
echo "  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365"
echo "  chmod 644 ca.crt server.crt"
echo "  chmod 600 ca.key server.key"
echo ""
read -p "Have you generated the certificates? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Please generate certificates before continuing"
    exit 1
fi

# Step 4: Configure MQTT password file
print_step "Step 4: Configuring MQTT password file"
if [ ! -f "$PROJECT_DIR/mqtt/passwordfile" ]; then
    print_warning "Creating MQTT password file..."
    echo "You will be prompted to set passwords for MQTT users"
    echo "First, install mosquitto-clients if not installed:"
    echo "  sudo apt-get update && sudo apt-get install -y mosquitto-clients"
    echo ""
    echo "Then create password file:"
    echo "  mosquitto_passwd -c $PROJECT_DIR/mqtt/passwordfile pgr_server"
    echo "  mosquitto_passwd $PROJECT_DIR/mqtt/passwordfile pgr_device_mitspe6"
    echo ""
    read -p "Have you created the password file? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Please create the password file before continuing"
        exit 1
    fi
    chmod 600 $PROJECT_DIR/mqtt/passwordfile
else
    echo "Password file already exists"
fi

# Step 5: Copy MQTT configuration files
print_step "Step 5: Setting up MQTT configuration"
# Note: These files should be copied from the deploy directory
echo "Please copy mosquitto.prod.conf to $PROJECT_DIR/mqtt/mosquitto.conf"
echo "Please copy aclfile to $PROJECT_DIR/mqtt/aclfile"

# Step 6: Create Docker network
print_step "Step 6: Creating Docker network"
docker network create parking_net 2>/dev/null || echo "Network already exists"

echo ""
echo -e "${GREEN}=== Initial Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Copy deployment files to $PROJECT_DIR"
echo "2. Build and transfer backend dist/ folder"
echo "3. Build and transfer frontend .next/ folder"
echo "4. Create backend/.env file from template"
echo "5. Run docker-compose commands to start services"
echo "6. Configure Apache virtual hosts"
echo "7. Set up SSL certificates"

