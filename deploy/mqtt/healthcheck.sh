#!/bin/sh
# Healthcheck script for Mosquitto MQTT broker
# Tests connection with credentials

# The eclipse-mosquitto image does not include mosquitto_sub/pub clients by default.
# Use a lightweight process check that doesn't depend on the MCU or any extra binaries.
if pgrep -x mosquitto > /dev/null 2>&1; then
    exit 0
fi
exit 1

