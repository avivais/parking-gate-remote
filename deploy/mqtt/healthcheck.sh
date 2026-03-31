#!/bin/sh
# Healthcheck script for Mosquitto MQTT broker
# Tests connection with credentials

# Use pgr_server user for healthcheck (has read permissions)
USERNAME="pgr_server"
PASSWORD="${MQTT_SERVER_PASSWORD}"

if [ -z "$PASSWORD" ]; then
    echo "MQTT_SERVER_PASSWORD not set"
    exit 1
fi

# Test broker health by connecting and publishing a no-payload message.
# This avoids depending on the MCU being online/publishing, and avoids spawning `timeout(1)`.
mosquitto_pub \
    -h localhost \
    -p 8883 \
    --cafile /mosquitto/certs/ca.crt \
    -u "$USERNAME" \
    -P "$PASSWORD" \
    -t 'pgr/healthcheck' \
    -n > /dev/null 2>&1

exit $?

