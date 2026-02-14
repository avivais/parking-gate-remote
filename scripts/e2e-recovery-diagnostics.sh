#!/usr/bin/env bash
# E2E: lose connection → recover → send diagnostics; assert device online and diagnostics API.
#
# Modes:
#   --broker-down    Stop Mosquitto, wait, start it again; device (mcu-sim or real MCU) reconnects
#                    and (if MCU_DIAGNOSTICS_ON_RECONNECT) publishes diagnostics. Default.
#   --sim-disconnect Start mcu-sim in background with MCU_DISCONNECT_AFTER_MS and
#                    MCU_DIAGNOSTICS_ON_RECONNECT=true; wait for disconnect/reconnect and assert.
#
# Prerequisites:
#   Backend reachable at BASE_URL. For --broker-down: Docker, Mosquitto running, device already
#   running (e.g. ./scripts/start-local.sh with GATE_DEVICE_MODE=mqtt). For --sim-disconnect:
#   Backend + Mosquitto running; mcu-sim will be started by this script.
#
# Env: BASE_URL, DEVICE_ID, ADMIN_TOKEN (optional; if set, assertions run and script exits
#   non-zero on failure). Broker-down: BROKER_DOWN_SEC, WAIT_AFTER_RESTORE_SEC. Sim-disconnect:
#   SIM_DISCONNECT_MS (default 5000), SIM_WAIT_AFTER_RECONNECT_SEC (default 28),
#   MQTT_DEVICE_PASSWORD (required for --sim-disconnect).
#
# Usage: from repo root: ./scripts/e2e-recovery-diagnostics.sh [--broker-down|--sim-disconnect]

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:---broker-down}"
BASE_URL="${BASE_URL:-http://localhost:3001}"
DEVICE_ID="${DEVICE_ID:-mitspe6-gate-001}"
BROKER_DOWN_SEC="${BROKER_DOWN_SEC:-15}"
WAIT_AFTER_RESTORE_SEC="${WAIT_AFTER_RESTORE_SEC:-25}"
SIM_DISCONNECT_MS="${SIM_DISCONNECT_MS:-5000}"
SIM_WAIT_AFTER_RECONNECT_SEC="${SIM_WAIT_AFTER_RECONNECT_SEC:-28}"
MCU_SIM_PID=""
MCU_SIM_LOG="$REPO_ROOT/mcu-sim-e2e.log"

cleanup_sim() {
    if [[ -n "$MCU_SIM_PID" ]] && kill -0 "$MCU_SIM_PID" 2>/dev/null; then
        kill "$MCU_SIM_PID" 2>/dev/null || true
        wait "$MCU_SIM_PID" 2>/dev/null || true
    fi
    MCU_SIM_PID=""
}
trap cleanup_sim EXIT

assert_backend() {
    # No -f: Nest returns 404 for GET /; we only need to reach the server (any response = up)
    if ! curl -s --connect-timeout 5 -o /dev/null "$BASE_URL" 2>/dev/null; then
        echo "Error: Backend not reachable at $BASE_URL. Start it (e.g. ./scripts/start-local.sh)."
        exit 1
    fi
}

assert_diagnostics_api() {
    local diag_resp
    local diag_count
    local status_resp
    if [[ -z "$ADMIN_TOKEN" ]]; then
        echo "   Skipping API assertions (ADMIN_TOKEN not set)."
        return 0
    fi
    status_resp=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/admin/device-status" 2>/dev/null || echo "{}")
    diag_resp=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/api/gate/devices/$DEVICE_ID/diagnostics?limit=10" 2>/dev/null || echo "{}")
    if ! echo "$status_resp" | grep -q '"online":true'; then
        echo "   FAIL: Device not online. Response: ${status_resp:0:300}"
        return 1
    fi
    echo "   Device is online."
    diag_count=$(echo "$diag_resp" | grep -o '"receivedAt"' | wc -l | tr -d ' ')
    if [[ "${diag_count:-0}" -lt 1 ]]; then
        echo "   FAIL: No diagnostic batches. Expected at least one after reconnect with MCU_DIAGNOSTICS_ON_RECONNECT=true."
        return 1
    fi
    echo "   Diagnostics: $diag_count batch(es) stored."
    return 0
}

run_broker_down() {
    echo "=== E2E Recovery (broker-down) ==="
    echo "  BASE_URL=$BASE_URL"
    echo "  DEVICE_ID=$DEVICE_ID"
    echo "  BROKER_DOWN_SEC=$BROKER_DOWN_SEC"
    echo "  WAIT_AFTER_RESTORE_SEC=$WAIT_AFTER_RESTORE_SEC"
    echo "  ADMIN_TOKEN=${ADMIN_TOKEN:+<set>}"
    echo ""

    assert_backend
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q parking-mosquitto; then
        echo "Error: Container parking-mosquitto not running. Start MQTT (e.g. docker compose -f docker-compose.mqtt.yml up -d)."
        exit 1
    fi

    echo "1. Stopping MQTT broker..."
    docker stop parking-mosquitto || { echo "Error: failed to stop parking-mosquitto"; exit 1; }
    echo "2. Waiting ${BROKER_DOWN_SEC}s..."
    sleep "$BROKER_DOWN_SEC"
    echo "3. Starting MQTT broker..."
    docker start parking-mosquitto || { echo "Error: failed to start parking-mosquitto"; exit 1; }
    echo "4. Waiting ${WAIT_AFTER_RESTORE_SEC}s for reconnect and diagnostics..."
    sleep "$WAIT_AFTER_RESTORE_SEC"
    echo "5. Asserting device status and diagnostics..."
    if ! assert_diagnostics_api; then
        exit 1
    fi
    print_broker_down_reminder
    echo ""
    echo "=== E2E (broker-down) passed. ==="
}

print_broker_down_reminder() {
    if [[ -z "$ADMIN_TOKEN" ]]; then
        echo ""
        echo "Note: ADMIN_TOKEN not set — API assertions were skipped. Set ADMIN_TOKEN to verify device and diagnostics."
    fi
    echo ""
    echo "For diagnostics to be stored, the device (mcu-sim or real MCU) must publish on reconnect."
    echo "  - mcu-sim: start with MCU_DIAGNOSTICS_ON_RECONNECT=true (./scripts/start-local.sh does this)."
    echo "  - If you just changed that, restart the simulator (or run ./scripts/stop-local.sh && ./scripts/start-local.sh)."
}

run_sim_disconnect() {
    echo "=== E2E Recovery (sim-disconnect) ==="
    echo "  BASE_URL=$BASE_URL"
    echo "  DEVICE_ID=$DEVICE_ID"
    echo "  SIM_DISCONNECT_MS=$SIM_DISCONNECT_MS"
    echo "  SIM_WAIT_AFTER_RECONNECT_SEC=$SIM_WAIT_AFTER_RECONNECT_SEC"
    echo "  ADMIN_TOKEN=${ADMIN_TOKEN:+<set>}"
    echo ""

    assert_backend
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q parking-mosquitto; then
        echo "Error: Container parking-mosquitto not running. Start MQTT first (e.g. ./scripts/start-local.sh with GATE_DEVICE_MODE=mqtt)."
        exit 1
    fi
    if [[ -z "$MQTT_DEVICE_PASSWORD" ]]; then
        echo "Error: MQTT_DEVICE_PASSWORD required for --sim-disconnect (e.g. pgr_device_local)."
        exit 1
    fi

    # Stop any existing mcu-sim so we own the only one
    pkill -f "node.*mcu-sim/src/index" 2>/dev/null || true
    sleep 2

    echo "1. Starting MCU simulator (disconnect after ${SIM_DISCONNECT_MS}ms, diagnostics on reconnect)..."
    rm -f "$MCU_SIM_LOG"
    (cd "$REPO_ROOT/mcu-sim" && \
        NO_COLOR=1 \
        MQTT_URL="${MQTT_URL:-mqtt://localhost:1883}" \
        MQTT_DEVICE_PASSWORD="$MQTT_DEVICE_PASSWORD" \
        MCU_DEVICE_ID="$DEVICE_ID" \
        MCU_DISCONNECT_AFTER_MS="$SIM_DISCONNECT_MS" \
        MCU_DIAGNOSTICS_ON_RECONNECT=true \
        node src/index.js >> "$MCU_SIM_LOG" 2>&1) &
    MCU_SIM_PID=$!
    echo "2. Waiting ${SIM_WAIT_AFTER_RECONNECT_SEC}s for disconnect and reconnect + diagnostics publish..."
    sleep "$SIM_WAIT_AFTER_RECONNECT_SEC"
    echo "3. Asserting device status and diagnostics..."
    if ! assert_diagnostics_api; then
        echo "   Simulator log (last 40 lines):"
        tail -40 "$MCU_SIM_LOG" 2>/dev/null || true
        exit 1
    fi
    echo ""
    echo "=== E2E (sim-disconnect) passed. ==="
}

case "$MODE" in
    --broker-down)
        run_broker_down
        ;;
    --sim-disconnect)
        run_sim_disconnect
        ;;
    *)
        echo "Usage: $0 [--broker-down|--sim-disconnect]"
        echo "  --broker-down    (default) Stop/start Mosquitto; device reconnects and may send diagnostics."
        echo "  --sim-disconnect Start mcu-sim with voluntary disconnect; assert diagnostics API."
        exit 1
        ;;
esac
