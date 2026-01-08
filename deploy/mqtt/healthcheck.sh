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

# Test connection by subscribing to status topic (pgr_server has read access to this)
# Use a timeout and check if mosquitto_sub can connect
timeout 5 mosquitto_sub \
    -h localhost \
    -p 8883 \
    --cafile /mosquitto/certs/ca.crt \
    -u "$USERNAME" \
    -P "$PASSWORD" \
    -t 'pgr/mitspe6/gate/status' \
    -C 1 > /dev/null 2>&1

exit $?

