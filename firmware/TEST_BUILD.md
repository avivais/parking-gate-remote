# MQTT Test Build Instructions

This is a test firmware that uses **cellular connectivity only** (no WiFi) to connect to HiveMQ Cloud MQTT broker via TLS over the A7670G cellular modem.

## Features

- **Cellular-only connectivity** via Cellcom Israel APN (`sphone`)
- **TLS/SSL encrypted MQTT** connection to HiveMQ Cloud
- Uses modem's built-in MQTT client (via lewisxhe TinyGSM fork)
- State machine pattern for robust connectivity management
- Automatic reconnection with exponential backoff
- Displays all state transitions and MQTT activity on serial monitor

## Prerequisites

- ESP32 development board with A7670G cellular modem (LilyGo T-A7670)
- Cellcom Israel SIM card (or compatible SIM)
- USB cable for programming and serial monitoring
- PlatformIO installed and configured

## Configuration

### Cellular Settings

Edit `src/config/config.h`:

```cpp
// Cellular APN Configuration (Cellcom Israel)
#define CELLULAR_APN "sphone"      // Cellcom Israel APN
#define CELLULAR_USERNAME ""       // Blank for Cellcom
#define CELLULAR_PASSWORD ""       // Blank for Cellcom
```

### MQTT Broker Settings

The firmware is configured for HiveMQ Cloud with TLS:

```cpp
// MQTT Broker Configuration (HiveMQ Cloud)
#define MQTT_HOST "3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883  // TLS port
#define MQTT_USERNAME "avivais"
#define MQTT_PASSWORD "Avivr_121"
```

### TLS Certificate

The HiveMQ root CA certificate is stored in `src/config/HivemqRootCA.h` and is used for secure TLS connections.

## Building

### Quick Build

```bash
cd ~/Development/parking-gate-remote/firmware
pio run
```

### Build and Upload

```bash
cd ~/Development/parking-gate-remote/firmware
pio run -t upload --upload-port /dev/cu.wchusbserial589A0084711
```

## Uploading to ESP32

### Find Your Serial Port

```bash
pio device list
```

Common ports:
- macOS: `/dev/cu.wchusbserial589A0084711` or `/dev/cu.usbserial-*`
- Linux: `/dev/ttyUSB0` or `/dev/ttyACM0`
- Windows: `COM3`, `COM4`, etc.

### Upload Command

```bash
pio run -t upload --upload-port /dev/cu.wchusbserial589A0084711
```

### Troubleshooting Upload

If upload fails:

1. **Check USB connection**: Ensure ESP32 is connected via USB
2. **Find the port**: `pio device list`
3. **Try boot mode**: Press and hold BOOT button during upload
4. **Lower upload speed**: Edit `platformio.ini`:
   ```ini
   upload_speed = 115200  # Instead of 921600
   ```

## Monitoring Serial Output

### Start Serial Monitor

```bash
pio device monitor --port /dev/cu.wchusbserial589A0084711 --baud 115200
```

### Expected Serial Output (Successful Connection)

```
========================================
MQTT Test Firmware - Cellular Only
Using Cellcom Israel APN
========================================

=== CONFIGURATION VALUES ===
Device ID: mitspe6-gate-001
FW Version: fw-dev-0.1
APN: sphone
...

[Test] Starting in TEST_MODEM_INIT state
[Modem] Initializing hardware...
[Modem] AT handshake OK
[Modem] Echo disabled
[Modem] Initialization complete

[Test] Modem initialized, starting PPP...
[PPP] Starting PPP session with TinyGSM...
[PPP] TinyGSM initialized
[PPP] PPP connection initiated
[PPP] Skipping SIM check (ModemManager already verified)
[PPP] Starting network registration...
[PPP] Waiting for network registration... Signal: 26
[PPP] Registered on home network
[PPP] Setting APN: sphone
[PPP] APN set successfully
[PPP] Activating network...
[PPP] Network activated
[PPP] IP address: XX.XX.XX.XX
[PPP] PPP is UP

[Test] PPP connected!
[Test] PPP up, setting up MQTT...
[Test] Linking MqttManager to PppManager...
[MQTT] Using modem's built-in MQTT client (supports TLS/SSL)
[Test] Initializing modem MQTT with TLS...
[MQTT] Initializing modem MQTT client...
[MQTT] SSL: enabled
[MQTT] SNI: enabled
[MQTT] Setting root CA certificate...
[MQTT] Modem MQTT initialized
[Test] Modem MQTT initialized with TLS

[Test] Network ready, connecting to MQTT...
[MQTT] Connecting to broker 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud:8883...
[MQTT] Connected to broker
[MQTT] Subscribed to pgr/mitspe6/gate/cmd

[Test] MQTT connected!
[Test] Published: Test message #1 from ESP32 at XXXXX
[Test] Published: Test message #2 from ESP32 at XXXXX
...
```

## State Machine Flow

The firmware uses a state machine with these states:

1. **TEST_MODEM_INIT** → Initialize cellular modem (AT commands, power-on)
2. **TEST_PPP_CONNECTING** → Establish cellular data connection
   - Wait for network registration
   - Set APN
   - Activate network
   - Get IP address
3. **TEST_PPP_UP** → PPP connected, initialize MQTT
   - Link MqttManager to PppManager
   - Initialize modem MQTT with TLS certificate
4. **TEST_MQTT_CONNECTING** → Connect to HiveMQ Cloud
5. **TEST_MQTT_CONNECTED** → Operational, publishing test messages every 5 seconds

## Architecture

### Key Components

- **ModemManager**: Handles modem power-on, AT handshake, and hardware init
- **PppManager**: Manages cellular data connection using TinyGSM (lewisxhe fork)
- **MqttManager**: Uses modem's built-in MQTT client for TLS connections

### TinyGSM Fork

This project uses the [lewisxhe TinyGSM fork](https://github.com/lewisxhe/TinyGSM) which includes:
- Modem built-in MQTT support (`mqtt_begin`, `mqtt_connect`, `mqtt_publish`, etc.)
- TLS/SSL certificate handling
- SNI (Server Name Indication) support

## Troubleshooting

### Modem Not Initializing

- Check SIM card is inserted correctly
- Verify power connections
- Check serial connections (TX: 26, RX: 27)
- Ensure DTR pin (25) is set LOW

### Network Registration Fails

- Check SIM card has active data plan
- Verify signal strength in logs (`Signal: XX`)
- Wait longer - registration can take 30+ seconds in weak signal areas
- Check if SIM is locked (should show `+CPIN: READY` at boot)

### PPP Connection Fails

- Verify APN settings (`sphone` for Cellcom Israel)
- Check network registration succeeded first
- Try power cycling the modem

### MQTT Connection Fails

- Verify MQTT credentials in config.h
- Check PPP is UP and has IP address
- Ensure TLS certificate is correctly loaded
- Check HiveMQ Cloud cluster is active

### No Serial Output

- Verify USB cable is data-capable (not charge-only)
- Check correct serial port: `pio device list`
- Try different USB port
- Check baud rate matches (115200)

## Files Overview

| File | Purpose |
|------|---------|
| `src/main.ino` | Main test firmware (currently active) |
| `src/main.ino.production` | Production firmware (backup) |
| `src/main_test.ino.bak` | Test firmware backup |
| `src/config/config.h` | Configuration constants |
| `src/config/HivemqRootCA.h` | HiveMQ TLS root certificate |
| `src/tinygsm_pre.h` | TinyGSM modem model definition |
| `src/utilities.h` | Board pin definitions |
| `src/modem/ModemManager.*` | Modem initialization |
| `src/ppp/PppManager.*` | Cellular data connection |
| `src/mqtt/MqttManager.*` | MQTT client using modem API |

## Notes

- **Cellular-only**: This firmware does NOT use WiFi - all connectivity is via cellular modem
- **TLS Required**: HiveMQ Cloud requires TLS on port 8883
- **Modem MQTT**: Uses the modem's built-in MQTT client, not PubSubClient
- **DNS**: Handled by modem internally (no ESP32 DNS needed)
- **lewisxhe Fork**: Required for modem MQTT support (standard TinyGSM won't work)
