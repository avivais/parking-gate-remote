#ifndef CONFIG_H
#define CONFIG_H

// Device Identification
#define DEVICE_ID "mitspe6-gate-001"

// MQTT Broker Configuration
#define MQTT_HOST "localhost"
#define MQTT_PORT 1883
#define MQTT_USERNAME "pgr_device_mitspe6"
#define MQTT_PASSWORD "pgr_dev_password_change_me"

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

// Modem GPIO Pins (placeholders - adjust for your hardware)
#define MODEM_PWR_PIN 4      // Power enable pin
#define MODEM_RESET_PIN 5    // Reset pin
#define MODEM_PWRKEY_PIN 6   // Power key pin

// UART Configuration for Modem
#define MODEM_UART_NUM 2
#define MODEM_TX_PIN 17      // UART2 TX pin
#define MODEM_RX_PIN 16      // UART2 RX pin
#define MODEM_UART_BAUD 115200

// AT Command Timeouts (milliseconds)
#define AT_CMD_TIMEOUT_MS 5000
#define AT_INIT_TIMEOUT_MS 30000

// PPP Configuration
#define PPP_TIMEOUT_MS 60000

// Cellular APN Configuration (Cellcom Israel)
#define CELLULAR_APN "internetg"  // Alternative: "sphone"
#define CELLULAR_USERNAME ""       // Blank for Cellcom
#define CELLULAR_PASSWORD ""       // Blank for Cellcom

// Firmware Version
#define FW_VERSION "fw-dev-0.1"

#endif // CONFIG_H

