#ifndef CONFIG_H
#define CONFIG_H

// Device Identification
#define DEVICE_ID "mitspe6-gate-001"

// MQTT Broker Configuration (HiveMQ Cloud)
#define MQTT_HOST "3bde4a57fee14109aa72d3b805d645c5.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883  // TLS port
#define MQTT_USERNAME "avivais"
#define MQTT_PASSWORD "Avivr_121"

// MQTT Topics
#define MQTT_CMD_TOPIC "pgr/mitspe6/gate/cmd"
#define MQTT_ACK_TOPIC "pgr/mitspe6/gate/ack"
#define MQTT_STATUS_TOPIC "pgr/mitspe6/gate/status"

// Status Heartbeat Interval (milliseconds)
#define STATUS_INTERVAL_MS 5000

// Recovery Thresholds
#define MQTT_FAILS_BEFORE_PPP_REBUILD 3
#define PPP_FAILS_BEFORE_MODEM_RESET 2

// Exponential Backoff Configuration
#define BACKOFF_BASE_MS 1000
#define BACKOFF_MAX_MS 60000

// Modem GPIO Pins (LILYGO_T_A7670 configuration)
// Based on working POC - DO NOT CHANGE without hardware verification
#define BOARD_PWRKEY_PIN 4      // Power key pin (boot sequence)
#define BOARD_POWERON_PIN 12    // Power enable pin (must be HIGH for modem power)
#define MODEM_RESET_PIN 5       // Reset pin
#define MODEM_RESET_LEVEL HIGH  // Reset is active HIGH for A7670
#define MODEM_DTR_PIN 25        // DTR pin (must be LOW to prevent sleep)

// UART Configuration for Modem (LILYGO_T_A7670)
// Uses Serial1 (SerialAT), not HardwareSerial with UART number
#define MODEM_TX_PIN 26         // Serial1 TX pin
#define MODEM_RX_PIN 27         // Serial1 RX pin
#define MODEM_UART_BAUD 115200

// Power on pulse width (A7670 specific)
#define MODEM_POWERON_PULSE_WIDTH_MS 100

// AT Command Timeouts (milliseconds)
#define AT_CMD_TIMEOUT_MS 5000
#define AT_INIT_TIMEOUT_MS 30000

// PPP Configuration
#define PPP_TIMEOUT_MS 60000

// Cellular APN Configuration (Cellcom Israel)
#define CELLULAR_APN "sphone"  // Alternative: "sphone"
#define CELLULAR_USERNAME ""       // Blank for Cellcom
#define CELLULAR_PASSWORD ""       // Blank for Cellcom

// DNS Configuration (Google Public DNS)
#define DNS_PRIMARY "8.8.8.8"
#define DNS_SECONDARY "8.8.4.4"

// Firmware Version
#define FW_VERSION "fw-dev-0.1"

#endif // CONFIG_H

