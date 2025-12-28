# MQTT Test Build Instructions

This is a simplified test firmware that connects to HiveMQ Cloud broker for testing MQTT connectivity.

## Features

- Connects to WiFi (no modem/PPP required)
- Connects to HiveMQ Cloud MQTT broker with TLS
- Subscribes to `test-incoming` topic
- Publishes test messages to `test-sent-message` topic every 5 seconds
- Displays all received messages on serial monitor

## Configuration

Before building, edit `src/main_test.ino` and set your WiFi credentials:

```cpp
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
```

## MQTT Broker Details

- **Host**: `3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud`
- **Port**: `8883` (TLS)
- **Username**: `avivais`
- **Password**: `Avivr_121`

## Topics

- **Subscribe**: `test-incoming` (QoS 1)
- **Publish**: `test-sent-message` (QoS 0)

## Building

### PlatformIO

1. Create or update `platformio.ini`:
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    knolleary/PubSubClient@^2.8
monitor_speed = 115200
```

2. Rename `src/main_test.ino` to `src/main.ino` (or create a separate environment)

3. Build and upload:
```bash
pio run -t upload
pio device monitor
```

### Arduino IDE

1. Install ESP32 board support
2. Install PubSubClient library
3. Open `src/main_test.ino`
4. Set WiFi credentials
5. Select board: ESP32 Dev Module
6. Upload

## Testing

1. **Monitor Serial Output** (115200 baud):
   - Should see WiFi connection
   - Should see MQTT connection
   - Should see subscription confirmation
   - Should see periodic publish messages

2. **Send Test Message** (using MQTT client):
   ```bash
   mosquitto_pub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud \
     -p 8883 --cafile /path/to/ca.crt \
     -u avivais -P Avivr_121 \
     -t test-incoming -m "Hello from test client"
   ```

   The ESP32 should display the message on serial monitor.

3. **Monitor Published Messages**:
   ```bash
   mosquitto_sub -h 3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud \
     -p 8883 --cafile /path/to/ca.crt \
     -u avivais -P Avivr_121 \
     -t test-sent-message
   ```

   Should see messages every 5 seconds.

## Notes

- Uses `setInsecure()` for TLS (skips certificate validation) - suitable for testing only
- For production, use proper CA certificate validation
- WiFi credentials must be set before building
- Serial monitor shows all MQTT activity

