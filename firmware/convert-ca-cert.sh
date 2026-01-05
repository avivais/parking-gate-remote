#!/bin/bash
# Convert production CA certificate to ProductionRootCA.h header file
# Usage: ./convert-ca-cert.sh /path/to/ca.crt

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-ca.crt>"
    echo ""
    echo "Example:"
    echo "  # Copy certificate from server first:"
    echo "  scp -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com:/opt/parking-gate-remote/mqtt/certs/ca.crt /tmp/prod-ca.crt"
    echo ""
    echo "  # Then convert it:"
    echo "  $0 /tmp/prod-ca.crt"
    exit 1
fi

CA_CERT_FILE="$1"
OUTPUT_FILE="src/config/ProductionRootCA.h"

if [ ! -f "$CA_CERT_FILE" ]; then
    echo "Error: Certificate file not found: $CA_CERT_FILE"
    exit 1
fi

echo "Converting CA certificate to ProductionRootCA.h..."
echo "Input: $CA_CERT_FILE"
echo "Output: $OUTPUT_FILE"
echo ""

# Create the header file
cat > "$OUTPUT_FILE" << 'EOF'
#include <pgmspace.h>
// Production MQTT CA Certificate
// Generated from production server CA certificate
static const char ProductionRootCA[] PROGMEM =
EOF

# Convert certificate to C string format (matching HivemqRootCA.h format)
# Each line becomes a string with \r\n and backslash continuation
FIRST_LINE=true
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    if [ -z "$line" ]; then
        continue
    fi
    # Add backslash continuation for all lines except the last
    if [ "$FIRST_LINE" = true ]; then
        printf "\"$line\\r\\n\"   \\\n" >> "$OUTPUT_FILE"
        FIRST_LINE=false
    else
        # Check if this is the last line (END CERTIFICATE)
        if echo "$line" | grep -q "END CERTIFICATE"; then
            printf "\"$line\\r\\n\";\n" >> "$OUTPUT_FILE"
        else
            printf "\"$line\\r\\n\"   \\\n" >> "$OUTPUT_FILE"
        fi
    fi
done < "$CA_CERT_FILE"

echo "✓ Successfully created $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Verify the certificate content looks correct"
echo "2. Update firmware/src/config/config.h with production MQTT password"
echo "3. Build and flash: pio run -t upload"

