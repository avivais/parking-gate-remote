# Parking Gate Remote - MCU Firmware

Production-grade connectivity skeleton for ESP32 TTGO with A7670G cellular modem.

## Architecture

The firmware implements a non-blocking state machine that maintains reliable connectivity through:
1. Modem initialization (AT commands)
2. PPP connection over UART
3. MQTT client connection and subscriptions
4. Automatic recovery with exponential backoff

## Directory Structure

```
firmware/
├── src/
│   └── main.ino              # Main state machine driver
├── config/
│   └── config.h            # All compile-time configuration
├── modem/
│   ├── ModemManager.h      # Modem power control and AT commands
│   └── ModemManager.cpp
├── ppp/
│   ├── PppManager.h        # PPP connection management
│   └── PppManager.cpp
├── mqtt/
│   ├── MqttManager.h       # MQTT client with auto-reconnect
│   └── MqttManager.cpp
├── protocol/
│   ├── Protocol.h          # Command parsing and ACK generation
│   └── Protocol.cpp
└── util/
    ├── Backoff.h           # Exponential backoff utility
    └── Backoff.cpp
```

## State Machine

The firmware operates in the following states:

- **MODEM_INIT**: Initialize modem, AT handshake
- **PPP_CONNECTING**: Start PPP session, wait for IP
- **PPP_UP**: PPP established, ready for MQTT
- **MQTT_CONNECTING**: Connect to MQTT broker, subscribe
- **MQTT_CONNECTED**: Operational, processing commands
- **DEGRADED**: Retrying with backoff

## Recovery Logic

### MQTT Failure Recovery
- On MQTT failure, increment failure streak
- After `MQTT_FAILS_BEFORE_PPP_REBUILD` failures, rebuild PPP connection
- Uses exponential backoff between retry attempts

### PPP Failure Recovery
- On PPP failure, increment failure streak
- After `PPP_FAILS_BEFORE_MODEM_RESET` failures, hard reset modem
- Returns to MODEM_INIT state

## Configuration

Edit `config/config.h` to configure:
- Device ID
- MQTT broker settings (host, port, credentials)
- MQTT topics
- Recovery thresholds
- GPIO pins (modem control)
- UART configuration

## Dependencies

Required Arduino libraries:
- `PubSubClient` (MQTT client)
- `ArduinoJson` (JSON parsing)
- ESP32 core with PPP support

## Building

This firmware is designed for PlatformIO or Arduino IDE with ESP32 board support.

### PlatformIO

Create `platformio.ini`:
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    knolleary/PubSubClient@^2.8
    bblanchon/ArduinoJson@^6.21.0
```

### Arduino IDE

1. Install ESP32 board support
2. Install libraries via Library Manager:
   - PubSubClient
   - ArduinoJson
3. Select board: ESP32 Dev Module
4. Upload

## Protocol

The firmware implements the MQTT protocol as specified in `../docs/mqtt-protocol.md`:

- Subscribes to: `pgr/mitspe6/gate/cmd` (QoS 1)
- Publishes to: `pgr/mitspe6/gate/ack` (QoS 1)
- Publishes to: `pgr/mitspe6/gate/status` (QoS 1, every 5 seconds)

## Current Limitations

- **No GPIO gate logic**: This skeleton focuses only on connectivity
- **No TLS**: Plain MQTT connections
- **PPP implementation**: Simplified skeleton (needs AT command implementation for APN configuration)
- **RSSI reporting**: Placeholder (needs modem AT command integration)

## Next Steps

1. Implement actual PPP AT commands (APN configuration)
2. Integrate RSSI reading from modem
3. Add gate relay GPIO control
4. Add TLS support for MQTT
5. Optimize memory usage

## Testing

After flashing:
1. Monitor serial output (115200 baud)
2. Verify state transitions in logs
3. Test MQTT broker connectivity
4. Send test command via MQTT
5. Verify ACK and status messages

