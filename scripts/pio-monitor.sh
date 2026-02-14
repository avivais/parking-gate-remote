#!/usr/bin/env bash
# Run PlatformIO device monitor with project config (115200 baud).
# Usage: from repo root: ./scripts/pio-monitor.sh
# Or:    cd firmware && pio device monitor
set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/firmware"
exec pio device monitor "$@"
