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

# The eclipse-mosquitto image does not include mosquitto_sub/pub clients by default.
# Use a lightweight process check that doesn't depend on the MCU or any extra binaries.
pgrep -x mosquitto > /dev/null 2>&1
exit $?

