#!/bin/bash
# Configure security: UFW firewall and provide EC2 Security Group instructions
# Run this on the EC2 instance

set -e

echo "=== Security Configuration ==="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "This script must be run with sudo"
    echo "Usage: sudo ./configure-security.sh"
    exit 1
fi

echo "Step 1: Configuring UFW Firewall"
echo ""

# Allow SSH (important - don't lock yourself out!)
echo "Allowing SSH (port 22)..."
ufw allow 22/tcp

# Allow HTTP and HTTPS
echo "Allowing HTTP (port 80)..."
ufw allow 80/tcp

echo "Allowing HTTPS (port 443)..."
ufw allow 443/tcp

# Allow MQTT TLS
echo "Allowing MQTT TLS (port 8883)..."
ufw allow 8883/tcp

# Deny non-TLS MQTT (if it was open)
echo "Denying non-TLS MQTT (port 1883)..."
ufw deny 1883/tcp

# Enable firewall
echo ""
echo "Enabling UFW firewall..."
ufw --force enable

echo ""
echo "=== UFW Configuration Complete ==="
echo ""
ufw status verbose

echo ""
echo "=== EC2 Security Group Configuration ==="
echo ""
echo "IMPORTANT: You must also configure the EC2 Security Group in AWS Console:"
echo ""
echo "1. Go to AWS EC2 Console → Security Groups"
echo "2. Find the security group attached to your EC2 instance"
echo "3. Add/Update Inbound Rules:"
echo "   - Type: SSH, Port: 22, Source: Your IP (or 0.0.0.0/0 if using key-based auth)"
echo "   - Type: HTTP, Port: 80, Source: 0.0.0.0/0"
echo "   - Type: HTTPS, Port: 443, Source: 0.0.0.0/0"
echo "   - Type: Custom TCP, Port: 8883, Source: 0.0.0.0/0 (for MQTT TLS)"
echo "4. Remove/Deny any rules for port 1883 (non-TLS MQTT)"
echo ""
echo "To find your instance ID, run:"
echo "  curl -s http://169.254.169.254/latest/meta-data/instance-id"
echo ""
echo "=== Security Configuration Complete ==="

