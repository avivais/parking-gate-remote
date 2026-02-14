#!/usr/bin/env bash
# Backward-compatible wrapper: runs e2e recovery in broker-down mode.
# Use ./scripts/e2e-recovery-diagnostics.sh --broker-down or --sim-disconnect directly for more control.
#
# Prerequisites: Backend + MQTT broker + mcu-sim (or real MCU) running (e.g. ./scripts/start-local.sh with GATE_DEVICE_MODE=mqtt).
# Optional: ADMIN_TOKEN for API assertions (script exits non-zero if assertions fail).
#
# Usage: from repo root: ./scripts/test-recovery-and-diagnostics.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/e2e-recovery-diagnostics.sh" --broker-down
