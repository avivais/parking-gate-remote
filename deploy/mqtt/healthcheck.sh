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

# Test connection by subscribing to a system topic
timeout 5 mosquitto_sub \
    -h localhost \
    -p 8883 \
    --cafile /mosquitto/certs/ca.crt \
    -u "$USERNAME" \
    -P "$PASSWORD" \
    -t '$SYS/#' \
    -C 1 > /dev/null 2>&1

exit $?

