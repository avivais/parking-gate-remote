#!/bin/bash
# Generate MQTT TLS Certificates
# Run this script in the mqtt/certs directory

set -e

CERT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CERT_DIR"

echo "=== Generating MQTT TLS Certificates ==="
echo "Certificate directory: $CERT_DIR"
echo ""

# Generate CA key and certificate
echo "Step 1: Generating CA key and certificate..."
openssl genrsa -out ca.key 2048
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
    -subj "/CN=Parking Gate Remote MQTT CA/O=Parking Gate Remote/C=IL"

# Generate server key
echo "Step 2: Generating server key..."
openssl genrsa -out server.key 2048

# Generate server certificate signing request
echo "Step 3: Generating server certificate signing request..."
openssl req -new -key server.key -out server.csr \
    -subj "/CN=mqtt.mitzpe6-8.com/O=Parking Gate Remote/C=IL"

# Generate server certificate signed by CA
echo "Step 4: Signing server certificate with CA..."
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
    -CAcreateserial -out server.crt -days 3650 \
    -extensions v3_req -extfile <(
        echo "[v3_req]"
        echo "subjectAltName = @alt_names"
        echo "[alt_names]"
        echo "DNS.1 = mqtt.mitzpe6-8.com"
        echo "DNS.2 = localhost"
        echo "IP.1 = 127.0.0.1"
    )

# Set proper permissions
chmod 644 ca.crt server.crt
chmod 600 ca.key server.key
chmod 600 ca.srl 2>/dev/null || true

# Clean up CSR
rm -f server.csr

echo ""
echo "=== Certificates Generated Successfully ==="
echo ""
echo "Files created:"
echo "  - ca.crt (CA certificate - share with devices)"
echo "  - ca.key (CA private key - keep secure)"
echo "  - server.crt (Server certificate)"
echo "  - server.key (Server private key)"
echo ""
echo "Next steps:"
echo "1. Copy ca.crt to your devices for TLS verification"
echo "2. Update mosquitto.conf to use these certificates"
echo "3. Ensure proper permissions are set (already done)"

