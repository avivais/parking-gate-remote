#!/bin/bash
# Serial monitor troubleshooting script

echo "=========================================="
echo "ESP32 Serial Monitor Troubleshooting"
echo "=========================================="
echo ""

# Find ESP32 serial ports
echo "1. Checking for USB serial devices..."
PORTS=$(ls /dev/cu.* 2>/dev/null | grep -iE "usb|serial|ch34|cp21|ftdi|wchusb" | head -5)

if [ -z "$PORTS" ]; then
    echo "   ❌ No USB serial devices found!"
    echo "   → Make sure ESP32 is connected via USB"
    echo "   → Try a different USB cable (must be data-capable)"
    echo "   → Try a different USB port"
    exit 1
else
    echo "   ✅ Found serial ports:"
    for port in $PORTS; do
        echo "      - $port"
    done
fi

echo ""
echo "2. Checking if ports are accessible..."
for port in $PORTS; do
    if [ -c "$port" ]; then
        echo "   ✅ $port is accessible"
    else
        echo "   ❌ $port is not accessible"
    fi
done

echo ""
echo "3. Checking if ports are in use..."
for port in $PORTS; do
    if lsof "$port" 2>/dev/null | grep -q .; then
        echo "   ⚠️  $port is in use by another process"
        lsof "$port" 2>/dev/null | head -3
    else
        echo "   ✅ $port is available"
    fi
done

echo ""
echo "4. Testing serial connection..."
PRIMARY_PORT=$(echo $PORTS | awk '{print $1}')

if [ -n "$PRIMARY_PORT" ]; then
    echo "   Using port: $PRIMARY_PORT"
    echo "   Baud rate: 115200"
    echo ""
    echo "   Attempting to connect..."
    echo "   (Press Ctrl+C to exit)"
    echo ""
    echo "   If you see nothing, try:"
    echo "   - Press RESET button on ESP32"
    echo "   - Press BOOT button briefly"
    echo "   - Unplug and replug USB cable"
    echo ""
    echo "=========================================="

    # Try to connect with screen or minicom
    if command -v screen &> /dev/null; then
        screen "$PRIMARY_PORT" 115200
    elif command -v minicom &> /dev/null; then
        minicom -D "$PRIMARY_PORT" -b 115200
    else
        echo "   Installing screen for serial monitoring..."
        echo "   Run: brew install screen"
        echo ""
        echo "   Or use PlatformIO:"
        echo "   pio device monitor --port $PRIMARY_PORT"
    fi
else
    echo "   ❌ No primary port found"
fi

