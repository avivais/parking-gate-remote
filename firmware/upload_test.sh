#!/bin/bash
# Upload script for main_test.ino
# This script temporarily swaps main.ino with main_test.ino, uploads, then restores

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${SCRIPT_DIR}/src"
MAIN_FILE="${SRC_DIR}/main.ino"
TEST_FILE="${SRC_DIR}/main_test.ino.bak"
BACKUP_FILE="${SRC_DIR}/main.ino.backup"

echo "=========================================="
echo "Uploading main_test.ino"
echo "=========================================="

# Check if test file exists
if [ ! -f "${TEST_FILE}" ]; then
    echo "Error: ${TEST_FILE} not found!"
    exit 1
fi

# Backup main.ino if it exists
if [ -f "${MAIN_FILE}" ]; then
    echo "Backing up main.ino..."
    cp "${MAIN_FILE}" "${BACKUP_FILE}"
fi

# Restore test file
echo "Restoring main_test.ino..."
cp "${TEST_FILE}" "${MAIN_FILE}"

# Upload
echo "Uploading to ESP32..."
if command -v pio &> /dev/null; then
    pio run -t upload
else
    ~/.platformio/penv/bin/platformio run -t upload
fi

UPLOAD_RESULT=$?

# Restore main.ino
if [ -f "${BACKUP_FILE}" ]; then
    echo "Restoring main.ino..."
    mv "${BACKUP_FILE}" "${MAIN_FILE}"
else
    # If no backup, remove the test file
    rm -f "${MAIN_FILE}"
fi

if [ $UPLOAD_RESULT -eq 0 ]; then
    echo "=========================================="
    echo "Upload successful!"
    echo "=========================================="
    echo ""
    echo "To monitor serial output, run:"
    echo "  pio device monitor"
    echo "  (or ~/.platformio/penv/bin/platformio device monitor)"
else
    echo "=========================================="
    echo "Upload failed!"
    echo "=========================================="
    exit $UPLOAD_RESULT
fi

