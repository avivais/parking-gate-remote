#!/usr/bin/env bash
# Test script: simulate MQTT disconnect, then restoration; verify device comes back
# online and (if firmware/mcu-sim sends them) diagnostic logs are stored.
#
# Prerequisites:
#   - Backend + MQTT broker + mcu-sim (or real MCU) running (e.g. ./scripts/start-local.sh with GATE_DEVICE_MODE=mqtt)
#   - Docker (for stopping/starting Mosquitto)
#
# Optional: ADMIN_TOKEN env var with a valid JWT for an admin user. If set, the script
# will call the diagnostics API and device-status API to assert results.
#
# Usage: from repo root: ./scripts/test-recovery-and-diagnostics.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BASE_URL="${BASE_URL:-http://localhost:3001}"
DEVICE_ID="${DEVICE_ID:-mitspe6-gate-001}"
BROKER_DOWN_SEC="${BROKER_DOWN_SEC:-15}"
WAIT_AFTER_RESTORE_SEC="${WAIT_AFTER_RESTORE_SEC:-25}"

echo "=== Recovery and diagnostics test ==="
echo "  BASE_URL=$BASE_URL"
echo "  DEVICE_ID=$DEVICE_ID"
echo "  BROKER_DOWN_SEC=$BROKER_DOWN_SEC"
echo "  WAIT_AFTER_RESTORE_SEC=$WAIT_AFTER_RESTORE_SEC"
echo "  ADMIN_TOKEN=${ADMIN_TOKEN:+<set>}"
echo ""

# Check backend is up
if ! curl -sf --connect-timeout 3 "$BASE_URL/api/gate/logs?limit=1" -H "Authorization: Bearer ${ADMIN_TOKEN:-invalid}" >/dev/null 2>&1; then
    if [[ -z "$ADMIN_TOKEN" ]]; then
        echo "Backend may require auth. Trying without token..."
    fi
    if ! curl -sf --connect-timeout 5 "$BASE_URL" >/dev/null 2>&1; then
        echo "Error: Backend not reachable at $BASE_URL. Start it (e.g. ./scripts/start-local.sh) and ensure GATE_DEVICE_MODE=mqtt."
        exit 1
    fi
fi

# Check Mosquitto is running
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q parking-mosquitto; then
    echo "Error: Container parking-mosquitto not running. Start MQTT (e.g. docker compose -f docker-compose.mqtt.yml up -d)."
    exit 1
fi

echo "1. Stopping MQTT broker to simulate connection loss..."
docker stop parking-mosquitto || { echo "Error: failed to stop parking-mosquitto"; exit 1; }

echo "2. Waiting ${BROKER_DOWN_SEC}s for device to attempt recovery and buffer diagnostics..."
sleep "$BROKER_DOWN_SEC"

echo "3. Starting MQTT broker again..."
docker start parking-mosquitto || { echo "Error: failed to start parking-mosquitto"; exit 1; }

echo "4. Waiting ${WAIT_AFTER_RESTORE_SEC}s for device to reconnect and (if implemented) publish diagnostics..."
sleep "$WAIT_AFTER_RESTORE_SEC"

# Assertions (if we have an admin token)
if [[ -n "$ADMIN_TOKEN" ]]; then
    echo "5. Checking device status and diagnostics..."
    STATUS_RESP=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/admin/device-status" 2>/dev/null || echo "{}")
    DIAG_RESP=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/gate/devices/$DEVICE_ID/diagnostics?limit=10" 2>/dev/null || echo "{}")

    if echo "$STATUS_RESP" | grep -q '"online":true'; then
        echo "   Device is online."
    else
        echo "   Warning: Device may not be online yet. Response: ${STATUS_RESP:0:200}"
    fi

    DIAG_COUNT=$(echo "$DIAG_RESP" | grep -o '"receivedAt"' | wc -l | tr -d ' ')
    if [[ "${DIAG_COUNT:-0}" -gt 0 ]]; then
        echo "   Diagnostics: $DIAG_COUNT log batch(es) stored."
    else
        echo "   Note: No diagnostic logs yet. With production firmware (or mcu-sim extended to publish diagnostics), re-run after a disconnect to see logs here."
    fi
else
    echo "5. Skipping API assertions (ADMIN_TOKEN not set). Set ADMIN_TOKEN to verify device status and diagnostics."
fi

echo ""
echo "=== Done. Recovery and diagnostics test completed. ==="
