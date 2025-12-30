#!/bin/bash
# Quick test to see if we can connect to serial port

PORT="/dev/cu.usbserial-589A0084711"
BAUD=115200

echo "Testing serial connection to $PORT at $BAUD baud..."
echo "Press Ctrl+C to exit"
echo ""
echo "If you see nothing, try:"
echo "1. Press RESET button on ESP32"
echo "2. Unplug and replug USB cable"
echo "3. Try the other port: /dev/cu.wchusbserial589A0084711"
echo ""

if command -v screen &> /dev/null; then
    screen "$PORT" "$BAUD"
elif command -v minicom &> /dev/null; then
    minicom -D "$PORT" -b "$BAUD"
else
    echo "Installing screen: brew install screen"
    echo "Or use: pio device monitor --port $PORT"
fi
