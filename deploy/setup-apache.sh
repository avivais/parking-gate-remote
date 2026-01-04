#!/bin/bash
# Apache setup script - run on server with sudo

set -e

echo "=== Apache Configuration Setup ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Enable required modules
echo "Enabling Apache modules..."
a2enmod proxy proxy_http ssl rewrite

# Get SSL certificate for api.mitzpe6-8.com (if not already exists)
echo ""
echo "Checking SSL certificate for api.mitzpe6-8.com..."
if [ -f "/etc/letsencrypt/live/api.mitzpe6-8.com/fullchain.pem" ]; then
    echo "SSL certificate already exists, skipping certbot..."
else
    echo "Getting SSL certificate for api.mitzpe6-8.com..."
    certbot --apache -d api.mitzpe6-8.com --non-interactive --agree-tos --email admin@mitzpe6-8.com || {
        echo "Certbot failed. You may need to run manually:"
        echo "  certbot --apache -d api.mitzpe6-8.com"
    }
fi

# Copy Apache configurations
echo ""
echo "Setting up Apache virtual hosts..."

# API vhost
if [ -f "/tmp/apache-configs/apache-api.conf" ]; then
    cp /tmp/apache-configs/apache-api.conf /etc/apache2/sites-available/api.mitzpe6-8.com.conf
    echo "Created api.mitzpe6-8.com.conf"
fi

if [ -f "/tmp/apache-configs/apache-api-ssl.conf" ]; then
    cp /tmp/apache-configs/apache-api-ssl.conf /etc/apache2/sites-available/api.mitzpe6-8.com-le-ssl.conf
    echo "Created api.mitzpe6-8.com-le-ssl.conf"
fi

# Root domain redirect
if [ -f "/tmp/apache-configs/apache-root.conf" ]; then
    cp /tmp/apache-configs/apache-root.conf /etc/apache2/sites-available/mitzpe6-8.com.conf
    echo "Created mitzpe6-8.com.conf"
fi

# Update app vhost
if [ -f "/tmp/apache-configs/apache-app-ssl-updated.conf" ]; then
    cp /tmp/apache-configs/apache-app-ssl-updated.conf /etc/apache2/sites-available/app.mitzpe6-8.com-le-ssl.conf
    echo "Updated app.mitzpe6-8.com-le-ssl.conf"
fi

# Enable sites
echo ""
echo "Enabling sites..."
a2ensite api.mitzpe6-8.com
a2ensite mitzpe6-8.com

# Test configuration
echo ""
echo "Testing Apache configuration..."
apache2ctl configtest

# Reload Apache
echo ""
echo "Reloading Apache..."
systemctl reload apache2

echo ""
echo "=== Apache Configuration Complete ==="

